require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';
const isProduction = process.env.NODE_ENV === 'production';
const SESSION_SECURE_COOKIE = process.env.SESSION_SECURE === 'true';

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_GALLERY_DIR = path.join(__dirname, 'Photos');
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const ENV_FILE = path.join(__dirname, '.env');

const ensureStorage = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  if (!fs.existsSync(GALLERY_FILE)) {
    fs.writeFileSync(GALLERY_FILE, JSON.stringify({ images: [] }, null, 2));
  }

  if (!fs.existsSync(ADMIN_FILE)) {
    const defaultUsername = process.env.ADMIN_USERNAME || 'eddy';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'EddyJardin2026!';
    const passwordHash = bcrypt.hashSync(defaultPassword, 10);
    fs.writeFileSync(ADMIN_FILE, JSON.stringify({ username: defaultUsername, passwordHash }, null, 2));
  }
};

const syncLegacyGalleryAssets = () => {
  if (!fs.existsSync(PUBLIC_GALLERY_DIR)) return;

  const publicFiles = [
    'Allée_pierres_souches_troncs_arbres.jpeg',
    'Terrasse_en_bois.jpeg',
    'Tonte_terrain.jpeg',
    'Allée_de_parc_entretenue.jpeg',
    'Terrasse_en_bois_vue_opposée.jpeg',
    'Multiphotos_tontes.jpeg',
    'Allée_bois.jpeg',
    'Allée_souches_arbres.jpeg',
    'Multiphotos_fabrication_escalier_béton.jpeg',
    'Contour_piscine_bois.jpeg'
  ];

  publicFiles.forEach((fileName) => {
    const source = path.join(PUBLIC_GALLERY_DIR, fileName);
    const target = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(source) && !fs.existsSync(target)) {
      fs.copyFileSync(source, target);
    }
  });
};

ensureStorage();
syncLegacyGalleryAssets();

const defaultGallery = [
  { id: 'default-1', src: './Photos/Allée_pierres_souches_troncs_arbres.jpeg', alt: 'Allée aménagée en pierres et souches d arbres naturelles', title: 'Allée en pierres et souches', isDefault: true },
  { id: 'default-2', src: './Photos/Terrasse_en_bois.jpeg', alt: 'Terrasse en bois avec mur en pierres naturelles', title: 'Terrasse en bois', isDefault: true },
  { id: 'default-3', src: './Photos/Tonte_terrain.jpeg', alt: 'Terrain fraîchement tondu avec tondeuse professionnelle', title: 'Tonte de terrain', isDefault: true },
  { id: 'default-4', src: './Photos/Allée_de_parc_entretenue.jpeg', alt: 'Allée de parc public parfaitement entretenue et désherbée', title: 'Allée de parc entretenue', isDefault: true },
  { id: 'default-5', src: './Photos/Terrasse_en_bois_vue_opposée.jpeg', alt: 'Vue alternative de la terrasse en bois avec mur en pierres', title: 'Terrasse en bois - vue 2', isDefault: true },
  { id: 'default-6', src: './Photos/Multiphotos_tontes.jpeg', alt: 'Compilation de terrains publics et privés fraîchement tondus', title: 'Multiple tontes', isDefault: true },
  { id: 'default-7', src: './Photos/Allée_bois.jpeg', alt: 'Allée publique aménagée en bois naturel', title: 'Allée en bois', isDefault: true },
  { id: 'default-8', src: './Photos/Allée_souches_arbres.jpeg', alt: 'Allée créative réalisée avec des souches d arbres', title: 'Allée en souches', isDefault: true },
  { id: 'default-9', src: './Photos/Multiphotos_fabrication_escalier_béton.jpeg', alt: 'Étapes de fabrication d un escalier extérieur en béton', title: 'Escalier béton', isDefault: true },
  { id: 'default-10', src: './Photos/Contour_piscine_bois.jpeg', alt: 'Contour de piscine hors sol aménagé en bois', title: 'Contour piscine en bois', isDefault: true }
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Type de fichier non autorisé. Utilisez JPG, PNG ou WEBP.'));
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/Photos', express.static(PUBLIC_GALLERY_DIR));
app.use('/AujardindEddy', express.static(PUBLIC_GALLERY_DIR));

app.set('trust proxy', 1);

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: SESSION_SECURE_COOKIE,
    maxAge: 1000 * 60 * 60 * 12
  }
}));

const readGallery = () => {
  try {
    const raw = fs.readFileSync(GALLERY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.images) ? parsed.images : [];
  } catch (error) {
    return [];
  }
};

const writeGallery = (images) => {
  fs.writeFileSync(GALLERY_FILE, JSON.stringify({ images }, null, 2));
};

const writeEnvAdminCredentials = (username, password) => {
  try {
    if (!fs.existsSync(ENV_FILE)) return;

    let envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const setOrReplace = (key, value) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const escapedValue = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${escapedValue}`);
      } else {
        envContent += `\n${key}=${escapedValue}\n`;
      }
    };

    setOrReplace('ADMIN_USERNAME', username);
    setOrReplace('ADMIN_PASSWORD', password);
    fs.writeFileSync(ENV_FILE, envContent.trim() + '\n');
  } catch (error) {
    console.warn('Impossible de synchroniser les identifiants admin dans .env :', error.message);
  }
};

const readAdmin = () => {
  try {
    const raw = fs.readFileSync(ADMIN_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {
      username: process.env.ADMIN_USERNAME || 'eddy',
      passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'EddyJardin2026!', 10)
    };
  }
};

const getGalleryImages = () => {
  const uploaded = readGallery();
  return [...defaultGallery, ...uploaded];
};

const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ message: 'Non autorisé.' });
  }
  next();
};

app.get('/api/gallery', (req, res) => {
  res.json({ images: getGalleryImages() });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const admin = readAdmin();

  if (!username || !password) {
    return res.status(400).json({ message: 'Identifiant et mot de passe requis.' });
  }

  if (username !== admin.username) {
    return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
  }

  const isValid = bcrypt.compareSync(password, admin.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
  }

  req.session.isAdmin = true;
  req.session.username = username;
  res.json({ success: true, username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/admin/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin), username: req.session?.username || null });
});

app.get('/api/admin/credentials', requireAdmin, (req, res) => {
  const admin = readAdmin();
  res.json({ username: admin.username });
});

app.put('/api/admin/credentials', requireAdmin, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Identifiant et mot de passe requis.' });
  }

  const newHash = bcrypt.hashSync(password, 10);
  const updated = { username, passwordHash: newHash };
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(updated, null, 2));
  writeEnvAdminCredentials(username, password);

  req.session.username = username;
  res.json({ success: true, username });
});

app.post('/api/gallery/upload', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier sélectionné.' });
    }

    const title = (req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ message: 'Un titre est requis pour le référencement SEO.' });
    }

    const uploaded = readGallery();
    const imageUrl = `/uploads/${req.file.filename}`;

    uploaded.push({
      id: `uploaded-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      src: imageUrl,
      alt: title,
      title,
      isDefault: false,
      name: req.file.originalname
    });

    writeGallery(uploaded);
    res.json({ success: true, image: uploaded[uploaded.length - 1] });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du téléversement.' });
  }
});

app.delete('/api/gallery/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const gallery = readGallery();
  const imageToRemove = gallery.find((image) => image.id === id);

  if (imageToRemove && !imageToRemove.isDefault && imageToRemove.src.startsWith('/uploads/')) {
    const fileName = path.basename(imageToRemove.src);
    const filePath = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  const uploaded = gallery.filter((image) => image.id !== id);
  writeGallery(uploaded);
  res.json({ success: true, removedId: id });
});

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Route introuvable.' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
