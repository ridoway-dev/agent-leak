import { describe, it, expect } from 'vitest';
import { scanFileContent } from '../src/scanners/file-scanner.js';
import { renderJsonReport } from '../src/reporters/json-reporter.js';
import { renderSarifReport } from '../src/reporters/sarif-reporter.js';
import { renderConsoleReport } from '../src/reporters/console-reporter.js';
import { ScanResult } from '../src/types/index.js';

describe('Security Non-Leak Guarantee (Section 30)', () => {
  const FAKE_RAW_SECRET = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  const FAKE_RAW_DB_PASS = 'super_secret_db_password_999';
  const FAKE_RAW_DB_URL = `postgres://postgres:${FAKE_RAW_DB_PASS}@prod.internal.net:5432/app`;

  it('guarantees Finding objects never store raw secret values', () => {
    const code = `
      const gh = "${FAKE_RAW_SECRET}";
      const db = "${FAKE_RAW_DB_URL}";
    `;

    const findings = scanFileContent({ filePath: 'src/secrets.ts', content: code });

    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.maskedValue).not.toContain(FAKE_RAW_SECRET);
      expect(f.maskedValue).not.toContain(FAKE_RAW_DB_PASS);
      // Ensure Finding has no secret field
      expect((f as any).rawSecret).toBeUndefined();
      expect((f as any).secret).toBeUndefined();
    }
  });

  it('guarantees JSON reporter NEVER outputs raw secrets', () => {
    const code = `const key = "${FAKE_RAW_SECRET}";`;
    const findings = scanFileContent({ filePath: 'src/config.ts', content: code });

    const mockResult: ScanResult = {
      targetPath: '/project',
      findings,
      totalFilesScanned: 1,
      scanDurationMs: 12,
      summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0, total: 1 },
      hasExceededThreshold: true,
    };

    const json = renderJsonReport(mockResult);
    expect(json).not.toContain(FAKE_RAW_SECRET);
    expect(json).toContain('ghp_');
    expect(json).toContain('****');
  });

  it('guarantees SARIF reporter NEVER outputs raw secrets', () => {
    const code = `const key = "${FAKE_RAW_SECRET}";`;
    const findings = scanFileContent({ filePath: 'src/config.ts', content: code });

    const mockResult: ScanResult = {
      targetPath: '/project',
      findings,
      totalFilesScanned: 1,
      scanDurationMs: 12,
      summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0, total: 1 },
      hasExceededThreshold: true,
    };

    const sarif = renderSarifReport(mockResult);
    expect(sarif).not.toContain(FAKE_RAW_SECRET);
  });

  it('guarantees Console reporter NEVER outputs raw secrets even with explain enabled', () => {
    const fakeOpenAI = ['sk', 'proj', 'DEMOFAKEOPENAIKEY99887766554433221100'].join('-');
    const fakeStripe = ['sk', 'live', '51DEMOFAKESTRIPEKEY9988776655443322'].join('_');
    const code = `
      const openai = "${fakeOpenAI}";
      const stripe = "${fakeStripe}";
    `;
    const findings = scanFileContent({ filePath: 'src/config.ts', content: code });

    const mockResult: ScanResult = {
      targetPath: '/project',
      findings,
      totalFilesScanned: 1,
      scanDurationMs: 12,
      summary: { critical: 2, high: 0, medium: 0, low: 0, info: 0, total: 2 },
      hasExceededThreshold: true,
    };

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));

    try {
      renderConsoleReport(mockResult, { explain: true });
      const combined = logs.join('\n');
      expect(combined).not.toContain(fakeOpenAI);
      expect(combined).not.toContain(fakeStripe);
      expect(combined).toContain('sk-proj');
      expect(combined).toContain('sk_live_');
    } finally {
      console.log = originalLog;
    }
  });
});
