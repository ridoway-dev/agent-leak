import { describe, it, expect } from 'vitest';
import { scanFileContent } from '../src/scanners/file-scanner.js';

describe('Secret Detection Rules', () => {
  it('detects OpenAI API keys', () => {
    const fakeKey = 'sk-proj-FAKEABCDEF1234567890abcdef123456';
    const content = `const client = new OpenAI({ apiKey: "${fakeKey}" });`;
    const findings = scanFileContent({ filePath: 'src/ai.ts', content });

    expect(findings.length).toBeGreaterThan(0);
    const match = findings.find((f) => f.id === 'sec-openai-key');
    expect(match).toBeDefined();
    expect(match?.severity).toBe('CRITICAL');
    expect(match?.maskedValue).not.toContain(fakeKey);
    expect(match?.maskedValue).toContain('****');
  });

  it('detects GitHub Personal Access Tokens', () => {
    const fakeToken = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const content = `const token = "${fakeToken}";`;
    const findings = scanFileContent({ filePath: 'config.ts', content });

    const match = findings.find((f) => f.id === 'sec-github-pat');
    expect(match).toBeDefined();
    expect(match?.severity).toBe('CRITICAL');
    expect(match?.maskedValue).not.toContain(fakeToken);
  });

  it('detects AWS Access Keys', () => {
    const fakeKey = 'AKIAIOSFODNN7EXAMPLE';
    const content = `aws_access_key_id = "${fakeKey}"`;
    const findings = scanFileContent({ filePath: 'aws.py', content });

    const match = findings.find((f) => f.id === 'sec-aws-access-key');
    expect(match).toBeDefined();
    expect(match?.maskedValue).not.toBe(fakeKey);
  });

  it('detects Database connection strings with embedded passwords', () => {
    const connStr = 'postgres://admin:super_secret_pw123@db.internal.net:5432/main';
    const content = `DATABASE_URL="${connStr}"`;
    const findings = scanFileContent({ filePath: 'server.ts', content });

    const match = findings.find((f) => f.id === 'sec-conn-postgres');
    expect(match).toBeDefined();
    expect(match?.severity).toBe('CRITICAL');
    expect(match?.maskedValue).toContain('postgres://admin:');
    expect(match?.maskedValue).toContain('********');
    expect(match?.maskedValue).not.toContain('super_secret_pw123');
  });

  it('detects private key blocks', () => {
    const content = `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0FakeKey...\n-----END RSA PRIVATE KEY-----`;
    const findings = scanFileContent({ filePath: 'keys/server.key', content });

    const match = findings.find((f) => f.id === 'sec-private-key');
    expect(match).toBeDefined();
    expect(match?.severity).toBe('CRITICAL');
    expect(match?.maskedValue).toContain('REDACTED');
  });

  it('detects JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const content = `const auth = "Bearer ${jwt}";`;
    const findings = scanFileContent({ filePath: 'auth.ts', content });

    const match = findings.find((f) => f.id === 'sec-jwt');
    expect(match).toBeDefined();
    expect(match?.maskedValue).not.toBe(jwt);
  });
});
