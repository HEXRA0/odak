import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { db, rowToTask } from './db.mjs';

const port = Number(process.env.PORT || 4173);
const distDir = path.resolve('dist');
const statuses = new Set(['inbox', 'todo', 'progress', 'waiting', 'done']);
const priorities = new Set(['low', 'normal', 'high', 'urgent']);
const roles = new Set(['admin', 'user']);
const colors = ['#e45b35', '#5d76a9', '#4d8a70', '#8c65a8', '#c67b36', '#b64d68', '#317c83'];
const taskFields = ['title', 'description', 'status', 'priority', 'requester', 'project', 'due_date', 'estimated_minutes', 'tags', 'archived', 'assignee_id'];
const taskSelect = `SELECT t.*, creator.name AS creator_name, creator.initials AS creator_initials, creator.color AS creator_color,
  assignee.name AS assignee_name, assignee.initials AS assignee_initials, assignee.color AS assignee_color
  FROM tasks t LEFT JOIN profiles creator ON creator.id = t.created_by LEFT JOIN profiles assignee ON assignee.id = t.assignee_id`;

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 1_000_000) reject(new Error('İstek çok büyük.'));
  });
  req.on('end', () => {
    try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Geçersiz JSON.')); }
  });
  req.on('error', reject);
});

function initials(name) {
  return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('tr')).join('');
}

function getProfile(req) {
  const id = Number(req.headers['x-profile-id']);
  if (!Number.isInteger(id)) return null;
  return db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) || null;
}

function publicProfile(profile) {
  return profile ? { id: profile.id, name: profile.name, initials: profile.initials, color: profile.color, role: profile.role, created_at: profile.created_at } : null;
}

function canAccess(task, profile) {
  return profile?.role === 'admin' || task?.created_by === profile?.id || task?.assignee_id === profile?.id;
}

function getTask(id) {
  return rowToTask(db.prepare(`${taskSelect} WHERE t.id = ?`).get(id));
}

function addActivity(taskId, actorId, action, detail = '') {
  db.prepare('INSERT INTO activity (task_id, actor_id, action, detail) VALUES (?, ?, ?, ?)').run(taskId, actorId, action, detail);
}

function validateTask(input, partial = false) {
  if (!partial && (!input.title || !String(input.title).trim())) return 'Görev başlığı gerekli.';
  if (input.title !== undefined && !String(input.title).trim()) return 'Görev başlığı boş olamaz.';
  if (input.status !== undefined && !statuses.has(input.status)) return 'Geçersiz durum.';
  if (input.priority !== undefined && !priorities.has(input.priority)) return 'Geçersiz öncelik.';
  if (input.estimated_minutes !== undefined && input.estimated_minutes !== null && input.estimated_minutes !== '' && (!Number.isInteger(Number(input.estimated_minutes)) || Number(input.estimated_minutes) < 0)) return 'Tahmini süre geçersiz.';
  if (input.tags !== undefined && !Array.isArray(input.tags)) return 'Etiketler liste olmalıdır.';
  if (input.assignee_id !== undefined && !db.prepare('SELECT id FROM profiles WHERE id = ?').get(Number(input.assignee_id))) return 'Atanacak profil bulunamadı.';
  return null;
}

async function handleApi(req, res, url) {
  const taskMatch = url.pathname.match(/^\/api\/tasks\/(\d+)$/);
  const activityMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/activity$/);

  if (req.method === 'GET' && url.pathname === '/api/profiles') {
    const profiles = db.prepare(`SELECT p.*, COUNT(CASE WHEN t.archived = 0 AND t.status != 'done' AND t.assignee_id = p.id THEN 1 END) AS open_tasks FROM profiles p LEFT JOIN tasks t ON t.assignee_id = p.id GROUP BY p.id ORDER BY CASE p.role WHEN 'admin' THEN 0 ELSE 1 END, p.name`).all();
    return json(res, 200, profiles.map((profile) => ({ ...publicProfile(profile), open_tasks: profile.open_tasks })));
  }

  if (req.method === 'POST' && url.pathname === '/api/profiles') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    if (name.length < 2) return json(res, 400, { error: 'Profil adı en az 2 karakter olmalıdır.' });
    if (name.length > 40) return json(res, 400, { error: 'Profil adı çok uzun.' });
    const role = roles.has(body.role) ? body.role : 'user';
    const color = /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : colors[db.prepare('SELECT COUNT(*) count FROM profiles').get().count % colors.length];
    const result = db.prepare('INSERT INTO profiles (name, initials, color, role) VALUES (?, ?, ?, ?)').run(name, initials(name), color, role);
    return json(res, 201, publicProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid)));
  }

  const profile = getProfile(req);
  if (!profile) return json(res, 401, { error: 'Lütfen bir profil seçin.' });

  if (req.method === 'GET' && url.pathname === '/api/session') return json(res, 200, publicProfile(profile));

  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    const archived = url.searchParams.get('archived') === 'true' ? 1 : 0;
    const scope = url.searchParams.get('scope') || 'visible';
    const params = [archived];
    let visibility = '';
    if (profile.role !== 'admin' || scope === 'mine') {
      visibility = ' AND (t.created_by = ? OR t.assignee_id = ?)';
      params.push(profile.id, profile.id);
    }
    const rows = db.prepare(`${taskSelect} WHERE t.archived = ?${visibility} ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, COALESCE(t.due_date, '9999-12-31'), t.created_at DESC`).all(...params);
    return json(res, 200, rows.map(rowToTask));
  }

  if (req.method === 'GET' && activityMatch) {
    const task = getTask(Number(activityMatch[1]));
    if (!task || !canAccess(task, profile)) return json(res, 404, { error: 'Görev bulunamadı.' });
    const rows = db.prepare(`SELECT a.*, p.name AS actor_name, p.initials AS actor_initials, p.color AS actor_color FROM activity a LEFT JOIN profiles p ON p.id = a.actor_id WHERE a.task_id = ? ORDER BY a.created_at DESC, a.id DESC`).all(task.id);
    return json(res, 200, rows);
  }

  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    const body = await readBody(req);
    const error = validateTask(body);
    if (error) return json(res, 400, { error });
    const values = {
      title: String(body.title).trim(), description: String(body.description || '').trim(),
      status: body.status || 'inbox', priority: body.priority || 'normal',
      requester: String(body.requester || '').trim(), project: String(body.project || '').trim(),
      due_date: body.due_date || null,
      estimated_minutes: body.estimated_minutes === '' || body.estimated_minutes == null ? null : Number(body.estimated_minutes),
      tags: JSON.stringify((body.tags || []).map(String).map((tag) => tag.trim()).filter(Boolean)),
      created_by: profile.id, assignee_id: Number(body.assignee_id || profile.id),
    };
    const result = db.prepare(`INSERT INTO tasks (title, description, status, priority, requester, project, due_date, estimated_minutes, tags, created_by, assignee_id) VALUES (:title, :description, :status, :priority, :requester, :project, :due_date, :estimated_minutes, :tags, :created_by, :assignee_id)`).run(values);
    addActivity(result.lastInsertRowid, profile.id, 'created', `Görev ${values.assignee_id === profile.id ? 'oluşturuldu' : 'atandı'}`);
    return json(res, 201, getTask(result.lastInsertRowid));
  }

  if (req.method === 'PATCH' && taskMatch) {
    const id = Number(taskMatch[1]);
    const existing = getTask(id);
    if (!existing || !canAccess(existing, profile)) return json(res, 404, { error: 'Görev bulunamadı.' });
    const body = await readBody(req);
    const error = validateTask(body, true);
    if (error) return json(res, 400, { error });
    const updates = [];
    const values = { id };
    for (const field of taskFields) {
      if (body[field] === undefined) continue;
      updates.push(`${field} = :${field}`);
      if (field === 'tags') values[field] = JSON.stringify(body[field].map(String).map((tag) => tag.trim()).filter(Boolean));
      else if (field === 'archived') values[field] = body[field] ? 1 : 0;
      else if (field === 'estimated_minutes') values[field] = body[field] === '' || body[field] == null ? null : Number(body[field]);
      else if (field === 'assignee_id') values[field] = Number(body[field]);
      else if (field === 'due_date') values[field] = body[field] || null;
      else if (typeof body[field] === 'string') values[field] = body[field].trim();
      else values[field] = body[field];
    }
    if (!updates.length) return json(res, 200, existing);
    if (body.status !== undefined) {
      updates.push('completed_at = :completed_at');
      values.completed_at = body.status === 'done' ? new Date().toISOString() : null;
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = :id`).run(values);
    const action = body.archived ? 'archived' : body.assignee_id && Number(body.assignee_id) !== existing.assignee_id ? 'assigned' : 'updated';
    addActivity(id, profile.id, action, Object.keys(body).filter((key) => taskFields.includes(key)).join(', '));
    return json(res, 200, getTask(id));
  }

  if (req.method === 'DELETE' && taskMatch) {
    const id = Number(taskMatch[1]);
    const task = getTask(id);
    if (!task || !canAccess(task, profile)) return json(res, 404, { error: 'Görev bulunamadı.' });
    db.prepare('UPDATE tasks SET archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    addActivity(id, profile.id, 'archived', 'Görev arşivlendi');
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'Bulunamadı.' });
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    let filePath = path.resolve(distDir, requested);
    if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(distDir, 'index.html');
    if (!fs.existsSync(filePath)) return json(res, 503, { error: 'Arayüz henüz derlenmedi. Önce pnpm build çalıştırın.' });
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error.message || 'Sunucu hatası.' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Odak sunucusu: http://127.0.0.1:${port}`));
