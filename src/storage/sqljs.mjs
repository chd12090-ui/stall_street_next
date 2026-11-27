// sql.js (SQLite compiled to WebAssembly) for the browser.
//
// `npm install` copies node_modules/sql.js/dist/sql-wasm.{js,wasm} into
// public/vendor/sql.js (scripts/copy-sqljs.mjs). Loading it as a plain script
// keeps the WebAssembly loader out of the Next.js bundle, so neither webpack nor
// Turbopack has to understand its Node.js fallbacks.

export const sqlJsBase = '/vendor/sql.js/';
let loading;

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('Could not load ' + src + '. Run `npm install` so public/vendor/sql.js is copied.'));
    };
    document.head.append(script);
  });
}

export function loadSqlJs(base = sqlJsBase) {
  loading ??= (async () => {
    if (typeof globalThis.initSqlJs !== 'function') await injectScript(base + 'sql-wasm.js');
    if (typeof globalThis.initSqlJs !== 'function') throw new Error('sql.js did not register initSqlJs.');
    return globalThis.initSqlJs({locateFile: file => base + file});
  })().catch(error => {
    loading = undefined;
    throw error;
  });
  return loading;
}

// Wraps a sql.js Database in the engine shape used by src/server/db/d1-adapter.mjs.
export function sqlJsEngine(SQL, bytes) {
  const db = bytes?.byteLength ? new SQL.Database(bytes) : new SQL.Database();
  let dirty = false;
  const totalChanges = () => db.exec('SELECT total_changes() AS n')[0].values[0][0];
  return {
    query(sql, params = []) {
      const before = totalChanges();
      const statement = db.prepare(sql);
      const rows = [];
      try {
        if (params.length) statement.bind(params);
        while (statement.step()) rows.push(statement.getAsObject());
      } finally {
        statement.free();
      }
      const changed = totalChanges() !== before;
      if (changed) dirty = true;
      return {rows, changes: changed ? db.getRowsModified() : 0};
    },
    exec(sql) {
      const before = totalChanges();
      db.exec(sql);
      if (totalChanges() !== before) dirty = true;
    },
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
    clearDirty() { dirty = false; },
    export: () => db.export(),
    close: () => db.close(),
  };
}
