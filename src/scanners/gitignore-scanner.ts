import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, basename } from 'node:path';
import { GitIgnoreAnalysis } from '../types/index.js';
import { checkSensitiveFileName } from '../rules/sensitive-files.js';
import { isFileGitIgnored, isGitRepo } from '../utils/git.js';
import { IgnoreFilter, loadIgnoreFiles } from '../utils/ignore.js';

export async function analyzeGitIgnore(rootDir: string): Promise<GitIgnoreAnalysis[]> {
  const absoluteRoot = resolve(rootDir);
  const results: GitIgnoreAnalysis[] = [];

  if (!isGitRepo(absoluteRoot)) {
    return results;
  }

  const ignoreFilter: IgnoreFilter = loadIgnoreFiles(absoluteRoot);
  const sensitiveFilesFound: Array<{ relPath: string; fileName: string; severity: any }> = [];

  function walk(currentDir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry);
      const relPath = relative(absoluteRoot, fullPath);

      if (ignoreFilter.isIgnored(relPath) && !entry.startsWith('.env') && !entry.includes('key')) {
        continue;
      }

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (entry !== 'node_modules' && entry !== '.git') {
          walk(fullPath);
        }
      } else if (stat.isFile()) {
        const sensitiveRule = checkSensitiveFileName(relPath);
        if (sensitiveRule) {
          sensitiveFilesFound.push({
            relPath,
            fileName: entry,
            severity: sensitiveRule.severity,
          });
        }
      }
    }
  }

  walk(absoluteRoot);

  for (const item of sensitiveFilesFound) {
    const isIgnored = await isFileGitIgnored(absoluteRoot, item.relPath);
    results.push({
      file: item.relPath,
      isIgnored,
      severity: item.severity,
      recommendation: isIgnored
        ? 'Properly ignored by .gitignore.'
        : `Add "${item.fileName}" or pattern to .gitignore to prevent accidental commit by coding agents.`,
    });
  }

  return results;
}
