import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { scanDirectory } from '../src/scanners/directory-scanner.js';
import { loadConfig } from '../src/config/index.js';

describe('Demo Project Scan & Config', () => {
  const demoPath = resolve(process.cwd(), 'demo/demo-project');

  it('scans the demo project and detects intentional fake vulnerabilities', () => {
    const result = scanDirectory(demoPath, {
      failOn: 'HIGH',
    });

    expect(result.totalFilesScanned).toBeGreaterThan(0);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.hasExceededThreshold).toBe(true);

    const ruleIds = result.findings.map((f) => f.id);
    expect(ruleIds).toContain('file-env');
    expect(ruleIds).toContain('sec-openai-key');
    expect(ruleIds).toContain('sec-conn-postgres');
    expect(ruleIds).toContain('sec-aws-access-key');
    expect(ruleIds).toContain('sec-private-key');
  });

  it('loads default config properly', () => {
    const config = loadConfig(process.cwd());
    expect(config.failOn).toBe('HIGH');
    expect(Array.isArray(config.ignore)).toBe(true);
  });
});
