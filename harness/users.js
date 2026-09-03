/*
 * users.js — multi-user accounts for the portal.
 * Users persist in DATA_DIR/users.json (survives container rebuilds).
 * Passwords: scrypt hash + per-user salt. Roles: admin | member.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || '/data/selfhost-portal/data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function load() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return {}; }
}
function save(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, user) {
  if (!user || !user.salt || !user.hash) return false;
  const { hash } = hashPassword(password, user.salt);
  const a = Buffer.from(hash, 'hex'); const b = Buffer.from(user.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Create the first admin on first run
function ensureInit() {
  const users = load();
  if (Object.keys(users).length === 0) {
    const name = process.env.ADMIN_USER || 'admin';
    const pass = process.env.ADMIN_PASS || 'changeme';
    const { salt, hash } = hashPassword(pass);
    users[name] = { role: 'admin', salt, hash, createdAt: new Date().toISOString() };
    save(users);
    console.log(`[users] created first admin "${name}"` +
      (pass === 'changeme' ? '  (DEFAULT PASSWORD — change it!)' : ''));
  }
}

function authenticate(name, password) {
  const users = load();
  const u = users[String(name || '').toLowerCase()];
  if (!u || !verifyPassword(password, u)) return null;
  return { name: String(name).toLowerCase(), role: u.role || 'member' };
}

function list() {
  return Object.entries(load()).map(([name, u]) => ({
    name, role: u.role || 'member', createdAt: u.createdAt,
  }));
}

function add(name, password, role) {
  name = String(name || '').toLowerCase().trim();
  if (!/^[a-z0-9_.-]{2,32}$/.test(name)) throw new Error('invalid username (2-32 chars, a-z 0-9 _ . -)');
  if (!password || String(password).length < 4) throw new Error('password must be at least 4 characters');
  role = role === 'admin' ? 'admin' : 'member';
  const users = load();
  if (users[name]) throw new Error('user already exists');
  const { salt, hash } = hashPassword(password);
  users[name] = { role, salt, hash, createdAt: new Date().toISOString() };
  save(users);
  return { name, role };
}

function remove(name) {
  const users = load();
  name = String(name || '').toLowerCase();
  if (!users[name]) throw new Error('no such user');
  const admins = Object.values(users).filter(u => (u.role || 'member') === 'admin').length;
  if (users[name].role === 'admin' && admins <= 1) throw new Error('cannot remove the last admin');
  delete users[name];
  save(users);
}

function changePassword(name, newPassword) {
  const users = load();
  name = String(name || '').toLowerCase();
  if (!users[name]) throw new Error('no such user');
  if (!newPassword || String(newPassword).length < 4) throw new Error('password must be at least 4 characters');
  const { salt, hash } = hashPassword(newPassword);
  users[name].salt = salt; users[name].hash = hash;
  save(users);
}

function setRole(name, role) {
  const users = load();
  name = String(name || '').toLowerCase();
  if (!users[name]) throw new Error('no such user');
  if (!['admin', 'member'].includes(role)) throw new Error('bad role');
  const admins = Object.values(users).filter(u => (u.role || 'member') === 'admin').length;
  if (users[name].role === 'admin' && role !== 'admin' && admins <= 1) throw new Error('cannot demote the last admin');
  users[name].role = role;
  save(users);
}

module.exports = { ensureInit, authenticate, list, add, remove, changePassword, setRole };
