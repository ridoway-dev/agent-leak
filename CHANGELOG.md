# Changelog

All notable changes to **Agent Leak** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-26

### Added
- **Core Secret Engine**: Multi-signal credential detection (OpenAI, Anthropic, AWS, GitHub PATs, GitLab, Google, Stripe, Slack, Discord, JWT, Bearer tokens, database connection strings, SSH private keys).
- **AI Agent Specific Audit (`agent-leak agent`)**: Detection of leaked session states (`.claude/`, `.cursor/`, `.codex/`), debug logs, copied terminal outputs, prompt dumps, and unignored sensitive files.
- **Git Diff Scanner (`agent-leak diff`)**: Staged and unstaged working-tree change inspection with exact line reporting.
- **Git History Audit (`agent-leak history`)**: Commit log audit distinguishing current vs historical exposures with immediate rotation guidance.
- **Pre-Commit Hook (`agent-leak install-hook`)**: Native Git hook preventing commit of secrets with documented `AGENT_LEAK_ALLOW=1` emergency bypass.
- **Privacy Non-Leak Guarantee**: Strict masking and redaction across Console, JSON, and SARIF output formats.
- **Doctor Command (`agent-leak doctor`)**: Runtime environment, Git configuration, and rule engine health check.
- **Agent Skill**: Operational skill definition for AI coding agents (`skill/agent-leak/SKILL.md`).
- **Interactive Demo**: Built-in fake vulnerable demo project under `demo/demo-project`.
