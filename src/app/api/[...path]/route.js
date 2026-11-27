// Game API over HTTP, for NEXT_PUBLIC_GAME_API_MODE=remote.
// In the default local mode the browser runs the same code itself (src/storage),
// so this route only answers once src/server/db/server-db.mjs returns a database.
import {serveGameApi, roomError} from '@/server/game-api.mjs';
import {getServerDb} from '@/server/db/server-db.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request) {
  const db = await getServerDb();
  if (!db) return roomError('서버 데이터베이스가 아직 연결되지 않았어. 지금은 로컬 저장 모드로 플레이해 줘.', 503);
  try {
    return await serveGameApi(request, db);
  } catch (error) {
    console.error('Game API request failed', new URL(request.url).pathname, error);
    return roomError('게임 서버에 연결하지 못했어. 잠시 뒤 다시 시도해 줘.', 503);
  }
}

export {handle as GET, handle as POST};
