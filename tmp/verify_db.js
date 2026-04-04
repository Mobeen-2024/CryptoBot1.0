import Database from 'better-sqlite3';
const db = new Database('trades.db');

try {
  console.log('--- SHADOW BALANCES ---');
  const balances = db.prepare('SELECT * FROM shadow_balances').all();
  console.table(balances);

  console.log('--- LATEST SHADOW TRADES ---');
  const trades = db.prepare('SELECT * FROM copied_fills_v2 ORDER BY timestamp DESC LIMIT 10').all();
  console.table(trades.map(t => ({
    acc: t.slave_id,
    sym: t.symbol,
    side: t.side,
    qty: t.quantity,
    price: t.price
  })));
} catch (err) {
  console.error('Error querying DB:', err.message);
} finally {
  db.close();
}
