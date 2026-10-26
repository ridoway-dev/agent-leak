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
  options: { title?: string; isQuiet?: boolean } = {}
): void {
  if (options.isQuiet) return;

  const title = options.title || 'Agent Leak Scan';
  console.log(`\n${pc.bold(pc.cyan('⚡ AGENT LEAK'))} ${pc.dim('—')} ${pc.bold(title)}\n`);

  if (result.findings.length === 0) {
    console.log(
      `  ${pc.green('✓')} ${pc.bold('No sensitive leaks detected!')} ${pc.dim(
        `(${result.totalFilesScanned} files scanned in ${result.scanDurationMs}ms)`
      )}\n`
    );
    return;
  }

  // Group findings by file
  const grouped = new Map<string, Finding[]>();
  for (const f of result.findings) {
    const list = grouped.get(f.file) || [];
    list.push(f);
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
        console.log(`             ${pc.dim('Commit:')}   ${pc.yellow(f.commitHash)} ${pc.dim(`by ${f.commitAuthor || 'unknown'}`)}`);
      }
      console.log(`             ${pc.dim('Sample:')}   ${pc.dim(f.maskedValue)}`);
      if (f.remediation) {
        console.log(`             ${pc.dim('Action:')}   ${pc.italic(f.remediation)}`);
      }
      console.log('');
    }
  }

  // Render GitIgnore analysis if present
  if (result.gitIgnoreAnalysis && result.gitIgnoreAnalysis.length > 0) {
    console.log(`  ${pc.bold('.gitignore analysis')}`);
    const unignored = result.gitIgnoreAnalysis.filter((a) => !a.isIgnored);

    for (const a of result.gitIgnoreAnalysis) {
      if (a.isIgnored) {
        console.log(`    ${pc.green('✓')} ${a.file.padEnd(25)} ${pc.dim('ignored')}`);
      } else {
        console.log(`    ${pc.red('✗')} ${pc.bold(a.file.padEnd(25))} ${pc.red('NOT ignored')}`);
      }
    }

    if (unignored.length > 0) {
      console.log(`\n  ${pc.yellow(pc.bold('Recommended additions to .gitignore:'))}`);
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
    console.log(`  ${pc.bgRed(pc.white(pc.bold(' SCAN FAILED ')))} ${pc.red('Findings exceeded allowed severity threshold.')}\n`);
  }
}
