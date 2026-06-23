/**
 * Property Tests: JWT Module
 *
 * Feature: backend-stub-implementations, Property 16: Access token minimum 30-day expiry
 * Feature: backend-stub-implementations, Property 17: Forged JWT tokens are rejected
 *
 * **Validates: Requirements 5.4, 6.1, 6.2, 6.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createTokenPair,
  verifyToken,
  signToken,
  getJwtConfig,
  JwtConfig,
} from '../jwt';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a random user ID */
const userIdArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 5, maxLength: 30 },
).map((s) => `user-${s}`);

/** Generates a random set of roles */
const rolesArb = fc.array(
  fc.constantFrom('student', 'parent', 'admin', 'teacher', 'moderator'),
  { minLength: 1, maxLength: 3 },
);

/** Generates a random secret string (different from the default config secret) */
const differentSecretArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
  { minLength: 32, maxLength: 64 },
).map((s) => `forged-${s}`);

/** Generates a random byte modification for payload tampering */
const tamperIndexArb = (maxLen: number) => fc.integer({ min: 0, max: Math.max(0, maxLen - 1) });

// ─── Constants ────────────────────────────────────────────────────────────────

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60; // 2,592,000 seconds

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 16: Access token minimum 30-day expiry', () => {
  it('for any newly issued access token, exp - iat SHALL be at least 30 days', () => {
    const config = getJwtConfig();

    fc.assert(
      fc.property(userIdArb, rolesArb, (userId, roles) => {
        const pair = createTokenPair(userId, roles, config);

        // Decode the access token to inspect claims
        const decoded = verifyToken(pair.accessToken, config);
        expect(decoded).not.toBeNull();

        if (decoded) {
          // exp and iat are in milliseconds in this implementation
          const expiryDurationMs = decoded.exp - decoded.iat;
          const expiryDurationSeconds = expiryDurationMs / 1000;

          // The expiry duration SHALL be at least 30 days (2,592,000 seconds)
          expect(expiryDurationSeconds).toBeGreaterThanOrEqual(THIRTY_DAYS_SECONDS);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property 17: Forged JWT tokens are rejected', () => {
  it('a token signed with a different secret SHALL be rejected by verifyToken', () => {
    const config = getJwtConfig();

    fc.assert(
      fc.property(userIdArb, rolesArb, differentSecretArb, (userId, roles, forgedSecret) => {
        // Ensure the forged secret is actually different from the real one
        fc.pre(forgedSecret !== config.secret);

        const forgedConfig: JwtConfig = {
          ...config,
          secret: forgedSecret,
        };

        // Sign a token with the forged secret
        const forgedToken = signToken(
          {
            sub: userId,
            exp: Date.now() + config.accessTokenExpiry,
            iss: config.issuer,
            aud: config.audience,
            roles,
            type: 'access',
          },
          forgedConfig,
        );

        // Verify with the real config — SHALL return null
        const result = verifyToken(forgedToken, config);
        expect(result).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it('a token with its payload modified after signing SHALL be rejected by verifyToken', () => {
    const config = getJwtConfig();

    fc.assert(
      fc.property(
        userIdArb,
        rolesArb,
        fc.integer({ min: 0, max: 100 }),
        (userId, roles, tamperSeed) => {
          // Create a valid token
          const pair = createTokenPair(userId, roles, config);
          const token = pair.accessToken;

          // Split into parts
          const parts = token.split('.');
          expect(parts.length).toBe(3);

          const [header, payload, signature] = parts;

          // Tamper with the payload by modifying a character
          const payloadChars = payload.split('');
          if (payloadChars.length === 0) return; // skip empty payloads

          const tamperIdx = tamperSeed % payloadChars.length;
          const originalChar = payloadChars[tamperIdx];

          // Replace with a different base64url character
          const base64urlChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
          let replacementChar = base64urlChars[(base64urlChars.indexOf(originalChar) + 1) % base64urlChars.length];
          if (replacementChar === originalChar) {
            replacementChar = base64urlChars[(base64urlChars.indexOf(originalChar) + 2) % base64urlChars.length];
          }
          payloadChars[tamperIdx] = replacementChar;

          const tamperedPayload = payloadChars.join('');

          // Only proceed if we actually changed the payload
          fc.pre(tamperedPayload !== payload);

          // Reassemble the token with tampered payload but original signature
          const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

          // Verify SHALL return null
          const result = verifyToken(tamperedToken, config);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });
});
