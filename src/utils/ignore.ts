import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const DEFAULT_EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.cache',
  'vendor',
  '.next',
  '.turbo',
  '.output',
  'tmp',
  'temp',
];

export const DEFAULT_EXCLUDED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'composer.lock',
  'Cargo.lock',
  'go.sum',
];

/**
 * Converts a simple glob pattern into a regular expression.
 */
export function globToRegex(pattern: string): RegExp {
  let cleaned = pattern.trim();
  if (cleaned.startsWith('/')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);

  // Escape regex special chars except * and ?
  const escaped = cleaned
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/___DOUBLE_STAR___/g, '.*');

  return new RegExp(`(^|/)${escaped}(/|$)`, 'i');
}

export class IgnoreFilter {
  private patterns: RegExp[] = [];

  constructor(customPatterns: string[] = []) {
    // Add default exclusions
    for (const dir of DEFAULT_EXCLUDED_DIRS) {
      this.patterns.push(new RegExp(`(^|/)${dir}(/|$)`, 'i'));
    }
    for (const file of DEFAULT_EXCLUDED_FILES) {
      this.patterns.push(new RegExp(`(^|/)${file.replace('.', '\\.')}$`, 'i'));
    }

    for (const p of customPatterns) {
      if (p && !p.startsWith('#')) {
        this.patterns.push(globToRegex(p));
      }
    }
  }

  public addPattern(pattern: string): void {
    const trimmed = pattern.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      this.patterns.push(globToRegex(trimmed));
    }
  }

  public isIgnored(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return this.patterns.some((regex) => regex.test(normalized));
  }
}

/**
 * Load .agent-leakignore and optional .gitignore from root
 */
export function loadIgnoreFiles(rootDir: string, extraIgnore: string[] = []): IgnoreFilter {
  const patterns: string[] = [...extraIgnore];

  const leakIgnorePath = resolve(rootDir, '.agent-leakignore');
  if (existsSync(leakIgnorePath)) {
    try {
      const content = readFileSync(leakIgnorePath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          patterns.push(trimmed);
        }
      }
    } catch {
      // ignore read error
    }
  }

  return new IgnoreFilter(patterns);
}

/**
 * Checks if a specific line has an inline suppression comment:
 * e.g. # agent-leak-ignore or // agent-leak-ignore
 */
export function hasInlineSuppression(lineContent: string, prevLineContent?: string): boolean {
  const suppressionTag = /agent-leak-ignore/i;
  if (suppressionTag.test(lineContent)) {
    return true;
  }
  if (prevLineContent && suppressionTag.test(prevLineContent)) {
    return true;
  }
  return false;
}
