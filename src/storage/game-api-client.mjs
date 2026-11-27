// Single entry point for the game's /api/* requests (used by src/game/room-session.mjs).
//
//   NEXT_PUBLIC_GAME_API_MODE=local   (default in the browser) the API runs in this
//                                      browser and stores data in IndexedDB.
//   NEXT_PUBLIC_GAME_API_MODE=remote  requests go to the Next.js route handler in
//                                      src/app/api/[...path]/route.js (needs a database).
//
// Outside a browser (Node tests) the default is "remote", so tests can stub fetch.

function configuredMode() {
  // Next.js replaces this exact expression at build time; elsewhere it may throw.
  try { return process.env.NEXT_PUBLIC_GAME_API_MODE; } catch { return undefined; }
}

export function gameApiMode() {
  const configured = configuredMode();
  if (configured === 'local' || configured === 'remote') return configured;
  return typeof indexedDB === 'undefined' ? 'remote' : 'local';
}

export async function gameApiFetch(url, init) {
  if (gameApiMode() === 'remote') return fetch(url, init);
  const {localGameApi} = await import('./local-game-api.mjs');
  return localGameApi(url, init);
}

// Starts loading the local database while the landing screen renders.
export function warmUpGameApi() {
  if (gameApiMode() !== 'local') return Promise.resolve();
  return import('./browser-db.mjs').then(module => module.warmUpLocalDb());
}
