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

## Test Framework
- Using: Vitest (based on specs/tech-stack.md: TypeScript + Node.js)

## Test Cases

### Unit Tests

```typescript
// packages/app/src/config/settings.test.ts
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadSettingsFromFile, mergeSettings, getEffectiveConfig, getSettingsPath } from './settings.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Configuration System', () => {
  const testSettingsPath = path.join(os.homedir(), '.bruce', 'settings.json');
  let originalSettings: string | null = null;

  beforeEach(() => {
    // Backup existing settings if present
    if (fs.existsSync(testSettingsPath)) {
      originalSettings = fs.readFileSync(testSettingsPath, 'utf-8');
    }
  });

  afterEach(() => {
    // Restore original settings
    if (originalSettings) {
      fs.writeFileSync(testSettingsPath, originalSettings);
    } else if (fs.existsSync(testSettingsPath)) {
      fs.unlinkSync(testSettingsPath);
    }
    // Clear env vars
    delete process.env.OPENAI_API_KEY;
    delete process.env.MOONSHOT_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  describe('loadSettingsFromFile', () => {
    test('returns null when settings file does not exist', () => {
      if (fs.existsSync(testSettingsPath)) fs.unlinkSync(testSettingsPath);
      const result = loadSettingsFromFile();
      expect(result).toBeNull();
    });

    test('returns parsed settings when file exists', () => {
      const mockSettings = {
        providers: { moonshot: { apiKey: 'test-key' } },
        preferences: { defaultProvider: 'moonshot' }
      };
      fs.writeFileSync(testSettingsPath, JSON.stringify(mockSettings));
      
      const result = loadSettingsFromFile();
      expect(result?.providers?.moonshot?.apiKey).toBe('test-key');
    });
  });

  describe('mergeSettings', () => {
    test('environment variable overrides config file', () => {
      const mockSettings = {
        providers: { moonshot: { apiKey: 'file-key' } }
      };
      fs.writeFileSync(testSettingsPath, JSON.stringify(mockSettings));
      process.env.MOONSHOT_API_KEY = 'env-key';

      const merged = mergeSettings();
      expect(merged.providers?.moonshot?.apiKey).toBe('env-key');
    });

    test('returns default provider when not configured', () => {
      if (fs.existsSync(testSettingsPath)) fs.unlinkSync(testSettingsPath);
      
      const merged = mergeSettings();
      expect(merged.preferences?.defaultProvider).toBe('moonshot');
    });
  });

  describe('getEffectiveConfig', () => {
    test('throws error when no API key configured', () => {
      if (fs.existsSync(testSettingsPath)) fs.unlinkSync(testSettingsPath);
      delete process.env.MOONSHOT_API_KEY;
      
      expect(() => getEffectiveConfig()).toThrow(/No API key configured/);
    });

    test('returns valid config when API key present', () => {
      process.env.MOONSHOT_API_KEY = 'test-key';
      
      const config = getEffectiveConfig();
      expect(config.provider).toBe('moonshot');
      expect(config.apiKey).toBe('test-key');
    });
  });
});
```

### Integration Tests

- Test 1: 无配置文件时 CLI 报错
  - 删除 ~/.bruce/settings.json，清除环境变量
  - 运行 `bruce --message "hello"`
  - 期望：输出错误信息提示配置
  
- Test 2: 配置文件存在但缺少某 provider 配置
  - 配置 moonshot API key，设置 defaultProvider 为 deepseek
  - 运行 `bruce --message "hello"`
  - 期望：报错缺少 deepseek 配置
  
- Test 3: 环境变量覆盖配置文件
  - 配置文件中设置 apiKey 为 "file-key"
  - 环境变量设置 MOONSHOT_API_KEY="env-key"
  - 运行并检查请求是否使用 env-key
  
- Test 4: 自定义工作目录
  - 配置文件中设置 skillsDir: "/custom/skills"
  - 运行 `bruce --message "列出 skills"`
  - 期望：从 /custom/skills 加载技能

## Merge Checklist
- [ ] 所有测试通过 (`npm test` in packages/app)
- [ ] 配置文件示例文档更新（README 或 docs/）
- [ ] 无 regressions（现有功能不受影响）
- [ ] CLI 入口行为验证（bruce 命令正常运行）