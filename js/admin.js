/**
 * =============================================
 * 万鑫安全培训报名 - 管理员后台
 * =============================================
 * 使用 REST API 直连 Supabase（避免 JS 客户端兼容问题）
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://isgzgscaljosdsxatclo.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_Bd3-2QXZ9doG_-6fzkAfeg_TzXSiCiV';

  /** Supabase REST API 请求 */
  async function sb(method, path, body, count) {
    const url = SUPABASE_URL + '/rest/v1/' + path;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };
    if (count) headers['Prefer'] = 'count=exact';
    const options = { method, headers };
    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.substring(0, 150)}`);
    if (res.status === 204 || text === '') return null;
    const data = JSON.parse(text);
    if (count) {
      const cr = res.headers.get('content-range');
      return { data, count: cr ? parseInt(cr.split('/')[1], 10) : data.length };
    }
    return data;
  }

  function sbGet(path, count) { return sb('GET', path, null, count); }
  function sbPatch(path, body) { return sb('PATCH', path, body); }
  function sbPost(path, body) { return sb('POST', path, body); }
  function sbDelete(path) { return sb('DELETE', path); }

  // =============================================
  // 状态管理
  // =============================================

  let currentUser = null;
  let currentPage = 1;
  const PAGE_SIZE = 20;
  let searchQuery = '';

  // =============================================
  // DOM
  // =============================================

  const $ = id => document.getElementById(id);

  const loginPage = $('loginPage');
  const dashboardPage = $('dashboardPage');
  const loginError = $('loginError');
  const loginBtn = $('loginBtn');
  const tableBody = $('tableBody');
  const pagination = $('pagination');
  const sidebarStats = $('sidebarStats');
  const userBadge = $('userBadge');

  const viewRegistrations = $('viewRegistrations');
  const viewSettings = $('viewSettings');
  const viewAdmins = $('viewAdmins');
  const sidebarSettings = $('sidebarSettings');
  const sidebarAdmins = $('sidebarAdmins');

  const adminTableBody = $('adminTableBody');
  const addAdminModal = $('addAdminModal');
  const detailModal = $('detailModal');
  const detailContent = $('detailContent');

  // =============================================
  // 工具
  // =============================================

  function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
  }

  function esc(s) {
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
  }

  function fmtDt(s) {
    if (!s) return '-';
    try { return new Date(s).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }); } catch(e) { return s; }
  }

  function fmtDate(s) {
    if (!s) return '-';
    try { return new Date(s).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }); } catch(e) { return s; }
  }

  // =============================================
  // 密码哈希（Web Crypto API / PBKDF2）
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

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;

    if (!username || !password) {
      loginError.textContent = '请输入用户名和密码';
      loginError.style.display = 'block';
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';
    loginError.style.display = 'none';

    try {
      const rows = await sbGet(`admin_users?username=eq.${encodeURIComponent(username)}&select=*`);
      if (!rows || rows.length === 0) {
        loginError.textContent = '用户名或密码错误';
        loginError.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = '登 录';
        return;
      }

      const user = rows[0];
      const hash = await hashPassword(password, user.salt);

      if (hash !== user.password_hash) {
        loginError.textContent = '用户名或密码错误';
        loginError.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = '登 录';
        return;
      }

      // ✅ 登录成功
      currentUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name || user.username,
      };

      const session = { user: currentUser, expires: Date.now() + 8 * 3600 * 1000 };
      localStorage.setItem('wanxin_admin_session', JSON.stringify(session));

      // 更新最后登录时间（忽略错误）
      sbPatch(`admin_users?id=eq.${user.id}`, { last_login: new Date().toISOString() }).catch(() => {});

      enterDashboard();
    } catch (err) {
      console.error('登录错误:', err);
      loginError.textContent = '登录失败：' + (err.message || '网络错误，请检查连接');
      loginError.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = '登 录';
    }
  });

  $('logoutBtn').addEventListener('click', function () {
    localStorage.removeItem('wanxin_admin_session');
    currentUser = null;
    loginPage.style.display = 'flex';
    dashboardPage.style.display = 'none';
    $('loginPassword').value = '';
    loginError.style.display = 'none';
  });

  function enterDashboard() {
    loginPage.style.display = 'none';
    dashboardPage.style.display = 'block';
    userBadge.textContent = `${currentUser.displayName} (${currentUser.role === 'super_admin' ? '超级管理员' : '管理员'})`;
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
      const s = JSON.parse(raw);
      if (Date.now() > s.expires) { localStorage.removeItem('wanxin_admin_session'); return false; }
      currentUser = s.user;
      return true;
    } catch (e) { return false; }
  }

  // =============================================
  // 报名记录
  // =============================================

  async function loadRegistrations(page) {
    page = page || currentPage;
    tableBody.innerHTML = '<tr><td colspan="10" class="loading-row">加载中...</td></tr>';

    try {
      // 搜索过滤
      let q = 'registrations?select=*';
      const sq = searchQuery.trim();
      if (sq) {
        const e = encodeURIComponent;
        q += `&or=(name.ilike.*${e(sq)}*,id_card.ilike.*${e(sq)}*,phone.ilike.*${e(sq)}*,work_unit.ilike.*${e(sq)}*,registration_no.ilike.*${e(sq)}*)`;
      }

      // 获取总数 + 分页数据（一次查询）
      const offset = (page - 1) * PAGE_SIZE;
      const result = await sbGet(`${q}&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`, true);
      const rows = result?.data || [];
      const total = result?.count || 0;

      renderTable(rows);
      renderPagination(total, page);
      sidebarStats.textContent = `总报名: ${total} 条`;
      currentPage = page;
    } catch (err) {
      console.error('加载失败:', err);
      tableBody.innerHTML = '<tr><td colspan="10" class="error-row">加载失败: ' + esc(err.message) + '</td></tr>';
    }
  }

  const statusMap = {
    pending: '<span class="status-badge status-pending">待审核</span>',
    confirmed: '<span class="status-badge status-confirmed">已确认</span>',
    completed: '<span class="status-badge status-completed">已完成</span>',
    cancelled: '<span class="status-badge status-cancelled">已取消</span>',
  };

  function renderTable(rows) {
    if (rows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="10" class="loading-row">暂无报名记录</td></tr>';
      return;
    }

    tableBody.innerHTML = rows.map(r => `
      <tr>
        <td><input type="checkbox" class="row-checkbox" data-id="${r.id}"></td>
        <td class="cell-regno">${esc(r.registration_no || '-')}</td>
        <td>${esc(r.name)}</td>
        <td class="cell-idcard">${esc(r.id_card || '-')}</td>
        <td>${esc(r.work_unit || '-')}</td>
        <td>${esc(r.phone || '-')}</td>
        <td>${esc(r.street || '-')}</td>
        <td>${statusMap[r.status] || esc(r.status)}</td>
        <td class="cell-time">${fmtDt(r.created_at)}</td>
        <td class="cell-actions">
          <button class="table-btn" onclick="ADMIN.viewDetail(${r.id})">详情</button>
          <button class="table-btn table-btn-danger" onclick="ADMIN.deleteReg(${r.id})">删除</button>
        </td>
      </tr>
    `).join('');
  }

  function renderPagination(total, page) {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
      html += `<span class="page-btn${i === page ? ' active' : ''}" onclick="ADMIN.goPage(${i})">${i}</span>`;
    }
    pagination.innerHTML = html;
  }

  async function loadStats() {
    try {
      const r = await sbGet('registrations?select=id&limit=1', true);
      sidebarStats.textContent = `总报名: ${r?.count || 0} 条`;
    } catch (e) {}
  }

  // =============================================
  // 搜索
  // =============================================

  let searchTimer;
  $('searchInput').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = this.value.trim();
      currentPage = 1;
      loadRegistrations(1);
    }, 400);
  });

  // =============================================
  // 详情
  // =============================================

  async function viewDetail(id) {
    try {
      const rows = await sbGet(`registrations?id=eq.${id}&select=*`);
      if (!rows || rows.length === 0) { showToast('记录不存在'); return; }
      const r = rows[0];
      detailContent.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        ${dr('报名编号', r.registration_no)}
        ${dr('姓名', r.name)}
        ${dr('性别', r.gender)}
        ${dr('学历', r.education)}
        ${dr('人员类型', r.person_type)}
        ${dr('身份证号', r.id_card)}
        ${dr('工作单位', r.work_unit)}
        ${dr('信用代码', r.credit_code)}
        ${dr('手机号', r.phone)}
        ${dr('所属街道', r.street)}
        ${dr('状态', r.status)}
        ${dr('提交时间', fmtDt(r.submit_time))}
        ${dr('创建时间', fmtDt(r.created_at))}
        ${r.portrait_url ? `<tr><td style="padding:6px 12px;font-weight:500;">证件照</td><td><img src="${esc(r.portrait_url)}" style="max-width:120px;max-height:120px;border-radius:4px;"></td></tr>` : ''}
        ${r.id_front_url ? `<tr><td style="padding:6px 12px;font-weight:500;">身份证正面</td><td><img src="${esc(r.id_front_url)}" style="max-width:200px;max-height:120px;border-radius:4px;"></td></tr>` : ''}
        ${r.id_back_url ? `<tr><td style="padding:6px 12px;font-weight:500;">身份证反面</td><td><img src="${esc(r.id_back_url)}" style="max-width:200px;max-height:120px;border-radius:4px;"></td></tr>` : ''}
      </table>`;
      detailModal.classList.add('show');
    } catch (e) { showToast('加载失败'); }
  }

  function dr(l, v) {
    return `<tr><td style="padding:6px 12px;font-weight:500;color:#5f6368;white-space:nowrap;">${l}</td><td style="padding:6px 12px;">${v || '-'}</td></tr>`;
  }

  $('detailCloseBtn').onclick = () => detailModal.classList.remove('show');
  detailModal.onclick = (e) => { if (e.target === detailModal) detailModal.classList.remove('show'); };

  // =============================================
  // 删除
  // =============================================

  async function deleteReg(id) {
    if (!confirm('确定删除此报名记录？')) return;
    try {
      await sbDelete(`registrations?id=eq.${id}`);
      showToast('已删除');
      loadRegistrations(currentPage);
      loadStats();
    } catch (e) { showToast('删除失败'); }
  }

  $('batchDeleteBtn').addEventListener('click', async function () {
    const cbs = document.querySelectorAll('.row-checkbox:checked');
    const ids = Array.from(cbs).map(cb => parseInt(cb.dataset.id)).filter(id => !isNaN(id));
    if (ids.length === 0 || !confirm(`删除选中的 ${ids.length} 条记录？`)) return;
    try {
      // 逐个删除（IN 查询比较安全）
      for (const id of ids) {
        await sbDelete(`registrations?id=eq.${id}`);
      }
      showToast(`已删除 ${ids.length} 条`);
      $('selectAll').checked = false;
      this.style.display = 'none';
      loadRegistrations(currentPage);
      loadStats();
    } catch (e) { showToast('删除失败'); }
  });

  $('selectAll').addEventListener('change', function () {
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = this.checked);
    updateBatchBtn();
  });
  document.addEventListener('change', e => { if (e.target.classList.contains('row-checkbox')) updateBatchBtn(); });

  function updateBatchBtn() {
    const n = document.querySelectorAll('.row-checkbox:checked').length;
    $('batchDeleteBtn').style.display = n > 0 ? 'inline-flex' : 'none';
    if (n > 0) $('batchDeleteBtn').textContent = `🗑️ 删除选中 (${n})`;
  }

  // =============================================
  // 导出 Excel
  // =============================================

  $('exportBtn').addEventListener('click', async function () {
    this.disabled = true; this.textContent = '导出中...';
    try {
      let filter = '';
      if (searchQuery) {
        filter = `&or=(name.ilike.*${encodeURIComponent(searchQuery)}*,id_card.ilike.*${encodeURIComponent(searchQuery)}*,phone.ilike.*${encodeURIComponent(searchQuery)}*,work_unit.ilike.*${encodeURIComponent(searchQuery)}*)`;
      }
      const rows = await sbGet(`registrations?select=*${filter}&order=created_at.desc`) || [];
      const xlsData = rows.map(r => ({
        '报名编号': r.registration_no || '',
        '姓名': r.name || '', '性别': r.gender || '', '学历': r.education || '',
        '人员类型': r.person_type || '', '身份证号': r.id_card || '',
        '工作单位': r.work_unit || '', '信用代码': r.credit_code || '',
        '手机号': r.phone || '', '所属街道': r.street || '',
        '状态': r.status || '', '提交时间': fmtDt(r.submit_time),
        '创建时间': fmtDt(r.created_at),
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(xlsData);
      XLSX.utils.book_append_sheet(wb, ws, '报名记录');
      XLSX.writeFile(wb, `万鑫安全报名_${new Date().toLocaleDateString('zh-CN').replace(/\//g,'-')}.xlsx`);
      showToast(`导出 ${xlsData.length} 条`);
    } catch (e) { showToast('导出失败'); }
    finally { this.disabled = false; this.textContent = '📥 导出 Excel'; }
  });

  // =============================================
  // 系统设置
  // =============================================

  async function loadSettings() {
    try {
      const rows = await sbGet(`app_settings?key=eq.registration_window&select=value`);
      if (!rows || rows.length === 0) return;
      const w = rows[0].value;
      $('timeLimitEnabled').checked = w.enabled !== false;
      if (w.start_time) $('timeStart').value = w.start_time.slice(0, 16);
      if (w.end_time) $('timeEnd').value = w.end_time.slice(0, 16);
    } catch (e) { console.warn(e); }
  }

  $('saveSettingsBtn').addEventListener('click', async function () {
    this.disabled = true; this.textContent = '保存中...';
    try {
      const value = {
        enabled: $('timeLimitEnabled').checked,
        start_time: $('timeStart').value ? new Date($('timeStart').value).toISOString() : '',
        end_time: $('timeEnd').value ? new Date($('timeEnd').value).toISOString() : '',
      };
      await sbPatch('app_settings?key=eq.registration_window', { value, updated_at: new Date().toISOString() });
      showToast('已保存');
    } catch (e) { showToast('保存失败'); }
    finally { this.disabled = false; this.textContent = '保存设置'; }
  });

  // =============================================
  // 管理员管理
  // =============================================

  async function loadAdminUsers() {
    adminTableBody.innerHTML = '<tr><td colspan="6" class="loading-row">加载中...</td></tr>';
    try {
      const rows = await sbGet('admin_users?select=*&order=created_at.asc') || [];
      adminTableBody.innerHTML = rows.map(u => `
        <tr>
          <td>${esc(u.username)}</td>
          <td>${esc(u.display_name)}</td>
          <td>${u.role === 'super_admin' ? '超级管理员' : '普通管理员'}</td>
          <td>${u.last_login ? fmtDt(u.last_login) : '从未登录'}</td>
          <td>${fmtDate(u.created_at)}</td>
          <td>${u.username !== currentUser.username
            ? `<button class="table-btn table-btn-danger" onclick="ADMIN.deleteAdmin(${u.id},'${esc(u.username)}')">删除</button>`
            : '<span style="color:#9aa0a6;font-size:12px;">当前账号</span>'}
          </td>
        </tr>`).join('');
    } catch (e) {
      adminTableBody.innerHTML = '<tr><td colspan="6" class="error-row">加载失败</td></tr>';
    }
  }

  async function deleteAdmin(id, username) {
    if (!confirm(`确定删除管理员 "${username}"？`)) return;
    try {
      await sbDelete(`admin_users?id=eq.${id}`);
      showToast('已删除');
      loadAdminUsers();
    } catch (e) { showToast('删除失败'); }
  }

  $('addAdminBtn').addEventListener('click', () => addAdminModal.classList.add('show'));
  $('cancelAddAdmin').addEventListener('click', () => addAdminModal.classList.remove('show'));

  $('confirmAddAdmin').addEventListener('click', async function () {
    const username = $('newAdminUsername').value.trim();
    const password = $('newAdminPassword').value;
    const displayName = $('newAdminDisplayName').value.trim() || username;
    const role = $('newAdminRole').value;
    if (!username || !password) { showToast('用户名和密码不能为空'); return; }

    this.disabled = true; this.textContent = '添加中...';
    try {
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const hash = await hashPassword(password, salt);
      await sbPost('admin_users', { username, password_hash: hash, salt, role, display_name: displayName });
      showToast('添加成功');
      addAdminModal.classList.remove('show');
      $('newAdminUsername').value = ''; $('newAdminPassword').value = ''; $('newAdminDisplayName').value = '';
      loadAdminUsers();
    } catch (e) {
      showToast(e.message.includes('duplicate') ? '用户名已存在' : '添加失败');
    } finally { this.disabled = false; this.textContent = '确认添加'; }
  });

  // =============================================
  // 侧边栏
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
  // 暴露给 HTML 内联 onclick 使用
  // =============================================

  window.ADMIN = {
    viewDetail,
    deleteReg,
    goPage: (p) => loadRegistrations(p),
    deleteAdmin,
  };

  // =============================================
  // 初始化
  // =============================================

  function init() {
    if (checkSession()) {
      enterDashboard();
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
