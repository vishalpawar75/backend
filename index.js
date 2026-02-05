const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { testConnection } = require('./db/client');
require('./ingest/scheduler');
const { createInquiry, listInquiries, updateInquiryStatus } = require('./db/repository');
const { getSummary, hasTradeData, getFilters } = require('./db/tradeRepository');

const app = express();
const PORT = process.env.PORT || 3000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

const USERS = [
  {
    id: 'vakratund-partner',
    name: 'Vakratund Partner',
    email: 'partner@vakratund.in',
    password: 'Partner@2026',
    role: 'partner'
  },
  {
    id: 'vakratund-admin',
    name: 'Vakratund Admin',
    email: 'admin@vakratund.in',
    password: 'Admin@2026',
    role: 'admin'
  }
];

const sessions = new Map();
const inquiries = [];
let dbReady = false;

const companyProfile = {
  name: 'Vakratund Hybrid Seeds Private Limited',
  type: 'Farmer Producer Company (FPC)',
  focus: 'Seed production and supply for vegetable and field crops',
  mission:
    'Enable agribusinesses to identify our production capabilities, geographic presence, and crop expertise to build long-term seed production partnerships.',
  strengths: [
    'Reliable farmer network with organized production processes',
    'Quality-driven execution with traceability focus',
    'Multi-crop expertise across vegetables and field crops',
    'Flexible production planning and seasonal scheduling'
  ],
  locations: [
    'Western Maharashtra',
    'Vidarbha',
    'Northern Karnataka',
    'Central India clusters'
  ],
  crops: [
    'Okra',
    'Tomato',
    'Chilli',
    'Cucumber',
    'Bitter gourd',
    'Pumpkin',
    'Cotton',
    'Sorghum'
  ],
  certifications: ['Internal QA protocols', 'Field-level supervision', 'Germination testing'],
  contact: {
    email: 'partnerships@vakratund.in',
    phone: '+91-XXXXXXXXXX',
    address: 'Pune, Maharashtra, India'
  }
};

const analyticsDataset = {
  status: 'Demo dataset. Replace with official sources such as TradeStat, APEDA, or DGCI&S.',
  updatedAt: new Date().toISOString(),
  summary: {
    totalExportValueUsd: 2980000000,
    totalImportValueUsd: 1040000000,
    topExportCategory: 'Spices and seed crops',
    topImportCategory: 'Oilseeds and feedstock',
    coverage: 'India agriculture-related HS codes (demo scope)'
  },
  topExports: [
    { commodity: 'Spices (mixed)', hsCode: '0904', valueUsd: 620000000, sharePct: 20.8 },
    { commodity: 'Seed vegetables', hsCode: '1209', valueUsd: 410000000, sharePct: 13.8 },
    { commodity: 'Basmati rice', hsCode: '1006', valueUsd: 370000000, sharePct: 12.4 },
    { commodity: 'Cotton (raw)', hsCode: '5201', valueUsd: 295000000, sharePct: 9.9 },
    { commodity: 'Oilcakes', hsCode: '2306', valueUsd: 210000000, sharePct: 7.1 }
  ],
  topImports: [
    { commodity: 'Crude palm oil', hsCode: '1511', valueUsd: 320000000, sharePct: 30.7 },
    { commodity: 'Soybean (feedstock)', hsCode: '1201', valueUsd: 210000000, sharePct: 20.2 },
    { commodity: 'Sunflower oil', hsCode: '1512', valueUsd: 160000000, sharePct: 15.4 },
    { commodity: 'Pulses (lentils)', hsCode: '0713', valueUsd: 120000000, sharePct: 11.5 },
    { commodity: 'Feed supplements', hsCode: '2309', valueUsd: 98000000, sharePct: 9.4 }
  ],
  topDestinations: [
    { country: 'UAE', valueUsd: 520000000 },
    { country: 'Bangladesh', valueUsd: 430000000 },
    { country: 'Vietnam', valueUsd: 320000000 },
    { country: 'Saudi Arabia', valueUsd: 260000000 },
    { country: 'Indonesia', valueUsd: 240000000 }
  ],
  trends: [
    { period: '2024-Q1', exportsUsd: 710000000, importsUsd: 280000000 },
    { period: '2024-Q2', exportsUsd: 740000000, importsUsd: 265000000 },
    { period: '2024-Q3', exportsUsd: 760000000, importsUsd: 250000000 },
    { period: '2024-Q4', exportsUsd: 770000000, importsUsd: 245000000 }
  ]
};

function issueToken(user) {
  const token = crypto.randomUUID();
  sessions.set(token, { id: user.id, name: user.name, role: user.role, email: user.email });
  return token;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = sessions.get(token);
  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/public/company', (req, res) => {
  res.json(companyProfile);
});

app.post('/api/public/inquiry', (req, res) => {
  const { name, email, company, interest, message } = req.body || {};
  if (!name || !email || !company) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const payload = { name, email, company, interest, message, status: 'new' };
  if (dbReady) {
    createInquiry(payload)
      .then(() => res.json({ ok: true, message: 'Inquiry received. We will reach out shortly.' }))
      .catch(() => res.status(500).json({ error: 'Failed to save inquiry.' }));
    return;
  }

  const fallback = {
    id: crypto.randomUUID(),
    ...payload,
    createdAt: new Date().toISOString()
  };
  inquiries.push(fallback);
  console.log('New inquiry:', fallback);
  return res.json({ ok: true, message: 'Inquiry received. We will reach out shortly.' });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = USERS.find((u) => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = issueToken(user);
  return res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
});

app.get('/api/analytics/summary', requireAuth, async (req, res) => {
  if (dbReady && (await hasTradeData())) {
    const summary = await getSummary();
    return res.json({
      updatedAt: new Date().toISOString(),
      summary: {
        totalExportValueUsd: summary.totalExportValueUsd,
        totalImportValueUsd: summary.totalImportValueUsd,
        topExportCategory: summary.topExports[0]?.commodity || '—',
        topImportCategory: summary.topImports[0]?.commodity || '—',
        coverage: 'India agriculture-related HS codes'
      },
      topExports: summary.topExports,
      topImports: summary.topImports,
      topDestinations: summary.topDestinations,
      trends: summary.trends,
      status: 'Trade data sourced from official datasets (loaded into DB).',
      requestedBy: req.user.email
    });
  }

  if (process.env.ALLOW_DEMO_FALLBACK === 'true') {
    return res.json({ ...analyticsDataset, requestedBy: req.user.email });
  }

  return res.status(503).json({ error: 'Analytics unavailable. No data loaded.' });
});

app.get('/api/analytics/filters', requireAuth, async (req, res) => {
  if (dbReady && (await hasTradeData())) {
    const filters = await getFilters();
    return res.json(filters);
  }
  const commodities = [...new Set(analyticsDataset.topExports.map((item) => item.commodity))];
  const countries = analyticsDataset.topDestinations.map((item) => item.country);
  return res.json({
    directions: ['export', 'import'],
    commodities,
    countries,
    periods: analyticsDataset.trends.map((trend) => trend.period)
  });
});

app.get('/api/admin/inquiries', requireAuth, requireRole('admin'), async (req, res) => {
  if (dbReady) {
    const rows = await listInquiries();
    return res.json({ inquiries: rows });
  }
  return res.json({ inquiries });
});

app.patch('/api/admin/inquiries/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const status = req.body?.status;
  if (!status) return res.status(400).json({ error: 'Missing status' });

  if (dbReady) {
    const updated = await updateInquiryStatus(id, status);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true, inquiry: updated });
  }

  const inquiry = inquiries.find((item) => item.id === id);
  if (!inquiry) return res.status(404).json({ error: 'Not found' });
  inquiry.status = status;
  return res.json({ ok: true, inquiry });
});

testConnection().then((ready) => {
  dbReady = ready;
  if (dbReady) {
    console.log('Database connected. Using persistent storage.');
  } else {
    console.warn('Database not connected. Using in-memory fallback.');
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
});
