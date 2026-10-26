import pc from 'picocolors';
import { Finding, ScanResult, Severity } from '../types/index.js';

function formatSeverityBadge(severity: Severity): string {
  switch (severity) {
    case 'CRITICAL':
      return pc.bgRed(pc.bold(pc.white(' CRITICAL ')));
    case 'HIGH':
      return pc.red(pc.bold(' HIGH     '));
    case 'MEDIUM':
      return pc.yellow(pc.bold(' MEDIUM   '));
    case 'LOW':
      return pc.cyan(' LOW      ');
    case 'INFO':
      return pc.dim(' INFO     ');
  }
}

export function renderConsoleReport(
  result: ScanResult,
  options: { title?: string; isQuiet?: boolean; explain?: boolean } = {}
): void {
  if (options.isQuiet) return;

  const title = options.title || 'Agent Leak Scan';
  console.log(`\n${pc.bold(pc.cyan('⚡ AGENT LEAK'))} ${pc.dim('—')} ${pc.bold(title)}\n`);

  if (result.findings.length === 0) {
    console.log(
      `  ${pc.green('✓')} ${pc.bold('No sensitive leaks detected!')} ${pc.dim(
        `(${result.totalFilesScanned} items scanned in ${result.scanDurationMs}ms)`
      )}`
    );
    console.log(
      `  ${pc.dim('Checked:')} ${pc.dim('API keys, connection strings, private keys, .env files, and AI agent session dumps.')}`
    );
    console.log(
      `  ${pc.dim('Tip:')}     ${pc.dim('Always verify that .env and private key files are listed in your .gitignore.')}\n`
    );
    return;
  }

  // Sort findings by severity (CRITICAL first)
  const severityRank: Record<Severity, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFO: 1,
  };

  const sortedFindings = [...result.findings].sort(
    (a, b) => severityRank[b.severity] - severityRank[a.severity]
  );

  // Group findings by file
  const grouped = new Map<string, Finding[]>();
  for (const f of sortedFindings) {
    const list = grouped.get(f.file) || [];
    // Skip exact duplicate findings on the same file, line, and rule
    const isDup = list.some((existing) => existing.id === f.id && existing.line === f.line);
    if (!isDup) {
      list.push(f);
    }
    grouped.set(f.file, list);
  }

  for (const [file, findings] of grouped.entries()) {
    console.log(`  ${pc.underline(pc.bold(file))}`);

    for (const f of findings) {
      const loc = f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : '';
      const badge = formatSeverityBadge(f.severity);
      const histTag = f.isHistorical ? pc.bgMagenta(pc.white(' HISTORICAL ')) + ' ' : '';

      console.log(`    ${badge} ${histTag}${pc.bold(f.ruleName)}`);
      console.log(`             ${pc.dim('Location:')} ${file}${loc}`);
      if (f.commitHash) {
        console.log(`             ${pc.dim('Commit:')}   ${pc.yellow(f.commitHash)} ${pc.dim(`by ${f.commitAuthor || 'unknown'}`)} ${pc.red('(Rotation required!)')}`);
      }
      console.log(`             ${pc.dim('Sample:')}   ${pc.dim(f.maskedValue)}`);
      if (f.whyItMatters) {
        console.log(`             ${pc.dim('Risk:')}     ${pc.yellow(f.whyItMatters)}`);
      }
      if (f.remediation) {
        console.log(`             ${pc.dim('Action:')}   ${pc.italic(f.remediation)}`);
      }
      if (f.fixGuide && (options.explain || options.title?.includes('Audit') || f.severity === 'CRITICAL')) {
        console.log(`             ${pc.dim('How to fix:')} ${pc.cyan(f.fixGuide)}`);
      }
      if (f.rotationUrl) {
        console.log(`             ${pc.dim('Rotate at:')}   ${pc.blue(pc.underline(f.rotationUrl))}`);
      }
      if (options.explain && f.agentInstruction) {
        console.log(`             ${pc.dim('Agent instruction:')} ${pc.green(f.agentInstruction)}`);
      }
      console.log('');
    }
  }

  // Render GitIgnore analysis if present
  if (result.gitIgnoreAnalysis && result.gitIgnoreAnalysis.length > 0) {
    console.log(`  ${pc.bold('.gitignore Analysis')}`);
    const unignored = result.gitIgnoreAnalysis.filter((a) => !a.isIgnored);

    for (const a of result.gitIgnoreAnalysis) {
      if (a.isIgnored) {
        console.log(`    ${pc.green('✓')} ${a.file.padEnd(25)} ${pc.dim('properly ignored by git')}`);
      } else {
        console.log(`    ${pc.red('✗')} ${pc.bold(a.file.padEnd(25))} ${pc.red('NOT ignored (at risk of git commit)')}`);
      }
    }

    if (unignored.length > 0) {
      console.log(`\n  ${pc.yellow(pc.bold('Recommended additions to your .gitignore:'))}`);
      for (const u of unignored) {
        console.log(`    ${pc.cyan(u.file)}`);
      }
      console.log('');
    }
  }

  // Summary box
  console.log(pc.dim('─'.repeat(55)));
  const s = result.summary;
  const parts = [];
  if (s.critical > 0) parts.push(pc.red(pc.bold(`${s.critical} critical`)));
  if (s.high > 0) parts.push(pc.red(`${s.high} high`));
  if (s.medium > 0) parts.push(pc.yellow(`${s.medium} medium`));
  if (s.low > 0) parts.push(pc.cyan(`${s.low} low`));
  if (s.info > 0) parts.push(pc.dim(`${s.info} info`));

  console.log(`  Summary: ${parts.join(', ') || 'Clean'}`);
  console.log(`  Scanned: ${result.totalFilesScanned} items in ${result.scanDurationMs}ms\n`);

  if (result.hasExceededThreshold) {
    console.log(`  ${pc.bgRed(pc.white(pc.bold(' COMMIT BLOCKED / SCAN FAILED ')))} ${pc.red('Sensitive findings must be resolved.')}\n`);
    console.log(`  ${pc.bold(pc.yellow('⚡ Safe Next Steps:'))}`);
    console.log(`    1. Run ${pc.cyan('npx agent-leak fix')} for interactive step-by-step guidance`);
    console.log(`    2. Move secrets to environment variables (e.g. process.env.API_KEY)`);
    console.log(`    3. If .env or key file was created, ensure it is added to .gitignore`);
    console.log(`    4. Re-run verification: ${pc.cyan('npx agent-leak verify')}`);
    console.log(`    5. Emergency bypass (use with caution): ${pc.dim('AGENT_LEAK_ALLOW=1 git commit')}\n`);
  }
}
