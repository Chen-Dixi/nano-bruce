# Bruce Agent (TypeScript)

Client-side skill-enabled LLM agent. Written in TypeScript for the same rationale as [Pi](https://github.com/badlogic/pi-mono): **smaller permission surface, local data, user-owned**. Python (`../bruce`) is used for **backend services** (APIs, sandboxing, audit) when you need server-side guarantees.

Inspired by [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/) and the [Pi monorepo](https://github.com/badlogic/pi-mono).

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

```bash
# Moonshot (set MOONSHOT_API_KEY)
npm start -- --provider moonshot --message "列出可用的 skills"

# DeepSeek (set DEEPSEEK_API_KEY)
npm start -- --provider deepseek --message "What skills are available?"

# Custom skills dir
npm start -- --skills /path/to/skills --message "..."
```

## Usage as library

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
