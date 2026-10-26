import * as readline from 'node:readline';
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { Finding, ScanOptions, ScanResult } from '../types/index.js';
import { scanDirectory } from '../scanners/directory-scanner.js';
import { scanGitDiff } from '../scanners/git-diff-scanner.js';
import { scanFileContent } from '../scanners/file-scanner.js';
import { isGitRepo } from '../utils/git.js';
import { maskSecret } from '../utils/masking.js';

export interface FixOptions extends ScanOptions {
  nonInteractive?: boolean;
}

function promptUser(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((res) => {
    rl.question(query, (ans) => res(ans.trim()));
  });
}

function displayFileContext(finding: Finding, cwd: string): void {
  const fullPath = resolve(cwd, finding.file);
  if (!existsSync(fullPath)) {
    console.log(pc.yellow(`  Cannot view file context: file not found at ${fullPath}`));
    return;
  }

  try {
    const raw = readFileSync(fullPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const targetLine = finding.line || 1;
    const start = Math.max(1, targetLine - 2);
    const end = Math.min(lines.length, targetLine + 2);

    console.log(`\n  ${pc.bold(finding.file)} (lines ${start}–${end}):`);
    for (let i = start; i <= end; i++) {
      const isTarget = i === targetLine;
      const prefix = isTarget ? pc.red(pc.bold('  > ')) : '    ';
      const lineNumStr = pc.dim(String(i).padStart(4) + ' | ');
      let lineText = lines[i - 1];

      // Safe display: always mask sample value if it appears in the line
      if (isTarget && finding.maskedValue) {
        lineText = maskSecret(lineText, 6, 4);
      }

      console.log(`${prefix}${lineNumStr}${lineText}`);
    }
    console.log('');
  } catch (err: any) {
    console.log(pc.yellow(`  Error reading file: ${err?.message || err}`));
  }
}

export async function runGuidedFix(targetPath: string = '.', options: FixOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const isInteractive = Boolean(process.stdin.isTTY && !options.nonInteractive);

  console.log(`\n${pc.bold(pc.cyan('⚡ AGENT LEAK'))} ${pc.dim('—')} ${pc.bold('Guided Fix Assistant')}\n`);

  // 1. Gather initial findings
  let initialFindings: Finding[] = [];
  const inGit = isGitRepo(cwd);

  if (options.stagedOnly && inGit) {
    const diffResult = await scanGitDiff(cwd, { stagedOnly: true });
    initialFindings = diffResult.findings;
  } else {
    const scanResult = scanDirectory(resolve(cwd, targetPath), options);
    initialFindings = scanResult.findings;
  }

  // Deduplicate findings by rule and line
  const findings: Finding[] = [];
  for (const f of initialFindings) {
    const exists = findings.some((prev) => prev.id === f.id && prev.file === f.file && prev.line === f.line);
    if (!exists) {
      findings.push(f);
    }
  }

  if (findings.length === 0) {
    console.log(`  ${pc.green('✓')} ${pc.bold('No issues found to fix!')} Your workspace is clean.\n`);
    console.log(`  ${pc.dim('Tip: Run "npx agent-leak diff --staged-only" before making your next Git commit.')}\n`);
    return;
  }

  console.log(
    `  Found ${pc.bold(pc.red(String(findings.length)))} issue(s) that need your attention.\n` +
      `  ${pc.dim('No changes will be made to your code without your explicit confirmation.')}\n`
  );

  // Non-interactive mode (CI or piped input)
  if (!isInteractive) {
    console.log(pc.yellow('  Running in non-interactive mode. Showing detailed instructions for each finding:\n'));
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      console.log(`  [Issue ${i + 1} of ${findings.length}] ${pc.bold(f.ruleName)} (${f.severity}) in ${f.file}${f.line ? `:${f.line}` : ''}`);
      if (f.whyItMatters) console.log(`    ${pc.dim('Why it matters:')} ${f.whyItMatters}`);
      if (f.fixGuide) console.log(`    ${pc.dim('How to fix:')}     ${f.fixGuide}`);
      if (f.rotationUrl) console.log(`    ${pc.dim('Rotate token:')}   ${f.rotationUrl}`);
      console.log('');
    }
    console.log(`  ${pc.bold('Next step:')} Fix the above items, then run: ${pc.cyan('npx agent-leak verify')}\n`);
    process.exit(1);
  }

  // Interactive mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    for (let idx = 0; idx < findings.length; idx++) {
      const f = findings[idx];
      let resolved = false;

      while (!resolved) {
        console.log(pc.dim('─'.repeat(55)));
        console.log(
          `  ${pc.bold(`[Issue ${idx + 1} of ${findings.length}]`)} ` +
            `${pc.bold(pc.red(f.ruleName))} ${pc.dim(`(${f.severity})`)}`
        );
        console.log(`  ${pc.dim('Location:')} ${pc.bold(f.file)}${f.line ? `:${f.line}` : ''}`);
        console.log(`  ${pc.dim('Sample:')}   ${pc.dim(f.maskedValue)}`);
        if (f.whyItMatters) {
          console.log(`  ${pc.dim('Risk:')}     ${pc.yellow(f.whyItMatters)}`);
        }
        console.log('');
        console.log('  What would you like to do?');
        console.log(`    ${pc.bold('[1]')} Show me how to fix this (Step-by-step instructions & rotation URL)`);
        console.log(`    ${pc.bold('[2]')} View file context (Show lines around this secret)`);
        console.log(`    ${pc.bold('[3]')} Ignore this finding (Explain risk & add to .agent-leakignore)`);
        console.log(`    ${pc.bold('[4]')} Verify my fix (Check if you fixed this issue)`);
        console.log(`    ${pc.bold('[5]')} Skip to next issue`);
        console.log(`    ${pc.bold('[q]')} Quit guided fix`);

        const choice = await promptUser(rl, `\n  Select option [1-5, q]: `);

        if (choice === '1') {
          console.log(`\n  ${pc.bold(pc.cyan('Remediation Guide:'))}`);
          if (f.fixGuide) {
            console.log(`  ${f.fixGuide}`);
          } else if (f.remediation) {
            console.log(`  ${f.remediation}`);
          }

          if (f.rotationUrl) {
            console.log(`\n  ${pc.bold(pc.yellow('⚠️  Token Rotation Required:'))}`);
            console.log(
              '  Deleting a secret from your file does NOT deactivate it! Anyone with prior access can still use it.'
            );
            console.log(`  Revoke and generate a new key at: ${pc.blue(pc.underline(f.rotationUrl))}`);
          }

          console.log(`\n  ${pc.dim('Once you update your file, select option [4] to verify the fix.')}\n`);
        } else if (choice === '2') {
          displayFileContext(f, cwd);
        } else if (choice === '3') {
          console.log(`\n  ${pc.bold(pc.yellow('⚠️  Risk of Suppressing Findings:'))}`);
          console.log(
            '  Ignoring a finding will stop Agent Leak warnings, but if this is a real secret,\n' +
              '  it will remain exposed to anyone who reads your code or repository history.'
          );

          const confirm = await promptUser(rl, '  Do you still want to ignore this finding? [y/N]: ');
          if (confirm.toLowerCase() === 'y') {
            const ignorePath = resolve(cwd, '.agent-leakignore');
            const patternToIgnore = f.line ? `${f.file}` : f.file;
            appendFileSync(ignorePath, `\n# Suppressed via agent-leak fix on ${new Date().toISOString().split('T')[0]}\n${patternToIgnore}\n`);
            console.log(`  ${pc.green('✓')} Added ${pc.cyan(patternToIgnore)} to .agent-leakignore.`);
            resolved = true;
          } else {
            console.log('  Suppression cancelled.');
          }
        } else if (choice === '4') {
          console.log(`  Verifying fix in ${pc.bold(f.file)}...`);
          const fullPath = resolve(cwd, f.file);
          if (!existsSync(fullPath)) {
            console.log(`  ${pc.green('✓')} File no longer exists. Finding resolved!`);
            resolved = true;
          } else {
            const freshContent = readFileSync(fullPath, 'utf8');
            const freshFindings = scanFileContent({ filePath: f.file, content: freshContent });
            const stillPresent = freshFindings.some((newF) => newF.id === f.id && newF.line === f.line);

            if (!stillPresent) {
              console.log(`  ${pc.green('✓')} ${pc.bold('Verified! Finding has been resolved.')}\n`);
              resolved = true;
            } else {
              console.log(
                `  ${pc.red('✗')} ${pc.bold('Finding still detected.')} Ensure you saved your changes in your editor and removed the secret.\n`
              );
            }
          }
        } else if (choice === '5') {
          console.log('  Skipping to next issue...');
          resolved = true;
        } else if (choice.toLowerCase() === 'q') {
          console.log(`\n  Exiting guided fix. Run ${pc.cyan('npx agent-leak verify')} once all fixes are complete.\n`);
          return;
        } else {
          console.log(pc.yellow('  Invalid choice. Please select 1, 2, 3, 4, 5, or q.'));
        }
      }
    }

    console.log(pc.dim('─'.repeat(55)));
    console.log(`\n  ${pc.green('✓')} ${pc.bold('Guided fix review completed!')}`);
    console.log(`  Run ${pc.cyan('npx agent-leak verify')} to run final verification before committing.\n`);
  } finally {
    rl.close();
  }
}
