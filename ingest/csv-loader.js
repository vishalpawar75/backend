const fs = require('fs');
const crypto = require('crypto');

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

function loadCsvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSV(content);
  return rows.map(toTradeRecord);
}

module.exports = {
  loadCsvFile
};
