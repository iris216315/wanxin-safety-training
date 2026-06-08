/**
 * 健康检查
 * GET /api/health
 */
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: '仅支持 GET 请求' });
  }

  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
    version: '1.0.0',
  });
};
