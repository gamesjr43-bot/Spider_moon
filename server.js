const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ===== MIDDLEWARES =====
app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ===== MONGODB =====
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => { console.error('❌ Erro MongoDB:', err); process.exit(1); });

// ===== SCHEMAS =====
const userSchema = new mongoose.Schema({
  user:      { type: String, required: true, unique: true, trim: true, maxlength: 30 },
  email:     { type: String, required: true, unique: true, trim: true, lowercase: true },
  pass:      { type: String, required: true },
  role:      { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  bio:       { type: String, default: '', maxlength: 300 },
  avatar:    { type: String, default: '' },
  score:     { type: Number, default: 0 },
  flies:     { type: Number, default: 0 },
  isBanned:  { type: Boolean, default: false },
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
  user:    { type: String, required: true },
  role:    { type: String, default: 'user' },
  content: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user:   { type: String, required: true },
}, { timestamps: true });

const forumCategorySchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, maxlength: 60 },
  description: { type: String, default: '', maxlength: 200 },
  icon:        { type: String, default: '💬' },
  order:       { type: Number, default: 0 },
}, { timestamps: true });

const forumTopicSchema = new mongoose.Schema({
  category:   { type: mongoose.Schema.Types.ObjectId, ref: 'ForumCategory', required: true },
  title:      { type: String, required: true, maxlength: 150 },
  content:    { type: String, required: true, maxlength: 5000 },
  author:     { type: String, required: true },
  authorRole: { type: String, default: 'user' },
  pinned:     { type: Boolean, default: false },
  locked:     { type: Boolean, default: false },
  views:      { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
}, { timestamps: true });

const forumReplySchema = new mongoose.Schema({
  topic:      { type: mongoose.Schema.Types.ObjectId, ref: 'ForumTopic', required: true },
  content:    { type: String, required: true, maxlength: 3000 },
  author:     { type: String, required: true },
  authorRole: { type: String, default: 'user' },
}, { timestamps: true });

const User          = mongoose.model('User',          userSchema);
const Chat          = mongoose.model('Chat',          chatSchema);
const Audit         = mongoose.model('Audit',         auditSchema);
const ForumCategory = mongoose.model('ForumCategory', forumCategorySchema);
const ForumTopic    = mongoose.model('ForumTopic',    forumTopicSchema);
const ForumReply    = mongoose.model('ForumReply',    forumReplySchema);

// ===== HELPERS =====
const JWT_SECRET = process.env.JWT_SECRET || 'spider_secret_mude_isso';

function gerarToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Sem token' });
  try {
    const token = header.split(' ')[1];
    req.decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(req.decoded.id).select('-pass');
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    if (user.isBanned) return res.status(403).json({ error: 'Conta banida' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  next();
}

function modOrAdmin(req, res, next) {
  if (!['admin', 'moderator'].includes(req.user.role))
    return res.status(403).json({ error: 'Acesso negado' });
  next();
}

async function registrarAudit(action, user) {
  try { await Audit.create({ action, user }); } catch {}
}

// ===== HEALTH CHECK (UptimeRobot aponta aqui) =====
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ===== ROTAS PÚBLICAS =====
app.post('/api/register', async (req, res) => {
  try {
    let { user, email, pass } = req.body;
    if (!user || !email || !pass)
      return res.status(400).json({ error: 'Preencha todos os campos' });

    user = user.trim();
    email = email.trim().toLowerCase();

    if (user.length < 3 || user.length > 30)
      return res.status(400).json({ error: 'Usuário deve ter entre 3 e 30 caracteres' });
    if (pass.length < 6)
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    if (!/^[a-zA-Z0-9_.-]+$/.test(user))
      return res.status(400).json({ error: 'Usuário só pode ter letras, números, _ . -' });

    const existe = await User.findOne({ $or: [{ user }, { email }] });
    if (existe) return res.status(409).json({ error: 'Usuário ou email já cadastrado' });

    const hash = await bcrypt.hash(pass, 12);
    await User.create({ user, email, pass: hash });
    res.status(201).json({ message: 'Conta criada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { user, pass } = req.body;
    if (!user || !pass)
      return res.status(400).json({ error: 'Preencha usuário e senha' });

    const found = await User.findOne({ user: user.trim() });
    if (!found) return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    if (found.isBanned) return res.status(403).json({ error: 'Conta banida' });

    const ok = await bcrypt.compare(pass, found.pass);
    if (!ok) return res.status(401).json({ error: 'Usuário ou senha incorretos' });

    const token = gerarToken(found);
    res.json({ token, user: { user: found.user, role: found.role, avatar: found.avatar, score: found.score, flies: found.flies } });
  } catch {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ===== PERFIL =====
app.get('/api/profile', auth, async (req, res) => res.json(req.user));

app.put('/api/profile', auth, async (req, res) => {
  try {
    const { bio, avatar } = req.body;
    const update = {};
    if (bio !== undefined) {
      if (bio.length > 300) return res.status(400).json({ error: 'Bio muito longa' });
      update.bio = bio;
    }
    if (avatar !== undefined) {
      if (avatar.length > 700000) return res.status(400).json({ error: 'Imagem muito grande' });
      update.avatar = avatar;
    }
    const updated = await User.findByIdAndUpdate(req.user._id, update, { new: true }).select('-pass');
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Erro ao salvar perfil' });
  }
});

// ===== SCORE =====
app.post('/api/score', auth, async (req, res) => {
  try {
    const { points } = req.body;
    if (!points || points < 0 || points > 10000)
      return res.status(400).json({ error: 'Pontuação inválida' });
    const fliesGanhas = Math.floor(points / 10);
    await User.findByIdAndUpdate(req.user._id, { $inc: { score: points, flies: fliesGanhas } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao salvar score' });
  }
});

// ===== RANKING =====
app.get('/api/ranking', auth, async (req, res) => {
  try {
    const users = await User.find({ isBanned: false })
      .select('user score flies role avatar')
      .sort({ score: -1 }).limit(50);
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erro ao carregar ranking' });
  }
});

// ===== CHAT =====
app.get('/api/chat', auth, async (req, res) => {
  try {
    const messages = await Chat.find().sort({ createdAt: -1 }).limit(100);
    res.json(messages.reverse());
  } catch {
    res.status(500).json({ error: 'Erro ao carregar chat' });
  }
});

app.post('/api/chat', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Mensagem vazia' });
    if (content.length > 500) return res.status(400).json({ error: 'Mensagem muito longa' });
    const msg = await Chat.create({ user: req.user.user, role: req.user.role, content: content.trim() });
    res.status(201).json(msg);
  } catch {
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// ===== FÓRUM - CATEGORIAS =====
app.get('/api/forum/categories', auth, async (req, res) => {
  try {
    const cats = await ForumCategory.find().sort({ order: 1, createdAt: 1 });
    // Conta tópicos por categoria
    const withCounts = await Promise.all(cats.map(async (cat) => {
      const topicCount = await ForumTopic.countDocuments({ category: cat._id });
      return { ...cat.toObject(), topicCount };
    }));
    res.json(withCounts);
  } catch {
    res.status(500).json({ error: 'Erro ao carregar categorias' });
  }
});

app.post('/api/forum/categories', auth, adminOnly, async (req, res) => {
  try {
    const { name, description, icon, order } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const cat = await ForumCategory.create({ name, description, icon: icon || '💬', order: order || 0 });
    await registrarAudit(`Criou categoria de fórum: ${name}`, req.user.user);
    res.status(201).json(cat);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Categoria já existe' });
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

app.put('/api/forum/categories/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, description, icon, order } = req.body;
    const cat = await ForumCategory.findByIdAndUpdate(req.params.id, { name, description, icon, order }, { new: true });
    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json(cat);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

app.delete('/api/forum/categories/:id', auth, adminOnly, async (req, res) => {
  try {
    const topicos = await ForumTopic.countDocuments({ category: req.params.id });
    if (topicos > 0) return res.status(400).json({ error: `Categoria tem ${topicos} tópico(s). Remova-os primeiro.` });
    await ForumCategory.findByIdAndDelete(req.params.id);
    await registrarAudit(`Deletou categoria de fórum`, req.user.user);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao deletar categoria' });
  }
});

// ===== FÓRUM - TÓPICOS =====
app.get('/api/forum/topics', auth, async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const filter = category ? { category } : {};
    const total = await ForumTopic.countDocuments(filter);
    const topics = await ForumTopic.find(filter)
      .sort({ pinned: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('category', 'name icon');
    res.json({ topics, total, pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Erro ao carregar tópicos' });
  }
});

app.get('/api/forum/topics/:id', auth, async (req, res) => {
  try {
    const topic = await ForumTopic.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('category', 'name icon');
    if (!topic) return res.status(404).json({ error: 'Tópico não encontrado' });
    res.json(topic);
  } catch {
    res.status(500).json({ error: 'Erro ao carregar tópico' });
  }
});

app.post('/api/forum/topics', auth, async (req, res) => {
  try {
    const { category, title, content } = req.body;
    if (!category || !title || !content)
      return res.status(400).json({ error: 'Preencha todos os campos' });
    if (title.length < 5) return res.status(400).json({ error: 'Título muito curto' });
    if (content.length < 10) return res.status(400).json({ error: 'Conteúdo muito curto' });

    const cat = await ForumCategory.findById(category);
    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });

    const topic = await ForumTopic.create({
      category, title, content,
      author: req.user.user,
      authorRole: req.user.role,
    });
    res.status(201).json(topic);
  } catch {
    res.status(500).json({ error: 'Erro ao criar tópico' });
  }
});

app.delete('/api/forum/topics/:id', auth, modOrAdmin, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: 'Tópico não encontrado' });
    await ForumReply.deleteMany({ topic: req.params.id });
    await ForumTopic.findByIdAndDelete(req.params.id);
    await registrarAudit(`Deletou tópico: ${topic.title}`, req.user.user);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao deletar tópico' });
  }
});

app.patch('/api/forum/topics/:id/pin', auth, modOrAdmin, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: 'Tópico não encontrado' });
    topic.pinned = !topic.pinned;
    await topic.save();
    res.json({ pinned: topic.pinned });
  } catch {
    res.status(500).json({ error: 'Erro ao fixar tópico' });
  }
});

app.patch('/api/forum/topics/:id/lock', auth, modOrAdmin, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: 'Tópico não encontrado' });
    topic.locked = !topic.locked;
    await topic.save();
    res.json({ locked: topic.locked });
  } catch {
    res.status(500).json({ error: 'Erro ao bloquear tópico' });
  }
});

// ===== FÓRUM - RESPOSTAS =====
app.get('/api/forum/topics/:id/replies', auth, async (req, res) => {
  try {
    const replies = await ForumReply.find({ topic: req.params.id }).sort({ createdAt: 1 });
    res.json(replies);
  } catch {
    res.status(500).json({ error: 'Erro ao carregar respostas' });
  }
});

app.post('/api/forum/topics/:id/replies', auth, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: 'Tópico não encontrado' });
    if (topic.locked && !['admin', 'moderator'].includes(req.user.role))
      return res.status(403).json({ error: 'Tópico bloqueado' });

    const { content } = req.body;
    if (!content || content.trim().length < 2)
      return res.status(400).json({ error: 'Resposta muito curta' });

    const reply = await ForumReply.create({
      topic: req.params.id,
      content: content.trim(),
      author: req.user.user,
      authorRole: req.user.role,
    });

    await ForumTopic.findByIdAndUpdate(req.params.id, { $inc: { replyCount: 1 }, updatedAt: new Date() });
    res.status(201).json(reply);
  } catch {
    res.status(500).json({ error: 'Erro ao responder' });
  }
});

app.delete('/api/forum/replies/:id', auth, modOrAdmin, async (req, res) => {
  try {
    const reply = await ForumReply.findById(req.params.id);
    if (!reply) return res.status(404).json({ error: 'Resposta não encontrada' });
    await ForumReply.findByIdAndDelete(req.params.id);
    await ForumTopic.findByIdAndUpdate(reply.topic, { $inc: { replyCount: -1 } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao deletar resposta' });
  }
});

// ===== ADMIN =====
app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
  try {
    const [users, messages, banned, topics, replies] = await Promise.all([
      User.countDocuments(),
      Chat.countDocuments(),
      User.countDocuments({ isBanned: true }),
      ForumTopic.countDocuments(),
      ForumReply.countDocuments(),
    ]);
    res.json({ users, messages, banned, topics, replies });
  } catch {
    res.status(500).json({ error: 'Erro ao carregar stats' });
  }
});

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-pass').sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

app.post('/api/admin/ban/:id', auth, adminOnly, async (req, res) => {
  try {
    const { ban } = req.body;
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (target.role === 'admin') return res.status(403).json({ error: 'Não é possível banir um admin' });
    await User.findByIdAndUpdate(req.params.id, { isBanned: ban });
    await registrarAudit(`${ban ? 'Baniu' : 'Desbaniu'} ${target.user}`, req.user.user);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao banir usuário' });
  }
});

app.post('/api/admin/role/:id', auth, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'moderator'].includes(role))
      return res.status(400).json({ error: 'Cargo inválido' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (target.role === 'admin') return res.status(403).json({ error: 'Não é possível alterar cargo de admin' });
    await User.findByIdAndUpdate(req.params.id, { role });
    await registrarAudit(`Alterou cargo de ${target.user} para ${role}`, req.user.user);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao alterar cargo' });
  }
});

app.delete('/api/admin/chat', auth, adminOnly, async (req, res) => {
  try {
    await Chat.deleteMany({});
    await registrarAudit('Limpou o chat', req.user.user);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao limpar chat' });
  }
});

app.get('/api/admin/audit', auth, adminOnly, async (req, res) => {
  try {
    const logs = await Audit.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch {
    res.status(500).json({ error: 'Erro ao carregar auditoria' });
  }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🕷 Spider API rodando na porta ${PORT}`));
