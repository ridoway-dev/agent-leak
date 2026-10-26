import { describe, it, expect } from 'vitest';
import { parseDiffOutput } from '../src/utils/git.js';
import { scanDirectory } from '../src/scanners/directory-scanner.js';
import { scanFileContent } from '../src/scanners/file-scanner.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Edge Cases & Robustness', () => {
  it('parses Git diffs with quoted filenames containing spaces', () => {
    const rawDiff = `diff --git "a/folder with spaces/config file.ts" "b/folder with spaces/config file.ts"
index 12345..67890 100644
--- "a/folder with spaces/config file.ts"
+++ "b/folder with spaces/config file.ts"
@@ -1,2 +1,3 @@
 export const port = 8080;
+export const apiKey = "sk-proj-DEMOFAKEKEY12345678901234567890";
`;

    const diffs = parseDiffOutput(rawDiff);
    expect(diffs.length).toBe(1);
    expect(diffs[0].filePath).toBe('folder with spaces/config file.ts');
    expect(diffs[0].additions.length).toBe(1);
    expect(diffs[0].additions[0].line).toBe(2);
  });

  it('skips binary diffs without error', () => {
    const rawDiff = `diff --git a/assets/logo.png b/assets/logo.png
index 11111..22222 100644
Binary files a/assets/logo.png and b/assets/logo.png differ
`;

    const diffs = parseDiffOutput(rawDiff);
    expect(diffs.length).toBe(1);
    expect(diffs[0].filePath).toBe('assets/logo.png');
    expect(diffs[0].additions.length).toBe(0);
  });

  it('gracefully handles non-existent paths', () => {
    expect(() => {
      scanDirectory('./non_existent_folder_xyz_123');
    }).toThrow(/does not exist/);
  });

  it('skips binary content containing null bytes', () => {
    const tmpDir = resolve(process.cwd(), 'tests/fixtures/tmp_binary');
    mkdirSync(tmpDir, { recursive: true });

    const binaryFile = resolve(tmpDir, 'sample.dat');
    // Buffer with null bytes and a fake key
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x00, 0x73, 0x6b, 0x2d, 0x70, 0x72, 0x6f, 0x6a]);
    writeFileSync(binaryFile, buf);

    try {
      const res = scanDirectory(tmpDir);
      // Binary file should be skipped from scanned count
      expect(res.totalFilesScanned).toBe(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('populates actionable remediation metadata on findings', () => {
    const code = 'const key = "sk-proj-DEMOFAKEKEY12345678901234567890";';
    const findings = scanFileContent({ filePath: 'src/config.ts', content: code });

    expect(findings.length).toBeGreaterThan(0);
    const finding = findings[0];
    expect(finding.remediation).toBeDefined();
    expect(finding.whyItMatters).toBeDefined();
    expect(finding.fixGuide).toBeDefined();
    expect(finding.agentInstruction).toBeDefined();
  });
});
