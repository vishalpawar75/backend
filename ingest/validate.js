const REQUIRED_COLUMNS = [
  'period',
  'direction',
  'hs_code',
  'commodity',
  'country',
  'value_usd'
];

function normalizeRow(row) {
  return {
    period: row.period?.trim(),
    direction: row.direction?.trim().toLowerCase(),
    hs_code: row.hs_code?.trim(),
    commodity: row.commodity?.trim(),
    country: row.country?.trim(),
    value_usd: row.value_usd,
    quantity: row.quantity,
    unit: row.unit?.trim(),
    source: row.source?.trim()
  };
}

function validateRow(row, index) {
  const missing = REQUIRED_COLUMNS.filter((key) => !row[key]);
  if (missing.length) {
    return {
      ok: false,
      error: `Row ${index + 1} missing required fields: ${missing.join(', ')}`
    };
  }

  if (!['export', 'import'].includes(row.direction)) {
    return {
      ok: false,
      error: `Row ${index + 1} has invalid direction: ${row.direction}`
    };
  }

  if (Number.isNaN(Number(row.value_usd))) {
    return {
      ok: false,
      error: `Row ${index + 1} has invalid value_usd: ${row.value_usd}`
    };
  }

  return { ok: true };
}

module.exports = {
  normalizeRow,
  validateRow
};
