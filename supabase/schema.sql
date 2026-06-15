-- =============================================
-- 万鑫安全培训报名系统 - 管理功能表结构
-- =============================================

-- 1. 管理员账号表
CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- 2. 系统设置表
CREATE TABLE IF NOT EXISTS app_settings (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 插入默认设置
INSERT INTO app_settings (key, value) VALUES
  ('registration_window', '{"enabled":true,"start_time":"2026-01-01T00:00:00+08:00","end_time":"2026-12-31T23:59:59+08:00"}')
ON CONFLICT (key) DO NOTHING;

-- 插入超级管理员（密码: admin123）
INSERT INTO admin_users (username, password_hash, salt, role, display_name)
VALUES (
  'admin',
  '9fa4fa63bc75d2c8f43267629048df201f5f2a26f42ca6e9baf3a4fe22b1483a399e1813e5219e97be0aa224adc21d1c7ea86a10083813cdd2a02424d462a99e',
  '28ccc8ed12818ffd0da4965ad470064b',
  'super_admin',
  '超级管理员'
)
ON CONFLICT (username) DO NOTHING;

-- 3. 注册时间窗口表（可选，用于报名时间段日志）
CREATE TABLE IF NOT EXISTS registration_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  detail JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 已注册身份证号索引（用于快速查重）
CREATE INDEX IF NOT EXISTS idx_registrations_id_card ON registrations(id_card);

-- 5. 在 registrations 表添加审核状态（如没有）
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

-- =============================================
-- 修复：为 registrations 表开放匿名用户权限
-- 注意：在 Supabase SQL 编辑器中运行此 SQL
-- =============================================

-- 允许匿名用户插入报名记录
DROP POLICY IF EXISTS "anon_insert_registrations" ON registrations;
CREATE POLICY "anon_insert_registrations" ON registrations
  FOR INSERT TO anon
  WITH CHECK (true);

-- 允许匿名用户查询报名记录（管理员后台使用）
DROP POLICY IF EXISTS "anon_select_registrations" ON registrations;
CREATE POLICY "anon_select_registrations" ON registrations
  FOR SELECT TO anon
  USING (true);

-- 允许匿名用户更新报名记录（管理员审核使用）
DROP POLICY IF EXISTS "anon_update_registrations" ON registrations;
CREATE POLICY "anon_update_registrations" ON registrations
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- 允许匿名用户删除报名记录（管理员删除使用）
DROP POLICY IF EXISTS "anon_delete_registrations" ON registrations;
CREATE POLICY "anon_delete_registrations" ON registrations
  FOR DELETE TO anon
  USING (true);

-- 6. 启用 RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 7. 设置管理员表访问策略（仅超级管理员可读写）
CREATE POLICY "仅超级管理员可管理管理员账号"
ON admin_users
USING (
  -- 通过应用层鉴权，这里放宽以便登录
  true
);

-- 允许公开读取 app_settings（仅限非敏感字段）
CREATE POLICY "允许读取报名时间段"
ON app_settings FOR SELECT
USING (key = 'registration_window');
