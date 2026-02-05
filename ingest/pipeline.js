const { loadCsvFile } = require('./csv-loader');
const { normalizeRow, validateRow } = require('./validate');
const { insertTradeRecords, rebuildAggregates } = require('../db/tradeRepository');

async function ingestCsv(filePath) {
  const rawRecords = loadCsvFile(filePath);
  const normalized = [];
  const errors = [];

  rawRecords.forEach((record, idx) => {
    const norm = normalizeRow(record);
    const validation = validateRow(norm, idx);
    if (!validation.ok) {
      errors.push(validation.error);
      return;
    }
    normalized.push(norm);
  });

  if (errors.length) {
    const error = new Error('Validation failed');
    error.details = errors;
    throw error;
  }

  const inserted = await insertTradeRecords(normalized);
  await rebuildAggregates();
  return inserted;
}

module.exports = {
  ingestCsv
};
