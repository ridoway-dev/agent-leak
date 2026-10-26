import { describe, it, expect } from 'vitest';
import { checkSensitiveFileName } from '../src/rules/sensitive-files.js';

describe('Sensitive File Detection', () => {
  it('identifies critical sensitive files', () => {
    expect(checkSensitiveFileName('.env')?.severity).toBe('CRITICAL');
    expect(checkSensitiveFileName('.env.local')?.severity).toBe('CRITICAL');
    expect(checkSensitiveFileName('.env.production')?.severity).toBe('CRITICAL');
    expect(checkSensitiveFileName('id_rsa')?.severity).toBe('CRITICAL');
    expect(checkSensitiveFileName('id_ed25519')?.severity).toBe('CRITICAL');
    expect(checkSensitiveFileName('server.key')?.severity).toBe('CRITICAL');
    expect(checkSensitiveFileName('cert.pem')?.severity).toBe('CRITICAL');
    expect(checkSensitiveFileName('service-account.json')?.severity).toBe('CRITICAL');
    expect(checkSensitiveFileName('credentials.json')?.severity).toBe('CRITICAL');
  });

  it('identifies high sensitive files', () => {
    expect(checkSensitiveFileName('secrets.yaml')?.severity).toBe('HIGH');
    expect(checkSensitiveFileName('terraform.tfvars')?.severity).toBe('HIGH');
    expect(checkSensitiveFileName('docker-compose.override.yml')?.severity).toBe('HIGH');
  });

  it('ignores template and example files', () => {
    expect(checkSensitiveFileName('.env.example')).toBeNull();
    expect(checkSensitiveFileName('.env.sample')).toBeNull();
    expect(checkSensitiveFileName('.env.template')).toBeNull();
  });
});
