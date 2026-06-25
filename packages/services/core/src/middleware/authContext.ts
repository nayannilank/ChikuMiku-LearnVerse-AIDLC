/**
 * Auth Context Middleware
 *
 * Extracts user identity from API Gateway Cognito authorizer claims
 * and provides a typed AuthContext for downstream handler logic.
 */

import type { APIGatewayProxyEvent } from '../lambdaTypes.js';
import { ServiceError } from './errorHandler.js';

// ============================================================
// Types
// ============================================================

export type UserRole = 'parent' | 'student';

export interface AuthContext {
  userId: string;
  role: UserRole;
  groups: string[];
  username: string;
}

// ============================================================
// Extraction Logic
// ============================================================

/**
 * Extracts authentication context from an API Gateway event.
 *
 * Expects Cognito authorizer claims to be present in
 * `event.requestContext.authorizer.claims`.
 *
 * @throws ServiceError with 401 status if claims are missing or invalid
 */
export function extractAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext?.authorizer?.claims;

  if (!claims) {
    throw new ServiceError('Missing authentication claims', 401, 'UNAUTHORIZED');
  }

  const userId = claims['sub'];
  if (!userId || typeof userId !== 'string') {
    throw new ServiceError('Invalid or missing user ID in token', 401, 'TOKEN_INVALID');
  }

  const username = claims['cognito:username'] ?? claims['username'] ?? '';
  const groupsClaim = claims['cognito:groups'] ?? '';
  const groups: string[] = typeof groupsClaim === 'string' && groupsClaim.length > 0
    ? groupsClaim.split(',').map((g: string) => g.trim())
    : [];

  const userType = claims['custom:userType'] ?? '';
  const role = resolveRole(userType, groups);

  return { userId, role, groups, username };
}

/**
 * Attempts to extract auth context without throwing.
 * Returns null for unauthenticated/public routes.
 */
export function extractAuthContextOptional(event: APIGatewayProxyEvent): AuthContext | null {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) {
    return null;
  }

  try {
    return extractAuthContext(event);
  } catch {
    return null;
  }
}

// ============================================================
// Helpers
// ============================================================

function resolveRole(userType: string, groups: string[]): UserRole {
  if (userType === 'parent') return 'parent';
  if (userType === 'student') return 'student';

  // Fall back to checking group membership
  if (groups.some(g => g.toLowerCase().includes('parent'))) return 'parent';
  return 'student';
}
