# Nano-Bruce 架构：双实现并行（TS 活跃，Python 参考）

## 设计原则（参考 Pi）

- **客户端 Agent 用 TypeScript（主线）**：权限小、数据在本地、风险小、用户自己负责。
- **Python 实现（参考线）**：保留历史实现与实验资产，目前不作为主线依赖。

详见 [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/) 与 [pi-mono](https://github.com/badlogic/pi-mono)。

## 仓库布局

```
nano-bruce/
├── bruce-ts/          # TypeScript 版 Bruce（当前活跃）
├── bruce-py/          # Python 版 Bruce（历史/参考）
├── docs/              # 结构化知识库（记录系统）
├── AGENTS.md          # Agent 地图（目录，不承载全部知识）
└── ARCHITECTURE.md    # 本文件
```

## 关系说明（关键）

- `bruce-ts/` 与 `bruce-py/` 在本仓库中视为**相互独立**的实现。
- 两者目标逻辑相似，但当前工程推进以 `bruce-ts/` 为主。
- 不以 `bruce-py/` 作为 `bruce-ts/` 的运行时依赖或知识前置条件。

## 当前推荐开发路径

- 日常开发、功能扩展、验证和文档更新默认围绕 `bruce-ts/`。
- `bruce-py/` 可用于参考历史设计，不作为阻塞项。
- 知识沉淀统一进入 `docs/`，由 `AGENTS.md` 提供导航入口。

## 参考

- [Pi (Armin Ronacher)](https://lucumr.pocoo.org/2026/1/31/pi/)
- [pi-mono (GitHub)](https://github.com/badlogic/pi-mono)
- [Anthropic Agent Skills](https://github.com/anthropics/skills)
