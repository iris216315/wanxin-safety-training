/**
 * =============================================
 * 万鑫安全培训报名 - 管理员后台
 * =============================================
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://isgzgscaljosdsxatclo.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_Bd3-2QXZ9doG_-6fzkAfeg_TzXSiCiV';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // =============================================
  // 状态管理
  // =============================================

  let currentUser = null;       // { username, role, displayName }
  let currentPage = 1;
  let pageSize = 20;
  let searchQuery = '';
  let adminUsers = [];

  // =============================================
  // DOM 引用
  // =============================================

  const $ = id => document.getElementById(id);

  // Login
  const loginPage = $('loginPage');
  const dashboardPage = $('dashboardPage');
  const loginForm = $('loginForm');
  const loginUsername = $('loginUsername');
  const loginPassword = $('loginPassword');
  const loginError = $('loginError');
  const loginBtn = $('loginBtn');
  const logoutBtn = $('logoutBtn');
  const userBadge = $('userBadge');
  const sidebarStats = $('sidebarStats');

  // Views
  const viewRegistrations = $('viewRegistrations');
  const viewSettings = $('viewSettings');
  const viewAdmins = $('viewAdmins');
  const sidebarSettings = $('sidebarSettings');
  const sidebarAdmins = $('sidebarAdmins');

  // Table
  const tableBody = $('tableBody');
  const pagination = $('pagination');
  const searchInput = $('searchInput');
  const selectAll = $('selectAll');
  const exportBtn = $('exportBtn');
  const batchDeleteBtn = $('batchDeleteBtn');

  // Settings
  const timeLimitEnabled = $('timeLimitEnabled');
  const timeStart = $('timeStart');
  const timeEnd = $('timeEnd');
  const saveSettingsBtn = $('saveSettingsBtn');

  // Admin management
  const adminTableBody = $('adminTableBody');
  const addAdminBtn = $('addAdminBtn');
  const addAdminModal = $('addAdminModal');
  const confirmAddAdmin = $('confirmAddAdmin');
  const cancelAddAdmin = $('cancelAddAdmin');

  // Detail modal
  const detailModal = $('detailModal');
  const detailContent = $('detailContent');
  const detailCloseBtn = $('detailCloseBtn');

  // =============================================
  // 工具函数
  // =============================================

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
  }

  function formatDateTime(str) {
    if (!str) return '-';
    const d = new Date(str);
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  }

  function formatDate(str) {
    if (!str) return '-';
    const d = new Date(str);
    return d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  }

  // =============================================
  // 密码哈希（与前端登录一致）
  // =============================================

  async function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-512' },
      keyMaterial, 512
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // =============================================
  // 登录 / 注销
  // =============================================

  async function handleLogin(e) {
    e.preventDefault();
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    if (!username || !password) {
      loginError.textContent = '请输入用户名和密码';
      loginError.style.display = 'block';
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !data) {
        loginError.textContent = '用户名或密码错误';
        loginError.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = '登 录';
        return;
      }

      const hash = await hashPassword(password, data.salt);
      if (hash !== data.password_hash) {
        loginError.textContent = '用户名或密码错误';
        loginError.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = '登 录';
        return;
      }

      // 登录成功
      currentUser = {
        id: data.id,
        username: data.username,
        role: data.role,
        displayName: data.display_name || data.username,
      };

      // 保存会话
      const session = { user: currentUser, expires: Date.now() + 8 * 3600 * 1000 };
      localStorage.setItem('wanxin_admin_session', JSON.stringify(session));

      // 更新最后登录时间
      supabase.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', data.id).catch(() => {});

      showDashboard();
    } catch (err) {
      console.error('登录错误:', err);
      loginError.textContent = '登录失败：网络错误';
      loginError.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = '登 录';
    }
  }

  function handleLogout() {
    localStorage.removeItem('wanxin_admin_session');
    currentUser = null;
    loginPage.style.display = 'flex';
    dashboardPage.style.display = 'none';
    loginPassword.value = '';
    loginError.style.display = 'none';
  }

  function showDashboard() {
    loginPage.style.display = 'none';
    dashboardPage.style.display = 'block';
    userBadge.textContent = `${currentUser.displayName} (${currentUser.role === 'super_admin' ? '超级管理员' : '管理员'})`;

    // 超级管理员可见设置和管理员管理
    sidebarSettings.style.display = currentUser.role === 'super_admin' ? 'block' : 'none';
    sidebarAdmins.style.display = currentUser.role === 'super_admin' ? 'block' : 'none';

    loadRegistrations();
    loadStats();
  }

  // =============================================
  // 会话检查
  // =============================================

  function checkSession() {
    try {
      const raw = localStorage.getItem('wanxin_admin_session');
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (Date.now() > session.expires) {
        localStorage.removeItem('wanxin_admin_session');
        return false;
      }
      currentUser = session.user;
      return true;
    } catch (e) {
      return false;
    }
  }

  // =============================================
  // 加载报名记录
  // =============================================

  let loadingRegs = false;

  async function loadRegistrations(page) {
    if (loadingRegs) return;
    loadingRegs = true;

    try {
      page = page || currentPage;
      let query = supabase.from('registrations').select('*', { count: 'exact' });

      if (searchQuery) {
        query = query.or(
          `name.ilike.%${searchQuery}%,id_card.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,work_unit.ilike.%${searchQuery}%,registration_no.ilike.%${searchQuery}%`
        );
      }

      const offset = (page - 1) * pageSize;
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      renderTable(data || []);
      renderPagination(count || 0, page);
      sidebarStats.textContent = `总报名: ${count || 0} 条`;

      currentPage = page;
    } catch (err) {
      console.error('加载记录失败:', err);
      tableBody.innerHTML = '<tr><td colspan="10" class="error-row">加载失败</td></tr>';
    } finally {
      loadingRegs = false;
    }
  }

  function renderTable(rows) {
    if (rows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="10" class="loading-row">暂无报名记录</td></tr>';
      return;
    }

    const statusMap = {
      pending: '<span class="status-badge status-pending">待审核</span>',
      confirmed: '<span class="status-badge status-confirmed">已确认</span>',
      completed: '<span class="status-badge status-completed">已完成</span>',
      cancelled: '<span class="status-badge status-cancelled">已取消</span>',
    };

    tableBody.innerHTML = rows.map(r => `
      <tr>
        <td><input type="checkbox" class="row-checkbox" data-id="${r.id}"></td>
        <td class="cell-regno">${r.registration_no || '-'}</td>
        <td>${escHtml(r.name)}</td>
        <td class="cell-idcard">${r.id_card || '-'}</td>
        <td>${escHtml(r.work_unit || '-')}</td>
        <td>${r.phone || '-'}</td>
        <td>${r.street || '-'}</td>
        <td>${statusMap[r.status] || r.status}</td>
        <td class="cell-time">${formatDateTime(r.created_at)}</td>
        <td class="cell-actions">
          <button class="table-btn" onclick="window._viewDetail(${r.id})">详情</button>
          <button class="table-btn table-btn-danger" onclick="window._deleteReg(${r.id})">删除</button>
        </td>
      </tr>
    `).join('');

    // 暴露方法
    window._viewDetail = viewDetail;
    window._deleteReg = deleteRegistration;
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderPagination(total, page) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
      if (i === page) {
        html += `<span class="page-btn active">${i}</span>`;
      } else {
        html += `<span class="page-btn" onclick="window._goToPage(${i})">${i}</span>`;
      }
    }
    pagination.innerHTML = html;
    window._goToPage = (p) => { currentPage = p; loadRegistrations(p); };
  }

  async function loadStats() {
    try {
      const { count } = await supabase.from('registrations').select('*', { count: 'exact', head: true });
      sidebarStats.textContent = `总报名: ${count || 0} 条`;
    } catch (e) {}
  }

  // =============================================
  // 搜索
  // =============================================

  let searchTimer = null;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = this.value.trim();
      currentPage = 1;
      loadRegistrations(1);
    }, 400);
  });

  // =============================================
  // 全选
  // =============================================

  selectAll.addEventListener('change', function () {
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = this.checked);
    updateBatchDeleteBtn();
  });

  document.addEventListener('change', function (e) {
    if (e.target.classList.contains('row-checkbox')) updateBatchDeleteBtn();
  });

  function updateBatchDeleteBtn() {
    const checked = document.querySelectorAll('.row-checkbox:checked');
    batchDeleteBtn.style.display = checked.length > 0 ? 'inline-flex' : 'none';
    if (checked.length > 0) batchDeleteBtn.textContent = `🗑️ 删除选中 (${checked.length})`;
  }

  // =============================================
  // 删除
  // =============================================

  async function deleteRegistration(id) {
    if (!confirm('确定删除此报名记录？此操作不可恢复。')) return;
    try {
      const { error } = await supabase.from('registrations').delete().eq('id', id);
      if (error) throw error;
      showToast('已删除');
      loadRegistrations(currentPage);
      loadStats();
    } catch (err) {
      showToast('删除失败');
    }
  }

  batchDeleteBtn.addEventListener('click', async function () {
    const ids = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => parseInt(cb.dataset.id));
    if (ids.length === 0 || !confirm(`确定删除选中的 ${ids.length} 条记录？`)) return;

    try {
      const { error } = await supabase.from('registrations').delete().in('id', ids);
      if (error) throw error;
      showToast(`已删除 ${ids.length} 条记录`);
      batchDeleteBtn.style.display = 'none';
      selectAll.checked = false;
      loadRegistrations(currentPage);
      loadStats();
    } catch (err) {
      showToast('删除失败');
    }
  });

  // =============================================
  // 查看详情
  // =============================================

  async function viewDetail(id) {
    try {
      const { data, error } = await supabase.from('registrations').select('*').eq('id', id).single();
      if (error || !data) { showToast('记录不存在'); return; }

      const r = data;
      detailContent.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          ${renderDetailRow('报名编号', r.registration_no)}
          ${renderDetailRow('姓名', r.name)}
          ${renderDetailRow('性别', r.gender)}
          ${renderDetailRow('学历', r.education)}
          ${renderDetailRow('人员类型', r.person_type)}
          ${renderDetailRow('身份证号', r.id_card)}
          ${renderDetailRow('工作单位', r.work_unit)}
          ${renderDetailRow('信用代码', r.credit_code)}
          ${renderDetailRow('手机号', r.phone)}
          ${renderDetailRow('所属街道', r.street)}
          ${renderDetailRow('状态', r.status)}
          ${renderDetailRow('提交时间', formatDateTime(r.submit_time))}
          ${renderDetailRow('报名时间', formatDateTime(r.created_at))}
          ${r.portrait_url ? `<tr><td style="padding:6px 12px;font-weight:500;">证件照</td><td style="padding:6px 12px;"><img src="${r.portrait_url}" style="max-width:120px;max-height:120px;border-radius:4px;"></td></tr>` : ''}
          ${r.id_front_url ? `<tr><td style="padding:6px 12px;font-weight:500;">身份证正面</td><td style="padding:6px 12px;"><img src="${r.id_front_url}" style="max-width:200px;max-height:120px;border-radius:4px;"></td></tr>` : ''}
          ${r.id_back_url ? `<tr><td style="padding:6px 12px;font-weight:500;">身份证反面</td><td style="padding:6px 12px;"><img src="${r.id_back_url}" style="max-width:200px;max-height:120px;border-radius:4px;"></td></tr>` : ''}
        </table>
      `;
      detailModal.classList.add('show');

      // ESC关闭
      const closeDetail = () => detailModal.classList.remove('show');
      detailCloseBtn.onclick = closeDetail;
      detailModal.onclick = (e) => { if (e.target === detailModal) closeDetail(); };
    } catch (err) {
      showToast('加载详情失败');
    }
  }

  function renderDetailRow(label, value) {
    return `<tr><td style="padding:6px 12px;font-weight:500;color:#5f6368;white-space:nowrap;">${label}</td><td style="padding:6px 12px;">${value || '-'}</td></tr>`;
  }

  // =============================================
  // 导出 Excel
  // =============================================

  exportBtn.addEventListener('click', async function () {
    this.disabled = true;
    this.textContent = '导出中...';

    try {
      let query = supabase.from('registrations').select('*');
      if (searchQuery) {
        query = query.or(
          `name.ilike.%${searchQuery}%,id_card.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,work_unit.ilike.%${searchQuery}%`
        );
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data || []).map(r => ({
        '报名编号': r.registration_no || '',
        '姓名': r.name || '',
        '性别': r.gender || '',
        '学历': r.education || '',
        '人员类型': r.person_type || '',
        '身份证号': r.id_card || '',
        '工作单位': r.work_unit || '',
        '统一社会信用代码': r.credit_code || '',
        '手机号': r.phone || '',
        '所属街道': r.street || '',
        '状态': r.status || '',
        '提交时间': formatDateTime(r.submit_time),
        '创建时间': formatDateTime(r.created_at),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, '报名记录');
      XLSX.writeFile(wb, `万鑫安全报名记录_${new Date().toLocaleDateString('zh-CN')}.xlsx`);

      showToast(`导出成功 ${rows.length} 条`);
    } catch (err) {
      console.error(err);
      showToast('导出失败');
    } finally {
      this.disabled = false;
      this.textContent = '📥 导出 Excel';
    }
  });

  // =============================================
  // 系统设置
  // =============================================

  async function loadSettings() {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'registration_window')
        .single();

      if (error || !data) return;

      const win = data.value;
      timeLimitEnabled.checked = win.enabled !== false;
      if (win.start_time) {
        timeStart.value = win.start_time.slice(0, 16);
      }
      if (win.end_time) {
        timeEnd.value = win.end_time.slice(0, 16);
      }
    } catch (e) {
      console.warn('加载设置失败');
    }
  }

  saveSettingsBtn.addEventListener('click', async function () {
    this.disabled = true;
    this.textContent = '保存中...';

    try {
      const value = {
        enabled: timeLimitEnabled.checked,
        start_time: timeStart.value ? new Date(timeStart.value).toISOString() : '',
        end_time: timeEnd.value ? new Date(timeEnd.value).toISOString() : '',
      };

      const { error } = await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', 'registration_window');

      if (error) throw error;
      showToast('设置已保存');
    } catch (err) {
      showToast('保存失败');
    } finally {
      this.disabled = false;
      this.textContent = '保存设置';
    }
  });

  // =============================================
  // 管理员管理
  // =============================================

  async function loadAdminUsers() {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at');

      if (error) throw error;
      adminUsers = data || [];

      adminTableBody.innerHTML = adminUsers.map(u => `
        <tr>
          <td>${escHtml(u.username)}</td>
          <td>${escHtml(u.display_name)}</td>
          <td>${u.role === 'super_admin' ? '超级管理员' : '普通管理员'}</td>
          <td>${u.last_login ? formatDateTime(u.last_login) : '从未登录'}</td>
          <td>${formatDate(u.created_at)}</td>
          <td>
            ${u.username !== currentUser.username
              ? `<button class="table-btn table-btn-danger" onclick="window._deleteAdmin(${u.id}, '${u.username}')">删除</button>`
              : '<span style="color:#9aa0a6;font-size:12px;">当前账号</span>'}
          </td>
        </tr>
      `).join('');

      window._deleteAdmin = deleteAdmin;
    } catch (err) {
      adminTableBody.innerHTML = '<tr><td colspan="6" class="error-row">加载失败</td></tr>';
    }
  }

  async function deleteAdmin(id, username) {
    if (!confirm(`确定删除管理员 "${username}"？`)) return;
    try {
      const { error } = await supabase.from('admin_users').delete().eq('id', id);
      if (error) throw error;
      showToast('已删除');
      loadAdminUsers();
    } catch (err) {
      showToast('删除失败');
    }
  }

  addAdminBtn.addEventListener('click', () => addAdminModal.classList.add('show'));
  cancelAddAdmin.addEventListener('click', () => addAdminModal.classList.remove('show'));

  confirmAddAdmin.addEventListener('click', async function () {
    const username = $('newAdminUsername').value.trim();
    const password = $('newAdminPassword').value;
    const displayName = $('newAdminDisplayName').value.trim() || username;
    const role = $('newAdminRole').value;

    if (!username || !password) {
      showToast('用户名和密码不能为空');
      return;
    }

    this.disabled = true;
    this.textContent = '添加中...';

    try {
      // 生成哈希
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const hash = await hashPassword(password, salt);

      const { error } = await supabase.from('admin_users').insert({
        username, password_hash: hash, salt, role, display_name: displayName,
      });

      if (error) {
        if (error.code === '23505') {
          showToast('用户名已存在');
        } else {
          throw error;
        }
        return;
      }

      showToast('管理员添加成功');
      addAdminModal.classList.remove('show');
      $('newAdminUsername').value = '';
      $('newAdminPassword').value = '';
      $('newAdminDisplayName').value = '';
      loadAdminUsers();
    } catch (err) {
      showToast('添加失败');
    } finally {
      this.disabled = false;
      this.textContent = '确认添加';
    }
  });

  // =============================================
  // 侧边栏导航
  // =============================================

  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', function () {
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');

      const view = this.dataset.view;
      document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
      const target = document.getElementById('view' + view.charAt(0).toUpperCase() + view.slice(1));
      if (target) target.style.display = 'block';

      if (view === 'settings') loadSettings();
      if (view === 'admins') loadAdminUsers();
    });
  });

  // =============================================
  // 初始化
  // =============================================

  function init() {
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // 检查是否已登录
    if (checkSession()) {
      showDashboard();
    } else {
      loginPage.style.display = 'flex';
      dashboardPage.style.display = 'none';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
