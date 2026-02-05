const fs = require('fs');
const path = require('path');
const { getPool } = require('./client');

const schemaPath = path.join(__dirname, 'schema.sql');

async function migrate() {
  const pool = getPool();
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Migration complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
