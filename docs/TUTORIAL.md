# Beginner Tutorial: Scan, Fix & Verify with Agent Leak

Welcome to Agent Leak! This tutorial is designed for anyone who has never used a secret scanner or security tool before. In 3 minutes, you will learn how to:

1. Scan a project for accidentally exposed passwords and API keys.
2. Understand what the scan output means in plain English.
3. Fix the issue safely by moving secrets to environment variables.
4. Verify that your fix was successful.

All examples use **synthetic, fake, nonfunctional credentials**. Never test with real credentials!

---

## What is a Secret Leak?

When developing with AI assistants (like Cursor, Claude Code, GitHub Copilot, or Cline), you or the AI might paste API keys or database connection strings directly into code files (like `server.js` or `app.ts`).

If you commit that file to Git and push it to GitHub:
- Automated web crawlers can find your credentials within minutes.
- Attackers could rack up thousands of dollars on your API bill or access your private database.

Agent Leak stops this from ever leaving your computer.

---

## Step 1: The Vulnerable Code

In your repository, we have created an example file at `demo/beginner-tutorial/server.js`:

```javascript
import http from 'node:http';

// ❌ Hardcoded OpenAI key
const OPENAI_API_KEY = 'sk-proj-DEMOTUTORIALFAKEKEY1234567890abcdef123456';

// ❌ Hardcoded database password
const DATABASE_URL = 'postgres://postgres:tutorial_secret_pw123@localhost:5432/myapp_dev';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});

server.listen(3000);
```

---

## Step 2: Run Your First Scan

Run this single command from your terminal:

```bash
npx agent-leak scan demo/beginner-tutorial
```

### What You Will See:

```text
⚡ AGENT LEAK — Scan: demo/beginner-tutorial

  server.js
     CRITICAL  OpenAI API Key
             Location: server.js:7:25
             Sample:   sk-proj**************************************3456
             Risk:     Exposed OpenAI keys are rapidly scraped by bots and cause massive unexpected billing spikes.
             Action:   Rotate this OpenAI key in the platform dashboard and load it from environment variables.
             How to fix: 1. Revoke the key in platform.openai.com/api-keys. 2. Set OPENAI_API_KEY in .env (add .env to .gitignore). 3. Use process.env.OPENAI_API_KEY in code.
             Rotate at:   https://platform.openai.com/api-keys

     CRITICAL  PostgreSQL Connection String
             Location: server.js:10:23
             Sample:   postgres://postgres:****************@localhost:5432/myapp_dev
             Risk:     Embedded database credentials grant full database read/write access to anyone who views this code.
             Action:   Move database connection URI to environment variables and do not commit passwords.
             How to fix: Use process.env.DATABASE_URL. Provide an uncredentialed placeholder in .env.example.

───────────────────────────────────────────────────────
  Summary: 2 critical
  Scanned: 1 items in 5ms

   COMMIT BLOCKED / SCAN FAILED  Sensitive findings must be resolved.
```

---

## Step 3: How to Read the Findings

Each finding answers 4 simple questions:

1. **What is the problem?**
   - e.g. `CRITICAL OpenAI API Key`
2. **Where is it?**
   - e.g. `server.js:7:25` (line 7, column 25 of `server.js`)
3. **Why is it dangerous?**
   - e.g. `Risk: Exposed OpenAI keys are rapidly scraped by bots and cause massive unexpected billing spikes.`
4. **How do I fix it?**
   - Clear 3-step guide and an official URL to deactivate/rotate the key.

Notice that Agent Leak **never prints the actual secret** in full. It masks it (e.g. `sk-proj****************3456`) so terminal screenshots and logs never leak secrets.

---

## Step 4: Fix the Code

To fix this file safely:

1. Open `demo/beginner-tutorial/server.js` in your text editor.
2. Replace lines 7 and 10 with environment variable lookups:

```javascript
// ✅ Correct: Load keys from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
```

3. Save the file.

> **Important**: In a real project, store your real keys in a file called `.env`, and make sure `.env` is listed in your `.gitignore` file so Git never tracks it!

---

## Step 5: Verify Your Fix

Now re-run Agent Leak to confirm that the issue is completely resolved:

```bash
npx agent-leak scan demo/beginner-tutorial
```

### Output:

```text
⚡ AGENT LEAK — Scan: demo/beginner-tutorial

  ✓ No sensitive leaks detected! (1 items scanned in 4ms)
  Checked: API keys, connection strings, private keys, .env files, and AI agent session dumps.
  Tip:     Always verify that .env and private key files are listed in your .gitignore.
```

**Congratulations!** You have scanned, fixed, and verified your first project using Agent Leak.

---

## Next Steps

- **Check before commits**: Run `npx agent-leak diff` to check what you are about to commit.
- **Auto-block commits**: Run `npx agent-leak install-hook` to install an automatic pre-commit guard.
- **Guided Fix Assistant**: Run `npx agent-leak fix` for interactive step-by-step help whenever findings appear.
