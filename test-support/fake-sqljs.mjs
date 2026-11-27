// A stand-in for the sql.js module backed by node:sqlite, implementing the part of
// the sql.js API that src/storage/sqljs.mjs uses: Database(bytes), prepare →
// bind/step/getAsObject/free, exec, getRowsModified, export, close.
// It lets the browser storage code run under `node --test` without WebAssembly.
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const folder = mkdtempSync(join(tmpdir(), 'fake-sqljs-'));
process.on('exit', () => rmSync(folder, {recursive: true, force: true}));
let files = 0;

const named = (sql, params) => /\?\d/.test(sql)
  ? [Object.fromEntries(params.map((value, index) => ['?' + (index + 1), value]))]
  : params;

class Statement {
  #db; #statement; #sql; #params = []; #rows = null; #index = -1;
  constructor(db, sql) { this.#db = db; this.#sql = sql; this.#statement = db.prepare(sql); }
  bind(values) { this.#params = [...values]; this.#rows = null; this.#index = -1; return true; }
  step() {
    if (!this.#rows) {
      const args = named(this.#sql, this.#params);
      if (this.#statement.columns().length) this.#rows = this.#statement.all(...args);
      else { this.#statement.run(...args); this.#rows = []; }
    }
    this.#index++;
    return this.#index < this.#rows.length;
  }
  getAsObject() { return {...this.#rows[this.#index]}; }
  free() { this.#statement = null; return true; }
}

export class Database {
  #db; #file;
  constructor(bytes) {
    this.#file = join(folder, 'db-' + (++files) + '.sqlite');
    if (bytes) writeFileSync(this.#file, bytes);
    this.#db = new DatabaseSync(this.#file);
  }
  prepare(sql) { return new Statement(this.#db, sql); }
  exec(sql) {
    const trimmed = sql.trim();
    if (/^select\b/i.test(trimmed) && !trimmed.slice(0, -1).includes(';')) {
      const statement = this.#db.prepare(trimmed);
      const rows = statement.all();
      if (!rows.length) return [];
      const columns = statement.columns().map(column => column.name);
      return [{columns, values: rows.map(row => columns.map(name => row[name]))}];
    }
    this.#db.exec(sql);
    return [];
  }
  getRowsModified() { return this.#db.prepare('SELECT changes() AS n').get().n; }
  export() {
    const copy = join(folder, 'export-' + (++files) + '.sqlite');
    this.#db.exec("VACUUM INTO '" + copy + "'");
    const bytes = new Uint8Array(readFileSync(copy));
    rmSync(copy, {force: true});
    return bytes;
  }
  close() { this.#db.close(); }
}

export const FakeSqlJs = {Database};
