import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, rowToTask } from './db.mjs';

const port = Number(process.env.PORT || 4173);
const distDir = path.resolve('dist');
const JWT_SECRET = process.env.JWT_SECRET || 'thedemir-super-secret-jwt-key-2026-change-in-production';
const SSO_LOGIN_URL = process.env.SSO_LOGIN_URL || 'https://kimlik.thedemir.com/login';
const COOKIE_NAME = 'thedemir_session';

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
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('tr')).join('') || 'KD';
}

function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const expectedSig = crypto.createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    if (signatureB64 !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function getSessionToken(req, url) {
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (url && url.searchParams.has('token')) {
    return url.searchParams.get('token');
  }
  return null;
}

function getOrCreateUserProfile(ssoUser) {
  if (!ssoUser) return null;
  let profile = null;
  if (ssoUser.userId) {
    profile = db.prepare('SELECT * FROM profiles WHERE sso_user_id = ?').get(ssoUser.userId);
  }
  if (!profile && ssoUser.email) {
    profile = db.prepare('SELECT * FROM profiles WHERE email = ?').get(ssoUser.email);
    if (profile && ssoUser.userId) {
      db.prepare('UPDATE profiles SET sso_user_id = ? WHERE id = ?').run(ssoUser.userId, profile.id);
    }
  }
  if (!profile) {
    const name = ssoUser.fullName || (ssoUser.email ? ssoUser.email.split('@')[0] : 'Kullanıcı');
    const isSuper = Boolean(ssoUser.isSuperadmin || ssoUser.role === 'superadmin' || ssoUser.permissions?.odak?.role === 'admin');
    const role = isSuper ? 'admin' : 'user';
    const color = colors[db.prepare('SELECT COUNT(*) count FROM profiles').get().count % colors.length];
    const res = db.prepare('INSERT INTO profiles (name, initials, color, role, sso_user_id, email) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, initials(name), color, role, ssoUser.userId || null, ssoUser.email || null);
    profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(res.lastInsertRowid);
  } else {
    // Update role / name if superadmin status changed
    const isSuper = Boolean(ssoUser.isSuperadmin || ssoUser.role === 'superadmin' || ssoUser.permissions?.odak?.role === 'admin');
    if (isSuper && profile.role !== 'admin') {
      db.prepare('UPDATE profiles SET role = ? WHERE id = ?').run('admin', profile.id);
      profile.role = 'admin';
    }
    if (ssoUser.fullName && profile.name !== ssoUser.fullName) {
      db.prepare('UPDATE profiles SET name = ?, initials = ? WHERE id = ?').run(ssoUser.fullName, initials(ssoUser.fullName), profile.id);
      profile.name = ssoUser.fullName;
      profile.initials = initials(ssoUser.fullName);
    }
  }
  return profile;
}

function resolveSession(req, url) {
  const token = getSessionToken(req, url);
  let authUser = null;
  let profile = null;

  if (token) {
    const decoded = verifyJwt(token, JWT_SECRET);
    if (decoded && (decoded.userId || decoded.email)) {
      authUser = decoded;
      profile = getOrCreateUserProfile(authUser);
    }
  }

  // Fallback: X-Profile-Id header or default admin profile for local dev/testing
  if (!profile) {
    const requestedId = Number(req.headers['x-profile-id']);
    if (Number.isInteger(requestedId)) {
      profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(requestedId) || null;
    }
  }

  // Fallback for standalone / legacy development
  if (!profile && !authUser) {
    profile = db.prepare("SELECT * FROM profiles ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, id LIMIT 1").get() || null;
  }

  return { authUser, profile };
}

function publicProfile(profile) {
  return profile ? {
    id: profile.id,
    name: profile.name,
    initials: profile.initials,
    color: profile.color,
    role: profile.role,
    sso_user_id: profile.sso_user_id || null,
    email: profile.email || null,
    created_at: profile.created_at
  } : null;
}

function canAccessTask(task, profile, authUser) {
  if (!task) return false;
  if (authUser?.isSuperadmin || authUser?.role === 'superadmin') return true;
  if (profile?.role === 'admin') return true;
  if (task.user_id && authUser?.userId && task.user_id === authUser.userId) return true;
  if (task.created_by && profile?.id && task.created_by === profile.id) return true;
  if (task.assignee_id && profile?.id && task.assignee_id === profile.id) return true;
  return false;
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
  if (input.assignee_id !== undefined && input.assignee_id !== null && input.assignee_id !== '' && Number(input.assignee_id) > 0) {
    if (!db.prepare('SELECT id FROM profiles WHERE id = ?').get(Number(input.assignee_id))) {
      return 'Atanacak profil bulunamadı.';
    }
  }
  return null;
}

async function handleApi(req, res, url) {
  const taskMatch = url.pathname.match(/^\/api\/tasks\/(\d+)$/);
  const activityMatch = url.pathname.match(/^\/api\/tasks\/(\d+)\/activity$/);

  // Logout Endpoint
  if (url.pathname === '/api/logout' || url.pathname === '/api/auth/logout') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': [
        'thedemir_session=; Path=/; Domain=.thedemir.com; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
        'thedemir_session=; Path=/; Domain=odak.thedemir.com; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
        'thedemir_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
      ]
    });
    return res.end(JSON.stringify({ ok: true, ssoLoginUrl: `${SSO_LOGIN_URL}?redirect=https://odak.thedemir.com` }));
  }

  const { authUser, profile } = resolveSession(req, url);
  const isSuperadmin = Boolean(authUser?.isSuperadmin || authUser?.role === 'superadmin' || profile?.role === 'admin');

  // Public/Session Check
  if (req.method === 'GET' && url.pathname === '/api/session') {
    if (!profile) {
      return json(res, 401, {
        error: 'Oturum bulunamadı. Lütfen Kimlik üzerinden giriş yapın.',
        ssoLoginUrl: `${SSO_LOGIN_URL}?redirect=https://odak.thedemir.com`
      });
    }
    return json(res, 200, {
      ...publicProfile(profile),
      ssoUser: authUser ? {
        userId: authUser.userId,
        email: authUser.email,
        fullName: authUser.fullName,
        isSuperadmin: isSuperadmin
      } : null
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/profiles') {
    if (isSuperadmin) {
      const profiles = db.prepare(`SELECT p.*, COUNT(CASE WHEN t.archived = 0 AND t.status != 'done' AND t.assignee_id = p.id THEN 1 END) AS open_tasks FROM profiles p LEFT JOIN tasks t ON t.assignee_id = p.id GROUP BY p.id ORDER BY CASE p.role WHEN 'admin' THEN 0 ELSE 1 END, p.name`).all();
      return json(res, 200, profiles.map((p) => ({ ...publicProfile(p), open_tasks: p.open_tasks })));
    }
    if (!profile) return json(res, 401, { error: 'Oturum açılmadı.' });
    const myProfile = db.prepare(`SELECT p.*, COUNT(CASE WHEN t.archived = 0 AND t.status != 'done' AND t.assignee_id = p.id THEN 1 END) AS open_tasks FROM profiles p LEFT JOIN tasks t ON t.assignee_id = p.id WHERE p.id = ? GROUP BY p.id`).get(profile.id);
    return json(res, 200, [myProfile ? { ...publicProfile(myProfile), open_tasks: myProfile.open_tasks } : publicProfile(profile)]);
  }

  // Superadmin user selector list
  if (req.method === 'GET' && url.pathname === '/api/users') {
    if (!isSuperadmin) {
      return json(res, 403, { error: 'Bu işlem için süperadmin yetkisi gereklidir.' });
    }
    const users = db.prepare(`
      SELECT 
        COALESCE(p.sso_user_id, t.user_id, 'local_' || p.id) AS userId,
        COALESCE(p.name, t.user_name, 'İsimsiz') AS fullName,
        COALESCE(p.email, t.user_email, '') AS email,
        COALESCE(p.role, 'user') AS role,
        COUNT(CASE WHEN t.archived = 0 THEN 1 END) AS activeTasks,
        COUNT(CASE WHEN t.archived = 0 AND t.status = 'done' THEN 1 END) AS completedTasks
      FROM profiles p
      FULL OUTER JOIN tasks t ON t.user_id = p.sso_user_id OR t.created_by = p.id
      GROUP BY userId, fullName, email, role
      ORDER BY activeTasks DESC, fullName ASC
    `).all();
    return json(res, 200, users);
  }

  if (req.method === 'POST' && url.pathname === '/api/profiles') {
    if (!isSuperadmin) {
      return json(res, 403, { error: 'Yeni profil ekleme yetkiniz yok.' });
    }
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    if (name.length < 2) return json(res, 400, { error: 'Profil adı en az 2 karakter olmalıdır.' });
    if (name.length > 40) return json(res, 400, { error: 'Profil adı çok uzun.' });
    const role = roles.has(body.role) ? body.role : 'user';
    const color = /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : colors[db.prepare('SELECT COUNT(*) count FROM profiles').get().count % colors.length];
    const result = db.prepare('INSERT INTO profiles (name, initials, color, role) VALUES (?, ?, ?, ?)').run(name, initials(name), color, role);
    return json(res, 201, publicProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid)));
  }

  if (!profile) return json(res, 401, { error: 'Lütfen giriş yapın.' });

  // Statistics endpoint with strict user isolation
  if (req.method === 'GET' && url.pathname === '/api/stats') {
    const filterUserId = url.searchParams.get('user_id');
    let whereClause = 'WHERE archived = 0';
    const params = [];

    if (isSuperadmin) {
      if (filterUserId && filterUserId !== 'all') {
        whereClause += ' AND (user_id = ? OR created_by = (SELECT id FROM profiles WHERE sso_user_id = ? LIMIT 1))';
        params.push(filterUserId, filterUserId);
      }
    } else {
      const userCondition = [];
      if (authUser?.userId) {
        userCondition.push('user_id = ?');
        params.push(authUser.userId);
      }
      userCondition.push('created_by = ?');
      params.push(profile.id);
      userCondition.push('assignee_id = ?');
      params.push(profile.id);

      whereClause += ` AND (${userCondition.join(' OR ')})`;
    }

    const statsRow = db.prepare(`
      SELECT 
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'inbox' THEN 1 END) AS inbox,
        COUNT(CASE WHEN status = 'todo' THEN 1 END) AS todo,
        COUNT(CASE WHEN status = 'progress' THEN 1 END) AS progress,
        COUNT(CASE WHEN status = 'waiting' THEN 1 END) AS waiting,
        COUNT(CASE WHEN status = 'done' THEN 1 END) AS done,
        COUNT(CASE WHEN priority = 'urgent' AND status != 'done' THEN 1 END) AS urgent,
        COUNT(CASE WHEN priority = 'high' AND status != 'done' THEN 1 END) AS high,
        COUNT(CASE WHEN due_date = date('now') AND status != 'done' THEN 1 END) AS due_today,
        COUNT(CASE WHEN due_date < date('now') AND status != 'done' THEN 1 END) AS overdue
      FROM tasks ${whereClause}
    `).get(...params);

    return json(res, 200, statsRow);
  }

  // Tasks listing with strict user isolation
  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    const archived = url.searchParams.get('archived') === 'true' ? 1 : 0;
    const filterUserId = url.searchParams.get('user_id');
    const params = [archived];
    let filterSql = '';

    if (isSuperadmin) {
      if (filterUserId && filterUserId !== 'all') {
        filterSql = ' AND (t.user_id = ? OR t.created_by = (SELECT id FROM profiles WHERE sso_user_id = ? LIMIT 1))';
        params.push(filterUserId, filterUserId);
      }
    } else {
      const userParts = [];
      if (authUser?.userId) {
        userParts.push('t.user_id = ?');
        params.push(authUser.userId);
      }
      userParts.push('t.created_by = ?');
      params.push(profile.id);
      userParts.push('t.assignee_id = ?');
      params.push(profile.id);

      filterSql = ` AND (${userParts.join(' OR ')})`;
    }

    const rows = db.prepare(`${taskSelect} WHERE t.archived = ?${filterSql} ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, COALESCE(t.due_date, '9999-12-31'), t.created_at DESC`).all(...params);
    return json(res, 200, rows.map(rowToTask));
  }

  if (req.method === 'GET' && activityMatch) {
    const task = getTask(Number(activityMatch[1]));
    if (!task || !canAccessTask(task, profile, authUser)) {
      return json(res, 404, { error: 'Görev bulunamadı veya erişim yetkiniz yok.' });
    }
    const rows = db.prepare(`SELECT a.*, p.name AS actor_name, p.initials AS actor_initials, p.color AS actor_color FROM activity a LEFT JOIN profiles p ON p.id = a.actor_id WHERE a.task_id = ? ORDER BY a.created_at DESC, a.id DESC`).all(task.id);
    return json(res, 200, rows);
  }

  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    const body = await readBody(req);
    const error = validateTask(body);
    if (error) return json(res, 400, { error });

    const values = {
      title: String(body.title).trim(),
      description: String(body.description || '').trim(),
      status: body.status || 'inbox',
      priority: body.priority || 'normal',
      requester: String(body.requester || '').trim(),
      project: String(body.project || '').trim(),
      due_date: body.due_date || null,
      estimated_minutes: body.estimated_minutes === '' || body.estimated_minutes == null ? null : Number(body.estimated_minutes),
      tags: JSON.stringify((body.tags || []).map(String).map((tag) => tag.trim()).filter(Boolean)),
      created_by: profile.id,
      assignee_id: (body.assignee_id && Number(body.assignee_id) > 0) ? Number(body.assignee_id) : profile.id,
      user_id: authUser?.userId || profile.sso_user_id || `local_${profile.id}`,
      user_email: authUser?.email || profile.email || '',
      user_name: authUser?.fullName || profile.name || 'Kullanıcı',
    };

    const result = db.prepare(`
      INSERT INTO tasks (
        title, description, status, priority, requester, project, due_date, 
        estimated_minutes, tags, created_by, assignee_id, user_id, user_email, user_name
      ) VALUES (
        :title, :description, :status, :priority, :requester, :project, :due_date, 
        :estimated_minutes, :tags, :created_by, :assignee_id, :user_id, :user_email, :user_name
      )
    `).run(values);

    addActivity(result.lastInsertRowid, profile.id, 'created', `Görev ${values.assignee_id === profile.id ? 'oluşturuldu' : 'atandı'}`);
    return json(res, 201, getTask(result.lastInsertRowid));
  }

  if (req.method === 'PATCH' && taskMatch) {
    const id = Number(taskMatch[1]);
    const existing = getTask(id);
    if (!existing || !canAccessTask(existing, profile, authUser)) {
      return json(res, 403, { error: 'Bu görevi düzenleme yetkiniz bulunmamaktadır.' });
    }
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
      else if (field === 'assignee_id') values[field] = (body[field] && Number(body[field]) > 0) ? Number(body[field]) : profile.id;
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
    const action = body.archived ? 'archived' : body.assignee_id && Number(body.assignee_id) !== existing.assignee?.id ? 'assigned' : 'updated';
    addActivity(id, profile.id, action, Object.keys(body).filter((key) => taskFields.includes(key)).join(', '));
    return json(res, 200, getTask(id));
  }

  if (req.method === 'DELETE' && taskMatch) {
    const id = Number(taskMatch[1]);
    const task = getTask(id);
    if (!task || !canAccessTask(task, profile, authUser)) {
      return json(res, 403, { error: 'Bu görevi silme veya arşivleme yetkiniz yok.' });
    }
    db.prepare('UPDATE tasks SET archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    addActivity(id, profile.id, 'archived', 'Görev arşivlendi');
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'Bulunamadı.' });
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    let filePath = path.resolve(distDir, requested);
    if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }
    if (!fs.existsSync(filePath)) {
      return json(res, 503, { error: 'Arayüz henüz derlenmedi. Önce pnpm build çalıştırın.' });
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error.message || 'Sunucu hatası.' });
  }
});

const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => console.log(`Odak sunucusu hazır: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
