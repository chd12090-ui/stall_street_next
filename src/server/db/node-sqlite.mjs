// node:sqlite engine for tests and local Node scripts (Node.js 22.13+).
// It is not imported by the Next.js app; the browser uses src/storage instead.
import {DatabaseSync} from 'node:sqlite';
import {createD1} from './d1-adapter.mjs';
import {migrate} from './migrate.mjs';

export function nodeSqliteEngine(location = ':memory:') {
  const db = new DatabaseSync(location);
  return {
    query(sql, params = []) {
      const statement = db.prepare(sql);
      // node:sqlite expects numbered placeholders (?1, ?2) as named parameters.
      const args = /\?\d/.test(sql) ? [Object.fromEntries(params.map((value, index) => ['?' + (index + 1), value]))] : params;
      if (statement.columns().length) return {rows: statement.all(...args), changes: 0};
      return {rows: [], changes: Number(statement.run(...args).changes)};
    },
    exec: sql => db.exec(sql),
    close: () => db.close(),
  };
}

// A migrated D1-compatible database. Defaults to an in-memory database.
export async function openNodeSqliteD1(location = ':memory:') {
  const engine = nodeSqliteEngine(location);
  await migrate(engine);
  return Object.assign(createD1(engine), {close: engine.close});
}
