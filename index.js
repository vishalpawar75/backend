const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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

const cropsPath = path.join(__dirname, 'data', 'crops.json');
const cropsData = fs.existsSync(cropsPath) ? JSON.parse(fs.readFileSync(cropsPath, 'utf8')) : { categories: [] };

function localizeCrop(crop, lang) {
  const translation = crop.translations?.[lang] || {};
  return {
    ...crop,
    name: translation.name || crop.name,
    description: translation.description || crop.description,
    season: translation.season || crop.season,
    soil: translation.soil || crop.soil,
    spacing: translation.spacing || crop.spacing,
    seedRate: translation.seedRate || crop.seedRate,
    irrigation: translation.irrigation || crop.irrigation,
    fertilizer: translation.fertilizer || crop.fertilizer
  };
}

function localizeCategory(category, lang) {
  return {
    ...category,
    name: category.translations?.[lang] || category.name,
    crops: category.crops.map((crop) => localizeCrop(crop, lang))
  };
}

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

app.get('/api/public/crops', (req, res) => {
  const lang = (req.query.lang || 'en').toString();
  const query = (req.query.q || '').toString().toLowerCase();
  const categories = cropsData.categories.map((category) => localizeCategory(category, lang));
  if (!query) return res.json({ language: lang, categories });

  const filtered = categories
    .map((category) => ({
      ...category,
      crops: category.crops.filter((crop) => crop.name.toLowerCase().includes(query))
    }))
    .filter((category) => category.crops.length > 0);
  return res.json({ language: lang, categories: filtered });
});

app.get('/api/public/crops/:id', (req, res) => {
  const lang = (req.query.lang || 'en').toString();
  const cropId = req.params.id;
  for (const category of cropsData.categories) {
    const crop = category.crops.find((item) => item.id === cropId);
    if (crop) {
      return res.json({ ...localizeCrop(crop, lang), category: category.id });
    }
  }
  return res.status(404).json({ error: 'Crop not found' });
});

app.post('/api/public/diagnose', async (req, res) => {
  const { imageData, language } = req.body || {};
  if (!imageData || typeof imageData !== 'string') {
    return res.status(400).json({ error: 'Missing image data' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  const match = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Invalid image data' });
  }
  const mimeType = match[1];
  const base64Data = match[2];

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await require('axios').post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'You are an agricultural assistant. Analyze the plant/leaf image and suggest likely issues. ' +
                  'Do NOT recommend or prescribe pesticides/chemicals. Provide safe, non-chemical first actions ' +
                  'and advise consulting local agronomists for chemical guidance. ' +
                  `Please respond in ${language || 'English'}. ` +
                  'Return JSON ONLY with fields: issue, confidence (low/medium/high), category, ' +
                  'symptoms (array of strings), safe_actions (array of strings), escalation_note (string). ' +
                  'Do not include any extra text or markdown.'
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ') || '';
    const jsonBlob = text.match(/\{[\s\S]*\}/)?.[0] || '';
    let parsed;
    try {
      parsed = JSON.parse(jsonBlob || text);
    } catch {
      parsed = { issue: text, confidence: 'low', category: 'unknown', symptoms: [], safe_actions: [], escalation_note: '' };
    }

    if (typeof parsed.confidence === 'number') {
      if (parsed.confidence >= 4) parsed.confidence = 'high';
      else if (parsed.confidence >= 2) parsed.confidence = 'medium';
      else parsed.confidence = 'low';
    }
    return res.json(parsed);
  } catch (err) {
    const message = err?.response?.data?.error?.message || err.message || 'Diagnosis failed';
    return res.status(500).json({ error: message });
  }
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
