---
name: configuration-system-summary
description: Phase 1 Configuration System 实现总结与设计思路
type: project
---

# Configuration System 实现总结

## 完成的功能

### 1. 配置文件读取
- 支持 `~/.bruce/settings.json` 配置文件
- 配置结构包含：
  - `providers` - 各 Provider 的 apiKey、baseURL、defaultModel
  - `preferences` - defaultProvider、streamOutput 等用户偏好
  - `workingDir` - skillsDir、memoryDir 工作目录配置

### 2. 配置优先级
- **环境变量 > 配置文件 > 默认值**
- 环境变量映射：`MOONSHOT_API_KEY` → `providers.moonshot.apiKey`

### 3. CLI 命令
- `bruce init` - 生成默认配置模板
- CLI 自动从配置读取 Provider 信息，无需手动 export API Key

### 4. 测试覆盖
- 使用 Vitest 添加 16 个测试用例
- 覆盖路径函数、文件读取、合并逻辑、错误处理

---

## 代码设计思路

### 模块分层

```
packages/ai/src/config-types.ts     # 类型定义（共享）
packages/app/src/config/settings.ts # 配置逻辑实现
packages/app/src/cli.ts             # CLI 入口集成
```

**设计原则：**
- 类型定义放在 `@nano-bruce/ai` 包，便于其他包引用
- 实现逻辑放在 `@nano-bruce/app` 包，靠近 CLI 入口
- 保持模块职责单一，便于测试和扩展

### 核心函数设计

```typescript
// 路径获取 - 简单函数，无副作用
getBruceDir() → ~/.bruce
getSettingsPath() → ~/.bruce/settings.json

// 文件读取 - 纯函数，返回 null 表示不存在
loadSettingsFromFile() → SettingsConfig | null

// 配置合并 - 核心逻辑，处理优先级
mergeSettings() → SettingsConfig
  1. 加载文件配置
  2. 读取环境变量
  3. 应用默认值
  4. 合并三者（env > file > default）

// 获取有效配置 - CLI 使用，验证并抛错
getEffectiveConfig() → { provider, apiKey, baseURL, model }
  - 无 apiKey 时抛出友好错误提示
```

### 优先级实现

```typescript
function mergeProviderSettings(provider, fileSettings?) {
  return {
    apiKey: process.env[ENV_KEY] ?? fileSettings?.apiKey,  // env 优先
    baseURL: process.env[BASE_URL_KEY] ?? fileSettings?.baseURL,
    defaultModel: fileSettings?.defaultModel,  // 仅文件配置
  };
}
```

### 错误处理设计

```typescript
// 配置缺失时的友好提示
throw new Error(
  `No API key configured for provider "${provider}".\n` +
  `Set environment variable or add to ~/.bruce/settings.json:\n` +
  `  Environment: export ${provider.toUpperCase()}_API_KEY=your-key\n` +
  `  Config file: { "providers": { "${provider}": { "apiKey": "your-key" } } }`
);
```

---

## 关键决策

### 决策 1：JSON 文件而非 SQLite
- **原因**：人类可读、便于调试、符合"透明优先"原则
- **后续**：Phase 2 Memory System 可考虑 SQLite 存储对话历史

### 册策 2：API Key 明文存储
- **原因**：第一阶段简化实现，快速交付
- **后续**：可扩展系统 keychain 集成（macOS Keychain / Linux secret-service）

### 册策 3：配置优先级不含 CLI 参数
- **原因**：用户确认仅环境变量和配置文件参与优先级
- **简化**：移除了 `--provider` 参数，配置由 settings.json 决定

### 册策 4：环境变量优先于配置文件
- **原因**：便于 CI/CD 和临时覆盖，符合行业标准实践
- **验证**：测试用例 `MOONSHOT_API_KEY='env-key'` 覆盖文件中的 `file-key`

---

## 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `bruce-ts/packages/ai/src/config-types.ts` | 新增 | 配置类型定义 |
| `bruce-ts/packages/app/src/config/settings.ts` | 新增 | 配置读取与合并逻辑 |
| `bruce-ts/packages/app/src/config/index.ts` | 新增 | 配置模块导出 |
| `bruce-ts/packages/app/src/config/settings.test.ts` | 新增 | Vitest 测试 (16 cases) |
| `bruce-ts/packages/app/src/cli.ts` | 修改 | 使用新配置系统，添加 `bruce init` |
| `bruce-ts/packages/app/src/index.ts` | 修改 | 导出配置模块 |
| `bruce-ts/packages/ai/src/index.ts` | 修改 | 导出配置类型 |
| `specs/2026-04-24-configuration-system/` | 新增 | 规格文档 |

---

## 使用示例

```bash
# 初始化配置
bruce init

# 编辑配置文件
vim ~/.bruce/settings.json

# 运行（自动读取配置）
bruce --message "hello"

# 环境变量临时覆盖
MOONSHOT_API_KEY=another-key bruce --message "hello"
```

---

## 后续优化方向

1. **配置验证** - 添加 schema 验证，防止无效配置
2. **多配置源** - 支持项目级 `.bruce/settings.json` + 全局级
3. **API Key 安全** - 集成系统 keychain
4. **配置热更新** - 监听文件变更，无需重启 CLI

---

**Why:** 记录设计决策和实现思路，便于后续维护和迭代
**How to apply:** 后续 Phase 开发时参考此文档的设计模式和决策理由