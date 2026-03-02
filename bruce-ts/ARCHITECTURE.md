# Bruce-ts 架构说明

本文档按**主题**组织，便于快速理解设计并参与维护与迭代。

---

## 1. 概述与设计目标

**Bruce-ts** 是一个自实现的、带「技能（skills）」能力的 LLM Agent 客户端，核心不依赖 Pi 等外部 agent 框架，便于在仓库内直接优化与扩展。

- **运行位置**：在用户环境（Node）中运行，数据在本地，权限面小。
- **与 Python 的关系**：Python 目录 `../bruce` 负责后端服务（API、沙箱、审计）；本仓库负责客户端 Agent 与技能调用。
- **技能协议**：兼容 Anthropic 风格的 skills（`<available_skills>` XML、SKILL.md、scripts/ 等），与 Python 侧约定一致。

---

## 2. 目录与分层

```
src/
├── index.ts          # 包入口，统一再导出
├── cli.ts            # 命令行入口
├── agent/            # 【主题一】Agent 引擎：循环、事件、状态
├── ai/               # 【主题二】大模型厂商适配
└── bruce/            # 【主题三】Bruce 技能层：注册表、提示、工具、门面
```

| 层级 | 目录 | 职责 |
|------|------|------|
| 入口 | `index.ts`, `cli.ts` | 对外 API 与 CLI，只做组装与转发 |
| 引擎 | `agent/` | 与厂商无关的 Agent 循环、消息类型、事件流、EngineAgent 类 |
| 厂商 | `ai/` | 统一 LLM 接口（Provider）、OpenAI 兼容实现、createProvider |
| 业务 | `bruce/` | Skill 发现、system prompt 构建、四大工具实现、对外 Agent 门面 |

依赖方向：`bruce` → `agent`、`bruce` → `ai`；`agent` → `ai`（仅类型与 Provider 接口）。`agent` 不依赖 `bruce`。

---

## 3. 主题一：Agent 引擎（`src/agent/`）

引擎层提供「消息 + 工具 → LLM → 工具执行 → 再 LLM」的通用循环，不关心具体技能或厂商实现。

### 3.1 核心文件

| 文件 | 作用 |
|------|------|
| `types.ts` | `AgentMessage`（user/assistant/toolResult）、`AgentContext`、`AgentTool`、`AgentLoopConfig`、`AgentEvent` 等 |
| `event-stream.ts` | `createAgentStream()`：可 push 事件、可 `for await` 消费的异步迭代流，用于把循环内事件抛给上层 |
| `agent-loop.ts` | `agentLoop(prompts, context, config)` / `agentLoopContinue(context, config)`：实现 turn 循环与工具执行 |
| `agent.ts` | **EngineAgent** 类：维护 systemPrompt、messages、tools，提供 `prompt()`、`continue()`、`subscribe()` |

### 3.2 消息与上下文

- **AgentMessage**：引擎内统一消息类型  
  - `UserMessage`：`role: "user", content: string`  
  - `AssistantMessage`：`role: "assistant", content, tool_calls?`  
  - `ToolResultMessage`：`role: "toolResult", toolCallId, toolName, content`
- **AgentContext**：`{ systemPrompt, messages: AgentMessage[], tools?: AgentTool[] }`，每次调用 LLM 前会据此拼好「发给厂商」的入参。
- **AgentTool**：`name`、`description`、`parameters`（schema）、`execute(toolCallId, args, signal)`。引擎在循环里按 `tool_calls` 的 `name` 查找并执行，不关心工具的业务含义。

### 3.3 循环逻辑（agent-loop）

1. **agentLoop(prompts, context, config)**：把 `prompts` 追加进 context，启动循环。
2. **runLoop** 内层：
   - 若有 pending 消息（steering/follow-up），先注入并 emit 事件。
   - 调用 `getAssistantResponse(context, config)`：用 `convertToLlm` 把 `AgentMessage[]` 转成 `ChatMessage[]`，再 `config.provider.chat(...)` 拿一条 assistant 消息。
   - 若有 `tool_calls`，则 `executeToolCalls`：按 name 找工具、执行、把结果压成 `ToolResultMessage` 追加进 context，并 push 各类事件；支持中途 `getSteeringMessages` 打断剩余工具。
   - 发出 `turn_end`，再根据 `getSteeringMessages` 决定下一轮是否有 pending。
3. **runLoop** 外层：当本轮的 tool 都处理完后，调用 `getFollowUpMessages`；若有则当作下一轮 pending 继续，否则 `agent_end` 并 `stream.end(messages)`。

Steering / follow-up 为可选；CLI 单轮对话一般不配，引擎仍可正常运行。

### 3.4 事件流（event-stream）

- `createAgentStream()` 返回带 `push(event)`、`end(messages)` 和 `[Symbol.asyncIterator]` 的对象。
- 循环中通过 `stream.push(AgentEvent)` 发出：`agent_start`、`turn_start`、`message_start`/`message_end`、`tool_execution_start`/`tool_execution_end`、`turn_end`、`agent_end`。
- 消费方 `for await (const event of stream)`，在 `agent_end` 时迭代结束，并可拿到最终 `messages`。
- EngineAgent 在 `prompt()`/`continue()` 里消费该流，更新自身 `messages` 并转发给 `subscribe` 的监听器。

### 3.5 扩展与维护要点

- **改循环行为**：改 `agent-loop.ts` 的 `runLoop`、`getAssistantResponse`、`executeToolCalls`。
- **改消息/事件形态**：改 `types.ts` 中 `AgentMessage`、`AgentEvent`，再在 agent-loop 和 event-stream 的 push 处对齐。
- **增加引擎级能力**：在 `AgentLoopConfig` 加可选回调或参数，在 `agent-loop` 和 `EngineAgent`（agent/agent.ts）中接入。

---

## 4. 主题二：AI 层 / 厂商适配（`src/ai/`）

AI 层定义「一次 LLM 调用」的接口，并由具体厂商实现，与 agent 循环解耦。

### 4.1 核心类型（types.ts）

- **ChatMessage**：发给 LLM 的消息，兼容 OpenAI 的 system/user/assistant/tool。
- **ChatTool**：OpenAI Function Calling 风格的工具定义（name、description、parameters）。
- **ChatResult**：一次 completion 的返回：`{ message: { role, content, tool_calls? }, usage? }`。
- **ChatOptions**：`model`、`temperature`、`max_tokens`、`tools`、`signal`。
- **LLMProvider**：接口 `chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult>`。

### 4.2 实现与工厂

| 文件 | 作用 |
|------|------|
| `openai-provider.ts` | 实现 `LLMProvider`：用 OpenAI SDK + 可配置 `baseURL`，一次非流式 `chat.completions.create`，把返回转成 `ChatResult`。 |
| `llm.ts` | 传统用法：`createLLM(options)` 得到 OpenAI 实例，`chatCompletion(client, messages, options)` 发一次请求；可被其他不经过 Agent 的代码使用。 |
| `index.ts` | 导出类型与 `createOpenAIProvider`、`createLLM`、`chatCompletion`；并实现 **createProvider(name, config)**。 |

### 4.3 createProvider

- **createProvider(name, config)**：`name` 为 `"openai"` | `"moonshot"` | `"deepseek"`，`config` 含 `apiKey`、可选 `baseURL`、`model`。
- 内部按 name 选默认 `baseURL` 和 `model`，用 `createOpenAIProvider` 生成同一套接口的实例，返回 `{ provider, model, baseURL }`。
- CLI 与 Bruce 门面都用它拿到「厂商无关」的 `provider` 和 `model`，再交给引擎。

### 4.4 扩展与维护要点

- **新增厂商**：在 `ai/` 下新增实现 `LLMProvider` 的模块（例如 `anthropic-provider.ts`），在 `createProvider` 中增加分支；若协议差异大，可扩展 `ChatMessage`/`ChatResult` 的形态并在该厂商实现内做转换。
- **流式**：当前为单次非流式；若要做流式，可扩展 `LLMProvider`（例如返回 AsyncIterable 或 Stream），并在 `agent-loop` 的 `getAssistantResponse` 中消费流并仍汇总成一条 `AssistantMessage` 再往下走。

---

## 5. 主题三：Bruce 技能层（`src/bruce/`）

在引擎与 AI 层之上，实现「技能目录发现、system 提示、四大工具、对外 Agent 门面」。

### 5.1 技能发现与提示

| 文件 | 作用 |
|------|------|
| `skill-registry.ts` | **SkillRegistry**：扫描 `skillsDir` 下子目录，找 SKILL.md/skill.md，用 gray-matter 解析 frontmatter（name、description 等），缓存目录与属性；提供 `getAvailableSkillsXml(skillNames?)` 生成 `<available_skills>` XML。 |
| `prompt-builder.ts` | **PromptBuilder**：持有一个 SkillRegistry，`buildSystemPrompt(skillNames?, extraBlocks?)` 返回「固定说明 + registry 的 XML + 可选 extra」拼接成的 system 字符串。 |

技能目录结构、XML 形状与 Python 侧约定一致，便于共用同一套 skills 目录。

### 5.2 工具定义与执行

| 文件 | 作用 |
|------|------|
| `tools.ts` | **getDefaultTools()**：返回 OpenAI 风格的 `ChatCompletionTool[]`（read_file、list_skills、load_skill、run_skill_script），供需要「仅声明工具形制」的场景使用。 |
| `bruce-tools.ts` | **getBruceAgentTools(options)**：返回引擎所需的 **AgentTool[]**，每个工具带 `execute`：read_file（受限路径读文件）、list_skills（从 registry 列技能）、load_skill（读 SKILL.md 并拼成返回）、run_skill_script（调 runSkillScript）。 |
| `run-script.ts` | **runSkillScript(scriptsDir, scriptName, args)**：在 `scriptsDir` 下安全执行脚本（扩展名白名单、超时、无 shell、参数列表），返回 stdout/stderr/code。 |

门面在构造时用 `getBruceAgentTools({ registry })` 得到 AgentTool 数组，交给引擎；引擎在循环中只按 name 调用 `execute`，不感知「技能」概念。

### 5.3 门面 Agent（bruce/agent.ts）

- **Agent**：对外类，接受 `provider`、`model`、`skillRegistry`、可选 `promptBuilder`、`toolsEnabled`、`temperature`。
- 构造时：用 `promptBuilder.buildSystemPrompt()` 得到 system，用 `getBruceAgentTools({ registry })` 得到 tools，**new EngineAgent**（agent/agent.ts），把 provider、model、systemPrompt、tools 传入。
- **chat(userMessage, options?)**：可传 `systemOverride` 或 `skillNames` 以临时改 system；然后调用引擎的 `prompt(userMessage)`，返回最后一条助手文本。
- **listSkills()**：直接转发 registry 的 `listSkills()`。

因此「技能」与「提示」只在 bruce 层组装；引擎层只看到「一串 message + 一组 AgentTool」。

### 5.4 扩展与维护要点

- **新工具**：在 `bruce-tools.ts` 增加一项 AgentTool（name、description、parameters、execute），并在 `tools.ts` 的 getDefaultTools 中增加对应 OpenAI 工具声明（若需保持一致）。
- **技能目录/协议变更**：改 `skill-registry.ts`（扫描规则、XML 结构）和 `prompt-builder.ts`（拼接逻辑）；若 SKILL.md 格式变化，同步改 load_skill 的 execute 实现。
- **脚本执行策略**：改 `run-script.ts`（白名单、超时、环境等）。

---

## 6. 主题四：请求链路与数据流

一次 `agent.chat("用户问题")` 的典型路径：

1. **bruce/agent.ts**  
   - 若未在 options 里改 system，则已用 `promptBuilder.buildSystemPrompt()` 在构造时设好。  
   - 调用引擎的 `prompt(userMessage)`。

2. **agent/agent.ts（EngineAgent）**
   - 把用户内容包成 `UserMessage`，调用 `agentLoop([userMsg], context, config)`，得到 event stream；
   - `for await` 消费 stream，在 `message_end` 时把消息追加到自己的 `messages`，最后取最后一条 assistant 的 content 返回。

3. **agent/agent-loop.ts**  
   - **runLoop**：把 user 消息放入 context，进入内层 while。  
   - **getAssistantResponse**：用 `convertToLlm` 把 context.messages 转成 `ChatMessage[]`（含 system），调用 `config.provider.chat(chatMessages, { model, temperature, tools })`。  
   - **ai/openai-provider**：把 ChatMessage[] 和 ChatTool[] 转成 OpenAI 请求体，发一次 completion，把返回转成 `ChatResult`。  
   - 若 assistant 带 `tool_calls`，**executeToolCalls**：对每个 call 在 config.tools 里按 name 找到 **AgentTool**（即 bruce-tools 提供的实现），执行 `execute(id, args, signal)`，把返回的 content 封装成 ToolResultMessage 推回 context，并 push 事件。  
   - 再次 **getAssistantResponse**（此时 context 里多了 assistant + 多条 toolResult），直到本轮没有 tool_calls。  
   - 若无 follow-up，则 `agent_end`，stream.end(messages)。

4. **数据形态**  
   - 引擎内：**AgentMessage[]**（user / assistant / toolResult）。  
   - 跨边界给 AI：**ChatMessage[]**（system / user / assistant / tool），由 `convertToLlm` 生成。  
   - 工具定义给 AI：**ChatTool[]**，由 `toolsToChatTools(AgentTool[])` 生成。

---

## 7. 主题五：扩展与维护入口速查

| 目标 | 主要修改位置 |
|------|----------------|
| 改 Agent 循环（如最大 turn、截断策略） | `agent/agent-loop.ts`（runLoop、getAssistantResponse） |
| 改消息/事件类型或增加事件 | `agent/types.ts`，以及 agent-loop 中 push 处、event-stream 的迭代结束条件 |
| 增加/更换 LLM 厂商 | `ai/`：新 Provider 实现 + `createProvider` 分支 |
| 改 system 提示格式或技能 XML | `bruce/prompt-builder.ts`、`bruce/skill-registry.ts` |
| 增加或修改 Agent 工具 | `bruce/bruce-tools.ts`（及可选 `bruce/tools.ts`） |
| 改脚本执行策略 | `bruce/run-script.ts` |
| 对外 API 或包导出 | `src/index.ts`；CLI 行为 `src/cli.ts` |

---

## 8. 附录：文件索引

```
src/
├── index.ts                 # 包入口
├── cli.ts                   # CLI：参数解析 → createProvider + bruce.Agent → chat
├── agent/
│   ├── types.ts             # AgentMessage, AgentContext, AgentTool, AgentLoopConfig, AgentEvent
│   ├── event-stream.ts      # createAgentStream
│   ├── agent-loop.ts        # agentLoop, agentLoopContinue, runLoop, getAssistantResponse, executeToolCalls
│   ├── agent.ts             # EngineAgent 类（prompt/continue/subscribe/state）
│   └── index.ts             # 导出 agent 引擎公共 API
├── ai/
│   ├── types.ts             # ChatMessage, ChatResult, ChatTool, ChatOptions, LLMProvider
│   ├── openai-provider.ts    # createOpenAIProvider → LLMProvider 实现
│   ├── llm.ts               # createLLM, chatCompletion（传统 OpenAI 用法）
│   └── index.ts             # createProvider, 导出类型与实现
└── bruce/
    ├── skill-registry.ts    # SkillRegistry, SkillProperties
    ├── prompt-builder.ts    # PromptBuilder
    ├── run-script.ts        # runSkillScript, RunScriptResult
    ├── tools.ts             # getDefaultTools（OpenAI ChatCompletionTool[]）
    ├── bruce-tools.ts       # getBruceAgentTools（AgentTool[]）
    ├── agent.ts             # Bruce 门面 Agent（chat, listSkills）
    └── index.ts             # 导出 bruce 层公共 API
```

以上结构按主题拆分，便于按「引擎 / 厂商 / 技能」分块阅读和迭代设计。
