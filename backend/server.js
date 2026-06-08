/**
 * =============================================
 * 台州万鑫安全技术咨询有限公司
 * 安全培训报名系统 - 后端服务
 * =============================================
 *
 * 技术栈：Node.js + Express + SQLite
 * 部署方式：支持 Render / Railway / VPS
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const db = require('./db');

// =============================================
// 配置
// =============================================
const CONFIG = {
  port: process.env.PORT || 3001,
  // CORS 允许的前端地址列表
  allowedOrigins: (
    process.env.ALLOWED_ORIGINS ||
    'https://iris216315.github.io,http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500'
  ).split(',').map(s => s.trim()),
  // 上传文件大小限制 (50MB)
  maxFileSize: 50 * 1024 * 1024,
  // 图片保存目录
  uploadDir: path.join(__dirname, 'uploads'),
  // 是否启用管理员密码保护
  adminPassword: process.env.ADMIN_PASSWORD || 'wanxin2026',
};

// 确保上传目录存在
if (!fs.existsSync(CONFIG.uploadDir)) {
  fs.mkdirSync(CONFIG.uploadDir, { recursive: true });
}

// =============================================
// 初始化 Express
// =============================================
const app = express();

// 安全头
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // 允许内联脚本和图片
}));

// CORS
app.use(cors({
  origin: function (origin, callback) {
    // 允许无 origin 的请求（如 curl、Postman）
    if (!origin) return callback(null, true);
    if (CONFIG.allowedOrigins.includes('*')) return callback(null, true);
    if (CONFIG.allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS 策略不允许此来源: ' + origin));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400,
}));

// JSON 请求体解析（支持大 JSON，用于 base64 图片）
app.use(express.json({
  limit: CONFIG.maxFileSize,
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));

// =============================================
// 速率限制
// =============================================
const submitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10,
  message: { success: false, message: '提交过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// =============================================
// 辅助函数
// =============================================

/**
 * 保存 Base64 图片到文件
 * @returns {string|null} 相对路径
 */
function saveBase64Image(base64Str, prefix) {
  if (!base64Str) return null;

  // 匹配 data:image/...;base64, 前缀
  const matches = base64Str.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return null;

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const data = matches[2];

  // 生成唯一文件名
  const fileName = `${prefix}_${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(CONFIG.uploadDir, fileName);

  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

  return `uploads/${fileName}`;
}

/**
 * 验证必填字段
 */
function validateRequired(data, fields) {
  const missing = [];
  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      missing.push(field);
    }
  }
  return missing;
}

// =============================================
// API 路由
// =============================================

/**
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    version: '1.0.0',
  });
});

/**
 * 提交报名
 * POST /api/register
 */
app.post('/api/register', submitLimiter, (req, res) => {
  try {
    const data = req.body;

    // 验证必填字段
    const requiredFields = [
      'name', 'gender', 'education', 'personType',
      'idCard', 'workUnit', 'creditCode', 'phone', 'street',
    ];
    const missing = validateRequired(data, requiredFields);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `缺少必填字段: ${missing.join(', ')}`,
      });
    }

    // 验证照片上传
    if (!data.portrait || !data.idFront || !data.idBack) {
      return res.status(400).json({
        success: false,
        message: '请上传完整的三张照片（证件照、身份证正面、身份证反面）',
      });
    }

    // 验证身份证格式
    const idCard = data.idCard.trim().toUpperCase();
    if (!/^\d{17}[\dX]$/.test(idCard)) {
      return res.status(400).json({
        success: false,
        message: '身份证号码格式不正确',
      });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(data.phone.trim())) {
      return res.status(400).json({
        success: false,
        message: '手机号码格式不正确',
      });
    }

    // 保存图片到磁盘
    const portraitPath = saveBase64Image(data.portrait, 'portrait');
    const idFrontPath = saveBase64Image(data.idFront, 'idfront');
    const idBackPath = saveBase64Image(data.idBack, 'idback');

    // 保存到数据库
    const regNo = db.saveRegistration({
      name: data.name.trim(),
      gender: data.gender,
      education: data.education,
      personType: data.personType,
      idCard,
      workUnit: data.workUnit.trim(),
      creditCode: data.creditCode.trim().toUpperCase(),
      phone: data.phone.trim(),
      street: data.street,
      portraitPath,
      idFrontPath,
      idBackPath,
      submitTime: data.submitTime || new Date().toISOString(),
    });

    console.log(`[报名成功] ${regNo} - ${data.name} - ${data.phone}`);

    res.json({
      success: true,
      registrationNo: regNo,
      message: '报名成功！',
    });

  } catch (err) {
    console.error('[报名错误]', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误，请稍后重试',
    });
  }
});

/**
 * 获取图片文件
 * GET /uploads/:filename
 */
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(CONFIG.uploadDir, req.params.filename);

  // 防止路径穿越
  if (!filePath.startsWith(CONFIG.uploadDir)) {
    return res.status(403).json({ error: '禁止访问' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  res.sendFile(filePath);
});

/**
 * 查询报名记录（管理员接口）
 * GET /api/admin/registrations?page=1&pageSize=20
 */
app.get('/api/admin/registrations', (req, res) => {
  // 基本认证检查
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ') || auth.split(' ')[1] !== CONFIG.adminPassword) {
    return res.status(401).json({
      success: false,
      message: '未授权访问',
    });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);
    const result = db.getAllRegistrations(page, pageSize);

    // 不返回图片 base64 数据，只返回路径
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[查询错误]', err);
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

/**
 * 按报名编号查询
 * GET /api/admin/registrations/:regNo
 */
app.get('/api/admin/registrations/:regNo', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ') || auth.split(' ')[1] !== CONFIG.adminPassword) {
    return res.status(401).json({ success: false, message: '未授权访问' });
  }

  const reg = db.getByRegNo(req.params.regNo);
  if (!reg) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }

  res.json({ success: true, data: reg });
});

/**
 * 更新报名状态
 * PATCH /api/admin/registrations/:regNo/status
 */
app.patch('/api/admin/registrations/:regNo/status', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ') || auth.split(' ')[1] !== CONFIG.adminPassword) {
    return res.status(401).json({ success: false, message: '未授权访问' });
  }

  try {
    const { status } = req.body;
    const updated = db.updateStatus(req.params.regNo, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({ success: true, message: '状态已更新' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// =============================================
// 错误处理中间件
// =============================================
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: '上传数据过大，请压缩图片后重试（最大50MB）',
    });
  }

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  console.error('[服务器错误]', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
  });
});

// =============================================
// 启动服务器
// =============================================
app.listen(CONFIG.port, () => {
  console.log('═══════════════════════════════════════');
  console.log('  万鑫安全培训报名系统 - 后端服务');
  console.log(`  端口: ${CONFIG.port}`);
  console.log(`  环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  允许的前端来源:`);
  CONFIG.allowedOrigins.forEach(o => console.log(`    - ${o}`));
  console.log('═══════════════════════════════════════');
});
