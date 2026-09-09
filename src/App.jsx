import React, { useState, useEffect, useMemo } from 'react';
import {
  Check, Archive, ArrowRight, CalendarDays, ChevronRight, CircleDot,
  Inbox, LogOut, Menu, Moon, Plus, Search, Sun, Timer,
  X, Zap, User
} from 'lucide-react';

const SSO_LOGIN_URL = 'https://kimlik.thedemir.com/login?redirect=https://odak.thedemir.com';

const STATUSES = {
  inbox: { label: 'Gelen kutusu', short: 'Gelen', color: '#8a8175' },
  todo: { label: 'Yapılacak', short: 'Yapılacak', color: '#5d76a9' },
  progress: { label: 'Devam ediyor', short: 'Devam', color: '#c67b36' },
  waiting: { label: 'Beklemede', short: 'Bekliyor', color: '#8c65a8' },
  done: { label: 'Tamamlandı', short: 'Tamam', color: '#4d8a70' },
};

const PRIORITIES = {
  low: { label: 'Düşük', mark: '—' },
  normal: { label: 'Normal', mark: '•' },
  high: { label: 'Yüksek', mark: '↑' },
  urgent: { label: 'Acil', mark: '!' },
};

const PAGES = {
  inbox: '/gelen-kutusu',
  today: '/bugun',
  all: '/tum-gorevler',
  waiting: '/beklemede',
  done: '/tamamlananlar',
  archive: '/arsiv',
};

const PATH_TO_PAGE = Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [v, k]));

const DEFAULT_TASK = {
  title: '',
  description: '',
  status: 'inbox',
  priority: 'normal',
  requester: '',
  project: '',
  due_date: '',
  estimated_minutes: '',
  tags: [],
  assignee_id: '',
};

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    window.location.href = SSO_LOGIN_URL;
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Bir şeyler ters gitti.');
  return data;
}

const formatDate = (d) =>
  d ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00`)) : '';

const getToday = () => new Date().toLocaleDateString('en-CA');
const isToday = (d) => d === getToday();
const isOverdue = (t) => t.due_date && t.due_date < getToday() && t.status !== 'done';

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Check size={18} strokeWidth={3} />
      </span>
      <span>odak</span>
    </div>
  );
}

function Avatar({ profile, size = 'normal' }) {
  if (!profile) return null;
  return (
    <span className={`avatar ${size}`} style={{ background: profile.color || '#e45b35' }} title={profile.name}>
      {profile.initials || 'KD'}
    </span>
  );
}

function QuickAdd({ onAdd }) {
  const [title, setTitle] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (title.trim()) {
      await onAdd({
        ...DEFAULT_TASK,
        title: title.trim(),
      });
      setTitle('');
    }
  }

  return (
    <form className="quick-add simple-add" onSubmit={handleSubmit}>
      <span className="plus-icon">
        <Plus size={18} />
      </span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Yeni görev yaz…"
        aria-label="Yeni görev başlığı"
      />
      <button type="submit" className="primary compact">
        Ekle <ArrowRight size={15} />
      </button>
    </form>
  );
}

function Sidebar({
  page,
  navigate,
  tasks,
  dark,
  setDark,
  account,
  onLogout,
  mobileOpen,
  closeMobile,
  isSuperadmin,
  selectedUserId,
  onUserSelect,
  usersList,
}) {
  const counts = useMemo(
    () => ({
      inbox: tasks.filter((t) => t.status === 'inbox').length,
      today: tasks.filter((t) => isToday(t.due_date) && t.status !== 'done').length,
      waiting: tasks.filter((t) => t.status === 'waiting').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }),
    [tasks]
  );

  const navItems = [
    ['inbox', Inbox, 'Gelen kutusu', counts.inbox],
    ['today', Zap, 'Bugün', counts.today],
    ['all', CircleDot, 'Tüm görevler', tasks.length],
    ['waiting', Timer, 'Beklemede', counts.waiting],
    ['done', Check, 'Tamamlananlar', counts.done],
    ['archive', Archive, 'Arşiv', null],
  ];

  return (
    <>
      <div className={mobileOpen ? 'scrim' : ''} onClick={closeMobile} />
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <Brand />
          <button className="icon-button mobile-close" aria-label="Menüyü kapat" onClick={closeMobile}>
            <X size={20} />
          </button>
        </div>

        {/* Süperadmin Kullanıcı Seçici */}
        {isSuperadmin && usersList && usersList.length > 0 && (
          <div style={{ padding: '0 12px 14px' }}>
            <div className="nav-label" style={{ padding: '0 0 6px', color: '#e45b35' }}>
              Süperadmin Görünümü
            </div>
            <select
              value={selectedUserId}
              onChange={(e) => onUserSelect(e.target.value)}
              style={{
                width: '100%',
                fontSize: '11px',
                background: '#151c19',
                color: '#e8eee9',
                border: '1px solid #363a37',
                borderRadius: '8px',
                padding: '6px 8px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">🏢 Tüm Kullanıcılar</option>
              {usersList.map((u) => (
                <option key={u.userId} value={u.userId}>
                  👤 {u.fullName} {u.email ? `(${u.email})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav>
          <div className="nav-label">Çalışma alanı</div>
          {navItems.map(([key, Icon, label, count]) => (
            <button
              key={key}
              className={page === key ? 'active' : ''}
              onClick={() => {
                navigate(key);
                closeMobile();
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {count !== null && <em>{count}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button onClick={() => setDark(!dark)}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            <span>{dark ? 'Açık tema' : 'Koyu tema'}</span>
          </button>
          <div className="profile active-profile">
            <Avatar profile={account} />
            <div>
              <strong>{account?.name || 'Kullanıcı'}</strong>
              <small>
                {account?.role === 'admin' || isSuperadmin
                  ? 'Süperadmin hesabı'
                  : account?.email || 'Kullanıcı hesabı'}
              </small>
            </div>
            <button className="logout-button" onClick={onLogout} title="Hesaptan Çıkış Yap">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function TaskCard({ task, onOpen, onStatus, compact = false, isSuperadmin }) {
  return (
    <article
      className={`task-card ${compact ? 'compact-card' : ''}`}
      onClick={() => onOpen(task)}
      draggable={!compact}
      onDragStart={(e) => e.dataTransfer.setData('taskId', String(task.id))}
    >
      <button
        className={`check-button ${task.status === 'done' ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onStatus(task, task.status === 'done' ? 'todo' : 'done');
        }}
        aria-label="Tamamla"
      >
        {task.status === 'done' && <Check size={13} />}
      </button>

      <div className="task-content">
        <h3>{task.title}</h3>
        <div className="task-meta">
          {(task.priority === 'high' || task.priority === 'urgent') && (
            <span className={`priority ${task.priority}`}>
              {PRIORITIES[task.priority].mark} {PRIORITIES[task.priority].label}
            </span>
          )}
          {task.due_date && (
            <span className={isOverdue(task) ? 'overdue' : ''}>
              <CalendarDays size={13} />
              {isOverdue(task) ? 'Gecikti · ' : ''}
              {formatDate(task.due_date)}
            </span>
          )}
          {isSuperadmin && task.userName && (
            <span className="assignee-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <User size={11} />
              {task.userName}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="task-arrow" size={17} />
    </article>
  );
}

function TaskList({ tasks, onOpen, onStatus, isSuperadmin }) {
  return (
    <div className="task-list">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onOpen={onOpen}
          onStatus={onStatus}
          isSuperadmin={isSuperadmin}
        />
      ))}
      {!tasks.length && <EmptyState />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <span>
        <Check size={24} />
      </span>
      <h3>Burada görev yok</h3>
      <p>Yeni bir talep eklediğinizde burada görünecek.</p>
    </div>
  );
}

function TaskDrawer({ task, onClose, onSave, onArchive }) {
  const [form, setForm] = useState(task || DEFAULT_TASK);
  const [tagsStr, setTagsStr] = useState((task?.tags || []).join(', '));
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    setForm(task || DEFAULT_TASK);
    setTagsStr((task?.tags || []).join(', '));
    if (task) {
      apiFetch(`/api/tasks/${task.id}/activity`)
        .then((data) => setActivities(data || []))
        .catch(() => setActivities([]));
    }
  }, [task]);

  if (!task) return null;

  const update = (field, val) => setForm((prev) => ({ ...prev, [field]: val }));

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <header>
          <span>Görev #{task.id}</span>
          <div>
            <button className="icon-button" onClick={() => onArchive(task)} title="Arşivle">
              <Archive size={18} />
            </button>
            <button className="icon-button" aria-label="Görev ayrıntısını kapat" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(task.id, {
              ...form,
              tags: tagsStr
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            });
          }}
        >
          <input
            className="title-input"
            value={form.title || ''}
            onChange={(e) => update('title', e.target.value)}
          />

          <div className="ownership">
            <span>
              <small>Hesap</small>
              <Avatar profile={task.creator} size="tiny" />
              {task.userName || task.creator?.name || 'Kullanıcı'}
            </span>
            {task.userEmail && (
              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                ({task.userEmail})
              </span>
            )}
          </div>

          <label>
            Açıklama
            <textarea
              value={form.description || ''}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Detayları, bağlantıları veya notları ekleyin…"
            />
          </label>

          <div className="form-grid essential-fields">
            <label>
              Durum
              <select value={form.status} onChange={(e) => update('status', e.target.value)}>
                {Object.entries(STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Öncelik
              <select value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Son tarih
              <input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => update('due_date', e.target.value)}
              />
            </label>

            <label>
              Tahmini süre
              <input
                type="number"
                min="0"
                value={form.estimated_minutes ?? ''}
                onChange={(e) => update('estimated_minutes', e.target.value)}
                placeholder="Dakika"
              />
            </label>
          </div>

          <details className="advanced-fields">
            <summary>Gelişmiş bilgiler</summary>
            <div className="form-grid">
              <label>
                Talep eden
                <input
                  value={form.requester || ''}
                  onChange={(e) => update('requester', e.target.value)}
                  placeholder="Kişi / birim"
                />
              </label>
              <label>
                Proje
                <input
                  value={form.project || ''}
                  onChange={(e) => update('project', e.target.value)}
                  placeholder="Proje adı"
                />
              </label>
              <label>
                Etiketler
                <input
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="backend, hata"
                />
              </label>
            </div>
          </details>

          <button className="primary save-button" type="submit">
            Değişiklikleri kaydet
          </button>
        </form>

        <section className="activity">
          <h4>Geçmiş</h4>
          {activities.length ? (
            activities.map((a) => (
              <div key={a.id}>
                <Avatar
                  profile={
                    a.actor_name
                      ? { initials: a.actor_initials, color: a.actor_color, name: a.actor_name }
                      : task.creator
                  }
                  size="tiny"
                />
                <p>
                  <strong>
                    {a.action === 'created'
                      ? 'Görev oluşturuldu'
                      : a.action === 'assigned'
                      ? 'Görev atandı'
                      : a.action === 'archived'
                      ? 'Görev arşivlendi'
                      : 'Görev güncellendi'}
                  </strong>
                  <small>
                    {a.actor_name ? `${a.actor_name} · ` : ''}
                    {new Date(`${a.created_at}Z`).toLocaleString('tr-TR')}
                  </small>
                </p>
              </div>
            ))
          ) : (
            <p className="muted">Henüz hareket yok.</p>
          )}
        </section>
      </aside>
    </>
  );
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [page, setPage] = useState(() => PATH_TO_PAGE[window.location.pathname] || 'inbox');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Süperadmin Kullanıcı Filtresi
  const [usersList, setUsersList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all');

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const navigate = (p) => {
    setPage(p);
    window.history.pushState({}, '', PAGES[p]);
  };

  const handleLogout = () => {
    document.cookie = 'thedemir_session=; Path=/; Domain=.thedemir.com; Max-Age=0; SameSite=Lax';
    document.cookie = 'thedemir_session=; Path=/; Max-Age=0; SameSite=Lax';
    localStorage.clear();
    window.location.href = SSO_LOGIN_URL;
  };

  // 1. Initial Session Load (Direct Account)
  useEffect(() => {
    apiFetch('/api/session')
      .then((sessionData) => {
        if (!sessionData) return;
        setAccount(sessionData);
        if (!PATH_TO_PAGE[window.location.pathname]) {
          window.history.replaceState({}, '', PAGES.inbox);
        }

        const isSuper = sessionData.ssoUser?.isSuperadmin || sessionData.role === 'admin';
        if (isSuper) {
          apiFetch('/api/users')
            .then((u) => setUsersList(u || []))
            .catch(() => setUsersList([]));
        }
      })
      .catch((err) => showToast(err.message))
      .finally(() => setLoading(false));
  }, []);

  // History popstate
  useEffect(() => {
    const onPop = () => {
      const p = PATH_TO_PAGE[window.location.pathname];
      if (p) setPage(p);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.querySelector('.top-search input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fetch Tasks
  async function loadTasks() {
    if (account) {
      setLoading(true);
      try {
        let q = '';
        if (selectedUserId && selectedUserId !== 'all') {
          q = `?user_id=${encodeURIComponent(selectedUserId)}`;
        }
        const data = await apiFetch(`/api/tasks${q}`);
        if (data) setTasks(data);

        if (page === 'archive') {
          const arch = await apiFetch(
            `/api/tasks?archived=true${
              selectedUserId && selectedUserId !== 'all' ? `&user_id=${encodeURIComponent(selectedUserId)}` : ''
            }`
          );
          if (arch) setArchivedTasks(arch);
        }
      } catch (err) {
        showToast(err.message);
      } finally {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadTasks();
  }, [page, account, selectedUserId]);

  async function handleAddTask(taskData) {
    try {
      const created = await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
      if (created) {
        setTasks((prev) => [created, ...prev]);
        showToast('Görev gelen kutusuna eklendi.');
      }
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleSaveTask(id, updates) {
    try {
      const updated = await apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
        setSelectedTask((prev) => (prev?.id === id ? updated : null));
        showToast('Değişiklikler kaydedildi.');
      }
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleStatusChange(task, newStatus) {
    if (task && task.status !== newStatus) {
      await handleSaveTask(task.id, { status: newStatus });
    }
  }

  async function handleArchiveTask(task) {
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setSelectedTask(null);
      showToast('Görev arşivlendi.');
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleRestoreTask(task) {
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: false }),
      });
      setArchivedTasks((prev) => prev.filter((t) => t.id !== task.id));
      showToast('Görev geri yüklendi.');
    } catch (err) {
      showToast(err.message);
    }
  }

  if (loading && !account) {
    return (
      <div className="splash">
        <Brand />
        <span>Yükleniyor…</span>
      </div>
    );
  }

  const isSuperadmin = account?.role === 'admin' || usersList.length > 0;

  const currentList = page === 'archive' ? archivedTasks : tasks;
  const filteredTasks = currentList.filter((t) => {
    if (page === 'inbox' && t.status !== 'inbox') return false;
    if (page === 'today' && (!isToday(t.due_date) || t.status === 'done')) return false;
    if (page === 'waiting' && t.status !== 'waiting') return false;
    if (page === 'done' && t.status !== 'done') return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

    const query = search.toLocaleLowerCase('tr');
    const combined = `${t.title} ${t.description} ${t.requester} ${t.project} ${(t.tags || []).join(' ')} ${t.userName || ''}`.toLocaleLowerCase('tr');
    return combined.includes(query);
  });

  const pageTitle =
    {
      inbox: 'Gelen kutusu',
      today: 'Bugün',
      all: 'Tüm görevler',
      waiting: 'Beklemede',
      done: 'Tamamlananlar',
      archive: 'Arşiv',
    }[page] || 'Görevler';

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        tasks={tasks}
        dark={dark}
        setDark={setDark}
        account={account}
        mobileOpen={mobileOpen}
        navigate={navigate}
        onLogout={handleLogout}
        closeMobile={() => setMobileOpen(false)}
        isSuperadmin={isSuperadmin}
        selectedUserId={selectedUserId}
        onUserSelect={setSelectedUserId}
        usersList={usersList}
      />

      <main>
        <header className="topbar">
          <button
            className="icon-button menu-button"
            aria-label="Menüyü aç"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>

          <div className="top-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Görevlerde ara…"
            />
            <kbd>Ctrl K</kbd>
          </div>
        </header>

        <div className="content">
          <section className="hero simple-hero">
            <div>
              <h1>{pageTitle}</h1>
              <span>{filteredTasks.length} görev</span>
            </div>
          </section>

          {page !== 'archive' && <QuickAdd onAdd={handleAddTask} />}

          <section className="task-section">
            <div className="section-toolbar">
              <div>
                <h2>{page === 'inbox' ? 'Görevler' : pageTitle}</h2>
              </div>
              <div className="toolbar-actions">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  aria-label="Öncelik filtresi"
                >
                  <option value="all">Tüm öncelikler</option>
                  {Object.entries(PRIORITIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="loading">Görevler yükleniyor…</div>
            ) : page === 'archive' ? (
              <div className="task-list">
                {filteredTasks.map((t) => (
                  <div key={t.id} className="archive-row">
                    <span>{t.title}</span>
                    <button onClick={() => handleRestoreTask(t)}>Geri yükle</button>
                  </div>
                ))}
                {!filteredTasks.length && <EmptyState />}
              </div>
            ) : (
              <TaskList
                tasks={filteredTasks}
                onOpen={setSelectedTask}
                onStatus={handleStatusChange}
                isSuperadmin={isSuperadmin}
              />
            )}
          </section>
        </div>
      </main>

      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSave={handleSaveTask}
        onArchive={handleArchiveTask}
      />

      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
