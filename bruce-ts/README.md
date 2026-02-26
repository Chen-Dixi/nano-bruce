# Bruce Agent (TypeScript)

客户端、带 skills 能力的 LLM Agent，**核心全部自实现**（不依赖 Pi 等外部 agent 框架），便于自行优化与扩展。Python 目录 `../bruce` 用于后端服务；Agent 在 TS 侧运行，权限小、数据在本地。

## 如何运行（简要）

1. **安装依赖**：`npm install`
2. **编译**：`npm run build`（生成 `dist/`）
3. **运行**：设置环境变量后执行 `npm start` 或 `node dist/cli.js`

示例：`npm start -- --provider moonshot --message "列出可用的 skills"`。支持 `--skills`、`--provider`、`--message`。

## 依赖与架构

- **gray-matter**：解析 SKILL.md 的 YAML frontmatter
- **openai**：OpenAI 兼容客户端，通过 `baseURL` 对接 Moonshot、DeepSeek 等
- Agent 循环、工具调用、Skill 注册与提示构建均为本仓库自实现

## 环境变量与 Run

| provider  | 环境变量           | 说明                    |
|-----------|--------------------|-------------------------|
| moonshot  | MOONSHOT_API_KEY   | 月之暗面 / Kimi，baseURL 已内置 |
| deepseek  | DEEPSEEK_API_KEY   | DeepSeek，baseURL 已内置       |
| openai    | OPENAI_API_KEY     | 默认 baseURL                 |

```bash
npm start -- --provider moonshot --message "列出可用的 skills"
npm start -- --provider deepseek --message "..."
npm start -- --provider openai --message "..."
npm start -- --skills /path/to/skills --message "..."
```

## 作为库使用

```ts
import { Agent, createLLM, PromptBuilder, SkillRegistry } from "@nano-bruce/agent";

const registry = new SkillRegistry("./bruce/skills");
registry.load();

const client = createLLM({
  apiKey: process.env.MOONSHOT_API_KEY!,
  baseURL: "https://api.moonshot.cn/v1",
});
const agent = new Agent({
  client,
  model: "kimi-k2-turbo-preview",
  skillRegistry: registry,
  promptBuilder: new PromptBuilder(registry),
  toolsEnabled: true,
});

const reply = await agent.chat("我想写周报，该用哪个 skill？");
console.log(reply);
```

## 工具与目录结构

与 Python 版一致：`read_file`、`list_skills`、`load_skill`、`run_skill_script`。Skill 目录结构（scripts/, references/, assets/）见 `../bruce/README.md`。
