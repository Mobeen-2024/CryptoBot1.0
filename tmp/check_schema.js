import Database from 'better-sqlite3';
const db = new Database('trades.db');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='copied_fills_v2'").get();
console.log(schema.sql);
db.close();
