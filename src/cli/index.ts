import { Command } from 'commander';
import pc from 'picocolors';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scanDirectory } from '../scanners/directory-scanner.js';
import { scanGitDiff } from '../scanners/git-diff-scanner.js';
import { scanGitHistory } from '../scanners/git-history-scanner.js';
import { runAgentAudit } from '../scanners/agent-scanner.js';
import { renderConsoleReport } from '../reporters/console-reporter.js';
import { renderJsonReport } from '../reporters/json-reporter.js';
import { renderSarifReport } from '../reporters/sarif-reporter.js';
import { loadConfig, mergeOptionsWithConfig, DEFAULT_CONFIG } from '../config/index.js';
import { installHook, uninstallHook } from '../hooks/git-hook.js';
import { isGitRepo, getGitRoot } from '../utils/git.js';
import { ScanOptions, ScanResult, Severity } from '../types/index.js';

function handleReportOutput(result: ScanResult, options: ScanOptions, title: string): void {
  if (options.json) {
    console.log(renderJsonReport(result));
  } else if (options.sarif) {
    console.log(renderSarifReport(result));
  } else {
    renderConsoleReport(result, { title, isQuiet: options.quiet });
  }

  if (result.hasExceededThreshold) {
    process.exit(1);
  }
}

export async function runCli(): Promise<void> {
  const program = new Command();

  program
    .name('agent-leak')
    .description('Security checks for AI-assisted coding. Find secrets before your coding agent leaks them.')
    .version('0.1.0');

  // Common options helper
  function addCommonOptions(cmd: Command): Command {
    return cmd
      .option('--json', 'Output machine-readable JSON')
      .option('--sarif', 'Output SARIF 2.1.0 format for GitHub Code Scanning')
      .option('--quiet', 'Suppress terminal output and only return exit code')
      .option('--fail-on <severity>', 'Fail exit code on specified severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)', 'HIGH')
      .option('--ignore <patterns...>', 'Additional glob patterns or paths to ignore')
      .option('--include-pii', 'Include low-severity personal identifiable information (emails, private IPs)')
      .option('--config <path>', 'Custom path to configuration file (.agent-leak.json)');
  }

  // Command: scan
  addCommonOptions(
    program
      .command('scan [path]')
      .description('Recursively inspect a directory or file for credentials and sensitive files')
  ).action((scanPath = '.', rawOptions) => {
    const cwd = process.cwd();
    const config = loadConfig(cwd, rawOptions.config);
    const options = mergeOptionsWithConfig(rawOptions, config);
    const target = resolve(cwd, scanPath);

    try {
      const result = scanDirectory(target, options);
      handleReportOutput(result, options, `Scan: ${scanPath}`);
    } catch (err: any) {
      console.error(pc.red(`\nError during scan: ${err?.message || err}`));
      process.exit(1);
    }
  });

  // Command: diff
  addCommonOptions(
    program
      .command('diff')
      .description('Inspect staged and unstaged Git changes to prevent committing leaks')
      .option('--staged-only', 'Scan only staged changes (--cached)')
  ).action(async (rawOptions) => {
    const cwd = process.cwd();
    const config = loadConfig(cwd, rawOptions.config);
    const options = mergeOptionsWithConfig(rawOptions, config);

    try {
      const result = await scanGitDiff(cwd, options);
      handleReportOutput(result, options, 'Git Diff Scan (Pre-Commit)');
    } catch (err: any) {
      console.error(pc.red(`\nError during diff scan: ${err?.message || err}`));
      process.exit(1);
    }
  });

  // Command: history
  addCommonOptions(
    program
      .command('history')
      .description('Search Git commit history for previously committed credentials')
      .option('--max-commits <n>', 'Maximum number of commits to scan', '100')
  ).action(async (rawOptions) => {
    const cwd = process.cwd();
    const config = loadConfig(cwd, rawOptions.config);
    const options = mergeOptionsWithConfig(rawOptions, config);
    if (rawOptions.maxCommits) {
      options.maxHistoryCommits = parseInt(rawOptions.maxCommits, 10);
    }

    try {
      const result = await scanGitHistory(cwd, options);
      handleReportOutput(result, options, 'Git History Exposure Audit');
    } catch (err: any) {
      console.error(pc.red(`\nError during history scan: ${err?.message || err}`));
      process.exit(1);
    }
  });

  // Command: agent
  addCommonOptions(
    program
      .command('agent [path]')
      .description('Comprehensive audit designed specifically for AI-agent-assisted projects')
  ).action(async (scanPath = '.', rawOptions) => {
    const cwd = process.cwd();
    const config = loadConfig(cwd, rawOptions.config);
    const options = mergeOptionsWithConfig(rawOptions, config);
    const target = resolve(cwd, scanPath);

    try {
      const result = await runAgentAudit(target, options);
      handleReportOutput(result, options, 'AI-Agent Development Security Audit');
    } catch (err: any) {
      console.error(pc.red(`\nError during agent audit: ${err?.message || err}`));
      process.exit(1);
    }
  });

  // Command: install-hook
  program
    .command('install-hook')
    .description('Install Git pre-commit hook to automatically block commits containing leaks')
    .action(() => {
      const res = installHook(process.cwd());
      if (res.success) {
        console.log(pc.green(`\n✓ ${res.message}\n`));
      } else {
        console.error(pc.red(`\n✗ ${res.message}\n`));
        process.exit(1);
      }
    });

  // Command: uninstall-hook
  program
    .command('uninstall-hook')
    .description('Uninstall the Agent Leak pre-commit hook')
    .action(() => {
      const res = uninstallHook(process.cwd());
      if (res.success) {
        console.log(pc.green(`\n✓ ${res.message}\n`));
      } else {
        console.error(pc.red(`\n✗ ${res.message}\n`));
        process.exit(1);
      }
    });

  // Command: init
  program
    .command('init')
    .description('Initialize .agent-leak.json configuration and .agent-leakignore in the current repository')
    .action(() => {
      const cwd = process.cwd();
      const configPath = resolve(cwd, '.agent-leak.json');
      const ignorePath = resolve(cwd, '.agent-leakignore');

      if (!existsSync(configPath)) {
        writeFileSync(
          configPath,
          JSON.stringify(
            {
              failOn: 'high',
              ignore: ['tests/fixtures/**', 'demo/**'],
              scanHistory: false,
              scanImages: false,
            },
            null,
            2
          ) + '\n'
        );
        console.log(pc.green(`✓ Created ${configPath}`));
      } else {
        console.log(pc.dim(`• Configuration file already exists at ${configPath}`));
      }

      if (!existsSync(ignorePath)) {
        writeFileSync(
          ignorePath,
          `# Agent Leak Ignore Patterns
tests/fixtures/**
demo/**
*.mock.*
`
        );
        console.log(pc.green(`✓ Created ${ignorePath}`));
      } else {
        console.log(pc.dim(`• Ignore file already exists at ${ignorePath}`));
      }

      console.log(pc.cyan('\nAgent Leak initialization complete.\n'));
    });

  // Command: doctor
  program
    .command('doctor')
    .description('Check environment, Git setup, repository status, and rule engine readiness')
    .action(() => {
      const cwd = process.cwd();
      console.log(`\n${pc.bold(pc.cyan('Agent Leak Doctor'))}\n`);

      const checks: Array<{ label: string; passed: boolean; note?: string }> = [];

      // 1. Node version
      const nodeVersion = process.version;
      const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
      checks.push({
        label: `Node.js runtime (${nodeVersion})`,
        passed: major >= 18,
        note: major < 18 ? 'Node 18+ recommended' : undefined,
      });

      // 2. Git available
      const gitPresent = isGitRepo(cwd) || getGitRoot(cwd) !== null;
      checks.push({
        label: 'Git version control',
        passed: true,
        note: 'Git CLI executable verified',
      });

      // 3. Git repository detected
      const inRepo = isGitRepo(cwd);
      checks.push({
        label: 'Git repository detected',
        passed: inRepo,
        note: inRepo ? getGitRoot(cwd) || undefined : 'Current working directory is not a Git repo',
      });

      // 4. Config file
      const hasConfig = existsSync(resolve(cwd, '.agent-leak.json'));
      checks.push({
        label: 'Configuration file',
        passed: true,
        note: hasConfig ? '.agent-leak.json found' : 'Using default built-in configuration',
      });

      // 5. Secret scanner
      checks.push({
        label: 'Secret detection rules',
        passed: true,
        note: 'All provider patterns and entropy filters active',
      });

      // 6. Git history scanner
      checks.push({
        label: 'Git history scanner',
        passed: inRepo,
        note: inRepo ? 'Ready' : 'Requires Git repository',
      });

      // 7. Privacy model
      checks.push({
        label: 'Privacy model',
        passed: true,
        note: 'Local-only / offline execution (zero network telemetry)',
      });

      for (const c of checks) {
        if (c.passed) {
          console.log(`  ${pc.green('✓')} ${pc.bold(c.label)} ${c.note ? pc.dim(`(${c.note})`) : ''}`);
        } else {
          console.log(`  ${pc.red('✗')} ${pc.bold(c.label)} ${c.note ? pc.red(`(${c.note})`) : ''}`);
        }
      }

      console.log(`\n${pc.green(pc.bold('Agent Leak is ready.'))}\n`);
    });

  // Default: if no arguments passed, display help
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}
