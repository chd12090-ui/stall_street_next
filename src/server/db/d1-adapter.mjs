// A small Cloudflare D1-compatible wrapper around any SQLite engine.
//
// The game API (src/server) was written against D1:
//   db.prepare(sql).bind(...values).first() / .all() / .run()
//   db.batch([statement, ...])
// Wrapping an engine in this shape lets the same API code run on:
//   - sql.js in the browser (src/storage), which is the current setup,
//   - node:sqlite in tests and local Node scripts (./node-sqlite.mjs),
//   - any SQLite-compatible server database you choose later.
//
// An engine needs two methods:
//   query(sql, params) -> {rows: object[], changes: number}
//   exec(sql)          -> runs one or more statements without parameters
// Engines are synchronous (sql.js, node:sqlite). An engine that returns promises
// must set `async: true`; its calls are then queued so a batch stays atomic.

function bindable(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'bigint') return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  if (value === null || typeof value === 'number' || typeof value === 'string' || value instanceof Uint8Array) return value;
  throw new TypeError('SQLite cannot store a value of type ' + Object.prototype.toString.call(value));
}

function result(output) {
  return {results: output.rows, success: true, meta: {changes: output.changes, rows_read: output.rows.length}};
}

function syncBatch(engine, statements) {
  // No await between BEGIN and COMMIT: other requests cannot interleave.
  engine.exec('BEGIN');
  try {
    const output = statements.map(item => result(engine.query(item.sql, item.params)));
    engine.exec('COMMIT');
    return output;
  } catch (error) {
    engine.exec('ROLLBACK');
    throw error;
  }
}

async function asyncBatch(engine, statements) {
  await engine.exec('BEGIN');
  try {
    const output = [];
    for (const item of statements) output.push(result(await engine.query(item.sql, item.params)));
    await engine.exec('COMMIT');
    return output;
  } catch (error) {
    await engine.exec('ROLLBACK');
    throw error;
  }
}

export function createD1(engine) {
  let tail = Promise.resolve();
  const serial = task => {
    if (!engine.async) return Promise.resolve().then(task);
    const run = tail.then(task, task);
    tail = run.catch(() => {});
    return run;
  };
  const query = (sql, params) => serial(() => engine.query(sql, params));
  const statement = (sql, params = []) => ({
    sql,
    params,
    bind: (...values) => statement(sql, values.map(bindable)),
    async first(column) {
      const row = (await query(sql, params)).rows[0] ?? null;
      if (column === undefined) return row;
      return row && column in row ? row[column] : null;
    },
    all: async () => result(await query(sql, params)),
    run: async () => result(await query(sql, params)),
    raw: async () => (await query(sql, params)).rows.map(row => Object.values(row)),
  });
  return {
    prepare: sql => statement(sql),
    // D1 runs a batch as one transaction: every statement commits or none does.
    batch: statements => serial(() => engine.async ? asyncBatch(engine, statements) : syncBatch(engine, statements)),
    exec: sql => serial(() => engine.exec(sql)).then(() => ({count: 1})),
  };
}
