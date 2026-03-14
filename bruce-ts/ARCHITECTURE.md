# Bruce-ts 架构说明

本文档按**主题**组织，描述当前 monorepo 结构与各层职责，便于维护与迭代。

---

## 1. 概述与设计目标

**Bruce-ts** 是自实现的、带「技能（skills）」能力的 LLM Agent 客户端，核心不依赖 Pi 等外部 agent 框架。

- **运行位置**：在用户环境（Node）中运行，数据在本地，权限面小。
- **与 Python 的关系**：同仓库下的 `bruce/`（或约定目录）负责后端与技能定义；本仓库负责 TypeScript 端 Agent 与技能调用。
- **技能协议**：兼容 Anthropic 风格（`<available_skills>` XML、SKILL.md、scripts/ 等），与 Python 侧约定一致。

---

## 2. Monorepo 与目录结构

```
bruce-ts/
├── package.json              # 根：workspaces、build/start/clean/version:sync
├── tsconfig.base.json        # 公共 compilerOptions
├── tsconfig.json             # 根类型检查：extends base、paths、include packages/*/src
├── scripts/
│   ├── build.mjs             # 按依赖顺序构建 ai → agent → bruce → app
│   └── sync-version.mjs      # 从根 version 同步到各包及 @nano-bruce/* 依赖
└── packages/
    ├── ai/                   # @nano-bruce/ai：LLM Provider 适配
    │   ├── src/
    │   ├── tsconfig.build.json
    │   └── package.json
    ├── agent/                # @nano-bruce/agent-core：引擎（循环、事件流、EngineAgent）
    │   ├── src/
    │   ├── tsconfig.build.json
    │   └── package.json
    ├── bruce/                # @nano-bruce/bruce：技能层（SkillRegistry、工具、门面 Agent）
    │   ├── src/
    │   ├── tsconfig.build.json
    │   └── package.json
    └── app/                  # @nano-bruce/agent：入口包（index 再导出 + CLI）
        ├── src/
        ├── tsconfig.json     # 供 IDE，extends build
        ├── tsconfig.build.json
        └── package.json
```

| 包名 | 职责 |
|------|------|
| **@nano-bruce/ai** | 统一 LLM 接口（Provider）、OpenAI 兼容实现、createProvider、createLLM/chatCompletion |
| **@nano-bruce/agent-core** | 与厂商无关的 Agent 循环、消息类型、事件流、EngineAgent 类 |
| **@nano-bruce/bruce** | Skill 发现、system 提示构建、四大工具实现、对外 Agent 门面 |
| **@nano-bruce/agent** | 对外入口：再导出上述包、CLI（bin: bruce-agent） |

依赖关系：`app` → `bruce`、`ai`；`bruce` → `agent-core`、`ai`；`agent` → `ai`。

---

## 3. 根脚本与配置

- **build**：`node scripts/build.mjs`，按顺序构建 ai、agent、bruce、app。
- **start**：`node packages/app/dist/cli.js`，跑 CLI。
- **clean**：`npm run clean --workspaces`，各包执行 `rm -rf dist`。
- **version:sync**：从根 `package.json` 的 `version` 同步到各包 `version` 及所有 `@nano-bruce/*` 依赖；版本号只改根目录一处。
- **tsconfig**：根 `tsconfig.json` 含 `paths` 将 `@nano-bruce/ai`、`@nano-bruce/agent-core`、`@nano-bruce/bruce` 指到各包 `src`，`include` 为 `packages/*/src/**/*.ts`，便于根目录 `tsc --noEmit` 与 IDE 跳转到源码。

---

## 4. 主题一：Agent 引擎（packages/agent，@nano-bruce/agent-core）

引擎层实现「消息 + 工具 → LLM → 工具执行 → 再 LLM」的通用循环，不关心具体技能或厂商。

### 4.1 核心文件（packages/agent/src/）

| 文件 | 作用 |
|------|------|
| `types.ts` | AgentMessage（user/assistant/toolResult）、AgentContext、AgentTool、AgentLoopConfig、AgentEvent |
| `event-stream.ts` | createAgentStream()：可 push 事件、for await 消费的异步迭代流 |
| `agent-loop.ts` | agentLoop / agentLoopContinue、runLoop、getAssistantResponse、executeToolCalls |
| `agent.ts` | EngineAgent 类：systemPrompt、messages、tools，prompt()、continue()、subscribe() |
| `index.ts` | 导出引擎公共 API |

### 4.2 消息与上下文

- **AgentMessage**：UserMessage、AssistantMessage、ToolResultMessage。
- **AgentContext**：systemPrompt、messages、tools。
- **AgentTool**：name、description、parameters、execute(toolCallId, args, signal)。引擎按 tool_calls 的 name 查找并执行。

### 4.3 循环与事件

- **runLoop**：若有 pending（steering/follow-up）先注入；getAssistantResponse 调 provider.chat；有 tool_calls 则 executeToolCalls，结果追加到 context，再请求 LLM，直到无 tool_calls；最后根据 getFollowUpMessages 决定是否继续一轮。
- **事件流**：stream.push(agent_start、turn_start、message_start/end、tool_execution_*、turn_end、agent_end)；EngineAgent 消费流并更新 messages、通知 subscribe 监听器。

### 4.4 扩展要点

- 改循环：`agent-loop.ts` 的 runLoop、getAssistantResponse、executeToolCalls。
- 改消息/事件：`types.ts` 及 agent-loop 中 push 处。

---

## 5. 主题二：AI 层（packages/ai，@nano-bruce/ai）

定义「一次 LLM 调用」的接口，由具体厂商实现。

### 5.1 核心类型与实现（packages/ai/src/）

- **types.ts**：ChatMessage、ChatTool、ChatResult、ChatOptions、**LLMProvider**（chat(messages, options) => Promise<ChatResult>）。
- **openai-provider.ts**：createOpenAIProvider → LLMProvider，OpenAI SDK + baseURL，非流式。
- **llm.ts**：createLLM、chatCompletion，传统直接调用用法。
- **index.ts**：createProvider(name, config)，name 为 openai | moonshot | deepseek，返回 { provider, model, baseURL }。

### 5.2 扩展要点

- 新厂商：新 Provider 实现 + createProvider 分支。
- 流式：扩展 LLMProvider 返回流，在 agent-loop 的 getAssistantResponse 中消费并汇总成 AssistantMessage。

---

## 6. 主题三：Bruce 技能层（packages/bruce，@nano-bruce/bruce）

技能发现、system 提示、四大工具、对外 Agent 门面。

### 6.1 技能发现与提示（packages/bruce/src/）

- **skill-registry.ts**：SkillRegistry，扫描 skillsDir 子目录、SKILL.md/skill.md，gray-matter 解析 frontmatter，getAvailableSkillsXml(skillNames?)。
- **prompt-builder.ts**：PromptBuilder，buildSystemPrompt(skillNames?, extraBlocks?)：固定说明 + registry XML + extra。

### 6.2 工具与执行

- **tools.ts**：getDefaultTools() → OpenAI ChatCompletionTool[]（read_file、list_skills、load_skill、run_skill_script）。
- **bruce-tools.ts**：getBruceAgentTools(options) → AgentTool[]，带 execute：read_file、list_skills、load_skill、run_skill_script。
- **run-script.ts**：runSkillScript(scriptsDir, scriptName, args)，安全执行（白名单扩展名、超时、无 shell）。

### 6.3 门面 Agent（bruce/src/agent.ts）

- 接受 provider、model、skillRegistry、promptBuilder、toolsEnabled、temperature。
- 构造时用 promptBuilder.buildSystemPrompt()、getBruceAgentTools({ registry })，new EngineAgent(provider, model, systemPrompt, tools)。
- chat(userMessage, options?)：可 systemOverride 或 skillNames，再调用 engine.prompt(userMessage)；listSkills() 转发 registry.listSkills()。

### 6.4 扩展要点

- 新工具：bruce-tools.ts 增加 AgentTool，可选同步 tools.ts。
- 技能协议/目录：skill-registry.ts、prompt-builder.ts；脚本策略：run-script.ts。

---

## 7. 主题四：入口与 CLI（packages/app，@nano-bruce/agent）

### 7.1 index（packages/app/src/index.ts）

从 @nano-bruce/bruce、@nano-bruce/ai、@nano-bruce/agent-core 再导出，对外统一入口。

### 7.2 CLI 与默认 skills 目录（packages/app/src/cli.ts）

- 参数：--skills、--provider、--message；未传 --skills 时使用 **getDefaultSkillsDir(process.cwd())**。
- **getDefaultSkillsDir(startDir)**：从 startDir 向上找 git 根，沿途收集候选目录：每层的 `.nano_bruce/skills`、`.agents/skills`，返回**第一个已存在的目录**；若都不存在则用 `{gitRoot}/bruce/skills`，无 git 根则退回基于 __dirname 的 fallback。
- **findGitRepoRoot(startDir)**：向上查找含 `.git` 的目录作为仓库根。

---

## 8. 请求链路与数据流（简要）

1. 用户调用 **bruce.Agent#chat** → 门面调用 **EngineAgent#prompt**。
2. EngineAgent 将 UserMessage 传入 **agentLoop**，得到 event stream，消费 stream 更新 messages，取最后一条 assistant content 返回。
3. **runLoop** 内：convertToLlm 将 AgentMessage[] 转为 ChatMessage[]，**config.provider.chat**（ai 层）发请求；若有 tool_calls，**executeToolCalls** 按 name 执行 AgentTool（bruce-tools），结果追加到 context，再请求 LLM，直至无 tool_calls。
4. 数据形态：引擎内 AgentMessage[]；给 AI 的为 ChatMessage[]；工具定义为 ChatTool[]（由 AgentTool[] 转换）。

---

## 9. 扩展与维护速查

| 目标 | 位置 |
|------|------|
| 改 Agent 循环 | packages/agent/src/agent-loop.ts |
| 改消息/事件类型 | packages/agent/src/types.ts、agent-loop push 处 |
| 增/换 LLM 厂商 | packages/ai：新 Provider + createProvider |
| 改 system/技能 XML | packages/bruce/src/prompt-builder.ts、skill-registry.ts |
| 增/改工具 | packages/bruce/src/bruce-tools.ts（及 tools.ts） |
| 改脚本执行策略 | packages/bruce/src/run-script.ts |
| 对外 API / 导出 | packages/app/src/index.ts |
| CLI 行为 / 默认 skills | packages/app/src/cli.ts |
| 版本号 | 根 package.json version + npm run version:sync |

---

## 10. 文件索引（packages/*/src）

```
packages/ai/src/
├── types.ts
├── openai-provider.ts
├── llm.ts
└── index.ts

packages/agent/src/
├── types.ts
├── event-stream.ts
├── agent-loop.ts
├── agent.ts
└── index.ts

packages/bruce/src/
├── skill-registry.ts
├── prompt-builder.ts
├── run-script.ts
├── tools.ts
├── bruce-tools.ts
├── agent.ts
└── index.ts

packages/app/src/
├── index.ts    # 再导出
└── cli.ts     # CLI + getDefaultSkillsDir / findGitRepoRoot
```

以上按「monorepo → 引擎 → AI → 技能层 → 入口 → 链路 → 速查 → 索引」组织，便于分主题阅读与修改。
