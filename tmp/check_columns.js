import Database from 'better-sqlite3';
const db = new Database('trades.db');
const columns = db.prepare('PRAGMA table_info(copied_fills_v2)').all();
console.log(JSON.stringify(columns, null, 2));
db.close();
