# Nano-Bruce 架构：客户端 Agent (TS) + 服务端 (Python)

## 设计原则（参考 Pi）

- **客户端 Agent 用 TypeScript**：权限小、数据在本地、风险小、用户自己负责。
- **服务端用 Python**：公共资源时要防滥用、防攻击、要审计、要 SLA。

详见 [Pi: The Minimal Agent Within OpenClaw](https://lucumr.pocoo.org/2026/1/31/pi/) 与 [pi-mono](https://github.com/badlogic/pi-mono)。

## 仓库布局

```
nano-bruce/
├── bruce-ts/          # 客户端 Agent（TypeScript）
│   ├── src/
│   │   ├── agent.ts       # 对话 + tool 循环
│   │   ├── skill-registry.ts
│   │   ├── prompt-builder.ts
│   │   ├── tools.ts
│   │   ├── llm.ts         # OpenAI 兼容客户端
│   │   ├── run-script.ts # 安全执行 scripts/
│   │   ├── cli.ts
│   │   └── index.ts
│   └── package.json
├── bruce/             # Python：后端与工具
│   ├── ai/            # （可选）服务端 API、代理
│   ├── skills_ref/    # Skill 校验、to-prompt CLI
│   ├── skills/        # 共享的 Skill 目录
│   └── pyproject.toml
└── ARCHITECTURE.md    # 本文件
```

## 职责划分

| 能力           | 实现位置   | 说明 |
|----------------|------------|------|
| Agent 主循环   | bruce-ts   | 系统提示、tool 调用、多轮对话 |
| Skill 发现/解析| bruce-ts   | 用 gray-matter 解析 SKILL.md，不依赖 skills_ref |
| read_file      | bruce-ts   | 限制在 skills 目录下 |
| run_skill_script | bruce-ts | Node child_process，超时与扩展名白名单 |
| 校验 / to-prompt | bruce (Python) | skills_ref CLI，可选；TS 可自解析 |
| 后端 API       | bruce (Python) | 需要鉴权、限流、审计时用 Python 提供 HTTP API |

## 使用方式

- **本地/客户端**：直接运行 `bruce-ts`（`npm start` 或作为库引入），数据与执行都在本机。
- **服务端**：用 Python 起 HTTP 服务，内部可调用 LLM、或把请求转发给本地 bruce-ts 进程；在服务端做鉴权、限流、日志与审计。

## 参考

- [Pi (Armin Ronacher)](https://lucumr.pocoo.org/2026/1/31/pi/)
- [pi-mono (GitHub)](https://github.com/badlogic/pi-mono)
- [Anthropic Agent Skills](https://github.com/anthropics/skills)
