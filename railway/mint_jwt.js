#!/usr/bin/env node
/**
 * Mint a long-lived JWT token for PostgREST on Railway.
 * Zero external dependencies (uses native Node.js crypto module).
 *
 * Usage:
 *   node mint_jwt.js <PGRST_JWT_SECRET>
 * Example:
 *   node mint_jwt.js my-super-secret-jwt-key-min-32-chars
 */

const crypto = require('crypto');

function base64url(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function mintToken(secret, role = 'anon', expiresInYears = 5) {
  if (!secret || secret.length < 32) {
    console.error('Error: PGRST_JWT_SECRET must be at least 32 characters long.');
    process.exit(1);
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + (expiresInYears * 365 * 24 * 60 * 60);
  const payload = { role, exp };

  const h64 = base64url(Buffer.from(JSON.stringify(header)));
  const p64 = base64url(Buffer.from(JSON.stringify(payload)));
  const data = `${h64}.${p64}`;

  const signature = crypto.createHmac('sha256', secret).update(data).digest();
  const s64 = base64url(signature);

  return `${data}.${s64}`;
}

const secret = process.argv[2];
if (!secret) {
  console.log('Usage: node mint_jwt.js <PGRST_JWT_SECRET>');
  console.log('Example: node mint_jwt.js "my_random_secret_string_32_characters_minimum"');
  process.exit(1);
}

const token = mintToken(secret);
console.log('\n--- MINTED POSTGREST ANON JWT TOKEN ---');
console.log(token);
console.log('\nCopy this token into BACKEND.key in index.html and Risk and AML.html\n');
