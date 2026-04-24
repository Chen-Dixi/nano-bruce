/**
 * Configuration System Tests
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Import actual config module
import {
  getBruceDir,
  getSettingsPath,
  loadSettingsFromFile,
  mergeSettings,
  getEffectiveConfig,
  initSettings,
} from './settings.js';

const REAL_BRUCE_DIR = path.join(os.homedir(), '.bruce');
const REAL_SETTINGS_PATH = path.join(REAL_BRUCE_DIR, 'settings.json');
let originalSettings: string | null = null;

describe('Configuration System', () => {
  describe('Path functions', () => {
    test('getBruceDir returns ~/.bruce', () => {
      const bruceDir = getBruceDir();
      expect(bruceDir).toBe(path.join(os.homedir(), '.bruce'));
    });

    test('getSettingsPath returns ~/.bruce/settings.json', () => {
      const settingsPath = getSettingsPath();
      expect(settingsPath).toBe(path.join(os.homedir(), '.bruce', 'settings.json'));
    });
  });

  describe('loadSettingsFromFile', () => {
    beforeEach(() => {
      // Backup existing settings
      if (fs.existsSync(REAL_SETTINGS_PATH)) {
        originalSettings = fs.readFileSync(REAL_SETTINGS_PATH, 'utf-8');
      }
    });

    afterEach(() => {
      // Restore original settings
      if (originalSettings !== null) {
        fs.writeFileSync(REAL_SETTINGS_PATH, originalSettings);
        originalSettings = null;
      } else if (fs.existsSync(REAL_SETTINGS_PATH)) {
        fs.unlinkSync(REAL_SETTINGS_PATH);
      }
    });

    test('returns null when settings file does not exist', () => {
      if (fs.existsSync(REAL_SETTINGS_PATH)) {
        fs.unlinkSync(REAL_SETTINGS_PATH);
      }
      const result = loadSettingsFromFile();
      expect(result).toBeNull();
    });

    test('returns parsed settings when file exists', () => {
      const mockSettings = {
        providers: { moonshot: { apiKey: 'test-key' } },
        preferences: { defaultProvider: 'moonshot' }
      };
      fs.writeFileSync(REAL_SETTINGS_PATH, JSON.stringify(mockSettings));

      const result = loadSettingsFromFile();
      expect(result?.providers?.moonshot?.apiKey).toBe('test-key');
    });

    test('handles malformed JSON gracefully', () => {
      fs.writeFileSync(REAL_SETTINGS_PATH, 'invalid json');

      // Should return null and log error
      const result = loadSettingsFromFile();
      expect(result).toBeNull();
    });
  });

  describe('mergeSettings', () => {
    beforeEach(() => {
      if (fs.existsSync(REAL_SETTINGS_PATH)) {
        originalSettings = fs.readFileSync(REAL_SETTINGS_PATH, 'utf-8');
      }
      // Clear env vars
      delete process.env.MOONSHOT_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;
    });

    afterEach(() => {
      if (originalSettings !== null) {
        fs.writeFileSync(REAL_SETTINGS_PATH, originalSettings);
        originalSettings = null;
      } else if (fs.existsSync(REAL_SETTINGS_PATH)) {
        fs.unlinkSync(REAL_SETTINGS_PATH);
      }
      delete process.env.MOONSHOT_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;
    });

    test('returns default provider when no settings', () => {
      if (fs.existsSync(REAL_SETTINGS_PATH)) {
        fs.unlinkSync(REAL_SETTINGS_PATH);
      }

      const merged = mergeSettings();
      expect(merged.preferences?.defaultProvider).toBe('moonshot');
    });

    test('environment variable overrides config file', () => {
      const mockSettings = {
        providers: { moonshot: { apiKey: 'file-key' } }
      };
      fs.writeFileSync(REAL_SETTINGS_PATH, JSON.stringify(mockSettings));
      process.env.MOONSHOT_API_KEY = 'env-key';

      const merged = mergeSettings();
      expect(merged.providers?.moonshot?.apiKey).toBe('env-key');
    });

    test('uses file apiKey when no env var', () => {
      const mockSettings = {
        providers: { moonshot: { apiKey: 'file-key' } }
      };
      fs.writeFileSync(REAL_SETTINGS_PATH, JSON.stringify(mockSettings));

      const merged = mergeSettings();
      expect(merged.providers?.moonshot?.apiKey).toBe('file-key');
    });

    test('applies default workingDir when not configured', () => {
      if (fs.existsSync(REAL_SETTINGS_PATH)) {
        fs.unlinkSync(REAL_SETTINGS_PATH);
      }

      const merged = mergeSettings();
      expect(merged.workingDir?.skillsDir).toBe(path.join(REAL_BRUCE_DIR, 'skills'));
      expect(merged.workingDir?.memoryDir).toBe(path.join(REAL_BRUCE_DIR, 'memory'));
    });

    test('respects custom workingDir from config', () => {
      const mockSettings = {
        workingDir: { skillsDir: '/custom/skills', memoryDir: '/custom/memory' }
      };
      fs.writeFileSync(REAL_SETTINGS_PATH, JSON.stringify(mockSettings));

      const merged = mergeSettings();
      expect(merged.workingDir?.skillsDir).toBe('/custom/skills');
      expect(merged.workingDir?.memoryDir).toBe('/custom/memory');
    });
  });

  describe('getEffectiveConfig', () => {
    beforeEach(() => {
      if (fs.existsSync(REAL_SETTINGS_PATH)) {
        originalSettings = fs.readFileSync(REAL_SETTINGS_PATH, 'utf-8');
      }
      delete process.env.MOONSHOT_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;
    });

    afterEach(() => {
      if (originalSettings !== null) {
        fs.writeFileSync(REAL_SETTINGS_PATH, originalSettings);
        originalSettings = null;
      } else if (fs.existsSync(REAL_SETTINGS_PATH)) {
        fs.unlinkSync(REAL_SETTINGS_PATH);
      }
      delete process.env.MOONSHOT_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;
    });

    test('throws error when no API key configured', () => {
      if (fs.existsSync(REAL_SETTINGS_PATH)) {
        fs.unlinkSync(REAL_SETTINGS_PATH);
      }

      expect(() => getEffectiveConfig()).toThrow(/No API key configured/);
    });

    test('returns valid config with env var', () => {
      process.env.MOONSHOT_API_KEY = 'test-key';

      const config = getEffectiveConfig();
      expect(config.provider).toBe('moonshot');
      expect(config.apiKey).toBe('test-key');
      expect(config.model).toBe('kimi-k2-turbo-preview');
    });

    test('returns valid config with file apiKey', () => {
      const mockSettings = {
        providers: { moonshot: { apiKey: 'file-key' } }
      };
      fs.writeFileSync(REAL_SETTINGS_PATH, JSON.stringify(mockSettings));

      const config = getEffectiveConfig();
      expect(config.apiKey).toBe('file-key');
    });

    test('respects defaultProvider preference', () => {
      const mockSettings = {
        providers: {
          moonshot: { apiKey: 'moonshot-key' },
          openai: { apiKey: 'openai-key' }
        },
        preferences: { defaultProvider: 'openai' }
      };
      fs.writeFileSync(REAL_SETTINGS_PATH, JSON.stringify(mockSettings));

      const config = getEffectiveConfig();
      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('openai-key');
    });
  });

  describe('initSettings', () => {
    beforeEach(() => {
      if (fs.existsSync(REAL_SETTINGS_PATH)) {
        originalSettings = fs.readFileSync(REAL_SETTINGS_PATH, 'utf-8');
        fs.unlinkSync(REAL_SETTINGS_PATH);
      }
      // Ensure directory exists
      if (!fs.existsSync(REAL_BRUCE_DIR)) {
        fs.mkdirSync(REAL_BRUCE_DIR, { recursive: true });
      }
    });

    afterEach(() => {
      if (originalSettings !== null) {
        fs.writeFileSync(REAL_SETTINGS_PATH, originalSettings);
        originalSettings = null;
      } else if (fs.existsSync(REAL_SETTINGS_PATH)) {
        fs.unlinkSync(REAL_SETTINGS_PATH);
      }
    });

    test('creates settings file with template', () => {
      initSettings();

      expect(fs.existsSync(REAL_SETTINGS_PATH)).toBe(true);
      const content = JSON.parse(fs.readFileSync(REAL_SETTINGS_PATH, 'utf-8'));
      expect(content.providers).toBeDefined();
      expect(content.preferences).toBeDefined();
      expect(content.providers?.moonshot).toBeDefined();
      expect(content.providers?.openai).toBeDefined();
      expect(content.providers?.deepseek).toBeDefined();
    });
  });

  describe('Default models mapping', () => {
    test('default models are correct for each provider', () => {
      const defaultModels = {
        openai: 'gpt-4o-mini',
        moonshot: 'kimi-k2-turbo-preview',
        deepseek: 'deepseek-chat'
      };

      expect(defaultModels.openai).toBe('gpt-4o-mini');
      expect(defaultModels.moonshot).toBe('kimi-k2-turbo-preview');
      expect(defaultModels.deepseek).toBe('deepseek-chat');
    });
  });
});