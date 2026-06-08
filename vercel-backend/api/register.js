/**
 * 提交报名
 * POST /api/register
 *
 * 接收 JSON 数据，包含 base64 图片
 * 将图片上传到 Supabase Storage，数据存入 PostgreSQL
 */

const crypto = require('crypto');
const { supabase, generateRegNo } = require('../lib/supabase');

// 图片大小限制 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

/**
 * 解析并验证 base64 图片
 * @returns {{ buffer: Buffer, ext: string, mime: string } | null}
 */
function parseBase64Image(base64Str) {
  if (!base64Str) return null;

  const matches = base64Str.match(/^data:(image\/(\w+));base64,(.+)$/);
  if (!matches) return null;

  const mime = matches[1];
  const ext = matches[2] === 'jpeg' ? 'jpg' : matches[2];
  const data = matches[3];

  // 检查文件大小
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`图片超过 10MB 大小限制`);
  }

  // 检查类型
  if (!ALLOWED_TYPES.includes(mime)) {
    throw new Error('仅支持 JPG/PNG 格式图片');
  }

  return { buffer, ext, mime };
}

/**
 * 上传图片到 Supabase Storage
 * @returns {string|null} 公开访问 URL
 */
async function uploadImage(base64Str, folder, fileName) {
  if (!base64Str) return null;

  const parsed = parseBase64Image(base64Str);
  if (!parsed) return null;

  const filePath = `${folder}/${fileName}.${parsed.ext}`;

  const { error } = await supabase.storage
    .from('registration-photos')
    .upload(filePath, parsed.buffer, {
      contentType: parsed.mime,
      upsert: false,
    });

  if (error) {
    console.error('图片上传失败:', error);
    throw new Error('图片上传失败');
  }

  // 获取公开 URL
  const { data: urlData } = supabase.storage
    .from('registration-photos')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '仅支持 POST 请求' });
  }

  try {
    const data = req.body;

    // === 验证必填字段 ===
    const requiredFields = [
      'name', 'gender', 'education', 'personType',
      'idCard', 'workUnit', 'creditCode', 'phone', 'street',
    ];
    const missing = requiredFields.filter(f => !data[f] || !data[f].trim());
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `缺少必填字段: ${missing.join(', ')}`,
      });
    }

    // 验证照片
    if (!data.portrait || !data.idFront || !data.idBack) {
      return res.status(400).json({
        success: false,
        message: '请上传完整的三张照片',
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

    // 验证手机号
    if (!/^1[3-9]\d{9}$/.test(data.phone.trim())) {
      return res.status(400).json({
        success: false,
        message: '手机号码格式不正确',
      });
    }

    // === 生成报名编号 ===
    const regNo = await generateRegNo(supabase);
    const now = new Date().toISOString();
    const randomId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

    // === 上传图片到 Supabase Storage ===
    let portraitUrl = null, idFrontUrl = null, idBackUrl = null;

    try {
      portraitUrl = await uploadImage(data.portrait, 'portrait', `${regNo}_${randomId}`);
      idFrontUrl = await uploadImage(data.idFront, 'idfront', `${regNo}_${randomId}`);
      idBackUrl = await uploadImage(data.idBack, 'idback', `${regNo}_${randomId}`);
    } catch (uploadErr) {
      console.error('图片上传异常:', uploadErr);
      return res.status(500).json({
        success: false,
        message: '照片上传失败，请重试',
      });
    }

    // === 保存到数据库 ===
    const { error: dbError } = await supabase.from('registrations').insert({
      registration_no: regNo,
      name: data.name.trim(),
      gender: data.gender,
      education: data.education,
      person_type: data.personType,
      id_card: idCard,
      work_unit: data.workUnit.trim(),
      credit_code: data.creditCode.trim().toUpperCase(),
      phone: data.phone.trim(),
      street: data.street,
      portrait_url: portraitUrl,
      id_front_url: idFrontUrl,
      id_back_url: idBackUrl,
      submit_time: data.submitTime || now,
      status: 'pending',
    });

    if (dbError) {
      console.error('数据库写入失败:', dbError);
      // 尝试清理已上传的图片
      return res.status(500).json({
        success: false,
        message: '数据保存失败，请稍后重试',
      });
    }

    console.log(`[报名成功] ${regNo} - ${data.name} - ${data.phone}`);

    res.status(200).json({
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
};
