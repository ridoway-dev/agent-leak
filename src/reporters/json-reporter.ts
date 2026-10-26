import { ScanResult } from '../types/index.js';

export function renderJsonReport(result: ScanResult): string {
  // Return clean JSON without leaking secrets
  const sanitized = {
    scanner: 'agent-leak',
    version: '0.1.0',
    targetPath: result.targetPath,
    totalFilesScanned: result.totalFilesScanned,
    scanDurationMs: result.scanDurationMs,
    hasExceededThreshold: result.hasExceededThreshold,
    summary: result.summary,
    findings: result.findings.map((f) => ({
      id: f.id,
      type: f.type,
      severity: f.severity,
      ruleName: f.ruleName,
      description: f.description,
      file: f.file,
      line: f.line,
      column: f.column,
      maskedValue: f.maskedValue,
      fingerprint: f.fingerprint,
      commitHash: f.commitHash,
      commitAuthor: f.commitAuthor,
      isHistorical: f.isHistorical,
      remediation: f.remediation,
    })),
    gitIgnoreAnalysis: result.gitIgnoreAnalysis,
  };

  return JSON.stringify(sanitized, null, 2);
}
