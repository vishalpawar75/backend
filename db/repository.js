const crypto = require('crypto');
const { getPool } = require('./client');

async function createInquiry(payload) {
  const pool = getPool();
  const id = crypto.randomUUID();
  const result = await pool.query(
    `INSERT INTO partner_inquiries
      (id, name, email, company, interest, message, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      payload.name,
      payload.email,
      payload.company,
      payload.interest || null,
      payload.message || null,
      payload.status || 'new'
    ]
  );
  return result.rows[0];
}

async function listInquiries() {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM partner_inquiries ORDER BY created_at DESC');
  return result.rows;
}

async function updateInquiryStatus(id, status) {
  const pool = getPool();
  const result = await pool.query(
    'UPDATE partner_inquiries SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return result.rows[0];
}

module.exports = {
  createInquiry,
  listInquiries,
  updateInquiryStatus
};
