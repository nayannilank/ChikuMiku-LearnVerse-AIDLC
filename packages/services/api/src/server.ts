/**
 * Local development server for the ChikuMiku LearnVerse API.
 *
 * Runs the API router on a local HTTP server for testing the
 * learning session workflow and other endpoints.
 *
 * Usage:
 *   npx tsx packages/services/api/src/server.ts
 *
 * The server starts at http://localhost:3000
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { ApiRouter, createDefaultRoutes, ApiRequest, HttpMethod } from './endpoints';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

// Create and configure router
const router = new ApiRouter();
for (const route of createDefaultRoutes()) {
  router.register(route);
}

/**
 * Parse the request body as JSON.
 */
function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw || raw.trim().length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Convert Node.js IncomingMessage to our ApiRequest format.
 */
async function toApiRequest(req: IncomingMessage): Promise<ApiRequest> {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const body = await parseBody(req);

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key] = value;
    }
  }

  const queryParams: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    queryParams[key] = value;
  }

  return {
    method: (req.method?.toUpperCase() ?? 'GET') as HttpMethod,
    path: url.pathname,
    headers,
    body,
    queryParams,
  };
}

// Create HTTP server
const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const apiRequest = await toApiRequest(req);

    console.log(`${apiRequest.method} ${apiRequest.path}`);

    const apiResponse = await router.dispatch(apiRequest);

    res.writeHead(apiResponse.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-learner-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      ...apiResponse.headers,
    });

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-learner-id',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      });
      res.end();
      return;
    }

    res.end(JSON.stringify(apiResponse.body, null, 2));
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Server error', retryable: true }));
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 ChikuMiku LearnVerse API running at http://localhost:${PORT}\n`);
  console.log('Available learning session endpoints:');
  console.log('  POST /api/v1/subjects/:subjectId/enroll  — Enroll in a subject');
  console.log('  GET  /api/v1/subjects                    — List enrolled subjects');
  console.log('  POST /api/v1/learning/start              — Start learning session');
  console.log('  POST /api/v1/learning/select-subject     — Select a subject');
  console.log('  POST /api/v1/learning/select-chapter     — Select a chapter');
  console.log('  POST /api/v1/learning/new-chapter        — Start a new chapter');
  console.log('  POST /api/v1/learning/end-chapter        — End current chapter');
  console.log('  POST /api/v1/learning/end                — End session');
  console.log('  GET  /api/v1/learning/session            — Get session state');
  console.log('\nTip: Use header "x-learner-id: <id>" to identify the learner.\n');
});
