import { Finding, ScanOptions } from '../types/index.js';
import { checkSensitiveFileName } from '../rules/sensitive-files.js';
import { SECRET_RULES } from '../rules/secrets.js';
import { PII_RULES } from '../rules/pii.js';
import { AI_AGENT_CHECKS } from '../rules/ai-agent.js';
import { hasInlineSuppression } from '../utils/ignore.js';
import { computeFingerprint } from '../utils/fingerprint.js';
import { maskSecret } from '../utils/masking.js';

export interface FileScanInput {
  filePath: string;
  content: string;
  options?: ScanOptions;
}

/**
 * Scans a single file content and its path for secrets, sensitive patterns, and agent leaks.
 */
export function scanFileContent(input: FileScanInput): Finding[] {
  const { filePath, content, options } = input;
  const findings: Finding[] = [];

  // 1. Check sensitive filename
  const sensitiveFile = checkSensitiveFileName(filePath);
  if (sensitiveFile) {
    findings.push({
      id: sensitiveFile.id,
      type: 'sensitive-file',
      severity: sensitiveFile.severity,
      ruleName: sensitiveFile.name,
      description: sensitiveFile.description,
      file: filePath,
      maskedValue: filePath,
      fingerprint: computeFingerprint(sensitiveFile.id, filePath),
      remediation: sensitiveFile.remediation,
    });
  }

  // 2. Check AI Agent specific path checks
  for (const agentCheck of AI_AGENT_CHECKS) {
    if (agentCheck.check(filePath, content)) {
      findings.push({
        id: agentCheck.id,
        type: 'ai-agent-leak',
        severity: agentCheck.severity,
        ruleName: agentCheck.name,
        description: agentCheck.description,
        file: filePath,
        maskedValue: filePath,
        fingerprint: computeFingerprint(agentCheck.id, filePath),
        remediation: agentCheck.remediation,
      });
      break;
    }
  }

  // 3. Line by line analysis of file content
  if (!content) return findings;

  const lines = content.split(/\r?\n/);
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const line = lines[lineIdx];
    const prevLine = lineIdx > 0 ? lines[lineIdx - 1] : undefined;

    // Check inline suppression (e.g. # agent-leak-ignore)
    if (hasInlineSuppression(line, prevLine)) {
      continue;
    }

    // Check secret rules
    for (const rule of SECRET_RULES) {
      // Reset regexp state
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = rule.pattern.exec(line)) !== null) {
        const rawSecret = match[1] || match[0];

        // Validate via rule validator if present
        if (rule.validator && !rule.validator(rawSecret, line)) {
          continue;
        }

        const masked = rule.maskHandler ? rule.maskHandler(rawSecret) : maskSecret(rawSecret);

        findings.push({
          id: rule.id,
          type: rule.id.includes('conn')
            ? 'connection-string'
            : rule.id.includes('private-key')
            ? 'private-key'
            : 'secret',
          severity: rule.severity,
          ruleName: rule.name,
          description: rule.description,
          file: filePath,
          line: lineNum,
          column: match.index + 1,
          maskedValue: masked,
          fingerprint: computeFingerprint(rule.id, filePath, lineNum),
          remediation: rule.remediation,
        });

        // Avoid infinite loop on zero-width match
        if (match.index === rule.pattern.lastIndex) {
          rule.pattern.lastIndex++;
        }
      }
    }

    // Check PII rules if enabled
    if (options?.includePii) {
      for (const piiRule of PII_RULES) {
        piiRule.pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = piiRule.pattern.exec(line)) !== null) {
          const rawMatch = match[0];
          if (piiRule.validator && !piiRule.validator(rawMatch)) {
            continue;
          }

          findings.push({
            id: piiRule.id,
            type: 'pii',
            severity: piiRule.severity,
            ruleName: piiRule.name,
            description: piiRule.description,
            file: filePath,
            line: lineNum,
            column: match.index + 1,
            maskedValue: piiRule.maskHandler(rawMatch),
            fingerprint: computeFingerprint(piiRule.id, filePath, lineNum),
            remediation: piiRule.remediation,
          });

          if (match.index === piiRule.pattern.lastIndex) {
            piiRule.pattern.lastIndex++;
          }
        }
      }
    }
  }

  return findings;
}
