/**
 * JWT Module — HMAC-SHA256 token signing and verification.
 *
 * Uses Node.js `crypto` only (no external dependencies).
 * Tokens follow a compact format: base64url(header).base64url(payload).base64url(signature)
 */

import { createHmac, randomBytes } from 'crypto';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface JwtConfig {
  secret: string;
  accessTokenExpiry: number;  // ms, default 30 days
  refreshTokenExpiry: number; // ms, default 60 days
  issuer: string;
  audience: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
}

export interface DecodedToken {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  roles: string[];
  type: 'access' | 'refresh';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

// ─── Default Config ───────────────────────────────────────────────────────────

const defaultSecret: string =
  process.env.JWT_SECRET || randomBytes(32).toString('hex');

const defaultConfig: JwtConfig = {
  secret: defaultSecret,
  accessTokenExpiry: THIRTY_DAYS_MS,
  refreshTokenExpiry: SIXTY_DAYS_MS,
  issuer: 'learnverse',
  audience: 'learnverse-app',
};

/**
 * Returns the current JWT configuration.
 * Useful for handlers that need to sign or verify tokens.
 */
export function getJwtConfig(): JwtConfig {
  return { ...defaultConfig };
}

// ─── Encoding Helpers ─────────────────────────────────────────────────────────

function toBase64Url(data: string): string {
  return Buffer.from(data, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

function createSignature(headerEncoded: string, payloadEncoded: string, secret: string): string {
  const data = `${headerEncoded}.${payloadEncoded}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─── Sign Token ───────────────────────────────────────────────────────────────

/**
 * Signs a token payload and returns a compact JWT string.
 * The `iat` (issued-at) field is set automatically to the current time.
 */
export function signToken(
  payload: Omit<DecodedToken, 'iat'>,
  config: JwtConfig = defaultConfig,
): string {
  const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
  const fullPayload: DecodedToken = {
    ...payload,
    iat: Date.now(),
  };

  const headerEncoded = toBase64Url(header);
  const payloadEncoded = toBase64Url(JSON.stringify(fullPayload));
  const signature = createSignature(headerEncoded, payloadEncoded, config.secret);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// ─── Verify Token ─────────────────────────────────────────────────────────────

/**
 * Verifies a token's signature, expiry, issuer, and audience.
 * Returns the decoded payload on success, or null on any failure.
 */
export function verifyToken(
  token: string,
  config: JwtConfig = defaultConfig,
): DecodedToken | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerEncoded, payloadEncoded, signatureProvided] = parts;

  // Verify signature
  const expectedSignature = createSignature(headerEncoded, payloadEncoded, config.secret);
  if (expectedSignature !== signatureProvided) return null;

  // Decode payload
  let decoded: DecodedToken;
  try {
    decoded = JSON.parse(fromBase64Url(payloadEncoded));
  } catch {
    return null;
  }

  // Check required fields
  if (
    typeof decoded.sub !== 'string' ||
    typeof decoded.iat !== 'number' ||
    typeof decoded.exp !== 'number' ||
    typeof decoded.iss !== 'string' ||
    typeof decoded.aud !== 'string' ||
    !Array.isArray(decoded.roles) ||
    (decoded.type !== 'access' && decoded.type !== 'refresh')
  ) {
    return null;
  }

  // Check expiry
  if (decoded.exp < Date.now()) return null;

  // Check issuer
  if (decoded.iss !== config.issuer) return null;

  // Check audience
  if (decoded.aud !== config.audience) return null;

  return decoded;
}

// ─── Create Token Pair ────────────────────────────────────────────────────────

/**
 * Generates an access + refresh token pair for a given user.
 */
export function createTokenPair(
  userId: string,
  roles: string[],
  config: JwtConfig = defaultConfig,
): TokenPair {
  const now = Date.now();

  const accessToken = signToken(
    {
      sub: userId,
      exp: now + config.accessTokenExpiry,
      iss: config.issuer,
      aud: config.audience,
      roles,
      type: 'access',
    },
    config,
  );

  const refreshToken = signToken(
    {
      sub: userId,
      exp: now + config.refreshTokenExpiry,
      iss: config.issuer,
      aud: config.audience,
      roles,
      type: 'refresh',
    },
    config,
  );

  return {
    accessToken,
    refreshToken,
    expiresAt: now + config.accessTokenExpiry,
  };
}
