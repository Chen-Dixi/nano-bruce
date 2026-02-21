# Nano-Bruce

我的大模型 Nano 项目。
- 从 Infra 到 Model 到上层 Wrapper 应用

## Agent：TypeScript（客户端）+ Python（服务端）

- **客户端 Agent**：`bruce-ts/`，TypeScript 实现，本地运行、权限小、数据在用户侧。参考 [Pi](https://lucumr.pocoo.org/2026/1/31/pi/) 的极简设计。
- **服务端 / 工具**：`bruce/`，Python，用于后端 API、技能校验 CLI（skills_ref）、需要审计与 SLA 时的服务。

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

### 快速开始（Agent）

```bash
cd bruce-ts && npm install && npm run build
export MOONSHOT_API_KEY=your_key
npm start -- --provider moonshot --message "列出可用的 skills"
```