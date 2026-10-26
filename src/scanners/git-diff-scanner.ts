import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Finding, ScanOptions, ScanResult, SEVERITY_LEVELS } from '../types/index.js';
import { getStagedDiff, getWorkingTreeDiff, getUntrackedFiles, isGitRepo } from '../utils/git.js';
import { scanFileContent } from './file-scanner.js';
import { IgnoreFilter, loadIgnoreFiles } from '../utils/ignore.js';

export async function scanGitDiff(
  targetDir: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const startTime = Date.now();
  const absoluteRoot = resolve(targetDir);

  if (!isGitRepo(absoluteRoot)) {
    throw new Error(`Directory '${targetDir}' is not a Git repository.`);
  }

  const ignoreFilter: IgnoreFilter = loadIgnoreFiles(absoluteRoot, options.ignore || []);
  const allFindings: Finding[] = [];
  let totalFilesScanned = 0;

  // 1. Get staged changes
  const stagedDiffs = await getStagedDiff(absoluteRoot);

  // 2. Get unstaged changes (unless options.stagedOnly is set, e.g. from pre-commit hook)
  const unstagedDiffs = options.stagedOnly ? [] : await getWorkingTreeDiff(absoluteRoot);

  // Merge diffs by file
  const diffMap = new Map<string, Array<{ line: number; content: string }>>();

  for (const diffFile of [...stagedDiffs, ...unstagedDiffs]) {
    if (diffFile.isDeleted || ignoreFilter.isIgnored(diffFile.filePath)) {
      continue;
    }
    const existing = diffMap.get(diffFile.filePath) || [];
    diffMap.set(diffFile.filePath, [...existing, ...diffFile.additions]);
  }

  // Scan added diff lines
  for (const [filePath, additions] of diffMap.entries()) {
    totalFilesScanned++;

    // Check sensitive file name itself
    const filenameFindings = scanFileContent({
      filePath,
      content: '',
      options,
    });
    allFindings.push(...filenameFindings);

    // Scan the lines added in diff
    const syntheticContent = additions.map((a) => a.content).join('\n');
    const contentFindings = scanFileContent({
      filePath,
      content: syntheticContent,
      options,
    });

    // Remap line numbers to actual line numbers in diff
    for (const f of contentFindings) {
      if (f.line && additions[f.line - 1]) {
        f.line = additions[f.line - 1].line;
      }
      allFindings.push(f);
    }
  }

  // 3. Scan untracked files (unless stagedOnly)
  if (!options.stagedOnly) {
    const untracked = await getUntrackedFiles(absoluteRoot);
    for (const relPath of untracked) {
      if (ignoreFilter.isIgnored(relPath)) continue;

      const fullPath = resolve(absoluteRoot, relPath);
      if (!existsSync(fullPath)) continue;

      try {
        const content = readFileSync(fullPath, 'utf8');
        totalFilesScanned++;
        const findings = scanFileContent({
          filePath: relPath,
          content,
          options,
        });
        allFindings.push(...findings);
      } catch {
        // skip unreadable
      }
    }
  }

  // Deduplicate findings by fingerprint
  const uniqueFindings: Finding[] = [];
  const seen = new Set<string>();
  for (const f of allFindings) {
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
    totalFilesScanned,
    scanDurationMs: Date.now() - startTime,
    summary,
    hasExceededThreshold,
  };
}
