/**
 * =============================================
 * 万鑫安全培训报名 - 增强验证模块
 * =============================================
 *
 * 功能：
 * - 身份证校验位 + 姓名简单匹配
 * - 统一社会信用代码校验
 * - 报名时间段限制
 * - 身份证号查重
 */

// =============================================
// 身份证验证
// =============================================

/** 身份证校验位检查（18位） */
function checkIdCardChecksum(id) {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(id[i], 10) * weights[i];
  }
  return checkCodes[sum % 11] === id[17].toUpperCase();
}

/** 身份证完整验证 */
function validateIdCard(idCard) {
  const v = (idCard || '').trim().toUpperCase();
  if (!v) return '请输入身份证号码';
  if (!/^\d{17}[\dX]$/.test(v)) return '身份证号码格式不正确，应为18位（末位可为X）';

  // 验证出生日期
  const year = parseInt(v.substr(6, 4), 10);
  const month = parseInt(v.substr(10, 2), 10);
  const day = parseInt(v.substr(12, 2), 10);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) {
    return '身份证号码中出生日期无效';
  }
  const now = new Date();
  if (birth > now) return '出生日期不能是未来日期';
  if (now.getFullYear() - year > 150) return '出生日期异常';
  if (!checkIdCardChecksum(v)) return '身份证号码校验位不正确';

  return ''; // 通过
}

/** 从身份证提取出生日期 */
function extractBirthFromIdCard(idCard) {
  const v = idCard.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(v)) return null;
  const year = v.substr(6, 4);
  const month = v.substr(10, 2);
  const day = v.substr(12, 2);
  return `${year}年${month}月${day}日`;
}

/** 从身份证提取性别 */
function extractGenderFromIdCard(idCard) {
  const v = idCard.trim();
  if (!/^\d{17}[\dX]$/i.test(v)) return null;
  return parseInt(v[16]) % 2 === 1 ? '男' : '女';
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
  const checkIdx = (31 - (sum % 31)) % 31;
  return charMap[checkIdx] === code[17];
}

function validateCreditCode(code) {
  const v = (code || '').trim().toUpperCase();
  if (!v) return '请输入统一社会信用代码';
  if (v.length !== 18) return '统一社会信用代码必须为18位';
  if (!/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/.test(v)) {
    return '统一社会信用代码格式不正确';
  }
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
// 姓名简单验证（不能包含数字/特殊字符）
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
// 报名时间段检查
// =============================================

async function checkRegistrationWindow() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'registration_window')
      .single();

    if (error || !data) return { allowed: true, message: '' };

    const win = data.value;
    if (!win.enabled) return { allowed: true, message: '' };

    const now = new Date();
    const start = new Date(win.start_time);
    const end = new Date(win.end_time);

    if (now < start) {
      return {
        allowed: false,
        message: `报名尚未开始，开始时间：${start.toLocaleString('zh-CN')}`
      };
    }
    if (now > end) {
      return {
        allowed: false,
        message: `报名已截止（截止时间：${end.toLocaleString('zh-CN')}）`
      };
    }
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
    const { count, error } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('id_card', v);

    if (error) throw error;
    return { duplicate: count > 0, count: count || 0 };
  } catch (e) {
    console.warn('身份证查重失败:', e);
    return { duplicate: false, count: 0 };
  }
}
