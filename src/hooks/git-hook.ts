import { existsSync, writeFileSync, chmodSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getGitRoot } from '../utils/git.js';

export const HOOK_MARKER = '# AGENT_LEAK_PRE_COMMIT_HOOK';

export const HOOK_SCRIPT = `#!/bin/sh
${HOOK_MARKER}
# Agent Leak - Pre-commit security check for AI-assisted coding
# Find secrets before your coding agent leaks them.

if [ "$AGENT_LEAK_ALLOW" = "1" ]; then
  echo "⚡ Agent Leak bypassed via AGENT_LEAK_ALLOW=1"
  exit 0
fi

if ! command -v agent-leak >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
  echo "⚠️ Agent Leak CLI or npx not found in PATH. Skipping hook."
  exit 0
fi

echo "⚡ Agent Leak: Verifying staged changes..."

if command -v agent-leak >/dev/null 2>&1; then
  agent-leak diff --staged-only
else
  npx --no-install agent-leak diff --staged-only
fi

STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo ""
  echo "⛔ Agent Leak blocked this commit."
  echo "   Remove detected secrets before committing."
  echo "   To explicitly bypass in emergency: AGENT_LEAK_ALLOW=1 git commit"
  echo ""
  exit 1
fi

exit 0
`;

export function installHook(cwd: string): { success: boolean; message: string } {
  const gitRoot = getGitRoot(cwd);
  if (!gitRoot) {
    return { success: false, message: 'Not inside a Git repository.' };
  }

  const hooksDir = resolve(gitRoot, '.git', 'hooks');
  if (!existsSync(hooksDir)) {
    return { success: false, message: 'Git hooks directory not found.' };
  }

  const preCommitPath = resolve(hooksDir, 'pre-commit');

  if (existsSync(preCommitPath)) {
    const existing = readFileSync(preCommitPath, 'utf8');
    if (existing.includes(HOOK_MARKER)) {
      return { success: true, message: 'Agent Leak pre-commit hook is already installed.' };
    }
  }

  try {
    writeFileSync(preCommitPath, HOOK_SCRIPT, { mode: 0o755 });
    try {
      chmodSync(preCommitPath, 0o755);
    } catch {
      // Windows ignore chmod
    }
    return {
      success: true,
      message: 'Agent Leak pre-commit hook successfully installed at .git/hooks/pre-commit',
    };
  } catch (err: any) {
    return { success: false, message: `Failed to write hook: ${err?.message || err}` };
  }
}

export function uninstallHook(cwd: string): { success: boolean; message: string } {
  const gitRoot = getGitRoot(cwd);
  if (!gitRoot) {
    return { success: false, message: 'Not inside a Git repository.' };
  }

  const preCommitPath = resolve(gitRoot, '.git', 'hooks', 'pre-commit');
  if (!existsSync(preCommitPath)) {
    return { success: true, message: 'No pre-commit hook found.' };
  }

  try {
    const existing = readFileSync(preCommitPath, 'utf8');
    if (existing.includes(HOOK_MARKER)) {
      unlinkSync(preCommitPath);
      return { success: true, message: 'Agent Leak pre-commit hook uninstalled.' };
    }
    return {
      success: false,
      message: 'Existing pre-commit hook was not created by Agent Leak. Refusing to overwrite.',
    };
  } catch (err: any) {
    return { success: false, message: `Failed to remove hook: ${err?.message || err}` };
  }
}
