// Runs the game API (src/server/game-api.mjs) inside the browser.
// room-session.mjs sends every /api/* request here while NEXT_PUBLIC_GAME_API_MODE
// is "local" (the default), so rooms, chat, elections and rituals are stored in
// this browser's IndexedDB instead of a server database.
import {serveGameApi, roomError} from '../server/game-api.mjs';
import {withLocalDb, exportLocalDb, resetLocalDb, localDbInfo} from './browser-db.mjs';

// Safari 16 has no static Response.json; the API code uses it for every reply.
if (typeof Response.json !== 'function') {
  Response.json = (data, init = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    return new Response(JSON.stringify(data), {...init, headers});
  };
}

// The minimum of the Fetch Request interface that the API reads. A native Request
// would do in Chromium, but Firefox does not expose Request.prototype.body.
export class LocalRequest {
  #text;
  constructor(url, {method = 'GET', headers, text = null, signal = null} = {}) {
    this.url = String(url);
    this.method = method.toUpperCase();
    this.headers = new Headers(headers);
    this.signal = signal;
    this.#text = text;
  }
  get body() {
    return this.#text === null ? null : new Response(this.#text).body;
  }
  async text() { return this.#text ?? ''; }
  async json() { return JSON.parse(this.#text ?? ''); }
}

async function bodyText(body) {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') return body;
  return new Response(body).text();
}

function abortable(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, {once: true});
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function localGameApi(input, init = {}) {
  const url = new URL(input instanceof URL ? input.href : String(input), globalThis.location?.href);
  const signal = init.signal ?? null;
  signal?.throwIfAborted?.();
  const request = new LocalRequest(url, {
    method: init.method, headers: init.headers, text: await bodyText(init.body), signal,
  });
  // Like a server, the work finishes even if the caller stops waiting for it.
  const work = withLocalDb(db => serveGameApi(request, db)).catch(error => {
    console.error('[stall-street] local game API failed', url.pathname, error);
    return roomError('브라우저 저장소에 연결하지 못했어. 새로고침한 뒤 다시 시도해 줘.', 503);
  });
  return abortable(work, signal);
}

// Console helpers while the game has no server database:
//   await stallStreetLocalDb.info()      where and how big the local copy is
//   await stallStreetLocalDb.download()  save it as a .sqlite file
//   await stallStreetLocalDb.reset()     delete rooms, chats and votes in this browser
if (typeof window !== 'undefined') {
  window.stallStreetLocalDb = {
    info: localDbInfo,
    reset: resetLocalDb,
    async download(name = 'stall-street-local.sqlite') {
      const bytes = await exportLocalDb();
      const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([bytes], {type: 'application/vnd.sqlite3'})), download: name,
      });
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    },
  };
}
