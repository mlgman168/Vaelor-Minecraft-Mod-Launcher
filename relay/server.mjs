import { createServer } from 'node:http';

const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const maxMessages = Number.parseInt(process.env.VAELOR_MAX_MESSAGES ?? '300', 10);
const maxMessageLength = Number.parseInt(process.env.VAELOR_MAX_MESSAGE_LENGTH ?? '180', 10);
const messageTtlMs = Number.parseInt(process.env.VAELOR_MESSAGE_TTL_MS ?? '600000', 10);
const rateWindowMs = 10_000;
const rateLimit = 6;

let nextId = 1;
const messages = [];
const rates = new Map();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  applyCors(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    pruneMessages();
    sendJson(response, 200, { ok: true, service: 'vaelor-chat-relay', messages: messages.length });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/chat') {
    pruneMessages();
    const after = Number.parseInt(url.searchParams.get('after') ?? '0', 10) || 0;
    const joinedAt = Number.parseInt(url.searchParams.get('joinedAt') ?? '0', 10) || 0;
    const serverName = cleanText(url.searchParams.get('server') ?? '', 80);
    const body = messages
      .filter((message) => message.id > after && message.createdAt >= joinedAt && message.server === serverName)
      .slice(-80)
      .map((message) => [
        message.id,
        message.createdAt,
        encodeURIComponent(message.sender),
        encodeURIComponent(message.message),
      ].join('\t'))
      .join('\n');
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end(body);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/chat') {
    pruneMessages();
    const ip = request.headers['x-forwarded-for']?.toString().split(',')[0].trim() || request.socket.remoteAddress || 'unknown';
    if (!allowMessage(ip)) {
      sendJson(response, 429, { ok: false, error: 'Slow down.' });
      return;
    }

    const payload = await readJson(request, 4096);
    const sender = cleanText(payload?.sender, 24);
    const message = cleanText(payload?.message, maxMessageLength);
    const serverName = cleanText(payload?.server, 80);
    const version = cleanText(payload?.version, 24);
    if (!sender || !message) {
      sendJson(response, 400, { ok: false, error: 'Missing sender or message.' });
      return;
    }

    const entry = {
      id: nextId++,
      createdAt: Date.now(),
      sender,
      message,
      server: serverName,
      version,
    };
    messages.push(entry);
    while (messages.length > maxMessages) {
      messages.shift();
    }
    sendJson(response, 200, { ok: true, id: entry.id });
    return;
  }

  sendJson(response, 404, { ok: false, error: 'Not found.' });
});

server.listen(port, () => {
  console.log(`Vaelor chat relay listening on :${port}`);
});

function applyCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(response, status, payload) {
  response
    .writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    .end(JSON.stringify(payload));
}

function allowMessage(ip) {
  const now = Date.now();
  const bucket = rates.get(ip)?.filter((timestamp) => now - timestamp < rateWindowMs) ?? [];
  if (bucket.length >= rateLimit) {
    rates.set(ip, bucket);
    return false;
  }
  bucket.push(now);
  rates.set(ip, bucket);
  return true;
}

function pruneMessages() {
  const cutoff = Date.now() - messageTtlMs;
  while (messages.length && messages[0].createdAt < cutoff) {
    messages.shift();
  }
}

function cleanText(value, limit) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

async function readJson(request, limit) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > limit) {
      return undefined;
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
