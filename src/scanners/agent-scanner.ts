import { resolve } from 'node:path';
import { ScanOptions, ScanResult, Finding, SEVERITY_LEVELS } from '../types/index.js';
import { scanDirectory } from './directory-scanner.js';
import { analyzeGitIgnore } from './gitignore-scanner.js';

export async function runAgentAudit(
  targetDir: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const startTime = Date.now();
  const absoluteRoot = resolve(targetDir);

  // 1. Run standard directory scan
  const dirResult = scanDirectory(absoluteRoot, options);
  const findings: Finding[] = [...dirResult.findings];

  // 2. Run gitignore analysis
  const gitIgnoreAnalysis = await analyzeGitIgnore(absoluteRoot);

  for (const item of gitIgnoreAnalysis) {
    if (!item.isIgnored) {
      findings.push({
        id: 'unignored-sensitive-file',
        type: 'unignored-file',
        severity: item.severity,
        ruleName: 'Unprotected Sensitive File',
        description: `File '${item.file}' is not in .gitignore and can be read/committed by AI agents`,
        file: item.file,
        maskedValue: item.file,
        fingerprint: `unignored:${item.file}`,
        remediation: item.recommendation,
      });
    }
  }

  // Deduplicate findings
  const uniqueFindings: Finding[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    if (!seen.has(f.fingerprint)) {
      seen.add(f.fingerprint);
      uniqueFindings.push(f);
    }
  }

  // Summary
  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: uniqueFindings.length,
  };

  for (const f of uniqueFindings) {
    switch (f.severity) {
      case 'CRITICAL': summary.critical++; break;
      case 'HIGH': summary.high++; break;
      case 'MEDIUM': summary.medium++; break;
      case 'LOW': summary.low++; break;
      case 'INFO': summary.info++; break;
    }
  }

  const threshold = options.failOn || 'HIGH';
  const thresholdLevel = SEVERITY_LEVELS[threshold] || 4;
  const hasExceededThreshold = uniqueFindings.some(
    (f) => (SEVERITY_LEVELS[f.severity] || 0) >= thresholdLevel
  );

  return {
    targetPath: absoluteRoot,
    findings: uniqueFindings,
    totalFilesScanned: dirResult.totalFilesScanned,
    scanDurationMs: Date.now() - startTime,
    gitIgnoreAnalysis,
    summary,
    hasExceededThreshold,
  };
}
