# ⚡ Agent Leak

> **Find what your AI coding agent could accidentally leak before it leaves your machine.**

[![GitHub Release](https://img.shields.io/github/v/release/ridoway-dev/agent-leak?color=7c3aed&style=flat-square)](https://github.com/ridoway-dev/agent-leak/releases)
[![Tests Passing](https://img.shields.io/badge/tests-36%20passed-success?style=flat-square)](https://github.com/ridoway-dev/agent-leak/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Zero Telemetry](https://img.shields.io/badge/privacy-100%25%20local%20%2F%20zero%20telemetry-brightgreen?style=flat-square)](#privacy--security-model)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D%2018-black?logo=node.js&style=flat-square)](https://nodejs.org)
[![AI Coding Compatible](https://img.shields.io/badge/AI%20Coding-Cursor%20%7C%20Claude%20%7C%20Codex-orange?style=flat-square)](#supported-detections--known-limitations)

Agent Leak is a lightweight, local-first developer security scanner designed for AI-assisted coding workflows. AI tools (like Cursor, Claude Code, Cline, and Copilot) routinely read files, execute shell commands, and generate code, which can accidentally save API keys, database connection strings, private keys, or session memory files into your Git repository. Agent Leak catches these sensitive leaks right on your machine, blocks unsafe commits, masks all evidence so nothing is exposed in your terminal, and guides you step-by-step on how to fix them.

---

## Before & After Demo

### 1. Before Fix (Vulnerable code detected)

```text
$ npx agent-leak scan .

⚡ AGENT LEAK — Scan: .

  server.js
     CRITICAL  OpenAI API Key
             Location: server.js:4:25
             Sample:   sk-proj**************************************3456
             Risk:     Exposed OpenAI keys are rapidly scraped by bots and cause massive unexpected billing spikes.
             Action:   Rotate this OpenAI key in the platform dashboard and load it from environment variables.
             How to fix: 1. Revoke the key in platform.openai.com/api-keys. 2. Set OPENAI_API_KEY in .env (add .env to .gitignore). 3. Use process.env.OPENAI_API_KEY in code.
             Rotate at:   https://platform.openai.com/api-keys

───────────────────────────────────────────────────────
  Summary: 1 critical
  Scanned: 8 items in 6ms

   COMMIT BLOCKED / SCAN FAILED  Sensitive findings must be resolved.

  ⚡ Safe Next Steps:
    1. Run npx agent-leak fix for interactive step-by-step guidance
    2. Move secrets to environment variables (e.g. process.env.API_KEY)
    3. Re-run verification: npx agent-leak verify
```

### 2. After Fix (Clean code verified)

```text
$ npx agent-leak verify

⚡ AGENT LEAK — Remediation Verified

  ✓ All checks passed! No sensitive tokens or unprotected files detected.
  Changes are clean and ready to commit.
```

---

## Quick Start

You do not need to install anything globally or create an account. Run any command directly with `npx`:

```bash
# Scan your entire project for exposed secrets
npx agent-leak scan .

# Check what you are about to commit (staged changes)
npx agent-leak diff

# Get interactive step-by-step guidance to fix findings
npx agent-leak fix

# Verify that recent fixes successfully removed the leak
npx agent-leak verify
```

> **Try the beginner tutorial**: Want to practice on safe, fake credentials? See our [Beginner Tutorial](docs/TUTORIAL.md) or run `npx agent-leak scan demo/beginner-tutorial`.

---

## How to Interpret Findings

When Agent Leak detects an issue, it breaks it down into plain English:

- **Severity Badge**:
  - `CRITICAL`: Live credentials (OpenAI, AWS, Stripe, GitHub tokens, database passwords, private keys). You must fix these before committing.
  - `HIGH`: Unprotected session dumps, JWTs, or auth bearer tokens.
  - `MEDIUM`: Debug logs that may contain command histories or tokens.
- **Location**: The exact file path and line number where the issue was found (e.g. `src/config.ts:12:15`).
- **Sample**: A masked preview (e.g. `sk-proj****************3456`). Agent Leak **never prints raw secrets**, protecting your terminal and logs from accidental exposure.
- **Risk**: A one-sentence explanation of what could happen if this secret is committed (e.g. billing spikes, database tampering).
- **How to fix**: Numbered instructions explaining how to extract the secret into an environment variable.
- **Rotate at**: Official link to the service provider's dashboard so you can revoke and generate a fresh credential.

---

## How to Fix a Detected Secret

Fixing a secret involves two simple steps:

### 1. Move the secret to an Environment Variable

Instead of hardcoding a secret in your code:

```javascript
// ❌ Dangerous: anyone who reads this file gets your key
const openaiApiKey = "sk-proj-YOUR_API_KEY_HERE";
```

Change it to read from an environment variable:

```javascript
// ✅ Safe: loads secret from your system or .env file
const openaiApiKey = process.env.OPENAI_API_KEY;
```

### 2. Store the secret in `.env` and ignore it

Create a file named `.env` in your project root:

```ini
OPENAI_API_KEY="sk-proj-YOUR_API_KEY_HERE"
```

Then ensure `.env` is listed in your `.gitignore` file:

```text
# .gitignore
.env
.env.local
*.key
```

> ⚠️ **Important Note on Credential Rotation**:
> If a secret was ever pushed to GitHub or shared publicly, deleting it from your code does **NOT** cancel the key! Attackers can still use it. Always visit the provider's dashboard (e.g., [OpenAI API Keys](https://platform.openai.com/api-keys) or [Stripe Dashboard](https://dashboard.stripe.com/apikeys)) to deactivate the old key and create a new one.

---

## How to Verify the Fix

After updating your code, run:

```bash
npx agent-leak verify
```

If the secret is gone, you will see:

```text
⚡ AGENT LEAK — Remediation Verified

  ✓ All checks passed! No sensitive tokens or unprotected files detected.
  Changes are clean and ready to commit.
```

You are now safe to commit your changes!

---

## Automatic Protection (Git Pre-Commit Hook)

To make sure you (or your AI agent) never accidentally commit a secret again, install Agent Leak's automatic Git pre-commit hook:

```bash
npx agent-leak install-hook
```

Once installed, every time you run `git commit`, Agent Leak automatically checks your staged changes in under 60 milliseconds.
- If no secrets are found, your commit proceeds instantly.
- If a secret is detected, your commit is **blocked**, protecting your repository.

### Emergency Bypass
In an intentional emergency, you can temporarily bypass the hook:
```bash
AGENT_LEAK_ALLOW=1 git commit -m "Emergency fix"
```

To uninstall the hook at any time:
```bash
npx agent-leak uninstall-hook
```

---

## Supported Detections & Known Limitations

### What Agent Leak Detects
- **AI Credentials**: OpenAI keys (`sk-...`, `sk-proj-...`), Anthropic Claude keys (`sk-ant-...`).
- **Cloud & VCS Providers**: AWS Access Keys (`AKIA...`), Google Cloud API keys (`AIza...`), GitHub Personal Access Tokens (`ghp_...`, `github_pat_...`), GitLab tokens (`glpat-...`).
- **Payment & Chat**: Stripe secret keys (`sk_live_...`, `rk_live_...`), Slack tokens (`xoxb-...`), Discord bot tokens.
- **Databases**: PostgreSQL, MySQL, MongoDB, and Redis connection strings with embedded passwords.
- **Cryptographic Keys**: RSA, EC, OPENSSH, and PGP private key blocks (`BEGIN PRIVATE KEY`).
- **Sensitive Files**: `.env`, `.env.local`, `*.pem`, `*.key`, `id_rsa`, `service-account.json`.
- **AI-Agent Artifacts**: Session history dumps, prompt context dumps (`.claude/context.json`, `.cursor/`), execution debug logs (`*.log`).

### Known Limitations
- Agent Leak specializes in credentials and AI session leaks. It does not scan compiled binary executables or deep machine-learning weights (`.onnx`, `.bin`).
- Static analysis catches known patterns and high-entropy strings, but cannot verify whether an external third-party API token is active without making a network call (Agent Leak remains 100% offline for your privacy).

---

## Privacy & Security Model

> **Agent Leak runs 100% locally on your machine.**

- **Zero Network Requests**: Agent Leak makes zero outbound network calls, has no remote telemetry, and transmits zero analytics.
- **Zero Raw Secret Storage**: Secrets are immediately masked upon pattern match. Raw secrets are never saved to disk, printed in terminal logs, or included in JSON/SARIF reports.
- **Zero Cloud Accounts**: Works completely offline without needing an API key or account.

---

## Troubleshooting & FAQ

### Q: Why did Agent Leak block my commit?
**A**: One of your staged files contains an API token, password, or unignored `.env` file. Run `npx agent-leak fix` to see which file triggered the alert and follow the instructions to move it to an environment variable.

### Q: What if I am in a folder without Git?
**A**: Commands like `diff`, `history`, and `verify` require a Git repository. To scan any folder without Git, simply run:
```bash
npx agent-leak scan .
```

### Q: I removed the secret, but my commit is still blocked?
**A**: Make sure you saved the file in your text editor and staged the updated file with `git add <file>`. Then run `npx agent-leak verify` to test again.

### Q: How do I ignore a harmless mock key in a test fixture?
**A**: Add an inline comment on the line right above it:
```javascript
// agent-leak-ignore
const mockKey = "sk-test-example-dummy-token";
```
Or add the file path to `.agent-leakignore`.

---

## Advanced Usage & Integration

### Interactive Guided Fix Assistant
```bash
npx agent-leak fix
```
Presents an interactive menu for each finding:
1. Show step-by-step remediation guide and provider rotation link.
2. View surrounding lines in context.
3. Suppress the finding with risk explanation.
4. Re-verify whether your fix worked.

### Machine-Readable Outputs
For CI pipelines and code quality tooling:
```bash
# Output JSON format
npx agent-leak scan . --json

# Output OASIS SARIF 2.1.0 format (for GitHub Advanced Security)
npx agent-leak scan . --sarif > results.sarif

# Quiet mode (exits 0 on clean, 1 on failure without terminal text)
npx agent-leak scan . --quiet
```

### System Health & Diagnostic
```bash
npx agent-leak doctor
```
Verifies your local Node.js version, Git environment, and rule engines.

---

## License

[MIT](LICENSE) © 2026 Agent Leak Contributors
