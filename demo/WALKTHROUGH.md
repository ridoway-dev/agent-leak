# Agent Leak — Interactive Walkthrough & Demo

This walkthrough demonstrates how Agent Leak intercepts leaks created during AI-assisted development and verifies their remediation.

---

## 1. Run Scan on Demo Project

The `demo/demo-project` folder contains intentional synthetic vulnerabilities:

```bash
npx agent-leak scan demo/demo-project
```

### Observed Behavior
1. Agent Leak discovers:
   - Accidental `DATABASE_URL` with credentials in `.env`
   - Hardcoded `OPENAI_API_KEY` and `STRIPE_SECRET_KEY`
   - Leaked private key in `certs/server.key`
   - Leaked AWS Key in `config.js`
   - Leaked Bearer JWT in `logs/agent-debug.log`
   - Leaked session context in `.claude/context.json`
2. All secret values are automatically masked in the terminal:
   - `postgresql://postgres:****************@db.prod.acme.internal:5432/acme_db`
   - `sk-proj**********************************************efff`
   - `[PRIVATE KEY CONTENT REDACTED BY AGENT-LEAK]`
3. Inline suppressed secrets (`// agent-leak-ignore`) are skipped without false alarms.

---

## 2. Inspect with Actionable Explanations

To see why each finding was flagged and how to resolve it safely:

```bash
npx agent-leak scan demo/demo-project --explain
```

---

## 3. Pre-Commit Guard in Action

Install the pre-commit hook in your local Git repository:

```bash
npx agent-leak install-hook
```

Now simulate an AI agent adding a hardcoded secret to your code:

```bash
# Add a fake token
echo 'export const token = "sk-proj-DEMOFAKEKEY12345678901234567890";' > leak.ts
git add leak.ts

# Attempt to commit
git commit -m "add feature"
```

### Result:
```text
⚡ Agent Leak: Verifying staged changes...

  leak.ts
     CRITICAL  OpenAI API Key
             Location: leak.ts:1:22
             Sample:   sk-proj************************7890

  COMMIT BLOCKED / SCAN FAILED  Sensitive findings must be resolved.
```
The commit is blocked with a non-zero exit code.

---

## 4. Remediation & Verification

Fix the finding by switching to environment variables:

```bash
echo 'export const token = process.env.OPENAI_API_KEY;' > leak.ts
git add leak.ts

# Run instant verification
npx agent-leak verify
```

### Result:
```text
⚡ AGENT LEAK — Remediation Verified

  ✓ All checks passed! No sensitive tokens or unprotected files detected.
  Changes are clean and ready to commit.
```

Now run `git commit -m "add feature"`, and Git will commit cleanly.
