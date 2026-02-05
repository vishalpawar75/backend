const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE
    });
  }
  return pool;
}

async function testConnection() {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    console.warn('Database connection failed:', err.message);
    return false;
  }
}

module.exports = {
  getPool,
  testConnection
};
