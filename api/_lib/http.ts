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

export function allowMethods(req: { method?: string }, res: ApiResponse, allowed: string[]) {
  const method = req.method?.toUpperCase() || '';
  if (!allowed.includes(method)) {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Allow', allowed.join(', '));
    }
    sendJson(res, 405, { error: `Method ${method || 'UNKNOWN'} not allowed` });
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
  return JSON.parse(raw) as T;
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
