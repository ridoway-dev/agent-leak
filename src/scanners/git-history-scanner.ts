import { resolve } from 'node:path';
import { Finding, ScanOptions, ScanResult, SEVERITY_LEVELS } from '../types/index.js';
import { getCommitHistory, isGitRepo } from '../utils/git.js';
import { scanFileContent } from './file-scanner.js';
import { parseDiffOutput } from '../utils/git.js';

export async function scanGitHistory(
  targetDir: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const startTime = Date.now();
  const absoluteRoot = resolve(targetDir);

  if (!isGitRepo(absoluteRoot)) {
    throw new Error(`Directory '${targetDir}' is not a Git repository.`);
  }

  const maxCommits = options.maxHistoryCommits || 100;
  const commits = await getCommitHistory(absoluteRoot, maxCommits);

  const allFindings: Finding[] = [];
  const seenFingerprints = new Set<string>();

  for (const commit of commits) {
    const diffFiles = parseDiffOutput(commit.diff);

    for (const diffFile of diffFiles) {
      if (diffFile.isDeleted) continue;

      // Scan filename
      const fileFindings = scanFileContent({
        filePath: diffFile.filePath,
        content: '',
        options,
      });

      // Scan additions in this commit
      const syntheticContent = diffFile.additions.map((a) => a.content).join('\n');
      const contentFindings = scanFileContent({
        filePath: diffFile.filePath,
        content: syntheticContent,
        options,
      });

      for (const f of [...fileFindings, ...contentFindings]) {
        if (f.line && diffFile.additions[f.line - 1]) {
          f.line = diffFile.additions[f.line - 1].line;
        }

        f.isHistorical = true;
        f.commitHash = commit.shortHash;
        f.commitAuthor = commit.author;
        f.commitDate = commit.date;
        f.remediation =
          'CRITICAL: This credential exists in Git history! Deleting or modifying the file in a new commit does NOT invalidate or remove it from history. You MUST rotate/revoke this credential immediately.';

        const dedupeKey = `${commit.shortHash}:${f.fingerprint}`;
        if (!seenFingerprints.has(dedupeKey)) {
          seenFingerprints.add(dedupeKey);
          allFindings.push(f);
        }
      }
    }
  }

  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: allFindings.length,
  };

  for (const f of allFindings) {
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
  const hasExceededThreshold = allFindings.some(
    (f) => (SEVERITY_LEVELS[f.severity] || 0) >= thresholdLevel
  );

  return {
    targetPath: absoluteRoot,
    findings: allFindings,
    totalFilesScanned: commits.length,
    scanDurationMs: Date.now() - startTime,
    summary,
    hasExceededThreshold,
  };
}
