# Agent Leak — Open-Source Launch Plan

## 1. Target Audience

### Primary Audience
- **Developers using AI Coding Agents**: Engineers actively using tools like Claude Code, Cursor, Codex, Cline, Roo, GitHub Copilot CLI, and Devin.
- **Open-Source Maintainers**: Developers who accept pull requests generated or aided by AI coding agents.
- **Indie Hackers & Small Teams**: Developers who move fast with AI agents and lack dedicated enterprise SecOps tooling.

### Secondary Audience
- **Security Engineers & DevOps**: Teams establishing local security hygiene before code reaches CI.

---

## 2. The Specific Problem Agent Leak Solves

AI coding agents have autonomous read/write access to project trees, local terminals, and environment configurations. This creates novel leakage vectors that traditional secret scanners ignore:

1. **Terminal Copy-Paste Leaks**: Agents execute CLI commands, and the terminal output (containing live Bearer tokens, temporary OAuth codes, or connection strings) gets copy-pasted into generated Markdown documentation or code comments.
2. **Agent Context Dumps**: Agents save chat transcripts, session memories, and prompt histories into directories like `.claude/`, `.cursor/`, or `.codex/`. If committed, these leak system prompts and captured credentials.
3. **Unprotected Environment Files**: When creating a project, agents frequently spin up `.env` or `.env.local` files without configuring `.gitignore`.
4. **Passive CI Scanners are Too Late**: Traditional scanners run in CI *after* code is pushed. Once a secret is pushed, even if removed later, it persists in Git history and requires rotation.

---

## 3. Verified Differentiation vs. Existing Tools

| Dimension | Gitleaks / Trufflehog | detect-secrets | Agent Leak |
| :--- | :--- | :--- | :--- |
| **Primary Identity** | Enterprise Git history audit & CI gate | Baseline secret linter | AI-agent pre-commit & workspace guard |
| **Agent Artifact Awareness** | ❌ None (ignores `.claude/`, memory dumps) | ❌ None | ✅ Detects prompt dumps, agent logs, context files |
| **Remediation Guidance** | ⚠️ Generic alert message | ⚠️ Baseline warning | ✅ Actionable What / Why / Fix / Agent instruction |
| **Agent Skill Integration** | ❌ None | ❌ None | ✅ Native skill for Claude Code, Cursor, Codex |
| **Secret Redaction** | ⚠️ Often outputs raw or partial secret in CLI | ⚠️ Raw secret in plugins | ✅ Strict non-leak contract (100% masked) |
| **Verification Loop** | ❌ Requires re-running full suite | ❌ Requires updating baseline | ✅ Dedicated `agent-leak verify` command |
| **Dependencies & Telemetry** | Go binary / Python / Heavy deps | Python / Baseline file | Zero runtime deps (Node.js), 100% offline |

---

## 4. The 10-Second Demo Concept

A developer can verify the tool in 10 seconds without cloning anything:

```bash
# 1. Test against the built-in vulnerable demo project
npx agent-leak scan demo/demo-project

# 2. Or verify staged changes in any existing Git repo
npx agent-leak diff
```

Expected impact:
- Immediate colored terminal feedback in < 20ms.
- Shows masked credentials (`sk-proj-****...`, `postgres://user:********@host/db`).
- Shows actionable remediation without exposing secrets.

---

## 5. GitHub Launch Checklist

- [x] Clear, high-signal README with one-line value proposition and architecture diagram.
- [x] Feature comparison table grounded in verified technical differences.
- [x] Reproducible demo project with synthetic, clearly fake credentials (`demo/demo-project`).
- [x] Comprehensive automated test suite (`npm test` passing with 25 unit/integration tests).
- [x] Native Git pre-commit hook installer (`agent-leak install-hook`) with safe bypass (`AGENT_LEAK_ALLOW=1`).
- [x] Agent Skill instructions (`skill/agent-leak/SKILL.md`).
- [x] Issue templates for bug reports, feature requests, and new detection rule requests.
- [x] Permissive open-source license (MIT).
- [x] Security policy and offline-first privacy statement (`SECURITY.md`).
- [x] Contributing guidelines (`CONTRIBUTING.md`).

---

## 6. Community Sharing Guidelines

Share the project only in communities where developer tooling announcements and open-source releases are explicitly allowed:

1. **Hacker News (Show HN)**:
   - *Title format*: `Show HN: Agent Leak – Security checks for AI coding agents (open-source)`
   - *Post angle*: Discuss the new leakage vectors introduced by AI coding agents and why pre-commit verification beats post-push CI scanning.
2. **Reddit**:
   - `r/programming`: Technical post detailing the regex + entropy + placeholder heuristics.
   - `r/node`: Node.js ecosystem tool announcement emphasizing zero dependencies and instant `npx` execution.
   - `r/Cursor`: Post highlighting how to prevent Cursor and Cline from committing `.env` files or session transcripts.
3. **Developer Discords / Forums**:
   - Share in tool-announcements channels of AI coding agent communities (Claude Code, Cursor community, Codex).
4. **Twitter / X / Bluesky**:
   - Short video/GIF demonstrating an AI agent generating a `.env` leak and Agent Leak blocking the commit in milliseconds.

---

## 7. Plan for Gathering Genuine Feedback & Contributors

- **Good First Issues**: Label issues such as `rule: add HuggingFace token pattern` or `rule: add Cohere API key pattern` to invite early contributors.
- **Rule Submission Template**: Provide a standardized issue template for community members to request or propose new token patterns with false-positive analysis.
- **Responsive Review**: Respond to PRs within 48 hours and maintain high test coverage standards.
- **Strict Anti-Manipulation**: Zero paid upvotes, zero fake stars, zero automated bot outreach. Organic developer trust is the single most valuable asset for a security tool.
