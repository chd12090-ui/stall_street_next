// The server-side database for NEXT_PUBLIC_GAME_API_MODE=remote.
//
// Not configured yet: the game currently keeps its data in the browser
// (src/storage). When you pick a database, return a D1-compatible object here:
//   prepare(sql).bind(...values).first() / .all() / .run(),  batch([...])
// The API code (src/server/*.mjs) is plain SQLite SQL, and db/migrations holds the
// schema. Two common ways to get that shape:
//
//   Cloudflare D1:      return env.DB  (already D1, nothing to wrap)
//   Any SQLite driver:  wrap it with createD1(engine) from ./d1-adapter.mjs,
//                       where engine = {query(sql, params) -> {rows, changes}, exec(sql)}
//                       and run migrate(engine) from ./migrate.mjs once at startup.
//                       ./node-sqlite.mjs is a complete example using node:sqlite.
let database = null;

export async function getServerDb() {
  return database;
}

export function setServerDb(db) {
  database = db;
}
