/**
 * Lambda Handler Types
 *
 * Minimal type definitions for AWS Lambda + API Gateway integration.
 * Defined inline since this monorepo does not depend on @types/aws-lambda directly.
 */

// ============================================================
// API Gateway Proxy Event (simplified)
// ============================================================

export interface APIGatewayProxyEvent {
  body: string | null;
  headers: Record<string, string | undefined>;
  pathParameters: Record<string, string | undefined> | null;
  queryStringParameters: Record<string, string | undefined> | null;
  requestContext: {
    authorizer?: {
      claims?: Record<string, string>;
    };
    requestId?: string;
    httpMethod?: string;
    path?: string;
  };
  httpMethod: string;
  path: string;
  resource: string;
}

// ============================================================
// API Gateway Proxy Result
// ============================================================

export interface APIGatewayProxyResult {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

// ============================================================
// Handler & Middleware Types
// ============================================================

/**
 * A Lambda handler function that processes an API Gateway proxy event.
 */
export type LambdaHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

/**
 * A middleware function that wraps handler execution.
 * Call `next()` to invoke the next middleware or final handler.
 */
export type MiddlewareFunction = (
  event: APIGatewayProxyEvent,
  next: () => Promise<APIGatewayProxyResult>,
) => Promise<APIGatewayProxyResult>;
