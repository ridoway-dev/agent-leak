# Agent Leak

> **Find what your AI coding agent could accidentally leak before it leaves your machine.**

AI coding agents (such as Claude Code, Codex, Cursor, Cline, and Roo) routinely access large portions of a developer's workspace. In doing so, agents can accidentally ingest, log, or commit sensitive credentials into git repositories, documentation, or public codebases.

**Agent Leak** is a developer security scanner designed specifically for AI-assisted development workflows. It catches credentials, database connection strings, private keys, agent context dumps, and unignored environment files before they are committed or pushed.

```text
AI agent generates code
        ↓
Agent Leak inspects changes
        ↓
Sensitive data detected & masked
        ↓
Developer fixes / rotates secret
        ↓
Safe to commit
```

---

## Quick Start

Run instantly without global installation:

```bash
# Scan working tree changes before committing
npx agent-leak diff

# Perform full AI-agent security audit
npx agent-leak agent

# Scan entire project
npx agent-leak scan .
```

---

## Interactive Demo

Agent Leak includes a built-in fake vulnerable demo project to test detection capabilities:

```bash
npx agent-leak scan demo/demo-project
```

Example output:

```text
⚡ AGENT LEAK — Scan: demo/demo-project

  .claude/context.json
     HIGH      AI Agent Context / Memory Leak
             Location: .claude/context.json
             Sample:   .claude/context.json
             Action:   Ensure agent context and session histories are excluded from git commits and public repositories.

     CRITICAL  GitLab Personal Access Token
             Location: .claude/context.json:5:16
             Sample:   glpat-**********************456
             Action:   Revoke and regenerate this GitLab token in GitLab User Settings -> Access Tokens.

  .env
     CRITICAL  Environment File
             Location: .env
             Action:   Add .env to your .gitignore. Use .env.example with placeholder values for sharing templates.

     CRITICAL  PostgreSQL Connection String
             Location: .env:3:15
             Sample:   postgresql://postgres:****************@db.prod.acme.internal:5432/acme_db
             Action:   Move database connection URI to environment variables and do not commit passwords.

     CRITICAL  OpenAI API Key
             Location: .env:4:17
             Sample:   sk-proj**********************************************efff
             Action:   Rotate this OpenAI key in the platform dashboard and load it from environment variables.

───────────────────────────────────────────────────────
  Summary: 9 critical, 5 high, 1 medium
  Scanned: 6 items in 8ms

  SCAN FAILED  Findings exceeded allowed severity threshold.
```

---

## Core Workflows

### 1. Pre-Commit Diff Check

Inspect staged and unstaged Git modifications to check what sensitive information is about to be committed:

```bash
agent-leak diff
```

Scan only staged files:

```bash
agent-leak diff --staged-only
```

### 2. AI-Agent Development Audit

Audit AI-agent specific directories (`.claude/`, `.cursor/`, `.codex/`), session history files, agent debug logs, and unignored sensitive files:

```bash
agent-leak agent
```

This also checks `.gitignore` coverage for detected sensitive files:

```text
  .gitignore analysis
    ✓ .env                      ignored
    ✗ certs/server.key          NOT ignored

  Recommended additions to .gitignore:
    certs/server.key
```

### 3. Git Commit History Scan

Search past Git commits to check if credentials were leaked in earlier commits:

```bash
agent-leak history
```

If historical exposures are discovered, Agent Leak marks them as `HISTORICAL` and explains that simply removing the secret in the latest commit is insufficient: **credential rotation is required**.

### 4. Git Pre-Commit Hook

Install an automated pre-commit hook in `.git/hooks/pre-commit`:

```bash
agent-leak install-hook
```

If a staged file contains a secret, the hook blocks the commit and exits with code 1.

#### Safe Emergency Bypass

To bypass the pre-commit hook in an intentional emergency:

```bash
AGENT_LEAK_ALLOW=1 git commit -m "commit message"
```

To remove the hook:

```bash
agent-leak uninstall-hook
```

---

## Supported Detections

| Category | Detections & Patterns | Severity |
| :--- | :--- | :--- |
| **Private Keys** | `BEGIN RSA/EC/OPENSSH/DSA/PGP PRIVATE KEY` blocks | `CRITICAL` |
| **Cloud Credentials** | AWS Access Key (`AKIA...`), AWS Secret Keys, Google Cloud API Keys (`AIza...`) | `CRITICAL` |
| **AI Providers** | OpenAI keys (`sk-proj-...`, `sk-...`), Anthropic keys (`sk-ant-...`) | `CRITICAL` |
| **VCS Tokens** | GitHub PATs (`ghp_...`, `github_pat_...`), GitLab tokens (`glpat-...`) | `CRITICAL` |
| **Database URIs** | PostgreSQL, MySQL, Redis, MongoDB with embedded passwords | `CRITICAL` |
| **Payment & Chat** | Stripe live secret keys (`sk_live_...`, `rk_live_...`), Slack tokens, Discord bot tokens | `CRITICAL` |
| **Auth & Tokens** | High-entropy variable secrets, Bearer headers, signed JWTs | `HIGH` |
| **Sensitive Files** | `.env`, `.env.local`, `*.pem`, `*.key`, `id_rsa`, `service-account.json`, `credentials.json` | `CRITICAL` |
| **Config & Dumps** | `docker-compose.override.yml`, `*.tfvars`, `secrets.yaml`, database SQL dumps | `HIGH` / `MEDIUM` |
| **Agent Artifacts** | Agent session memories, prompt transcripts (`.jsonl`), execution debug logs (`*.log`) | `HIGH` / `MEDIUM` |
| **PII (Optional)** | Internal RFC1918 IP addresses, personal email addresses (`--include-pii`) | `LOW` / `INFO` |

---

## False Positive Suppression

### Configuration File (`.agent-leak.json`)

Generate with `agent-leak init`:

```json
{
  "failOn": "HIGH",
  "ignore": [
    "tests/fixtures/**",
    "docs/examples/**"
  ],
  "scanHistory": false,
  "scanImages": false
}
```

### Ignore File (`.agent-leakignore`)

Add glob patterns line-by-line:

```text
# Ignore mock fixtures
tests/mocks/**
examples/**
```

### Inline Code Suppression

Add an inline comment on the same line or preceding line:

```typescript
// agent-leak-ignore
const mockKey = "sk-proj-DEMOFAKEKEY12345678901234567890";
```

Agent Leak also automatically recognizes placeholder strings (e.g. `YOUR_API_KEY_HERE`, `<API_KEY>`, `sk-test-example`, `dummy_token`) and avoids false-positive alerts.

---

## Output Modes

- **Default**: Pretty human-readable terminal output with file links and masked samples.
- **JSON**: Machine-readable output for programmatic agent consumption:
  ```bash
  agent-leak scan . --json
  ```
- **SARIF**: Standard OASIS SARIF 2.1.0 format for GitHub Code Scanning:
  ```bash
  agent-leak scan . --sarif > results.sarif
  ```
- **Quiet**: Suppresses terminal output and only returns exit code (ideal for CI scripts):
  ```bash
  agent-leak scan . --quiet
  ```

---

## AI Agent Skill Integration

Agent Leak ships with a specialized Agent Skill compatible with Claude Code, Cursor, Codex, and other coding-agent environments:

Location: `skill/agent-leak/SKILL.md` (or `.agents/skills/agent-leak/SKILL.md`)

The skill instructs coding agents to:
1. Run `agent-leak diff --staged-only` before committing.
2. Replace detected hardcoded secrets with environment variables (`process.env.VAR`).
3. Never output unmasked secrets in agent responses.
4. Prompt developers to rotate credentials if found in Git history.

---

## Continuous Integration (GitHub Actions)

Add `.github/workflows/agent-leak.yml`:

```yaml
name: Security Audit

on:
  push:
  pull_request:

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run Agent Leak Check
        run: npx agent-leak diff --fail-on high
```

---

## Privacy Model

> **Agent Leak runs locally.**
>
> Your source code, file trees, and detected secrets are **never uploaded anywhere**.

- 100% offline-first.
- Zero network telemetry or analytics.
- Secrets are masked immediately upon matching and are never retained in plain text.

---

## Doctor Command

Verify your local environment and scanner health:

```bash
agent-leak doctor
```

Output:

```text
Agent Leak Doctor

  ✓ Node.js runtime (v24.18.0) 
  ✓ Git version control (Git CLI executable verified)
  ✓ Git repository detected
  ✓ Configuration file (.agent-leak.json found)
  ✓ Secret detection rules (All provider patterns and entropy filters active)
  ✓ Git history scanner (Ready)
  ✓ Privacy model (Local-only / offline execution (zero network telemetry))

Agent Leak is ready.
```

---

## Roadmap

- **v0.1 (Current)**:
  - Multi-signal secret scanner
  - Sensitive file detection & `.gitignore` analysis
  - Git diff scanner & Git history scanner
  - Pre-commit hook with emergency bypass
  - AI-Agent audit workflow & Agent Skill
  - JSON & SARIF reporters
- **v0.2**:
  - Additional cloud provider & OAuth token patterns
  - Pre-push Git hook support
- **v0.3**:
  - Optional local OCR scanner for screenshot inspection
  - Custom team policy files
- **v0.4**:
  - Editor extensions & native IDE status indicators

---

## License

[MIT](LICENSE) © 2026 Agent Leak Contributors
