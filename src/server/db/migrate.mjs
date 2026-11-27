import {migrations} from './migrations.generated.mjs';

// Applies db/migrations/*.sql (bundled into migrations.generated.mjs) once each.
// Returns true when the schema changed, so callers know the database must be saved.
export async function migrate(engine) {
  await engine.exec(`CREATE TABLE IF NOT EXISTS _stall_migrations (
    name TEXT PRIMARY KEY NOT NULL,
    applied_at INTEGER NOT NULL
  )`);
  const applied = new Set((await engine.query('SELECT name FROM _stall_migrations', [])).rows.map(row => row.name));
  let changed = false;
  for (const {name, sql} of migrations) {
    if (applied.has(name)) continue;
    await engine.exec('BEGIN');
    try {
      await engine.exec(sql);
      await engine.query('INSERT INTO _stall_migrations(name, applied_at) VALUES (?, ?)', [name, Date.now()]);
      await engine.exec('COMMIT');
    } catch (error) {
      await engine.exec('ROLLBACK');
      throw Object.assign(new Error('Migration ' + name + ' failed: ' + error.message), {cause: error});
    }
    changed = true;
  }
  return changed;
}
