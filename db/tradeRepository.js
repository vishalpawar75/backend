const crypto = require('crypto');
const { getPool } = require('./client');

function hashRecord(record) {
  const payload = [
    record.period,
    record.direction,
    record.hs_code,
    record.commodity,
    record.country,
    record.value_usd,
    record.quantity || '',
    record.unit || '',
    record.source || ''
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function insertTradeRecords(records) {
  if (!records.length) return 0;
  const pool = getPool();
  const values = [];
  const placeholders = records.map((record, idx) => {
    const base = idx * 10;
    const recordHash = hashRecord(record);
    values.push(
      record.id || crypto.randomUUID(),
      record.period,
      record.direction,
      record.hs_code,
      record.commodity,
      record.country,
      record.value_usd,
      record.quantity || null,
      record.unit || null,
      recordHash,
      record.source || null
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
  });

  await pool.query(
    `INSERT INTO trade_records
      (id, period, direction, hs_code, commodity, country, value_usd, quantity, unit, record_hash, source)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (record_hash) DO NOTHING`,
    values
  );
  return records.length;
}

async function getSummary() {
  const pool = getPool();
  const totals = await pool.query(
    `SELECT direction, COALESCE(SUM(value_usd), 0) AS total
     FROM trade_records GROUP BY direction`
  );
  const exportTotal = Number(totals.rows.find((row) => row.direction === 'export')?.total || 0);
  const importTotal = Number(totals.rows.find((row) => row.direction === 'import')?.total || 0);

  const topExports = await pool.query(
    `SELECT commodity, hs_code, SUM(value_usd) AS value_usd
     FROM trade_records WHERE direction = 'export'
     GROUP BY commodity, hs_code
     ORDER BY value_usd DESC LIMIT 10`
  );

  const topImports = await pool.query(
    `SELECT commodity, hs_code, SUM(value_usd) AS value_usd
     FROM trade_records WHERE direction = 'import'
     GROUP BY commodity, hs_code
     ORDER BY value_usd DESC LIMIT 10`
  );

  const topDestinations = await pool.query(
    `SELECT country, SUM(value_usd) AS value_usd
     FROM trade_records WHERE direction = 'export'
     GROUP BY country
     ORDER BY value_usd DESC LIMIT 10`
  );

  const trends = await pool.query(
    `SELECT period,
        SUM(CASE WHEN direction = 'export' THEN value_usd ELSE 0 END) AS exports_usd,
        SUM(CASE WHEN direction = 'import' THEN value_usd ELSE 0 END) AS imports_usd
     FROM trade_records
     GROUP BY period ORDER BY period`
  );

  return {
    totalExportValueUsd: exportTotal,
    totalImportValueUsd: importTotal,
    topExports: topExports.rows.map((row) => ({
      commodity: row.commodity,
      hsCode: row.hs_code,
      valueUsd: Number(row.value_usd),
      sharePct: exportTotal ? (Number(row.value_usd) / exportTotal) * 100 : 0
    })),
    topImports: topImports.rows.map((row) => ({
      commodity: row.commodity,
      hsCode: row.hs_code,
      valueUsd: Number(row.value_usd),
      sharePct: importTotal ? (Number(row.value_usd) / importTotal) * 100 : 0
    })),
    topDestinations: topDestinations.rows.map((row) => ({
      country: row.country,
      valueUsd: Number(row.value_usd)
    })),
    trends: trends.rows.map((row) => ({
      period: row.period,
      exportsUsd: Number(row.exports_usd),
      importsUsd: Number(row.imports_usd)
    }))
  };
}

async function hasTradeData() {
  const pool = getPool();
  const result = await pool.query('SELECT COUNT(*) AS count FROM trade_records');
  return Number(result.rows[0].count || 0) > 0;
}

async function getFilters() {
  const pool = getPool();
  const commodities = await pool.query('SELECT DISTINCT commodity FROM trade_records ORDER BY commodity');
  const countries = await pool.query('SELECT DISTINCT country FROM trade_records ORDER BY country');
  const periods = await pool.query('SELECT DISTINCT period FROM trade_records ORDER BY period');
  return {
    directions: ['export', 'import'],
    commodities: commodities.rows.map((row) => row.commodity),
    countries: countries.rows.map((row) => row.country),
    periods: periods.rows.map((row) => row.period)
  };
}

async function rebuildAggregates() {
  const pool = getPool();
  await pool.query('DELETE FROM aggregates_monthly');
  await pool.query(
    `INSERT INTO aggregates_monthly
      (id, period, direction, hs_code, country, value_usd, quantity, source)
     SELECT
       gen_random_uuid()::text AS id,
       period,
       direction,
       hs_code,
       country,
       SUM(value_usd) AS value_usd,
       SUM(quantity) AS quantity,
       MAX(source) AS source
     FROM trade_records
     GROUP BY period, direction, hs_code, country`
  );
}

module.exports = {
  insertTradeRecords,
  getSummary,
  hasTradeData,
  getFilters,
  rebuildAggregates
};
