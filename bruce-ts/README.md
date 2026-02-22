# Bruce Agent (TypeScript)

Client-side skill-enabled LLM agent **built on [Pi](https://github.com/badlogic/pi-mono)** (`pi-agent-core` + `pi-ai`). Same rationale as Pi: **smaller permission surface, local data, user-owned**. Python (`../bruce`) is used for **backend services** (APIs, sandboxing, audit) when you need server-side guarantees.

Inspired by [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/) and the [Pi monorepo](https://github.com/badlogic/pi-mono). Bruce adds a **skill registry**, **&lt;available_skills&gt; prompt**, and **skill tools** (read_file, list_skills, load_skill, run_skill_script) on top of Pi’s agent loop.

## 如何运行（简要）

本仓库是 TypeScript 项目，运行前需要先安装依赖并编译：

1. **安装依赖**：`npm install`（会拉取 node_modules）
2. **编译**：`npm run build`（用 TypeScript 编译器生成 `dist/` 下的 JS）
3. **运行**：`npm start` 或 `node dist/cli.js`，并设置对应环境变量（如 `KIMI_API_KEY`）

命令行参数示例：`npm start -- --provider kimi-coding --message "列出可用的 skills"`。更多见下方 Run 小节。

## Why TypeScript for the agent?

- **Client / local-first**: Agent runs in the user’s environment (Node or browser later). Data stays local; the user is responsible.
- **Minimal surface**: Few dependencies; no MCP/skills download by default — the agent extends itself via tools (read_file, run_skill_script) and the shared `skills/` directory.
- **Portable**: Same OpenAI-compatible API; point `baseURL` at Moonshot, DeepSeek, or OpenAI.

## Why keep Python?

- **Backend services**: Rate limiting, auth, script execution in a sandbox, audit logs, SLA.
- **skills_ref CLI**: Validate skills, generate prompts (optional; this package can parse SKILL.md in TS with `gray-matter`).

## Setup

```bash
cd bruce-ts
npm install
npm run build
```

## Run

The agent is built on **Pi** (`@mariozechner/pi-agent-core` + `@mariozechner/pi-ai`). Use Pi’s providers when possible:

```bash
# Kimi / Moonshot via Pi (set KIMI_API_KEY; Pi uses this env name)
npm start -- --provider kimi-coding --message "列出可用的 skills"

# OpenAI via Pi (set OPENAI_API_KEY)
npm start -- --provider openai --message "What skills are available?"
```

Legacy providers (direct OpenAI client, no Pi):

```bash
# Moonshot (MOONSHOT_API_KEY)
npm start -- --provider moonshot --message "列出可用的 skills"

# DeepSeek (DEEPSEEK_API_KEY)
npm start -- --provider deepseek --message "..."

# Custom skills dir
npm start -- --skills /path/to/skills --message "..."
```

## Usage as library

**Preferred: Pi-based agent** (uses Pi’s agent loop, tool execution, and multi-provider API):

```ts
import { createBrucePiAgent, runBrucePiPrompt, SkillRegistry } from "@nano-bruce/agent";

const registry = new SkillRegistry("./bruce/skills");
registry.load();

const agent = createBrucePiAgent(registry, {
  provider: "kimi-coding",
  modelId: "kimi-k2",
});
const reply = await runBrucePiPrompt(agent, "我想写周报，该用哪个 skill？");
console.log(reply);
```

**Legacy: custom Agent + OpenAI client** (for moonshot/deepseek with custom baseURL):

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

## Tools

Same as the Python agent: `read_file`, `list_skills`, `load_skill`, `run_skill_script`. Skills directory structure (scripts/, references/, assets/) is the same; see `../bruce/README.md`.
