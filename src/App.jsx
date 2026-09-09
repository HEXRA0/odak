import React, { useState, useEffect, useMemo } from 'react';
import {
  Check, Archive, ArrowRight, CalendarDays, ChevronRight, CircleDot,
  Crown, Inbox, LogOut, Menu, Moon, Plus, Search, Sun, Timer,
  UserPlus, X, Zap
} from 'lucide-react';

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

const COLORS = ['#e45b35', '#5d76a9', '#4d8a70', '#8c65a8', '#c67b36', '#b64d68', '#317c83'];

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

async function apiFetch(url, options = {}, profileId) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (profileId) {
    headers['X-Profile-Id'] = String(profileId);
  }
  const res = await fetch(url, { ...options, headers });
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
    <span className={`avatar ${size}`} style={{ background: profile.color }} title={profile.name}>
      {profile.initials}
    </span>
  );
}

function ProfilePicker({ profiles, onSelect, onCreate }) {
  return (
    <div className="profile-picker">
      <div className="picker-brand">
        <Brand />
      </div>
      <section>
        <h1>Kim çalışıyor?</h1>
        <p>Profilini seç.</p>
        <div className="profile-grid">
          {profiles.map((p) => (
            <button key={p.id} className="profile-card" onClick={() => onSelect(p)}>
              <Avatar profile={p} size="large" />
              <strong>{p.name}</strong>
              {p.role === 'admin' && (
                <span>
                  <Crown size={12} /> Yönetici
                </span>
              )}
            </button>
          ))}
          <button className="profile-card add-profile" onClick={onCreate}>
            <span className="add-avatar">
              <Plus size={27} />
            </span>
            <strong>Profil ekle</strong>
          </button>
        </div>
      </section>
    </div>
  );
}

function NewProfileModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [color, setColor] = useState(COLORS[1]);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="profile-modal">
        <header>
          <div>
            <h2>Yeni profil oluştur</h2>
            <p>Bu profil görev alabilir ve görev paylaşabilir.</p>
          </div>
          <button className="icon-button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onCreate({ name: name.trim(), role, color });
          }}
        >
          <label>
            Profil adı
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ayşe Yılmaz"
            />
          </label>
          <label>
            Yetki
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">Kullanıcı — kendi ve paylaşılan görevleri görür</option>
              <option value="admin">Admin — tüm hesapların görevlerini görür</option>
            </select>
          </label>
          <label>
            Profil rengi
            <div className="color-options">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Renk ${c}`}
                  className={color === c ? 'selected' : ''}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </label>
          <button className="primary" type="submit">
            <UserPlus size={16} /> Profili oluştur
          </button>
        </form>
      </div>
    </>
  );
}

function QuickAdd({ onAdd, profiles, activeProfile }) {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState(String(activeProfile.id));

  useEffect(() => {
    setAssigneeId(String(activeProfile.id));
  }, [activeProfile.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (title.trim()) {
      await onAdd({
        ...DEFAULT_TASK,
        title: title.trim(),
        assignee_id: Number(assigneeId),
      });
      setTitle('');
      setAssigneeId(String(activeProfile.id));
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
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        aria-label="Görevi ata"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id === activeProfile.id ? 'Kendime' : p.name}
          </option>
        ))}
      </select>
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
  activeProfile,
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
            <Avatar profile={activeProfile} />
            <div>
              <strong>{activeProfile.name}</strong>
              <small>
                {activeProfile.role === 'admin' || isSuperadmin
                  ? 'Admin · tüm görevler'
                  : 'Kullanıcı hesabı'}
              </small>
            </div>
            <button className="logout-button" onClick={onLogout} title="Çıkış yap">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function TaskCard({ task, onOpen, onStatus, compact = false, activeProfile }) {
  const isShared = task.created_by !== task.assignee_id || task.assignee_id !== activeProfile.id;

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
          {isShared && (
            <span className="assignee-meta">
              <Avatar profile={task.assignee} size="tiny" />
              {task.assignee?.name}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="task-arrow" size={17} />
    </article>
  );
}

function TaskList({ tasks, onOpen, onStatus, activeProfile }) {
  return (
    <div className="task-list">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onOpen={onOpen}
          onStatus={onStatus}
          activeProfile={activeProfile}
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

function TaskDrawer({ task, profiles, profileId, onClose, onSave, onArchive }) {
  const [form, setForm] = useState(task || DEFAULT_TASK);
  const [tagsStr, setTagsStr] = useState((task?.tags || []).join(', '));
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    setForm(task || DEFAULT_TASK);
    setTagsStr((task?.tags || []).join(', '));
    if (task) {
      apiFetch(`/api/tasks/${task.id}/activity`, {}, profileId)
        .then(setActivities)
        .catch(() => setActivities([]));
    }
  }, [task, profileId]);

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
              assignee_id: Number(form.assignee_id),
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
              <small>Oluşturan</small>
              <Avatar profile={task.creator} size="tiny" />
              {task.creator?.name}
            </span>
            <ArrowRight size={14} />
            <span>
              <small>Atanan</small>
              <Avatar profile={task.assignee} size="tiny" />
              {task.assignee?.name}
            </span>
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
              Atanan kişi
              <select
                value={form.assignee_id}
                onChange={(e) => update('assignee_id', Number(e.target.value))}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
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
          </div>

          <details className="advanced-fields">
            <summary>Gelişmiş bilgiler</summary>
            <div className="form-grid">
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
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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

  // Süperadmin & Kullanıcı Sistemi
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

  const selectProfile = (p) => {
    localStorage.setItem('activeProfileId', p.id);
    setActiveProfile(p);
    setSelectedTask(null);
    window.history.pushState({}, '', PAGES.inbox);
    setPage('inbox');
  };

  const handleLogout = () => {
    localStorage.removeItem('activeProfileId');
    document.cookie = 'thedemir_session=; Path=/; Domain=.thedemir.com; Max-Age=0; SameSite=Lax';
    document.cookie = 'thedemir_session=; Path=/; Max-Age=0; SameSite=Lax';
    setActiveProfile(null);
    setTasks([]);
    setArchivedTasks([]);
    window.history.pushState({}, '', '/profiller');
  };

  // Initial Load
  useEffect(() => {
    apiFetch('/api/profiles')
      .then((profs) => {
        setProfiles(profs);
        const storedId = Number(localStorage.getItem('activeProfileId'));
        const found = profs.find((p) => p.id === storedId);
        if (found) {
          setActiveProfile(found);
          if (!PATH_TO_PAGE[window.location.pathname]) {
            window.history.replaceState({}, '', PAGES.inbox);
          }
        } else if (profs.length > 0) {
          setActiveProfile(profs[0]);
          localStorage.setItem('activeProfileId', profs[0].id);
        } else {
          localStorage.removeItem('activeProfileId');
          window.history.replaceState({}, '', '/profiller');
        }
      })
      .catch((err) => showToast(err.message))
      .finally(() => setLoading(false));

    // Fetch users for superadmin filter if available
    apiFetch('/api/users')
      .then(setUsersList)
      .catch(() => setUsersList([]));
  }, []);

  // History popstate
  useEffect(() => {
    const onPop = () => {
      const p = PATH_TO_PAGE[window.location.pathname];
      if (p) setPage(p);
      if (window.location.pathname === '/profiller') setActiveProfile(null);
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
    if (activeProfile) {
      setLoading(true);
      try {
        let q = '';
        if (selectedUserId && selectedUserId !== 'all') {
          q = `?user_id=${encodeURIComponent(selectedUserId)}`;
        }
        setTasks(await apiFetch(`/api/tasks${q}`, {}, activeProfile.id));
        if (page === 'archive') {
          setArchivedTasks(
            await apiFetch(
              `/api/tasks?archived=true${
                selectedUserId && selectedUserId !== 'all' ? `&user_id=${encodeURIComponent(selectedUserId)}` : ''
              }`,
              {},
              activeProfile.id
            )
          );
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
  }, [page, activeProfile?.id, selectedUserId]);

  async function handleCreateProfile(data) {
    try {
      const created = await apiFetch('/api/profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const all = await apiFetch('/api/profiles');
      setProfiles(all);
      setIsProfileModalOpen(false);
      selectProfile(created);
      showToast(`${created.name} profili oluşturuldu.`);
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleAddTask(taskData) {
    try {
      const created = await apiFetch(
        '/api/tasks',
        { method: 'POST', body: JSON.stringify(taskData) },
        activeProfile.id
      );
      setTasks((prev) => [created, ...prev]);
      showToast(
        created.assignee_id === activeProfile.id
          ? 'Görev gelen kutusuna eklendi.'
          : `Görev ${created.assignee?.name || ''} profiline atandı.`
      );
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleSaveTask(id, updates) {
    try {
      const updated = await apiFetch(
        `/api/tasks/${id}`,
        { method: 'PATCH', body: JSON.stringify(updates) },
        activeProfile.id
      );
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setSelectedTask((prev) => (prev?.id === id ? updated : null));
      showToast('Değişiklikler kaydedildi.');
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
      await apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE' }, activeProfile.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setSelectedTask(null);
      showToast('Görev arşivlendi.');
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleRestoreTask(task) {
    try {
      await apiFetch(
        `/api/tasks/${task.id}`,
        { method: 'PATCH', body: JSON.stringify({ archived: false }) },
        activeProfile.id
      );
      setArchivedTasks((prev) => prev.filter((t) => t.id !== task.id));
      showToast('Görev geri yüklendi.');
    } catch (err) {
      showToast(err.message);
    }
  }

  if (!activeProfile) {
    return (
      <>
        {loading ? (
          <div className="splash">
            <Brand />
            <span>Yükleniyor…</span>
          </div>
        ) : (
          <ProfilePicker
            profiles={profiles}
            onSelect={selectProfile}
            onCreate={() => setIsProfileModalOpen(true)}
          />
        )}
        {isProfileModalOpen && (
          <NewProfileModal
            onClose={() => setIsProfileModalOpen(false)}
            onCreate={handleCreateProfile}
          />
        )}
        {toast && (
          <div className="toast picker-toast">
            <Check size={16} />
            {toast}
          </div>
        )}
      </>
    );
  }

  const isSuperadmin = activeProfile.role === 'admin' || usersList.length > 0;

  const currentList = page === 'archive' ? archivedTasks : tasks;
  const filteredTasks = currentList.filter((t) => {
    if (page === 'inbox' && t.status !== 'inbox') return false;
    if (page === 'today' && (!isToday(t.due_date) || t.status === 'done')) return false;
    if (page === 'waiting' && t.status !== 'waiting') return false;
    if (page === 'done' && t.status !== 'done') return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

    const query = search.toLocaleLowerCase('tr');
    const combined = `${t.title} ${t.description} ${t.requester} ${t.project} ${(t.tags || []).join(' ')} ${t.assignee?.name || ''}`.toLocaleLowerCase('tr');
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
        activeProfile={activeProfile}
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

          {page !== 'archive' && (
            <QuickAdd
              onAdd={handleAddTask}
              profiles={profiles}
              activeProfile={activeProfile}
            />
          )}

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
                activeProfile={activeProfile}
              />
            )}
          </section>
        </div>
      </main>

      <TaskDrawer
        task={selectedTask}
        profiles={profiles}
        profileId={activeProfile.id}
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
