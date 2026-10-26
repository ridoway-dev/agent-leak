import { describe, it, expect } from 'vitest';
import { scanFileContent } from '../src/scanners/file-scanner.js';

describe('False Positive & Suppression Handling', () => {
  it('does NOT flag obvious placeholder values', () => {
    const placeholders = [
      'const key = "YOUR_API_KEY_HERE";',
      'const apiKey = "<API_KEY>";',
      'export const secret = "insert_token_here";',
      'const testKey = "sk-test-example";',
      'const dummy = "dummy_token_12345";',
      'const todo = "changeme";',
    ];

    for (const code of placeholders) {
      const findings = scanFileContent({ filePath: 'src/example.ts', content: code });
      const secretFindings = findings.filter((f) => f.type === 'secret');
      expect(secretFindings.length).toBe(0);
    }
  });

  it('respects inline suppression comment on the same line', () => {
    const code = 'const apiKey = "sk-proj-DEMOFAKEKEY12345678901234567890"; // agent-leak-ignore';
    const findings = scanFileContent({ filePath: 'src/config.ts', content: code });
    const secretFindings = findings.filter((f) => f.type === 'secret');
    expect(secretFindings.length).toBe(0);
  });

  it('respects inline suppression comment on the preceding line', () => {
    const code = [
      '// agent-leak-ignore',
      'const apiKey = "sk-proj-DEMOFAKEKEY12345678901234567890";',
    ].join('\n');

    const findings = scanFileContent({ filePath: 'src/config.ts', content: code });
    const secretFindings = findings.filter((f) => f.type === 'secret');
    expect(secretFindings.length).toBe(0);
  });
});
