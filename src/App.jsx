import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2, Circle, Clock, Plus, Filter, Search, Shield, Lock, Unlock,
  Play, Pause, RotateCcw, Volume2, User, LogOut, ChevronDown, Check,
  AlertCircle, Calendar, Tag, Layers, ArrowRight, LayoutGrid, List,
  Flame, Sparkles, X, Edit3, Trash2, Archive, RefreshCw, Eye, ExternalLink
} from 'lucide-react';

const SSO_LOGIN_URL = 'https://kimlik.thedemir.com/login?redirect=https://odak.thedemir.com';

export default function App() {
  // Session & User State
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usersList, setUsersList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all'); // 'all' or specific userId

  // Tasks & Stats
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({
    total: 0, inbox: 0, todo: 0, progress: 0, waiting: 0, done: 0, urgent: 0, high: 0, due_today: 0, overdue: 0
  });
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'today', 'progress', 'waiting', 'done', 'archived', 'all'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'kanban'
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modals & Drawers
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activityTask, setActivityTask] = useState(null);
  const [activities, setActivities] = useState([]);

  // Pomodoro & Focus State
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState('pomodoro'); // 'pomodoro' (25m), 'shortBreak' (5m), 'longBreak' (15m)
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [activeFocusTask, setActiveFocusTask] = useState(null);
  const pomodoroTimerRef = useRef(null);

  // Security / PIN Lock Screen
  const [isLocked, setIsLocked] = useState(false);
  const [userPin, setUserPin] = useState(() => localStorage.getItem('odak_pin') || '');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');

  // 1. Initial Load & Session Fetch
  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/session');
      if (res.status === 401) {
        setSession(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSession(data);

      const isSuper = data.ssoUser?.isSuperadmin || data.role === 'admin';
      if (isSuper) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Session fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  // 2. Fetch Tasks & Stats based on selected user filter
  const fetchTasksAndStats = async () => {
    try {
      let queryParams = '';
      if (activeTab === 'archived') {
        queryParams = '?archived=true';
      }
      if (selectedUserId && selectedUserId !== 'all') {
        queryParams += (queryParams ? '&' : '?') + `user_id=${encodeURIComponent(selectedUserId)}`;
      }

      const [tasksRes, statsRes] = await Promise.all([
        fetch(`/api/tasks${queryParams}`),
        fetch(`/api/stats${selectedUserId && selectedUserId !== 'all' ? `?user_id=${encodeURIComponent(selectedUserId)}` : ''}`)
      ]);

      if (tasksRes.ok) {
        const taskData = await tasksRes.json();
        setTasks(taskData);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTasksAndStats();
    }
  }, [session, selectedUserId, activeTab]);

  // Pomodoro Timer Logic
  useEffect(() => {
    if (isPomodoroRunning) {
      pomodoroTimerRef.current = setInterval(() => {
        setPomodoroTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(pomodoroTimerRef.current);
            setIsPomodoroRunning(false);
            playNotificationSound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(pomodoroTimerRef.current);
    }
    return () => clearInterval(pomodoroTimerRef.current);
  }, [isPomodoroRunning]);

  const switchPomodoroMode = (mode) => {
    setPomodoroMode(mode);
    setIsPomodoroRunning(false);
    if (mode === 'pomodoro') setPomodoroTimeLeft(25 * 60);
    else if (mode === 'shortBreak') setPomodoroTimeLeft(5 * 60);
    else if (mode === 'longBreak') setPomodoroTimeLeft(15 * 60);
  };

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // PIN Lock Logic
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === userPin) {
      setIsLocked(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('Hatalı PIN Kodu!');
      setPinInput('');
    }
  };

  const saveNewPin = () => {
    if (newPinInput.length >= 4) {
      localStorage.setItem('odak_pin', newPinInput);
      setUserPin(newPinInput);
      setIsSettingPin(false);
      setNewPinInput('');
    }
  };

  const handleLogout = () => {
    document.cookie = 'thedemir_session=; Path=/; Domain=.thedemir.com; Max-Age=0; SameSite=Lax';
    document.cookie = 'thedemir_session=; Path=/; Max-Age=0; SameSite=Lax';
    window.location.href = SSO_LOGIN_URL;
  };

  // Task Operations
  const handleToggleTaskStatus = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTasksAndStats();
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const handleSaveTask = async (taskData) => {
    try {
      if (editingTask && editingTask.id) {
        const res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
        if (res.ok) {
          setIsTaskModalOpen(false);
          setEditingTask(null);
          fetchTasksAndStats();
        }
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
        if (res.ok) {
          setIsTaskModalOpen(false);
          fetchTasksAndStats();
        }
      }
    } catch (err) {
      console.error('Save task error:', err);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Bu görevi arşivlemek istediğinizden emin misiniz?')) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTasksAndStats();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const openActivity = async (task) => {
    setActivityTask(task);
    try {
      const res = await fetch(`/api/tasks/${task.id}/activity`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.error('Activity fetch error:', err);
    }
  };

  // Filter Tasks by Active Tab, Priority & Search
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Tab filter
      if (activeTab === 'inbox' && t.status !== 'inbox') return false;
      if (activeTab === 'today') {
        const today = new Date().toISOString().split('T')[0];
        if (t.due_date !== today && t.priority !== 'urgent') return false;
      }
      if (activeTab === 'progress' && t.status !== 'progress') return false;
      if (activeTab === 'waiting' && t.status !== 'waiting') return false;
      if (activeTab === 'done' && t.status !== 'done') return false;

      // Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchProject = t.project?.toLowerCase().includes(q);
        const matchUser = t.userName?.toLowerCase().includes(q) || t.userEmail?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchProject && !matchUser) return false;
      }

      return true;
    });
  }, [tasks, activeTab, priorityFilter, searchQuery]);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-zinc-400">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="font-mono text-sm tracking-widest text-zinc-300">ODAK YÜKLENİYOR...</p>
      </div>
    );
  }

  // Not Authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
        <div className="w-full max-w-md glass-panel p-8 rounded-2xl text-center border border-zinc-800 shadow-2xl">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Flame className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">The Demir — Odak</h1>
          <p className="text-zinc-400 text-sm mb-8">
            Kişisel görevlerinizi düzenlemek ve derin odaklanma oturumları başlatmak için lütfen Kimlik ile giriş yapın.
          </p>
          <a
            href={SSO_LOGIN_URL}
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20"
          >
            <Shield className="w-5 h-5" />
            Kimlik ile Giriş Yap
          </a>
        </div>
      </div>
    );
  }

  // 🔒 PIN Lock Screen Overlay
  if (isLocked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-zinc-100">
        <div className="w-full max-w-xs glass-panel p-8 rounded-2xl text-center border border-zinc-800 shadow-2xl">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-400">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold mb-1">Odak Kilitli</h2>
          <p className="text-xs text-zinc-400 mb-6">Devam etmek için 4 haneli PIN kodunuzu girin</p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              maxLength={6}
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              className="w-full py-3 text-center text-2xl tracking-[0.5em] font-mono bg-zinc-900 border border-zinc-700 rounded-xl focus:border-amber-500 focus:outline-none"
            />
            {pinError && <p className="text-xs text-red-400 font-medium">{pinError}</p>}
            <button
              type="submit"
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-xl transition flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" /> Kilidi Aç
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isSuperadmin = Boolean(session.ssoUser?.isSuperadmin || session.role === 'admin');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-zinc-950 pb-20 md:pb-6">
      {/* 🏛️ 1. TOP HEADER */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight">Odak</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                  The Demir
                </span>
                {isSuperadmin && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Süperadmin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & User Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Pomodoro Quick Launch */}
            <button
              onClick={() => setIsPomodoroOpen(!isPomodoroOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                isPomodoroRunning
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-mono font-semibold">{formatTime(pomodoroTimeLeft)}</span>
            </button>

            {/* Privacy / PIN Lock Button */}
            {userPin ? (
              <button
                onClick={() => setIsLocked(true)}
                title="Ekranı Kilitle"
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
              >
                <Lock className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setIsSettingPin(true)}
                title="PIN Kodu Belirle"
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-amber-400 transition text-xs flex items-center gap-1"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}

            {/* User Badge & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white"
                style={{ backgroundColor: session.color || '#e45b35' }}
                title={session.email || session.name}
              >
                {session.initials || 'KD'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold leading-tight">{session.name}</div>
                <div className="text-[10px] text-zinc-400 leading-tight truncate max-w-[120px]">{session.email || session.role}</div>
              </div>
              <button
                onClick={handleLogout}
                title="Çıkış Yap"
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition ml-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 👑 2. SUPERADMIN USER SWITCHER BAR */}
        {isSuperadmin && (
          <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-amber-500/10 border-t border-b border-amber-500/20 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 font-bold text-[10px] uppercase tracking-wider">
                  Admin Görünümü
                </span>
                <span className="text-zinc-300 font-medium">
                  {selectedUserId === 'all'
                    ? 'Tüm Organizasyonun Görevleri Listeleniyor'
                    : `Seçili Kullanıcı: ${usersList.find((u) => u.userId === selectedUserId)?.fullName || selectedUserId}`}
                </span>
              </div>

              {/* User Dropdown Selector */}
              <div className="flex items-center gap-2">
                <label className="text-zinc-400">Kullanıcı Filtresi:</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="bg-zinc-900 border border-amber-500/30 text-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 font-medium text-xs cursor-pointer"
                >
                  <option value="all">🏢 Tüm Kullanıcılar (Genel Görünüm)</option>
                  {usersList.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      👤 {u.fullName} {u.email ? `(${u.email})` : ''} — {u.activeTasks} aktif görev
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 🚀 3. MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 flex-1 flex flex-col gap-6">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div
            onClick={() => setActiveTab('inbox')}
            className={`cursor-pointer p-4 rounded-2xl glass-card transition ${
              activeTab === 'inbox' ? 'border-amber-500 bg-amber-500/5' : ''
            }`}
          >
            <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
              <span>Gelen Kutusu</span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <div className="text-2xl font-bold font-mono">{stats.inbox}</div>
          </div>

          <div
            onClick={() => setActiveTab('today')}
            className={`cursor-pointer p-4 rounded-2xl glass-card transition ${
              activeTab === 'today' ? 'border-amber-500 bg-amber-500/5' : ''
            }`}
          >
            <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
              <span>Bugün / Acil</span>
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
            </div>
            <div className="text-2xl font-bold font-mono text-red-400">{stats.due_today + stats.urgent}</div>
          </div>

          <div
            onClick={() => setActiveTab('progress')}
            className={`cursor-pointer p-4 rounded-2xl glass-card transition ${
              activeTab === 'progress' ? 'border-amber-500 bg-amber-500/5' : ''
            }`}
          >
            <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
              <span>Devam Eden</span>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400">{stats.progress}</div>
          </div>

          <div
            onClick={() => setActiveTab('waiting')}
            className={`cursor-pointer p-4 rounded-2xl glass-card transition ${
              activeTab === 'waiting' ? 'border-amber-500 bg-amber-500/5' : ''
            }`}
          >
            <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
              <span>Beklemede</span>
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            </div>
            <div className="text-2xl font-bold font-mono text-purple-400">{stats.waiting}</div>
          </div>

          <div
            onClick={() => setActiveTab('done')}
            className={`cursor-pointer p-4 rounded-2xl glass-card transition ${
              activeTab === 'done' ? 'border-amber-500 bg-amber-500/5' : ''
            }`}
          >
            <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
              <span>Tamamlanan</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{stats.done}</div>
          </div>

          <div
            onClick={() => setActiveTab('all')}
            className={`cursor-pointer p-4 rounded-2xl glass-card transition ${
              activeTab === 'all' ? 'border-amber-500 bg-amber-500/5' : ''
            }`}
          >
            <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
              <span>Toplam Görev</span>
              <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
            </div>
            <div className="text-2xl font-bold font-mono">{stats.total}</div>
          </div>
        </div>

        {/* CONTROLS & FILTER BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'inbox', label: 'Gelen Kutusu', count: stats.inbox },
              { id: 'today', label: 'Bugün', count: stats.due_today },
              { id: 'progress', label: 'Devam Eden', count: stats.progress },
              { id: 'waiting', label: 'Beklemede', count: stats.waiting },
              { id: 'done', label: 'Tamamlanan', count: stats.done },
              { id: 'archived', label: 'Arşiv' },
              { id: 'all', label: 'Tümü', count: stats.total }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      activeTab === tab.id ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search, Priority & View Mode Toggle */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Görevlerde ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-zinc-200"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('list')}
                title="Liste Görünümü"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'list' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                title="Kanban Panosu"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'kanban' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Add Task Button */}
            <button
              onClick={() => {
                setEditingTask(null);
                setIsTaskModalOpen(true);
              }}
              className="py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Görev Ekle</span>
            </button>
          </div>
        </div>

        {/* 📋 4. TASK LIST / KANBAN VIEW */}
        {viewMode === 'list' ? (
          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl p-8 text-zinc-500">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30 text-amber-500" />
                <p className="text-sm font-medium text-zinc-400">Bu görünümde hiçbir görev bulunamadı.</p>
                <p className="text-xs text-zinc-600 mt-1">Yeni bir görev ekleyerek çalışmaya başlayabilirsiniz.</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`group glass-card p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-zinc-700 ${
                    task.status === 'done' ? 'opacity-60 bg-zinc-900/30' : ''
                  }`}
                >
                  {/* Checkbox + Title + Metadata */}
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => handleToggleTaskStatus(task)}
                      className="mt-0.5 text-zinc-500 hover:text-amber-500 transition"
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-medium text-sm text-zinc-100 ${
                            task.status === 'done' ? 'line-through text-zinc-400' : ''
                          }`}
                        >
                          {task.title}
                        </span>

                        {/* Priority Badge */}
                        {task.priority === 'urgent' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                            ACİL
                          </span>
                        )}
                        {task.priority === 'high' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            YÜKSEK
                          </span>
                        )}

                        {/* Project Tag */}
                        {task.project && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {task.project}
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{task.description}</p>
                      )}

                      {/* Footer Info: User, Date, Tags */}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500 flex-wrap">
                        {isSuperadmin && task.userName && (
                          <span className="flex items-center gap-1 text-amber-400/80 font-medium">
                            <User className="w-3 h-3" />
                            {task.userName}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-zinc-400">
                            <Calendar className="w-3 h-3" />
                            {task.due_date}
                          </span>
                        )}
                        {task.estimated_minutes && (
                          <span className="flex items-center gap-1 text-zinc-400">
                            <Clock className="w-3 h-3" />
                            {task.estimated_minutes} dk
                          </span>
                        )}
                        {task.tags?.map((tag) => (
                          <span key={tag} className="text-zinc-400 bg-zinc-800/80 px-1.5 py-0.2 rounded text-[10px]">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center opacity-90 sm:opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => {
                        setActiveFocusTask(task);
                        setIsPomodoroOpen(true);
                        switchPomodoroMode('pomodoro');
                      }}
                      title="Bu göreve odaklan (Pomodoro)"
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 text-zinc-400 hover:text-amber-400 transition text-xs flex items-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openActivity(task)}
                      title="Geçmiş & Aktivite"
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingTask(task);
                        setIsTaskModalOpen(true);
                      }}
                      title="Düzenle"
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      title="Arşivle"
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* KANBAN BOARD VIEW */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4">
            {[
              { status: 'inbox', label: '📥 Gelen Kutusu', color: 'border-blue-500/40' },
              { status: 'todo', label: '📋 Yapılacaklar', color: 'border-zinc-500/40' },
              { status: 'progress', label: '🚀 Devam Eden', color: 'border-amber-500/40' },
              { status: 'done', label: '✅ Tamamlanan', color: 'border-emerald-500/40' }
            ].map((col) => {
              const colTasks = filteredTasks.filter((t) => (col.status === 'todo' ? t.status === 'todo' || t.status === 'waiting' : t.status === col.status));
              return (
                <div key={col.status} className="bg-zinc-900/40 rounded-2xl p-3 border border-zinc-800/80 flex flex-col gap-3 min-h-[400px]">
                  <div className={`flex items-center justify-between pb-2 border-b ${col.color}`}>
                    <span className="font-semibold text-xs text-zinc-300">{col.label}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1">
                    {colTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition cursor-pointer"
                        onClick={() => {
                          setEditingTask(task);
                          setIsTaskModalOpen(true);
                        }}
                      >
                        <div className="font-medium text-xs text-zinc-100 mb-1">{task.title}</div>
                        {task.description && <p className="text-[11px] text-zinc-400 line-clamp-2 mb-2">{task.description}</p>}
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span>{task.project || 'Genel'}</span>
                          {task.due_date && <span>{task.due_date}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ⏱️ 5. POMODORO / DEEP WORK MODAL DRAWER */}
      {isPomodoroOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-3xl border border-zinc-800 shadow-2xl relative">
            <button
              onClick={() => setIsPomodoroOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 p-2"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-6 bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800 inline-flex mx-auto">
                <button
                  onClick={() => switchPomodoroMode('pomodoro')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    pomodoroMode === 'pomodoro' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Odak (25m)
                </button>
                <button
                  onClick={() => switchPomodoroMode('shortBreak')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    pomodoroMode === 'shortBreak' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Kısa Mola (5m)
                </button>
                <button
                  onClick={() => switchPomodoroMode('longBreak')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    pomodoroMode === 'longBreak' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Uzun Mola (15m)
                </button>
              </div>

              {/* Huge Timer Display */}
              <div className="text-6xl sm:text-7xl font-mono font-extrabold tracking-wider my-6 text-amber-400">
                {formatTime(pomodoroTimeLeft)}
              </div>

              {/* Active Task Info */}
              {activeFocusTask ? (
                <div className="bg-zinc-900/80 p-3 rounded-xl border border-amber-500/20 text-xs mb-6 text-zinc-300">
                  <span className="text-zinc-500 block text-[10px] uppercase font-mono">Odaklanılan Görev:</span>
                  <span className="font-semibold text-amber-300">{activeFocusTask.title}</span>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 mb-6 font-mono">Derin odaklanma modu devrede</p>
              )}

              {/* Timer Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-zinc-950 transition shadow-lg ${
                    isPomodoroRunning
                      ? 'bg-amber-400 hover:bg-amber-300 shadow-amber-500/20'
                      : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30'
                  }`}
                >
                  {isPomodoroRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
                <button
                  onClick={() => switchPomodoroMode(pomodoroMode)}
                  title="Sıfırla"
                  className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ➕ 6. TASK CREATE / EDIT MODAL */}
      {isTaskModalOpen && (
        <TaskFormModal
          task={editingTask}
          onClose={() => {
            setIsTaskModalOpen(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
        />
      )}

      {/* 📜 7. ACTIVITY HISTORY MODAL */}
      {activityTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-3xl border border-zinc-800 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-sm text-zinc-100">Görev Geçmişi</h3>
                <p className="text-xs text-zinc-400 truncate max-w-sm">{activityTask.title}</p>
              </div>
              <button onClick={() => setActivityTask(null)} className="p-2 text-zinc-400 hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {activities.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">Kayıtlı aktivite bulunamadı.</p>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-zinc-300">{act.actor_name || 'Kullanıcı'}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{act.created_at}</span>
                    </div>
                    <p className="text-zinc-400">
                      <span className="font-medium text-amber-400 uppercase text-[10px] mr-1">{act.action}</span>
                      {act.detail}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔐 8. SET NEW PIN MODAL */}
      {isSettingPin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs glass-panel p-6 rounded-2xl border border-zinc-800 shadow-2xl text-center">
            <Shield className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <h3 className="font-bold text-sm mb-1">4 Haneli PIN Belirle</h3>
            <p className="text-xs text-zinc-400 mb-4">Ortak cihazlarda görevlerinizi tek tıkla kilitleyin</p>
            <input
              type="password"
              maxLength={6}
              value={newPinInput}
              onChange={(e) => setNewPinInput(e.target.value)}
              placeholder="1234"
              className="w-full py-2.5 text-center text-xl tracking-[0.4em] font-mono bg-zinc-900 border border-zinc-700 rounded-xl mb-4 focus:border-amber-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsSettingPin(false)}
                className="flex-1 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-400"
              >
                İptal
              </button>
              <button
                onClick={saveNewPin}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 9. MOBILE BOTTOM NAVIGATION */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 px-4 py-2 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex flex-col items-center gap-1 text-[10px] ${activeTab === 'inbox' ? 'text-amber-400' : 'text-zinc-500'}`}
        >
          <Layers className="w-5 h-5" />
          <span>Görevler</span>
        </button>
        <button
          onClick={() => setActiveTab('today')}
          className={`flex flex-col items-center gap-1 text-[10px] ${activeTab === 'today' ? 'text-amber-400' : 'text-zinc-500'}`}
        >
          <Calendar className="w-5 h-5" />
          <span>Bugün</span>
        </button>
        <button
          onClick={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
          className="w-10 h-10 -mt-4 bg-amber-500 rounded-full flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/30"
        >
          <Plus className="w-6 h-6" />
        </button>
        <button
          onClick={() => setIsPomodoroOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] text-zinc-500 hover:text-amber-400"
        >
          <Clock className="w-5 h-5" />
          <span>Odak</span>
        </button>
        <button
          onClick={() => (userPin ? setIsLocked(true) : setIsSettingPin(true))}
          className="flex flex-col items-center gap-1 text-[10px] text-zinc-500 hover:text-amber-400"
        >
          <Lock className="w-5 h-5" />
          <span>Kilit</span>
        </button>
      </nav>
    </div>
  );
}

// 📝 Task Creation & Edit Form Component
function TaskFormModal({ task, onClose, onSave }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'inbox');
  const [priority, setPriority] = useState(task?.priority || 'normal');
  const [project, setProject] = useState(task?.project || '');
  const [requester, setRequester] = useState(task?.requester || '');
  const [dueDate, setDueDate] = useState(task?.due_date || '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimated_minutes || '');
  const [tags, setTags] = useState((task?.tags || []).join(', '));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      project: project.trim(),
      requester: requester.trim(),
      due_date: dueDate || null,
      estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg glass-panel p-6 rounded-3xl border border-zinc-800 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 p-2">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-base font-bold text-zinc-100 mb-4">
          {task ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-400 font-medium mb-1">Görev Başlığı *</label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Yeni API endpoint'lerini hazırla"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Açıklama</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Görev detayları, notlar..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="inbox">Gelen Kutusu</option>
                <option value="todo">Yapılacak</option>
                <option value="progress">Devam Eden</option>
                <option value="waiting">Beklemede</option>
                <option value="done">Tamamlandı</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Öncelik</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="low">Düşük</option>
                <option value="normal">Normal</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Proje / Kategori</label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="Örn: The Demir Hub"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Son Tarih</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Tahmini Süre (dk)</label>
              <input
                type="number"
                min="0"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="45"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Etiketler (virgülle ayırın)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="frontend, backend, sso"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium rounded-xl transition"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-xl transition shadow-sm"
            >
              {task ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
