#!/usr/bin/env node

import { runCli } from '../dist/cli/index.js';

runCli().catch((err) => {
  console.error('\nAgent Leak unexpected error:', err?.message || err);
  process.exit(1);
});
