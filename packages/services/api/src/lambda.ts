/**
 * AWS Lambda handler entry point.
 *
 * Wraps the existing ApiRouter to handle API Gateway events.
 * All routes are dispatched through the same router used by
 * the local development server.
 */

import { ApiRouter, createDefaultRoutes, ApiRequest, HttpMethod } from './endpoints';

// Create and configure router (shared across warm invocations)
const router = new ApiRouter();
for (const route of createDefaultRoutes()) {
  router.register(route);
}

interface ApiGatewayEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string> | null;
  body: string | null;
  queryStringParameters: Record<string, string> | null;
  pathParameters: Record<string, string> | null;
  isBase64Encoded?: boolean;
}

interface ApiGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

/**
 * Lambda handler for API Gateway proxy integration.
 */
export async function handler(event: ApiGatewayEvent): Promise<ApiGatewayResponse> {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
      isBase64Encoded: false,
    };
  }

  // Convert API Gateway event to ApiRequest
  const request = toApiRequest(event);

  // Dispatch through the router
  const response = await router.dispatch(request);

  return {
    statusCode: response.status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
      ...response.headers,
    },
    body: JSON.stringify(response.body),
    isBase64Encoded: false,
  };
}

/**
 * Convert API Gateway event to internal ApiRequest format.
 */
function toApiRequest(event: ApiGatewayEvent): ApiRequest {
  const headers: Record<string, string> = {};
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value) headers[key.toLowerCase()] = value;
    }
  }

  let body: unknown;
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      body = event.body;
    }
  }

  return {
    method: event.httpMethod.toUpperCase() as HttpMethod,
    path: event.path,
    headers,
    body,
    queryParams: event.queryStringParameters ?? {},
  };
}

/**
 * Standard CORS response headers.
 */
function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-learner-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
}
