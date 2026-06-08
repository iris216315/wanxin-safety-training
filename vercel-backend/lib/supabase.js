/**
 * Supabase 客户端
 * 环境变量通过 Vercel 项目设置配置
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 生成报名编号
 * 格式：WX + 年月日 + 4位序号
 */
async function generateRegNo(supabase) {
  const now = new Date();
  const dateStr = now.getFullYear()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');

  const todayPrefix = `WX${dateStr}%`;

  const { count } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .like('registration_no', todayPrefix);

  const seq = ((count || 0) + 1).toString().padStart(4, '0');
  return `WX${dateStr}${seq}`;
}

module.exports = { supabase, generateRegNo };
