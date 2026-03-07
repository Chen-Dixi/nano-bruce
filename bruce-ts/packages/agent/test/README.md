# Agent 单测

## Moonshot 流式调用

验证 Moonshot（月之暗面）API 是否可用。

1. 在仓库根目录先构建：`npm run build`
2. 设置环境变量：`export MOONSHOT_API_KEY=your_key`
3. 在仓库根目录执行：`npm run test:moonshot -w @nano-bruce/agent-core`  
   或在 `packages/agent` 下执行：`npm run test:moonshot`

成功时会流式打印模型回复，并输出「测试通过」。
