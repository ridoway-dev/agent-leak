import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AgentLeakConfig, ScanOptions, Severity } from '../types/index.js';

export const DEFAULT_CONFIG: AgentLeakConfig = {
  failOn: 'HIGH',
  ignore: ['tests/**', 'test/**', 'demo/**', 'tests/fixtures/**', 'dist/**'],
  scanHistory: false,
  scanImages: false,
  includePii: false,
  maxFileSizeKb: 5120,
};

export function loadConfig(rootDir: string, customConfigPath?: string): AgentLeakConfig {
  const targetPath = customConfigPath
    ? resolve(rootDir, customConfigPath)
    : resolve(rootDir, '.agent-leak.json');

  if (existsSync(targetPath)) {
    try {
      const raw = readFileSync(targetPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        failOn: (parsed.failOn ? parsed.failOn.toUpperCase() : DEFAULT_CONFIG.failOn) as Severity,
        ignore: Array.isArray(parsed.ignore)
          ? [...(DEFAULT_CONFIG.ignore || []), ...parsed.ignore]
          : DEFAULT_CONFIG.ignore,
      };
    } catch {
      // Return default on parse failure
    }
  }

  return { ...DEFAULT_CONFIG };
}

export function mergeOptionsWithConfig(
  cliOptions: ScanOptions,
  config: AgentLeakConfig
): ScanOptions {
  return {
    ...cliOptions,
    failOn: (cliOptions.failOn ? cliOptions.failOn.toUpperCase() : config.failOn) as Severity,
    ignore: [...(config.ignore || []), ...(cliOptions.ignore || [])],
    includePii: cliOptions.includePii ?? config.includePii,
  };
}
