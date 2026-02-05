const fs = require('fs');
const path = require('path');
const { testConnection } = require('../db/client');
const { ingestCsv } = require('./pipeline');

async function main() {
  const input = process.env.CSV_PATH || path.join(__dirname, '../data/tradestat_sample.csv');
  if (!fs.existsSync(input)) {
    console.error('Missing CSV file:', input);
    process.exit(1);
  }

  const ok = await testConnection();
  if (!ok) {
    console.error('Database connection failed. Check environment variables.');
    process.exit(1);
  }

  const inserted = await ingestCsv(input);
  console.log('Inserted', inserted, 'records from', input);
}

main().catch((err) => {
  console.error('CSV ingest failed:', err.message);
  process.exit(1);
});
