import { createHash } from 'node:crypto';

/**
 * Computes a deterministic fingerprint for a finding.
 * Based on file path, rule id, and line number.
 */
export function computeFingerprint(ruleId: string, filePath: string, line?: number): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const payload = `${ruleId}:${normalizedPath}:${line ?? 0}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
