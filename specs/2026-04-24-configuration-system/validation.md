# Configuration System Validation

## Success Criteria
- Criterion 1: 配置文件读取
  - Verify: `loadSettings()` 能正确读取 ~/.bruce/settings.json
  
- Criterion 2: 环境变量覆盖
  - Verify: 设置 OPENAI_API_KEY 环境变量后，即使配置文件中有 apiKey 也优先使用环境变量
  
- Criterion 3: CLI 集成
  - Verify: `bruce` 命令无需手动 export API_KEY，从配置文件自动读取
  
- Criterion 4: 配置初始化
  - Verify: `bruce init` 命令能生成默认配置文件模板

## Test Cases
- Test 1: 无配置文件时使用默认配置
  - 删除 ~/.bruce/settings.json，运行 bruce，应报错提示需配置或使用环境变量
  
- Test 2: 配置文件存在但缺少某 provider 配置
  - 配置 moonshot 但运行时指定 deepseek，应报错缺少配置
  
- Test 3: 环境变量覆盖配置文件
  - 配置文件中设置 apiKey 为 "file-key"，环境变量设置 "env-key"，运行时应使用 "env-key"
  
- Test 4: 自定义工作目录
  - 配置文件中设置 skillsDir: "/custom/skills"，运行时使用该路径加载技能

## Merge Checklist
- [ ] 所有测试通过
- [ ] 配置文件示例文档更新（README 或 docs/）
- [ ] 无 regressions（现有功能不受影响）
- [ ] CLI 入口行为验证（bruce 命令正常运行）