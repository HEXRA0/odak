import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const databasePath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve('data', 'tasks.db');
const dataDir = path.dirname(databasePath);
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#e45b35',
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'inbox' CHECK(status IN ('inbox','todo','progress','waiting','done')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
    requester TEXT NOT NULL DEFAULT '',
    project TEXT NOT NULL DEFAULT '',
    due_date TEXT,
    estimated_minutes INTEGER,
    tags TEXT NOT NULL DEFAULT '[]',
    created_by INTEGER REFERENCES profiles(id),
    assignee_id INTEGER REFERENCES profiles(id),
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    actor_id INTEGER REFERENCES profiles(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived);
`);

const taskColumns = new Set(db.prepare('PRAGMA table_info(tasks)').all().map((column) => column.name));
if (!taskColumns.has('created_by')) db.exec('ALTER TABLE tasks ADD COLUMN created_by INTEGER REFERENCES profiles(id)');
if (!taskColumns.has('assignee_id')) db.exec('ALTER TABLE tasks ADD COLUMN assignee_id INTEGER REFERENCES profiles(id)');
const activityColumns = new Set(db.prepare('PRAGMA table_info(activity)').all().map((column) => column.name));
if (!activityColumns.has('actor_id')) db.exec('ALTER TABLE activity ADD COLUMN actor_id INTEGER REFERENCES profiles(id)');

if (db.prepare('SELECT COUNT(*) AS count FROM profiles').get().count === 0) {
  db.prepare("INSERT INTO profiles (name, initials, color, role) VALUES (?, ?, ?, 'admin')").run('Yönetici', 'YÖ', '#e45b35');
}
const defaultProfileId = db.prepare("SELECT id FROM profiles ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, id LIMIT 1").get().id;
db.prepare('UPDATE tasks SET created_by = ? WHERE created_by IS NULL').run(defaultProfileId);
db.prepare('UPDATE tasks SET assignee_id = ? WHERE assignee_id IS NULL').run(defaultProfileId);
db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by); CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);');

export function rowToTask(row) {
  if (!row) return null;
  const task = {
    ...row,
    archived: Boolean(row.archived),
    tags: JSON.parse(row.tags || '[]'),
    creator: row.creator_name ? { id: row.created_by, name: row.creator_name, initials: row.creator_initials, color: row.creator_color } : null,
    assignee: row.assignee_name ? { id: row.assignee_id, name: row.assignee_name, initials: row.assignee_initials, color: row.assignee_color } : null,
  };
  delete task.creator_name;
  delete task.creator_initials;
  delete task.creator_color;
  delete task.assignee_name;
  delete task.assignee_initials;
  delete task.assignee_color;
  return task;
}
