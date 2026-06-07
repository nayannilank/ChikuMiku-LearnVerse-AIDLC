/**
 * Sync domain Lambda handler.
 *
 * Registers only routes tagged with 'sync' and dispatches
 * API Gateway proxy events through the shared ApiRouter.
 */

import { ApiRouter, createDefaultRoutes, ApiRequest, HttpMethod } from '../../endpoints';

// --- Interfaces matching API Gateway proxy integration ---

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

// --- Router setup (shared across warm invocations) ---

const DOMAIN_TAGS = ['sync'];

const router = new ApiRouter();
const allRoutes = createDefaultRoutes();
for (const route of allRoutes) {
  if (route.tags.some((tag) => DOMAIN_TAGS.includes(tag))) {
    router.register(route);
  }
}

// --- Handler ---

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

  const request = toApiRequest(event);
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

// --- Helpers ---

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

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-learner-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
}
