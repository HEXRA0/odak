import crypto from 'node:crypto';
import http from 'node:http';
import { db, rowToTask } from '../server/db.mjs';

const JWT_SECRET = 'thedemir-super-secret-jwt-key-2026-change-in-production';

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

const user1Token = makeJwt({ userId: 'usr_user1', email: 'user1@thedemir.com', fullName: 'Ali Demir', isSuperadmin: false });
const user2Token = makeJwt({ userId: 'usr_user2', email: 'user2@thedemir.com', fullName: 'Ayşe Demir', isSuperadmin: false });
const adminToken = makeJwt({ userId: 'usr_admin', email: 'admin@thedemir.com', fullName: 'Halil İbrahim Demir', isSuperadmin: true });

async function runTests() {
  console.log('--- ODAK SSO & TASK ISOLATION TESTS ---');
  
  // Clean test data
  db.prepare("DELETE FROM tasks WHERE user_id IN ('usr_user1', 'usr_user2', 'usr_admin')").run();
  db.prepare("DELETE FROM profiles WHERE sso_user_id IN ('usr_user1', 'usr_user2', 'usr_admin')").run();

  // Test server start on temporary port
  process.env.PORT = '5199';
  const serverModule = await import('../server/index.mjs');

  const request = (method, path, token, body = null) => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5199,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });

  // 1. User1 creates task
  const createRes1 = await request('POST', '/api/tasks', user1Token, { title: 'User 1 Gizli Görevi', priority: 'high' });
  console.log('1. User1 Task Create:', createRes1.status === 201 && createRes1.body.title === 'User 1 Gizli Görevi' ? 'PASSED ✅' : 'FAILED ❌', createRes1.body);
  const task1Id = createRes1.body.id;

  // 2. User2 creates task
  const createRes2 = await request('POST', '/api/tasks', user2Token, { title: 'User 2 Görevi', priority: 'normal' });
  console.log('2. User2 Task Create:', createRes2.status === 201 && createRes2.body.title === 'User 2 Görevi' ? 'PASSED ✅' : 'FAILED ❌');
  const task2Id = createRes2.body.id;

  // 3. User1 lists tasks (Should only see task 1, NOT task 2)
  const listRes1 = await request('GET', '/api/tasks', user1Token);
  const u1Tasks = listRes1.body;
  const user1SeesOnlyOwn = u1Tasks.every(t => t.userId === 'usr_user1') && u1Tasks.some(t => t.id === task1Id) && !u1Tasks.some(t => t.id === task2Id);
  console.log('3. User1 Strict Isolation (sees only own task):', user1SeesOnlyOwn ? 'PASSED ✅' : 'FAILED ❌', `Count: ${u1Tasks.length}`);

  // 4. User2 lists tasks (Should only see task 2, NOT task 1)
  const listRes2 = await request('GET', '/api/tasks', user2Token);
  const u2Tasks = listRes2.body;
  const user2SeesOnlyOwn = u2Tasks.every(t => t.userId === 'usr_user2') && u2Tasks.some(t => t.id === task2Id) && !u2Tasks.some(t => t.id === task1Id);
  console.log('4. User2 Strict Isolation (sees only own task):', user2SeesOnlyOwn ? 'PASSED ✅' : 'FAILED ❌', `Count: ${u2Tasks.length}`);

  // 5. User2 tries to edit User1's task (Should be 403 Forbidden)
  const hackRes = await request('PATCH', `/api/tasks/${task1Id}`, user2Token, { title: 'Hacked Task' });
  console.log('5. Cross-user unauthorized edit blocked (403):', hackRes.status === 403 ? 'PASSED ✅' : 'FAILED ❌', `Status: ${hackRes.status}`);

  // 6. Superadmin lists all tasks (Should see both task 1 and task 2)
  const adminList = await request('GET', '/api/tasks', adminToken);
  const adminSeesAll = adminList.body.some(t => t.id === task1Id) && adminList.body.some(t => t.id === task2Id);
  console.log('6. Superadmin Global View (sees all tasks):', adminSeesAll ? 'PASSED ✅' : 'FAILED ❌', `Total tasks: ${adminList.body.length}`);

  // 7. Superadmin filters by User1 (?user_id=usr_user1)
  const adminFilter1 = await request('GET', '/api/tasks?user_id=usr_user1', adminToken);
  const adminFilterCorrect = adminFilter1.body.every(t => t.userId === 'usr_user1') && adminFilter1.body.some(t => t.id === task1Id);
  console.log('7. Superadmin Filter by User1 (?user_id=usr_user1):', adminFilterCorrect ? 'PASSED ✅' : 'FAILED ❌', `Count: ${adminFilter1.body.length}`);

  // 8. Superadmin user picker list (/api/users)
  const usersList = await request('GET', '/api/users', adminToken);
  console.log('8. Superadmin Users List (/api/users):', usersList.status === 200 && usersList.body.length >= 2 ? 'PASSED ✅' : 'FAILED ❌', `Users found: ${usersList.body.length}`);

  // 9. Stats isolation
  const stats1 = await request('GET', '/api/stats', user1Token);
  const statsAdmin = await request('GET', '/api/stats', adminToken);
  console.log('9. Stats Isolation:', stats1.body.total === 1 && statsAdmin.body.total >= 2 ? 'PASSED ✅' : 'FAILED ❌', { user1Total: stats1.body.total, adminTotal: statsAdmin.body.total });

  console.log('--- ALL BACKEND AUTH & ISOLATION TESTS COMPLETE ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
