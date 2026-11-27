// Shared in-memory game database for API tests (node:sqlite, migrated from db/migrations).
import {openNodeSqliteD1} from '../src/server/db/node-sqlite.mjs';

export const DB = await openNodeSqliteD1();
