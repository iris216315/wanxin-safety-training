/**
 * 管理员查询报名记录
 * GET /api/admin/registrations
 * GET /api/admin/registrations?page=1&pageSize=20
 *
 * 需要 Bearer Token 认证
 */
const { supabase } = require('../../lib/supabase');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'wanxin2026';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 认证检查
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ') || auth.split(' ')[1] !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '未授权访问' });
  }

  try {
    if (req.method === 'GET') {
      // === 查询所有记录（分页） ===
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);
      const offset = (page - 1) * pageSize;

      // 如果有 regNo 参数，查询单个
      if (req.query.regNo) {
        const { data, error } = await supabase
          .from('registrations')
          .select('*')
          .eq('registration_no', req.query.regNo)
          .single();

        if (error || !data) {
          return res.status(404).json({ success: false, message: '记录不存在' });
        }

        return res.json({ success: true, data });
      }

      // 查询总数
      const { count } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true });

      // 查询分页数据
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('查询失败:', error);
        return res.status(500).json({ success: false, message: '查询失败' });
      }

      res.json({
        success: true,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
        data: data || [],
      });

    } else if (req.method === 'PATCH') {
      // === 更新状态 ===
      const { regNo, status } = req.body;
      if (!regNo || !status) {
        return res.status(400).json({ success: false, message: '缺少参数' });
      }

      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: '无效的状态值' });
      }

      const { error } = await supabase
        .from('registrations')
        .update({ status })
        .eq('registration_no', regNo);

      if (error) {
        console.error('更新失败:', error);
        return res.status(500).json({ success: false, message: '更新失败' });
      }

      res.json({ success: true, message: '状态已更新' });

    } else {
      res.status(405).json({ success: false, message: '不支持的请求方法' });
    }

  } catch (err) {
    console.error('[管理员 API 错误]', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};
