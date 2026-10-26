# Security Policy

## Privacy & Offline Execution Guarantee

Agent Leak is **strictly local-first and offline by design**:

- **No Remote Telemetry**: Agent Leak never phones home, collects telemetry, or records analytics.
- **No Secret Uploads**: Your source code, configuration files, and detected secrets are never transmitted over the network.
- **Redaction by Default**: Agent Leak internally redacts and masks all secret values immediately upon pattern detection. Raw tokens, connection string passwords, and private keys never appear in CLI logs, terminal outputs, JSON results, or SARIF reports.
- **No Remote API Keys Required**: Agent Leak performs all pattern evaluation and entropy analysis locally using zero cloud services.

## Reporting a Vulnerability

If you discover a security vulnerability or potential secret leakage path within Agent Leak itself, please report it privately:

- **Email**: security@agent-leak.org (or open a private security advisory on GitHub).
- Please provide a minimal reproduction case with fake/dummy tokens (never submit live credentials).
- We aim to acknowledge reports within 24 hours and issue patches swiftly.
