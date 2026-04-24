# Bruce

🥚 Infant Stage

> A minimal LLM Agent harness with skill capabilities.


---

## ⚠️ 项目状态

**Nano-Bruce 处于早期开发阶段（Infant）**。API 可能随时变化，不建议用于生产环境。

欢迎探索、反馈和贡献。

---

## 项目作用

本仓库是作者**个人练习用的 agent harness 工程**：用可运行代码把「LLM + 工具 + 技能 + 多轮循环」串成一条清晰链路，便于**吃透 harness 层的实现与迭代方式**（对话循环、工具编排、上下文与流式事件等），而不是提供对外承诺的商业产品。

`bruce-ts/` 中的 **agent-loop** 在流程上对照了 [badlogic/pi-mono](https://github.com/badlogic/pi-mono) 所体现的 Pi 系运行时思路；**本仓库不是 Pi 的 fork**，实现与依赖独立维护。

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

### 安装

```bash
cd bruce-ts
npm install
npm run build
cd packages/app && npm link  # 全局安装 bruce 命令
```

### 初始化配置

```bash
bruce init
# 创建 ~/.bruce/settings.json，请填入 API Key
```

或直接设置环境变量：

```bash
export MOONSHOT_API_KEY=your_key
```

### CLI 使用

```bash
# 进入 REPL 多轮对话（自动创建 session）
bruce

# 单轮对话（不创建 session）
bruce --message "列出可用的 skills"

# 恢复之前的 session
bruce -s <session-uuid>

# 列出所有 session
bruce sessions
```

### REPL 退出方式

- **Ctrl+D** —— 保存 session 后退出
- **双 Ctrl+C** —— 强制退出（不保存最后一轮）

支持的 Provider：`moonshot`、`deepseek`、`openai`、`anthropic`

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
- **多 Provider** —— 统一接口适配 OpenAI、Moonshot、DeepSeek、Anthropic 等
- **Coding Tools** —— 内置 read/write/edit/bash 元工具
- **Session 管理** —— 多轮对话持久化，支持恢复历史会话
- **配置系统** —— ~/.bruce/settings.json 统一管理 Provider 与偏好

---

## Acknowledgements

实现参考了 [Armin Ronacher 对 Pi 的阐述](https://lucumr.pocoo.org/2026/1/31/pi/) 以及 [badlogic/pi-mono](https://github.com/badlogic/pi-mono) 

---

## License

MIT