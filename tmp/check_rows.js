const Database = require('better-sqlite3');
const db = new Database('trades.db');
const rows = db.prepare("SELECT * FROM copied_fills_v2 WHERE slave_id LIKE 'delta_master_%'").all();
console.log(`Found ${rows.length} rows for delta_master`);
if (rows.length > 0) console.log(JSON.stringify(rows[0], null, 2));
db.close();
