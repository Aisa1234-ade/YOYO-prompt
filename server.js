const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'yoyo-prompt.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

const aiTools = [
  { value: 'Google Flow', label: 'Google Flow', icon: '✦' },
  { value: 'Grok', label: 'Grok', icon: '⌁' },
  { value: 'CapCut', label: 'CapCut', icon: '◈' },
  { value: 'Muse AI', label: 'Muse AI', icon: '✧' }
];

const categories = [
  'AI Video Prompts',
  'AI Image Prompts',
  'Cinematic AI Movies',
  'AI Storytelling',
  'Product Advertisements',
  'AI Influencer Content',
  'Character Creation',
  'Image-to-Video Prompts',
  'Social Media Content',
  'Tutorials and Guides'
];

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) throw err;
  console.log('SQLite ready at', DB_PATH);
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

const runStmt = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ id: this.lastID, changes: this.changes });
  });
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'yoyo-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 }
}));

const adminLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15 });
const reviewLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/quicktime'
    ];
    if (mime.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Unsupported upload type'));
  }
});

function normalizeSlug(value) {
  return slugify(String(value || '').trim().toLowerCase(), { lower: true, strict: true, trim: true });
}

function isAdmin(req) {
  return Boolean(req.session && req.session.isAdmin);
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.redirect('/admin/login');
  next();
}

async function initDb() {
  await runStmt(`CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    ai_tool TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL,
    short_explanation TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    how_to_use TEXT NOT NULL,
    additional_info TEXT,
    media_url TEXT,
    cover_image TEXT,
    media_file TEXT,
    featured INTEGER DEFAULT 0,
    visible INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`);

  await runStmt(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    name TEXT,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
  );`);

  await runStmt(`CREATE TABLE IF NOT EXISTS slug_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id INTEGER NOT NULL,
    old_slug TEXT NOT NULL,
    new_slug TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
  );`);
}

async function seedPrompts() {
  const existing = await run('SELECT COUNT(*) AS count FROM prompts');
  if (Number(existing[0]?.count || 0) > 0) return;

  const sample = [
    {
      title: 'Cinematic Luxury Car Reveal',
      slug: 'cinematic-luxury-car',
      ai_tool: 'Google Flow',
      category: 'Cinematic AI Movies',
      type: 'video',
      short_explanation: 'A premium luxury car reveal with cinematic motion and high-end product framing.',
      prompt_text: 'Create a cinematic luxury car reveal with a dark studio backdrop, soft golden rim lights, reflective surfaces, dramatic camera tracking, slow-motion close-ups, atmospheric smoke, premium motion graphics, ultra-photorealistic reflections, elegant product marketing style, 4k detail, luxury commercial mood.',
      how_to_use: '1. Open Google Flow.\n2. Paste the prompt.\n3. Choose a cinematic 16:9 format.\n4. Use slow camera movement and add subtle smoke.\n5. Export in 4k for a premium result.',
      additional_info: 'Best for automotive brand campaigns and luxury product ads.',
      media_url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
      cover_image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
      featured: 1,
      visible: 1
    },
    {
      title: 'Dreamy Neon Portrait',
      slug: 'dreamy-neon-portrait',
      ai_tool: 'Muse AI',
      category: 'AI Image Prompts',
      type: 'image',
      short_explanation: 'A luminous portrait with layered neon gradients and a dreamy editorial finish.',
      prompt_text: 'Create a dreamy portrait of a young creative woman with cyan and violet neon glow, soft volumetric lighting, editorial beauty styling, clean skin texture, glassmorphism background, cinematic color grading, realistic features, high detail, 85mm lens, polished digital art, premium fashion mood.',
      how_to_use: '1. Open Muse AI.\n2. Paste the prompt.\n3. Use portrait mode with high detail.\n4. Generate several variants.\n5. Upscale the top result.',
      additional_info: 'Ideal for avatars, cover art, or portfolio visuals.',
      media_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
      cover_image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
      featured: 1,
      visible: 1
    },
    {
      title: 'AI Influencer Promo Reel',
      slug: 'ai-influencer-promo-reel',
      ai_tool: 'CapCut',
      category: 'AI Influencer Content',
      type: 'video',
      short_explanation: 'A fast, stylish social promo ready for short-form creator marketing.',
      prompt_text: 'Create a 20-second influencer product promo with fast cuts, elevated lifestyle styling, dramatic close-ups, vibrant color palette, trendy captions, smooth transitions, polished social media pacing, product highlight shots, upbeat music energy, vertical 9:16 format, highly shareable creator content.',
      how_to_use: '1. Start in CapCut.\n2. Generate the scenes with this prompt.\n3. Build a 3-part structure: hook, demo, CTA.\n4. Add bold text overlays.\n5. Export as a vertical reel.',
      additional_info: 'Works well for product launches and creator ads.',
      media_url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
      cover_image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
      featured: 1,
      visible: 1
    },
    {
      title: 'Storybook Adventure Scene',
      slug: 'storybook-adventure-scene',
      ai_tool: 'Grok',
      category: 'AI Storytelling',
      type: 'image',
      short_explanation: 'Fantasy world-building art for a magical story moment or concept cover.',
      prompt_text: 'Illustrated storybook scene of a young explorer stepping into an enchanted forest, floating lanterns, misty mountains, whimsical details, magical realism, rich fantasy color palette, cinematic depth, polished illustration style, immersive world-building, warm light, highly detailed background.',
      how_to_use: '1. Open Grok.\n2. Paste the prompt.\n3. Ask for a single magical frame.\n4. Generate a few versions.\n5. Use the strongest one as a concept image.',
      additional_info: 'Helpful for fantasy brands and visual storytelling projects.',
      media_url: 'https://images.unsplash.com/photo-1517486800573-8c7d5a3a6894?auto=format&fit=crop&w=1200&q=80',
      cover_image: 'https://images.unsplash.com/photo-1517486800573-8c7d5a3a6894?auto=format&fit=crop&w=1200&q=80',
      featured: 0,
      visible: 1
    }
  ];

  for (const item of sample) {
    await runStmt(`INSERT INTO prompts (title, slug, ai_tool, category, type, short_explanation, prompt_text, how_to_use, additional_info, media_url, cover_image, featured, visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      item.title,
      item.slug,
      item.ai_tool,
      item.category,
      item.type,
      item.short_explanation,
      item.prompt_text,
      item.how_to_use,
      item.additional_info,
      item.media_url,
      item.cover_image,
      item.featured,
      item.visible
    ]);
  }
}

async function getPromptBySlug(slug) {
  const rows = await run('SELECT * FROM prompts WHERE slug = ? LIMIT 1', [slug]);
  return rows[0] || null;
}

async function getPromptById(id) {
  const rows = await run('SELECT * FROM prompts WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function getLibraryPrompts({ search = '', tool = '', category = '', type = '' } = {}) {
  let sql = 'SELECT * FROM prompts WHERE visible = 1';
  const params = [];

  if (search) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(short_explanation) LIKE ? OR LOWER(prompt_text) LIKE ?)';
    const term = `%${search.toLowerCase()}%`;
    params.push(term, term, term);
  }
  if (tool) sql += ' AND ai_tool = ?';
  if (category) sql += ' AND category = ?';
  if (type) sql += ' AND type = ?';

  if (tool) params.push(tool);
  if (category) params.push(category);
  if (type) params.push(type);

  sql += ' ORDER BY created_at DESC';
  return run(sql, params);
}

async function getPromptReviews(promptId) {
  return run('SELECT * FROM reviews WHERE prompt_id = ? ORDER BY created_at DESC', [promptId]);
}

async function verifyAdminPassword(password) {
  const hash = process.env.ADMIN_PASSWORD_HASH || await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin1234', 10);
  return bcrypt.compare(password, hash);
}

function getPublicUrl(req, slug) {
  return `${req.protocol}://${req.get('host')}/p/${slug}`;
}

app.locals.aiTools = aiTools;
app.locals.categories = categories;
app.locals.siteName = 'YOYO PROMPT';

app.get('/', async (req, res) => {
  const featured = await run('SELECT * FROM prompts WHERE visible = 1 AND featured = 1 ORDER BY created_at DESC LIMIT 4');
  const latest = await run('SELECT * FROM prompts WHERE visible = 1 ORDER BY created_at DESC LIMIT 6');
  const videoPrompts = await run('SELECT * FROM prompts WHERE visible = 1 AND type = ? ORDER BY created_at DESC LIMIT 3', ['video']);
  const imagePrompts = await run('SELECT * FROM prompts WHERE visible = 1 AND type = ? ORDER BY created_at DESC LIMIT 3', ['image']);
  res.render('index', { featured, latest, videoPrompts, imagePrompts, pageTitle: 'YOYO PROMPT | Free AI Prompt Library' });
});

app.get('/library', async (req, res) => {
  const search = String(req.query.search || '');
  const tool = String(req.query.tool || '');
  const category = String(req.query.category || '');
  const type = String(req.query.type || '');
  const prompts = await getLibraryPrompts({ search, tool, category, type });
  res.render('library', { prompts, search, tool, category, type, pageTitle: 'Prompt Library | YOYO PROMPT' });
});

app.get('/p/:slug', async (req, res) => {
  const prompt = await getPromptBySlug(req.params.slug);
  if (!prompt) {
    const redirected = await run('SELECT * FROM slug_history WHERE old_slug = ? ORDER BY created_at DESC LIMIT 1', [req.params.slug]);
    if (redirected[0]) {
      return res.redirect(301, `/p/${redirected[0].new_slug}`);
    }
    return res.status(404).render('error', { message: 'Prompt not found.' });
  }

  if (!prompt.visible) return res.status(404).render('error', { message: 'This prompt is hidden.' });

  const reviews = await getPromptReviews(prompt.id);
  const related = await run('SELECT * FROM prompts WHERE visible = 1 AND category = ? AND id != ? ORDER BY created_at DESC LIMIT 3', [prompt.category, prompt.id]);
  const average = reviews.length ? (reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length).toFixed(1) : 'No reviews yet';

  res.render('prompt', {
    prompt,
    reviews,
    related,
    average,
    currentUrl: getPublicUrl(req, prompt.slug),
    pageTitle: `${prompt.title} | YOYO PROMPT`
  });
});

app.post('/p/:slug/review', reviewLimiter, async (req, res) => {
  const prompt = await getPromptBySlug(req.params.slug);
  if (!prompt) return res.status(404).json({ message: 'Prompt not found.' });

  const rating = Number(req.body.rating || 5);
  const comment = String(req.body.comment || '').trim();
  const name = String(req.body.name || '').trim();

  if (!comment || rating < 1 || rating > 5) {
    return res.redirect(`/p/${prompt.slug}#reviews`);
  }

  await runStmt('INSERT INTO reviews (prompt_id, name, rating, comment) VALUES (?, ?, ?, ?)', [prompt.id, name || 'Anonymous', rating, comment]);
  res.redirect(`/p/${prompt.slug}#reviews`);
});

app.get('/admin/login', (req, res) => {
  if (isAdmin(req)) return res.redirect('/admin/dashboard');
  res.render('admin-login', { pageTitle: 'Admin Login | YOYO PROMPT' });
});

app.post('/admin/login', adminLoginLimiter, async (req, res) => {
  const ok = await verifyAdminPassword(String(req.body.password || ''));
  if (!ok) return res.status(401).render('admin-login', { pageTitle: 'Admin Login | YOYO PROMPT', authError: 'Wrong password.' });

  req.session.isAdmin = true;
  res.redirect('/admin/dashboard');
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  const prompts = await run('SELECT * FROM prompts ORDER BY created_at DESC');
  const reviews = await run(`SELECT r.*, p.title AS prompt_title FROM reviews r JOIN prompts p ON p.id = r.prompt_id ORDER BY r.created_at DESC`);
  res.render('admin-dashboard', { prompts, reviews, pageTitle: 'Dashboard | YOYO PROMPT' });
});

app.get('/admin/prompts/new', requireAdmin, (req, res) => {
  res.render('admin-prompt-form', { prompt: null, pageTitle: 'New Prompt | YOYO PROMPT', aiTools, categories });
});

app.get('/admin/prompts/:id/edit', requireAdmin, async (req, res) => {
  const prompt = await getPromptById(req.params.id);
  if (!prompt) return res.status(404).render('error', { message: 'Prompt not found.' });
  res.render('admin-prompt-form', { prompt, pageTitle: 'Edit Prompt | YOYO PROMPT', aiTools, categories });
});

app.post('/admin/prompts', requireAdmin, upload.fields([{ name: 'mediaFile', maxCount: 1 }, { name: 'coverFile', maxCount: 1 }]), async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const aiTool = String(req.body.ai_tool || 'Google Flow');
    const category = String(req.body.category || '').trim();
    const type = req.body.type === 'video' ? 'video' : 'image';
    const slug = normalizeSlug(req.body.slug || title);
    const shortExplanation = String(req.body.short_explanation || '').trim();
    const promptText = String(req.body.prompt_text || '').trim();
    const howToUse = String(req.body.how_to_use || '').trim();
    const additionalInfo = String(req.body.additional_info || '').trim();
    const mediaUrl = String(req.body.media_url || '').trim();
    const featured = req.body.featured === 'on' ? 1 : 0;
    const visible = req.body.visible === 'on' ? 1 : 1;

    const mediaFile = req.files?.mediaFile?.[0];
    const coverFile = req.files?.coverFile?.[0];

    const finalMedia = mediaFile ? `/uploads/${mediaFile.filename}` : mediaUrl;
    const finalCover = coverFile ? `/uploads/${coverFile.filename}` : finalMedia || '/images/og-default.jpg';

    await runStmt(`INSERT INTO prompts (title, slug, ai_tool, category, type, short_explanation, prompt_text, how_to_use, additional_info, media_url, cover_image, media_file, featured, visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      title, slug, aiTool, category, type, shortExplanation, promptText, howToUse, additionalInfo, finalMedia, finalCover, mediaFile ? `/uploads/${mediaFile.filename}` : null, featured, visible
    ]);

    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Unable to create prompt.' });
  }
});

app.post('/admin/prompts/:id', requireAdmin, upload.fields([{ name: 'mediaFile', maxCount: 1 }, { name: 'coverFile', maxCount: 1 }]), async (req, res) => {
  try {
    const prompt = await getPromptById(req.params.id);
    if (!prompt) return res.status(404).render('error', { message: 'Prompt not found.' });

    const title = String(req.body.title || '').trim();
    const aiTool = String(req.body.ai_tool || 'Google Flow');
    const category = String(req.body.category || '').trim();
    const type = req.body.type === 'video' ? 'video' : 'image';
    const slug = normalizeSlug(req.body.slug || title);
    const shortExplanation = String(req.body.short_explanation || '').trim();
    const promptText = String(req.body.prompt_text || '').trim();
    const howToUse = String(req.body.how_to_use || '').trim();
    const additionalInfo = String(req.body.additional_info || '').trim();
    const mediaUrl = String(req.body.media_url || '').trim();
    const featured = req.body.featured === 'on' ? 1 : 0;
    const visible = req.body.visible === 'on' ? 1 : 1;

    const mediaFile = req.files?.mediaFile?.[0];
    const coverFile = req.files?.coverFile?.[0];
    const finalMedia = mediaFile ? `/uploads/${mediaFile.filename}` : (mediaUrl || prompt.media_url);
    const finalCover = coverFile ? `/uploads/${coverFile.filename}` : (prompt.cover_image || finalMedia || '/images/og-default.jpg');

    if (slug !== prompt.slug) {
      await runStmt('INSERT INTO slug_history (prompt_id, old_slug, new_slug) VALUES (?, ?, ?)', [prompt.id, prompt.slug, slug]);
    }

    await runStmt(`UPDATE prompts SET title = ?, slug = ?, ai_tool = ?, category = ?, type = ?, short_explanation = ?, prompt_text = ?, how_to_use = ?, additional_info = ?, media_url = ?, cover_image = ?, media_file = ?, featured = ?, visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [
      title, slug, aiTool, category, type, shortExplanation, promptText, howToUse, additionalInfo, finalMedia, finalCover, mediaFile ? `/uploads/${mediaFile.filename}` : prompt.media_file, featured, visible, prompt.id
    ]);

    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Unable to update prompt.' });
  }
});

app.post('/admin/prompts/:id/delete', requireAdmin, async (req, res) => {
  await runStmt('DELETE FROM prompts WHERE id = ?', [req.params.id]);
  res.redirect('/admin/dashboard');
});

app.post('/admin/reviews/:id/delete', requireAdmin, async (req, res) => {
  await runStmt('DELETE FROM reviews WHERE id = ?', [req.params.id]);
  res.redirect('/admin/dashboard');
});

app.use((req, res) => res.status(404).render('error', { message: 'Page not found.' }));

(async () => {
  await initDb();
  await seedPrompts();
  app.listen(PORT, () => console.log(`YOYO PROMPT running on http://localhost:${PORT}`));
})();
