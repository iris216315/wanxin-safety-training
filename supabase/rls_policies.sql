-- =============================================
-- 万鑫安全培训报名系统 - 数据库安全策略
-- =============================================

-- 1. 启用行级安全
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- 2. 允许匿名用户插入报名记录（只能插入，不能查询/修改/删除）
CREATE POLICY "允许匿名报名"
ON registrations FOR INSERT
TO anon
WITH CHECK (true);

-- 3. 存储桶已创建，补充存储策略
-- 允许匿名用户上传文件
CREATE POLICY "匿名上传照片"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'registration-photos');
