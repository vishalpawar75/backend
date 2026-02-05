const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INPUT = path.join(__dirname, '../data/tradestat_sample.csv');

function parseCSV(content) {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return headers.reduce((acc, key, idx) => {
      acc[key] = cells[idx];
      return acc;
    }, {});
  });
}

function toTradeRecord(row) {
  return {
    id: crypto.randomUUID(),
    period: row.period,
    direction: row.direction,
    hs_code: row.hs_code,
    commodity: row.commodity,
    country: row.country,
    value_usd: Number(row.value_usd || 0),
    quantity: Number(row.quantity || 0),
    unit: row.unit,
    source: row.source
  };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error('Missing input file:', INPUT);
    process.exit(1);
  }
  const content = fs.readFileSync(INPUT, 'utf8');
  const rows = parseCSV(content);
  const records = rows.map(toTradeRecord);

  const outputPath = path.join(__dirname, '../data/trade_records.json');
  fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));
  console.log('Generated', records.length, 'records at', outputPath);
}

main();
