const fs = require('fs');
const path = require('path');
const { testConnection } = require('../db/client');
const { ingestCsv } = require('./pipeline');

const INCOMING_DIR = path.join(__dirname, '../data/incoming');
const PROCESSED_DIR = path.join(__dirname, '../data/processed');

function ensureDirs() {
  if (!fs.existsSync(INCOMING_DIR)) fs.mkdirSync(INCOMING_DIR, { recursive: true });
  if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

async function ingestFile(filePath) {
  await ingestCsv(filePath);
}

async function main() {
  ensureDirs();
  const ok = await testConnection();
  if (!ok) {
    console.error('Database connection failed. Check environment variables.');
    process.exit(1);
  }

  const files = fs.readdirSync(INCOMING_DIR).filter((file) => file.endsWith('.csv'));
  if (!files.length) {
    console.log('No CSV files found in', INCOMING_DIR);
    return;
  }

  for (const file of files) {
    const filePath = path.join(INCOMING_DIR, file);
    await ingestFile(filePath);
    const processedPath = path.join(PROCESSED_DIR, file);
    fs.renameSync(filePath, processedPath);
    console.log('Processed', file, '->', processedPath);
  }
}

main().catch((err) => {
  console.error('Directory ingest failed:', err.message);
  process.exit(1);
});
