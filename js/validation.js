/**
 * =============================================
 * 万鑫安全培训报名 - 验证模块
 * =============================================
 * 身份证/信用代码/手机号/姓名验证
 * 报名时间段/身份证查重（REST API 直连）
 */

// =============================================
// 身份证验证
// =============================================

function checkIdCardChecksum(id) {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += parseInt(id[i], 10) * weights[i];
  return checkCodes[sum % 11] === id[17].toUpperCase();
}

function validateIdCard(idCard) {
  const v = (idCard || '').trim().toUpperCase();
  if (!v) return '请输入身份证号码';
  if (!/^\d{17}[\dX]$/.test(v)) return '身份证号码格式不正确，应为18位（末位可为X）';
  const year = parseInt(v.substr(6, 4), 10);
  const month = parseInt(v.substr(10, 2), 10);
  const day = parseInt(v.substr(12, 2), 10);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) {
    return '身份证号码中出生日期无效';
  }
  if (birth > new Date()) return '出生日期不能是未来日期';
  if (new Date().getFullYear() - year > 150) return '出生日期异常';
  if (!checkIdCardChecksum(v)) return '身份证号码校验位不正确';
  return '';
}

// =============================================
// 统一社会信用代码验证
// =============================================

function checkCreditCodeChecksum(code) {
  const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
  const charMap = '0123456789ABCDEFGHJKLMNPQRTUWXY';
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const idx = charMap.indexOf(code[i]);
    if (idx === -1) return false;
    sum += idx * weights[i];
  }
  return charMap[(31 - (sum % 31)) % 31] === code[17];
}

function validateCreditCode(code) {
  const v = (code || '').trim().toUpperCase();
  if (!v) return '请输入统一社会信用代码';
  if (v.length !== 18) return '统一社会信用代码必须为18位';
  if (!/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/.test(v)) return '统一社会信用代码格式不正确';
  if (!checkCreditCodeChecksum(v)) return '统一社会信用代码校验位不正确';
  return '';
}

// =============================================
// 手机号验证
// =============================================

function validatePhone(phone) {
  const v = (phone || '').trim();
  if (!v) return '请输入联系电话';
  if (!/^1[3-9]\d{9}$/.test(v)) return '请输入正确的11位手机号码';
  return '';
}

// =============================================
// 姓名验证
// =============================================

function validateName(name) {
  const v = (name || '').trim();
  if (!v) return '请输入姓名';
  if (v.length < 2) return '姓名至少2个字符';
  if (v.length > 30) return '姓名不能超过30个字符';
  if (/[0-9]/.test(v)) return '姓名不能包含数字';
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v)) return '姓名不能包含特殊字符';
  return '';
}

// =============================================
// 工作单位 + 统一社会信用代码匹配验证
// =============================================

function validateCompanyCreditCode(company, creditCode) {
  const c = (company || '').trim();
  const cc = (creditCode || '').trim().toUpperCase();
  if (!c) return '请输入工作单位';
  if (!cc) return '请输入统一社会信用代码';
  if (c.length < 2) return '工作单位名称过短';
  // 统一社会信用代码格式校验
  const creditErr = validateCreditCode(cc);
  if (creditErr) return creditErr;
  return '';
}

// =============================================
// REST API（不依赖 Supabase SDK）
// =============================================

function sbApiUrl() {
  return window.__SUPABASE_URL || 'https://isgzgscaljosdsxatclo.supabase.co';
}

function sbApiKey() {
  return window.__SUPABASE_ANON_KEY || 'sb_publishable_Bd3-2QXZ9doG_-6fzkAfeg_TzXSiCiV';
}

function sbApiHeaders() {
  const k = sbApiKey();
  return { 'apikey': k, 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' };
}

async function sbFetch(path) {
  const res = await fetch(sbApiUrl() + '/rest/v1/' + path, { headers: sbApiHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(text.substring(0, 100));
  return text ? JSON.parse(text) : null;
}

// =============================================
// 报名时间段检查
// =============================================

async function checkRegistrationWindow() {
  try {
    const rows = await sbFetch("app_settings?key=eq.registration_window&select=value");
    if (!rows || rows.length === 0) return { allowed: true, message: '' };
    const win = rows[0].value;
    if (!win.enabled) return { allowed: true, message: '' };
    const now = new Date();
    const start = new Date(win.start_time);
    const end = new Date(win.end_time);
    if (now < start) return { allowed: false, message: `报名尚未开始（${start.toLocaleString('zh-CN')}）` };
    if (now > end) return { allowed: false, message: `报名已截止（${end.toLocaleString('zh-CN')}）` };
    return { allowed: true, message: '' };
  } catch (e) {
    console.warn('报名时间段检查失败:', e);
    return { allowed: true, message: '' };
  }
}

// =============================================
// 身份证号查重
// =============================================

async function checkIdCardDuplicate(idCard) {
  try {
    const v = idCard.trim().toUpperCase();
    const rows = await sbFetch("registrations?id_card=eq." + encodeURIComponent(v) + "&select=id");
    const count = (rows || []).length;
    return { duplicate: count > 0, count };
  } catch (e) {
    console.warn('身份证查重失败:', e);
    return { duplicate: false, count: 0 };
  }
}
