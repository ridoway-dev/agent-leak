import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

export interface GitDiffFile {
  filePath: string;
  isNew: boolean;
  isDeleted: boolean;
  additions: Array<{ line: number; content: string }>;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  diff: string;
}

export function isGitRepo(cwd: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
      stdio: 'ignore',
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

export function getGitRoot(cwd: string): string | null {
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    });
    return out.trim();
  } catch {
    return null;
  }
}

/**
 * Checks if a file path is ignored according to Git
 */
export async function isFileGitIgnored(cwd: string, filePath: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['check-ignore', '-q', filePath], {
      cwd,
      timeout: 3000,
    });
    return true; // exit code 0 means ignored
  } catch (err: any) {
    if (err?.code === 1) {
      return false; // exit code 1 means NOT ignored
    }
    return false;
  }
}

/**
 * Parses unified diff output into structured file additions
 */
export function parseDiffOutput(rawDiff: string): GitDiffFile[] {
  const files: GitDiffFile[] = [];
  const fileDiffBlocks = rawDiff.split(/^diff --git /m);

  for (const block of fileDiffBlocks) {
    if (!block.trim()) continue;

    const lines = block.split(/\r?\n/);
    const headerLine = lines[0]; // e.g. "a/path/to/file b/path/to/file"
    const isNew = block.includes('new file mode');
    const isDeleted = block.includes('deleted file mode');

    // Extract target file path
    const fileMatch = headerLine.match(/b\/(.+)$/);
    if (!fileMatch) continue;
    const filePath = fileMatch[1];

    const additions: Array<{ line: number; content: string }> = [];
    let currentLineNumber = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('@@')) {
        // Hunk header: @@ -old,len +new,len @@
        const hunkMatch = line.match(/\+([0-9]+)/);
        if (hunkMatch) {
          currentLineNumber = parseInt(hunkMatch[1], 10);
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        additions.push({
          line: currentLineNumber,
          content: line.slice(1),
        });
        currentLineNumber++;
      } else if (line.startsWith(' ') || line.startsWith('-')) {
        if (!line.startsWith('-')) {
          currentLineNumber++;
        }
      }
    }

    files.push({
      filePath,
      isNew,
      isDeleted,
      additions,
    });
  }

  return files;
}

/**
 * Retrieves staged git diffs
 */
export async function getStagedDiff(cwd: string): Promise<GitDiffFile[]> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--cached', '-U1'], {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
      timeout: 10000,
    });
    return parseDiffOutput(stdout);
  } catch (err) {
    return [];
  }
}

/**
 * Retrieves unstaged working tree diffs
 */
export async function getWorkingTreeDiff(cwd: string): Promise<GitDiffFile[]> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '-U1'], {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
      timeout: 10000,
    });
    return parseDiffOutput(stdout);
  } catch {
    return [];
  }
}

/**
 * Retrieves untracked files
 */
export async function getUntrackedFiles(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      {
        cwd,
        encoding: 'utf8',
        timeout: 5000,
      }
    );
    return stdout
      .split(/\r?\n/)
      .map((f) => f.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Retrieves commits with diffs for history scanning
 */
export async function getCommitHistory(
  cwd: string,
  maxCommits = 50
): Promise<GitCommitInfo[]> {
  try {
    // Format: Hash, Author, Date, Subject
    const logArgs = [
      'log',
      `-n`,
      maxCommits.toString(),
      `--pretty=format:COMMIT_RECORD%x1f%H%x1f%h%x1f%an <%ae>%x1f%ad%x1f%s`,
      `-p`,
      `-U1`,
    ];

    const { stdout } = await execFileAsync('git', logArgs, {
      cwd,
      maxBuffer: 30 * 1024 * 1024,
      encoding: 'utf8',
      timeout: 20000,
    });

    const commits: GitCommitInfo[] = [];
    const chunks = stdout.split('COMMIT_RECORD\x1f');

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const parts = chunk.split('\x1f');
      if (parts.length < 5) continue;

      const [hash, shortHash, author, date, messageAndDiff] = parts;
      const firstLineBreak = messageAndDiff.indexOf('\n');
      const message =
        firstLineBreak !== -1
          ? messageAndDiff.slice(0, firstLineBreak).trim()
          : messageAndDiff.trim();
      const diff = firstLineBreak !== -1 ? messageAndDiff.slice(firstLineBreak) : '';

      commits.push({
        hash,
        shortHash,
        author,
        date,
        message,
        diff,
      });
    }

    return commits;
  } catch {
    return [];
  }
}
