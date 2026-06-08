/**
 * 万鑫安全培训报名系统 - 数据库模块
 * 使用 SQLite 存储报名数据
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'registrations.db');

// 确保 data 目录存在
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

/**
 * 获取数据库实例（单例）
 */
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

/**
 * 初始化数据库表结构
 */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      education TEXT NOT NULL,
      person_type TEXT NOT NULL,
      id_card TEXT NOT NULL,
      work_unit TEXT NOT NULL,
      credit_code TEXT NOT NULL,
      phone TEXT NOT NULL,
      street TEXT NOT NULL,
      portrait_path TEXT,
      id_front_path TEXT,
      id_back_path TEXT,
      submit_time TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
      status TEXT DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_registrations_phone ON registrations(phone);
    CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at);
  `);
}

/**
 * 生成报名编号
 * 格式：WX + 年月日 + 4位序号
 */
function generateRegNo() {
  const now = new Date();
  const dateStr = now.getFullYear()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');

  const stmt = getDb().prepare(
    `SELECT COUNT(*) as count FROM registrations WHERE registration_no LIKE ?`
  );
  const todayPrefix = `WX${dateStr}%`;
  const row = stmt.get(todayPrefix);
  const seq = (row.count + 1).toString().padStart(4, '0');

  return `WX${dateStr}${seq}`;
}

/**
 * 保存报名数据
 */
function saveRegistration(data) {
  const regNo = generateRegNo();

  const stmt = getDb().prepare(`
    INSERT INTO registrations (
      registration_no, name, gender, education, person_type,
      id_card, work_unit, credit_code, phone, street,
      portrait_path, id_front_path, id_back_path, submit_time
    ) VALUES (
      @regNo, @name, @gender, @education, @personType,
      @idCard, @workUnit, @creditCode, @phone, @street,
      @portraitPath, @idFrontPath, @idBackPath, @submitTime
    )
  `);

  stmt.run({
    regNo,
    name: data.name,
    gender: data.gender,
    education: data.education,
    personType: data.personType,
    idCard: data.idCard,
    workUnit: data.workUnit,
    creditCode: data.creditCode,
    phone: data.phone,
    street: data.street,
    portraitPath: data.portraitPath || null,
    idFrontPath: data.idFrontPath || null,
    idBackPath: data.idBackPath || null,
    submitTime: data.submitTime || new Date().toISOString(),
  });

  return regNo;
}

/**
 * 查询所有报名记录
 */
function getAllRegistrations(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const db = getDb();

  const countRow = db.prepare('SELECT COUNT(*) as total FROM registrations').get();
  const rows = db.prepare(
    'SELECT * FROM registrations ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(pageSize, offset);

  return {
    total: countRow.total,
    page,
    pageSize,
    totalPages: Math.ceil(countRow.total / pageSize),
    data: rows,
  };
}

/**
 * 根据报名编号查询
 */
function getByRegNo(regNo) {
  return getDb().prepare('SELECT * FROM registrations WHERE registration_no = ?').get(regNo);
}

/**
 * 根据手机号查询
 */
function getByPhone(phone) {
  return getDb().prepare(
    'SELECT * FROM registrations WHERE phone = ? ORDER BY created_at DESC'
  ).all(phone);
}

/**
 * 更新报名状态
 */
function updateStatus(regNo, status) {
  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new Error(`无效的状态值: ${status}`);
  }
  const result = getDb().prepare(
    'UPDATE registrations SET status = ? WHERE registration_no = ?'
  ).run(status, regNo);
  return result.changes > 0;
}

module.exports = {
  getDb,
  saveRegistration,
  getAllRegistrations,
  getByRegNo,
  getByPhone,
  updateStatus,
};
