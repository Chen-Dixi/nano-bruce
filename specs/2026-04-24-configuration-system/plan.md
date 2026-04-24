# Configuration System Plan

## Task Group 1: 配置模块设计与类型定义
- [ ] Task 1.1: 在 `@nano-bruce/ai` 包中定义 `SettingsConfig` 类型
- [ ] Task 1.2: 定义 `ProviderConfig` 类型（endpoint, model, apiKey）
- [ ] Task 1.3: 定义 `UserPreferences` 类型（defaultProvider, streamOutput 等）
- [ ] Task 1.4: 定义 `WorkingDirConfig` 类型（skillsDir, memoryDir 等）

## Task Group 2: 配置文件读取实现
- [ ] Task 2.1: 创建 `packages/app/src/config/settings.ts` 配置读取模块
- [ ] Task 2.2: 实现 `loadSettings()` 函数读取 `~/.bruce/settings.json`
- [ ] Task 2.3: 实现 `getSettingsPath()` 函数获取配置文件路径
- [ ] Task 2.4: 处理配置文件不存在的情况（返回默认配置）

## Task Group 3: 配置优先级合并
- [ ] Task 3.1: 实现 `mergeConfig()` 函数合并配置文件和环境变量
- [ ] Task 3.2: 实现环境变量到配置的映射（OPENAI_API_KEY → provider.openai.apiKey）
- [ ] Task 3.3: 实现配置优先级逻辑（环境变量 > 配置文件）

## Task Group 4: CLI 集成
- [ ] Task 4.1: 修改 `cli.ts` 使用新的配置系统
- [ ] Task 4.2: 替换硬编码的 provider 选择逻辑
- [ ] Task 4.3: 从配置获取 API Key，而非硬编码环境变量名

## Task Group 5: 配置文件生成与验证
- [ ] Task 5.1: 实现 `initSettings()` 函数创建默认配置文件
- [ ] Task 5.2: 添加 CLI 命令 `bruce init` 生成配置文件
- [ ] Task 5.3: 实现配置验证与错误提示

## Dependencies
- Task 2.x depends on Task 1.x（类型定义完成后才能实现读取）
- Task 3.x depends on Task 2.x（读取实现完成后才能合并）
- Task 4.x depends on Task 3.x（合并逻辑完成后才能集成 CLI）
- Task 5.x 可与 Task 4.x 并行

## Notes
- 配置文件路径默认为 `~/.bruce/settings.json`
- 工作目录默认为 `~/.bruce/`，可在 settings.json 中指定其他路径
- API Key 明文存储，后续 Phase 可扩展 keychain 集成
- 优先级：环境变量 > 配置文件 > 默认值