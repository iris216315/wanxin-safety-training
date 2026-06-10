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

-- 插入默认设置（一行）
INSERT INTO app_settings (key, value) VALUES ('registration_window', '{"enabled":true,"start_time":"2026-01-01T00:00:00Z","end_time":"2026-12-31T23:59:59Z"}') ON CONFLICT (key) DO NOTHING;

-- 插入超级管理员（密码: admin123）
INSERT INTO admin_users (username, password_hash, salt, role, display_name) VALUES ('admin', '9fa4fa63bc75d2c8f43267629048df201f5f2a26f42ca6e9baf3a4fe22b1483a399e1813e5219e97be0aa224adc21d1c7ea86a10083813cdd2a02424d462a99e', '28ccc8ed12818ffd0da4965ad470064b', 'super_admin', '超级管理员') ON CONFLICT (username) DO NOTHING;

-- 3. 注册日志表
CREATE TABLE IF NOT EXISTS registration_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  detail JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 身份证号索引
CREATE INDEX IF NOT EXISTS idx_registrations_id_card ON registrations(id_card);

-- 5. 添加审核字段
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS review_note TEXT;

-- 6. 启用 RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 7. 访问策略
DROP POLICY IF EXISTS "允许读取管理员" ON admin_users;
CREATE POLICY "允许读取管理员" ON admin_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "允许读取报名时间段" ON app_settings;
CREATE POLICY "允许读取报名时间段" ON app_settings FOR SELECT USING (key = 'registration_window');
