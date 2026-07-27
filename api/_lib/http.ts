import type { IncomingMessage } from 'http';

export interface ApiRequest extends IncomingMessage {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ApiResponse {
  status?: (code: number) => ApiResponse;
  json?: (payload: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
  statusCode?: number;
}

export class ApiHttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiHttpError';
  }
}

export function createHttpError(status: number, message: string, code?: string): ApiHttpError {
  return new ApiHttpError(status, message, code);
}

export function sendJson(res: ApiResponse, status: number, payload: unknown) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(payload);
    return;
  }

  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  if (typeof res.statusCode === 'number') {
    res.statusCode = status;
  }

  if (typeof res.end === 'function') {
    res.end(JSON.stringify(payload));
  }
}

export function sendError(res: ApiResponse, status: number, error: string, code?: string, details?: string) {
  sendJson(res, status, {
    error,
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
  });
}

export function handleApiError(res: ApiResponse, endpoint: string, error: unknown, fallbackStatus = 500) {
  const errorMessage = error instanceof Error ? error.message : '';
  const isMissingEnv = errorMessage.startsWith('Missing required environment variable: ')
    || errorMessage.startsWith('Missing webhook configuration: ');

  const status = error instanceof ApiHttpError ? error.status : fallbackStatus;
  const message = error instanceof ApiHttpError
    ? error.message
    : isMissingEnv
      ? 'Unable to create checkout session'
      : 'Internal server error';
  const code = error instanceof ApiHttpError
    ? error.code
    : isMissingEnv
      ? 'backend_config_missing'
      : 'internal_error';
  const details = isMissingEnv ? 'Backend payment configuration is incomplete.' : undefined;
  const errorType = error instanceof Error ? error.name : typeof error;

  console.error('api_error', {
    endpoint,
    errorType,
    statusCode: status,
  });

  sendError(res, status, message, code, details);
}

export function allowMethods(req: { method?: string }, res: ApiResponse, allowed: string[]) {
  const method = req.method?.toUpperCase() || '';
  if (!allowed.includes(method)) {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Allow', allowed.join(', '));
    }
    sendError(res, 405, `Method ${method || 'UNKNOWN'} not allowed`, 'method_not_allowed');
    return false;
  }
  return true;
}

export async function readJsonBody<T = unknown>(req: ApiRequest): Promise<T> {
  if (typeof req.body === 'object' && req.body !== null) {
    return req.body as T;
  }

  const raw = await readRawBody(req);
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw createHttpError(400, 'Invalid JSON payload', 'invalid_json');
  }
}

export async function readRawBody(req: IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}
