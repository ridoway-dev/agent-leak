// Demo server for Agent Leak beginner tutorial
// WARNING: This file contains synthetic nonfunctional fake credentials for testing only.

import http from 'node:http';

// ❌ Vulnerable line: Hardcoded OpenAI API key
const OPENAI_API_KEY = 'sk-proj-DEMOTUTORIALFAKEKEY1234567890abcdef123456';

// ❌ Vulnerable line: Hardcoded PostgreSQL database connection string with password
const DATABASE_URL = 'postgres://postgres:tutorial_secret_pw123@localhost:5432/myapp_dev';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', message: 'Agent Leak Tutorial Server' }));
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
