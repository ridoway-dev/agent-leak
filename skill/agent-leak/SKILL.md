---
name: agent-leak
description: Security scanner for AI-assisted coding. Verifies git diffs, file trees, and agent transcripts to prevent accidental leakage of API keys, private tokens, connection strings, or sensitive local files before committing.
---

# Agent Leak — Agent Skill

This skill guides AI coding agents (Claude Code, Cursor, Codex, etc.) on how to prevent credential leaks, protect sensitive environment data, and ensure safe commits.

## 1. When to Run Agent Leak

Always run Agent Leak in these scenarios:
1. **Before any `git commit` or `git push`**: Check the staged changes with `npx agent-leak diff --staged-only`.
2. **After creating or modifying configuration files**: Run `npx agent-leak scan .`
3. **When auditing an existing codebase**: Run `npx agent-leak agent`
4. **Before committing generated documentation**: Ensure terminal outputs or example snippets do not contain real keys.

## 2. Core Operational Commands

```bash
# Verify staged changes before committing
npx agent-leak diff --staged-only

# Check working tree (staged + unstaged + untracked)
npx agent-leak diff

# Full AI-agent security audit (checks agent dirs, logs, and .gitignore status)
npx agent-leak agent

# Scan Git commit history for past exposures
npx agent-leak history

# Programmatic output for agents (JSON)
npx agent-leak diff --json
```

## 3. Strict Rules for AI Coding Agents

1. **NEVER Echo Full Secrets**: When reporting findings or errors to the user, never print the raw unmasked token, password, or private key. Always use the masked value provided by Agent Leak (e.g. `sk-proj-****...` or `postgres://user:********@host/db`).
2. **Never Commit `.env` Files**: Always check that `.env`, `.env.local`, `credentials.json`, `*.pem`, and `service-account.json` are strictly included in `.gitignore`.
3. **Rotating Historical Leaks**: If `agent-leak history` detects an exposure, do NOT assume that deleting the secret in a new commit makes it safe. Inform the user that the secret was permanently recorded in Git history and **must be rotated/revoked immediately**.
4. **Always Re-run Scan After Fixes**: Once you replace a hardcoded credential with an environment variable (`process.env.VAR`), re-run `npx agent-leak diff` to verify the fix before finalizing your response.

## 4. Remediation Workflow

When `agent-leak` flags a finding:
1. Identify the file and line indicated in the report.
2. Replace hardcoded secrets with standard environment variable access (e.g., `process.env.OPENAI_API_KEY`).
3. Add a placeholder example to `.env.example` (e.g., `OPENAI_API_KEY="your-api-key-here"`).
4. If a file is sensitive (e.g., `.env`), add it to `.gitignore`.
5. Re-run `npx agent-leak diff --staged-only` to ensure exit code 0.
