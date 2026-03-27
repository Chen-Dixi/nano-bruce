# Bruce

🥚 Infant Stage

> A minimal LLM Agent harness with skill capabilities.


---

## ⚠️ 项目状态

**Nano-Bruce 处于早期开发阶段（Infant）**。API 可能随时变化，不建议用于生产环境。

欢迎探索、反馈和贡献。

---

## 架构

```
┌─────────────────────────────────────────────────────┐
│                    Applications                      │
├─────────────────────────────────────────────────────┤
│  bruce-ts/          │  bruce-py/                    │
│  TypeScript Agent   │  Python Agent (Reference)     │
│  本地运行、权限小     │  独立实现、历史参考             │
├─────────────────────────────────────────────────────┤
│                    Agent Engine                      │
├─────────────────────────────────────────────────────┤
│                    AI Provider                       │
└─────────────────────────────────────────────────────┘
```

- **TypeScript Agent** (`bruce-ts/`) —— 当前主线实现，客户端本地运行，数据在用户侧。参考 [Pi](https://lucumr.pocoo.org/2026/1/31/pi/) 的极简设计。
- **Python 实现** (`bruce-py/`) —— 历史/参考实现，当前不作为 TS 主线依赖。

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 快速开始

```bash
cd bruce-ts
npm install
npm run build

export MOONSHOT_API_KEY=your_key
npm start -- --provider moonshot --message "列出可用的 skills"
```

支持的 Provider：`moonshot`、`deepseek`、`openai`

---

## 作为库使用

```typescript
import { Agent, createModel, SkillRegistry, PromptBuilder } from "@nano-bruce/agent";

const registry = new SkillRegistry("./skills");
registry.load();

const model = createModel("moonshot"); // 或 createModel("deepseek"), createModel("openai")

const agent = new Agent({
  model,
  skillRegistry: registry,
  toolsEnabled: true,
});

await agent.chat("帮我写一份周报");
```

---

## 特性

- **极简引擎** —— 核心 Agent 循环自实现，无外部框架依赖
- **技能系统** —— 通过 SKILL.md 定义技能，自动发现与加载
- **流式输出** —— 支持打字机效果与增量推送
- **多 Provider** —— 统一接口适配 OpenAI、Moonshot、DeepSeek 等
- **Coding Tools** —— 内置 read/write/edit/bash 元工具

---

## License

MIT