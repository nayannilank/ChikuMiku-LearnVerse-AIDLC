/**
 * AWS Lambda Authorizer for JWT token validation.
 *
 * This authorizer validates Bearer tokens from the Authorization header
 * and generates IAM policy documents for API Gateway.
 */

interface AuthorizerEvent {
  type: string;
  authorizationToken: string;
  methodArn: string;
}

interface AuthorizerResponse {
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: Array<{
      Action: string;
      Effect: string;
      Resource: string;
    }>;
  };
  context?: Record<string, string>;
}

/**
 * JWT Authorizer handler.
 *
 * Validates the Bearer token and returns an IAM policy allowing
 * or denying access to the API Gateway resource.
 */
export async function handler(event: AuthorizerEvent): Promise<AuthorizerResponse> {
  const token = extractToken(event.authorizationToken);

  if (!token) {
    return generatePolicy('anonymous', 'Deny', event.methodArn);
  }

  try {
    const payload = decodeToken(token);

    if (!payload || !payload.sub) {
      return generatePolicy('anonymous', 'Deny', event.methodArn);
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return generatePolicy(payload.sub, 'Deny', event.methodArn);
    }

    // Allow access — include user context for downstream Lambdas
    const response = generatePolicy(payload.sub, 'Allow', event.methodArn);
    response.context = {
      userId: payload.sub,
      userType: payload.userType ?? 'student',
    };
    return response;
  } catch {
    return generatePolicy('anonymous', 'Deny', event.methodArn);
  }
}

/**
 * Extract Bearer token from Authorization header value.
 */
function extractToken(authHeader: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Decode a JWT token payload (base64url decode, no signature verification in this stub).
 *
 * In production, replace this with proper JWT signature verification
 * using the JWT_SECRET environment variable.
 */
function decodeToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload) as JwtPayload;
  } catch {
    return null;
  }
}

interface JwtPayload {
  sub: string;
  exp?: number;
  iat?: number;
  userType?: string;
}

/**
 * Generate an IAM policy document for API Gateway.
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string
): AuthorizerResponse {
  // Use a wildcard resource so the policy is cached across endpoints
  const arnParts = resource.split(':');
  const apiGatewayArn = arnParts.slice(0, 5).join(':');
  const wildcardResource = `${apiGatewayArn}:*`;

  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: wildcardResource,
        },
      ],
    },
  };
}
