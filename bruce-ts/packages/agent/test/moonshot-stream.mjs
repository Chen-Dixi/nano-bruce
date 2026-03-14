/**
 * Moonshot 流式调用单测
 * 使用方式（在仓库根目录）：先 npm run build，再 node packages/agent/test/moonshot-stream.mjs
 * 需设置环境变量 MOONSHOT_API_KEY
 */

const apiKey = process.env.MOONSHOT_API_KEY;
if (!apiKey) {
  console.error("请设置环境变量 MOONSHOT_API_KEY");
  process.exit(1);
}

const { stream } = await import("@nano-bruce/ai");

const moonshotModel = {
  id: "kimi-k2-turbo-preview",
  name: "kimi-k2-turbo-preview",
  api: "moonshot-completions",
  provider: "moonshot",
  baseURL: "https://api.moonshot.cn/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 8192,
};

const messages = [{ role: "user", content: "用一句话介绍你自己。" }];
const options = { model: moonshotModel, temperature: 0.3, apiKey };

console.log("调用 Moonshot 流式 API...\n");
const eventStream = stream(messages, options);

let text = "";
for await (const event of eventStream) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
    text += event.delta;
  } else if (event.type === "done") {
    console.log("\n\n[done]", event.reason);
  } else if (event.type === "error") {
    console.error("\n[error]", event.error?.errorMessage ?? event);
  }
}

if (text.length > 0) {
  console.log("\n\n--- 测试通过：收到流式文本，长度", text.length);
} else {
  console.log("\n\n--- 未收到文本，请检查 API Key 与网络");
  process.exitCode = 1;
}
