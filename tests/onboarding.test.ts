import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { scanDirectory } from '../src/scanners/directory-scanner.js';
import { scanGitDiff } from '../src/scanners/git-diff-scanner.js';
import { scanFileContent } from '../src/scanners/file-scanner.js';
import { isGitRepo } from '../src/utils/git.js';
import { runGuidedFix } from '../src/cli/fix.js';

describe('Beginner Onboarding & User Journeys (Phase 8 Validation)', () => {
  let tempBase: string;

  beforeAll(() => {
    tempBase = mkdtempSync(resolve(tmpdir(), 'agent-leak-onboarding-'));
  });

  afterAll(() => {
    try {
      rmSync(tempBase, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // Scenario 1: First-time user with no configuration file
  it('Scenario 1: Runs smoothly for a first-time user without any config file', () => {
    const projectDir = resolve(tempBase, 'proj-no-config');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(resolve(projectDir, 'index.ts'), 'console.log("Hello, World!");\n');

    const result = scanDirectory(projectDir);
    expect(result.findings.length).toBe(0);
    expect(result.totalFilesScanned).toBe(1);
    expect(result.hasExceededThreshold).toBe(false);
  });

  // Scenario 2: Project containing a fake secret
  it('Scenario 2: Detects and masks a fake API key with plain-English remediation', () => {
    const projectDir = resolve(tempBase, 'proj-fake-secret');
    mkdirSync(projectDir, { recursive: true });
    const fakeKey = 'sk-proj-DEMOTESTINGONBOARDINGKEY99887766554433221100';
    writeFileSync(resolve(projectDir, 'api.ts'), `const key = "${fakeKey}";\n`);

    const result = scanDirectory(projectDir);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.hasExceededThreshold).toBe(true);

    const f = result.findings[0];
    expect(f.maskedValue).not.toContain(fakeKey);
    expect(f.whyItMatters).toBeDefined();
    expect(f.fixGuide).toBeDefined();
    expect(f.rotationUrl).toBe('https://platform.openai.com/api-keys');
  });

  // Scenario 3: Project with no detected findings
  it('Scenario 3: Returns clean report when project has no findings', () => {
    const projectDir = resolve(tempBase, 'proj-clean');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(resolve(projectDir, 'utils.ts'), 'export function add(a: number, b: number) { return a + b; }\n');

    const result = scanDirectory(projectDir);
    expect(result.findings.length).toBe(0);
    expect(result.summary.total).toBe(0);
    expect(result.hasExceededThreshold).toBe(false);
  });

  // Scenario 4: Project with false-positive examples (placeholders & inline ignores)
  it('Scenario 4: Gracefully ignores placeholders and suppressed code comments', () => {
    const projectDir = resolve(tempBase, 'proj-false-positives');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      resolve(projectDir, 'config.ts'),
      `
      // Placeholder string (should be ignored)
      const openai = "sk-proj-YOUR_API_KEY_HERE";
      const dummy = "sk-test-example-dummy-token";

      // agent-leak-ignore
      const sample = "sk-proj-SUPPRESSEDFAKEKEY12345678901234567890";
    `
    );

    const result = scanDirectory(projectDir);
    expect(result.findings.length).toBe(0);
  });

  // Scenario 5: Non-Git directory handling
  it('Scenario 5: Correctly identifies non-Git directories without crashing', () => {
    const nonGitDir = resolve(tempBase, 'non-git-dir');
    mkdirSync(nonGitDir, { recursive: true });

    expect(isGitRepo(nonGitDir)).toBe(false);

    // scanDirectory works without Git
    const result = scanDirectory(nonGitDir);
    expect(result.findings.length).toBe(0);
  });

  // Scenario 6: Git repository with a staged secret
  it('Scenario 6: Catches staged secret in Git diff and blocks commit', async () => {
    const gitDir = resolve(tempBase, 'git-repo');
    mkdirSync(gitDir, { recursive: true });
    execFileSync('git', ['init'], { cwd: gitDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: gitDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@test.local'], { cwd: gitDir, stdio: 'ignore' });

    const fakeKey = 'sk-proj-STAGEDFAKETOKEN99887766554433221100';
    writeFileSync(resolve(gitDir, 'client.ts'), `export const token = "${fakeKey}";\n`);
    execFileSync('git', ['add', 'client.ts'], { cwd: gitDir, stdio: 'ignore' });

    const diffResult = await scanGitDiff(gitDir, { stagedOnly: true });
    expect(diffResult.findings.length).toBeGreaterThan(0);
    expect(diffResult.hasExceededThreshold).toBe(true);
    expect(diffResult.findings[0].maskedValue).not.toContain(fakeKey);
  });

  // Scenario 7: User fixes finding and verification passes
  it('Scenario 7: Remediation verification passes after replacing secret with process.env', async () => {
    const gitDir = resolve(tempBase, 'git-repo');
    // Replace secret with environment variable
    writeFileSync(resolve(gitDir, 'client.ts'), `export const token = process.env.OPENAI_API_KEY;\n`);
    execFileSync('git', ['add', 'client.ts'], { cwd: gitDir, stdio: 'ignore' });

    const verifyResult = await scanGitDiff(gitDir, { stagedOnly: true });
    expect(verifyResult.findings.length).toBe(0);
    expect(verifyResult.hasExceededThreshold).toBe(false);
  });

  // Scenario 8: CI / Non-interactive execution
  it('Scenario 8: Guided fix in non-interactive mode safely prints remediation without hanging', async () => {
    const nonInteractiveDir = resolve(tempBase, 'non-interactive-proj');
    mkdirSync(nonInteractiveDir, { recursive: true });
    writeFileSync(
      resolve(nonInteractiveDir, 'db.ts'),
      'export const DB = "postgres://admin:super_secret_pw123@db.prod.internal:5432/main";\n'
    );

    // Call runGuidedFix in non-interactive mode (simulating CI)
    const logs: string[] = [];
    const origLog = console.log;
    const origExit = process.exit;
    let exitCode: number | undefined;

    console.log = (...args: any[]) => logs.push(args.join(' '));
    // @ts-ignore
    process.exit = (code?: number) => {
      exitCode = code;
      throw new Error(`EXIT_${code}`);
    };

    try {
      await runGuidedFix(nonInteractiveDir, { nonInteractive: true });
    } catch (e: any) {
      if (!e.message.startsWith('EXIT_')) {
        throw e;
      }
    } finally {
      console.log = origLog;
      process.exit = origExit;
    }

    const output = logs.join('\n');
    expect(output).toContain('Running in non-interactive mode');
    expect(output).toContain('How to fix');
    expect(exitCode).toBe(1); // Exits 1 to indicate unaddressed findings in CI
  });
});
