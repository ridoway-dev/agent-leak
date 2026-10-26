# Agent Leak — Architecture & Internals

This document outlines the architecture, detection pipeline, data privacy guarantees, and design decisions of **Agent Leak**.

---

## 1. High-Level Architecture

Agent Leak is an offline, modular security scanner with zero external network dependencies.

```text
┌────────────────────────────────────────────────────────┐
│                      CLI Entry                         │
│  (agent-leak scan, diff, verify, history, agent, etc.) │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│     Git Subsystem       │ │   Directory Subsystem   │
│ (staged, unstaged, log) │ │    (recursive walker)   │
└────────────┬────────────┘ └────────────┬────────────┘
             │                           │
             └─────────────┬─────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                    Scanner Pipeline                    │
│   ├── IgnoreFilter (.agent-leakignore, .gitignore)    │
│   ├── Sensitive File Rule Engine                       │
│   ├── AI Agent Context & Memory Detector               │
│   ├── Regex Pattern Matching                           │
│   ├── Shannon Entropy Analyzer                         │
│   └── False-Positive & Placeholder Reducer             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Redaction Engine                     │
│   (Masks all secrets immediately; raw secret discarded)│
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
       ┌───────────┐ ┌───────────┐ ┌───────────┐
       │  Console  │ │   JSON    │ │   SARIF   │
       │ Reporter  │ │ Reporter  │ │ Reporter  │
       └───────────┘ └───────────┘ └───────────┘
```

---

## 2. Core Detection Principles

### 2.1 Multi-Signal Credential Detection
Rather than relying solely on brute-force regular expressions (which yield rampant false positives), Agent Leak uses multi-signal heuristics:
1. **Known Structure / Signature Prefix**: e.g. `sk-proj-`, `sk-ant-`, `ghp_`, `AKIA`, `glpat-`.
2. **Shannon Entropy Analysis**: Strings assigned to generic credential variables (`api_key`, `secret_key`, etc.) must pass an entropy threshold ($H \ge 3.6$) calculated as:
   $$H(X) = -\sum_{i=1}^{n} P(x_i) \log_2 P(x_i)$$
3. **Obvious Placeholder Suppression**: Automatically ignores common documentation placeholders such as `YOUR_API_KEY_HERE`, `<API_KEY>`, `sk-test-example`, `dummy_token`, and passwords consisting of repeating characters.
4. **Context & URL Parsing**: For database strings (`postgres://`, `mysql://`, `redis://`, `mongodb://`), passwords are extracted and evaluated independently. Already-masked connection strings (`postgres://user:********@host/db`) are automatically recognized as documentation examples and skipped.

---

## 3. Data Privacy & Zero-Leak Model

Agent Leak adheres to a strict non-leak contract:

- **Ephemeral Matching**: The raw secret string only exists in memory long enough to run entropy validation and placeholder checking.
- **Redaction by Construction**: The `Finding` data structure contains only `maskedValue`. It possesses no raw secret field.
- **Offline Only**: Zero HTTP requests, zero telemetry, zero analytics, zero external API keys.

---

## 4. Git Diff Subsystem

Agent Leak parses Git diff outputs using an in-memory unified diff parser:
- Only newly added lines (`+` prefix) are scanned.
- Line numbers in findings correspond directly to line numbers in the modified file.
- Handles quoted file paths with spaces (e.g. `"folder with spaces/file.ts"`).
- Safely skips binary diff hunks (`Binary files differ`).

---

## 5. Standout Workflow: AI-Agent Pre-Commit Guard

When an AI coding agent writes or edits files:
1. The pre-commit hook runs `agent-leak diff --staged-only`.
2. If findings exceed the threshold (default: `HIGH`), the commit is blocked with exit code `1`.
3. The report presents the developer and agent with:
   - **What**: Safely masked credential pattern.
   - **Why**: The specific risk and threat model.
   - **Fix Guide**: Concrete remediation steps for the human.
   - **Agent Instruction**: Machine-actionable refactoring steps for the agent.
4. The developer or agent runs `agent-leak verify` to confirm resolution before proceeding.
