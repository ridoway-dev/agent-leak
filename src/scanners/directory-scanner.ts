import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { Finding, ScanOptions, ScanResult, Severity, SEVERITY_LEVELS } from '../types/index.js';
import { IgnoreFilter, loadIgnoreFiles } from '../utils/ignore.js';
import { scanFileContent } from './file-scanner.js';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svgz',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.7z', '.exe', '.dll',
  '.so', '.dylib', '.wasm', '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.mov', '.avi', '.bin'
]);

function isBinaryFile(filePath: string, buffer?: Buffer): boolean {
  const ext = extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  if (buffer) {
    // Check first 512 bytes for null byte
    const checkLen = Math.min(buffer.length, 512);
    for (let i = 0; i < checkLen; i++) {
      if (buffer[i] === 0) return true;
    }
  }
  return false;
}

export function scanDirectory(targetPath: string, options: ScanOptions = {}): ScanResult {
  const startTime = Date.now();
  const absoluteRoot = resolve(targetPath);

  if (!existsSync(absoluteRoot)) {
    throw new Error(`Target path '${targetPath}' does not exist.`);
  }
  const ignoreFilter: IgnoreFilter = loadIgnoreFiles(absoluteRoot, options.ignore || []);
  const maxBytes = 5 * 1024 * 1024; // 5 MB max per file

  const allFindings: Finding[] = [];
  let totalFilesScanned = 0;

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

      if (ignoreFilter.isIgnored(relPath)) {
        continue;
      }

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        if (stat.size > maxBytes) {
          continue; // skip files > 5MB
        }

        let contentBuffer: Buffer;
        try {
          contentBuffer = readFileSync(fullPath);
        } catch {
          continue;
        }

        if (isBinaryFile(fullPath, contentBuffer)) {
          continue;
        }

        const content = contentBuffer.toString('utf8');
        totalFilesScanned++;

        const findings = scanFileContent({
          filePath: relPath || entry,
          content,
          options,
        });

        allFindings.push(...findings);
      }
    }
  }

  // Handle single file vs directory
  const rootStat = statSync(absoluteRoot);
  if (rootStat.isFile()) {
    const content = readFileSync(absoluteRoot, 'utf8');
    totalFilesScanned = 1;
    allFindings.push(
      ...scanFileContent({
        filePath: relative(process.cwd(), absoluteRoot) || absoluteRoot,
        content,
        options,
      })
    );
  } else {
    walk(absoluteRoot);
  }

  // Calculate summary counts
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
    totalFilesScanned,
    scanDurationMs: Date.now() - startTime,
    summary,
    hasExceededThreshold,
  };
}
