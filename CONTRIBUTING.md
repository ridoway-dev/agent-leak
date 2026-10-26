# Contributing to Agent Leak

Thank you for your interest in improving Agent Leak! We welcome contributions that expand secret detection rules, improve false-positive suppression, and integrate with AI agent environments.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/agent-leak/agent-leak.git
cd agent-leak

# Install dependencies
npm install

# Run tests in watch mode
npm run test:watch

# Build bundle
npm run build
```

## Adding Detection Rules

When proposing new credential or token detection rules:
1. Add rule definition to `src/rules/secrets.ts` (or relevant rule category).
2. Ensure you specify appropriate masking handlers and validation checks.
3. Add test cases in `tests/secrets.test.ts` using **obviously fake test credentials**. Never submit real tokens.
4. Add false-positive test cases to verify common documentation examples or placeholders are not flagged.

## Submitting Pull Requests

1. Create a feature branch: `git checkout -b feat/new-rule-name`.
2. Ensure `npm test` and `npm run build` succeed without errors.
3. Open a Pull Request with a clear explanation of the detection logic and false-positive risk assessment.
