# Configuration System Requirements

## Scope
- In scope:
  - Provider 配置读取（endpoint, model, apiKey）
  - 配置文件路径管理（默认 ~/.bruce/settings.json）
  - 工作目录配置（skillsDir, memoryDir）
  - 环境变量与配置文件优先级合并
  - CLI 集成使用新配置系统
  - 配置文件初始化命令

- Out of scope:
  - API Key 系统级安全存储（keychain 集成）
  - CLI 参数覆盖配置（如 --provider）
  - 配置热更新（文件变更监听）
  - 多配置文件支持（项目级 vs 全局级）

## Decisions
- Decision 1: 使用 JSON 文件而非 SQLite
  - Rationale: 人类可读、便于调试、符合 "透明优先" 原则
  
- Decision 2: API Key 明文存储于配置文件
  - Rationale: 第一阶段简化实现，后续可扩展 keychain
  
- Decision 3: 配置优先级为环境变量 > 配置文件 > 默认值
  - Rationale: 环境变量优先便于 CI/CD 和临时覆盖
  
- Decision 4: 配置文件默认路径 ~/.bruce/settings.json
  - Rationale: 符合 CLI 工具惯例，与其他工具隔离

## Context
- References: specs/mission.md, specs/tech-stack.md
- Dependencies: Phase 0 已完成（Agent Loop, Skill System, Provider 层）
- Constraints: 不引入新的外部依赖（使用 Node.js 原生 fs/path/os）

## Open Questions
- [x] 配置格式：JSON vs SQLite → 选择 JSON
- [x] 安全存储：keychain vs 明文 → 选择明文（先跳过）
- [x] 优先级：CLI 参与 vs 仅 env+file → 仅环境变量和配置文件
- [x] 配置项范围 → Provider + 工作目录 + 配置路径