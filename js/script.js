/**
 * =============================================
 * 台州万鑫安全技术咨询有限公司
 * 安全培训报名网站 - 主逻辑（增强版）
 * =============================================
 *
 * 功能增强：
 * - 人脸检测 + 清晰度 + 背景检测
 * - 身份证 OCR 识别
 * - 身份证号查重
 * - 报名时间段限制
 * - 字段级错误提示
 * - Supabase 直连存储
 */

(function () {
  'use strict';

  // =============================================
  // Supabase 初始化
  // =============================================
  const SUPABASE_URL = 'https://isgzgscaljosdsxatclo.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_Bd3-2QXZ9doG_-6fzkAfeg_TzXSiCiV';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // 暴露给其他模块使用
  window.__supabase = supabase;

  // =============================================
  // DOM 引用
  // =============================================
  const dom = {
    form: document.getElementById('signupForm'),
    name: document.getElementById('name'),
    gender: document.querySelectorAll('input[name="gender"]'),
    education: document.getElementById('education'),
    personType: document.querySelectorAll('input[name="personType"]'),
    idCard: document.getElementById('idCard'),
    workUnit: document.getElementById('workUnit'),
    creditCode: document.getElementById('creditCode'),
    phone: document.getElementById('phone'),
    street: document.getElementById('street'),
    portraitInput: document.getElementById('portraitInput'),
    idFrontInput: document.getElementById('idFrontInput'),
    idBackInput: document.getElementById('idBackInput'),
    portraitArea: document.getElementById('portraitArea'),
    idFrontArea: document.getElementById('idFrontArea'),
    idBackArea: document.getElementById('idBackArea'),
    portraitPreview: document.getElementById('portraitPreview'),
    idFrontPreview: document.getElementById('idFrontPreview'),
    idBackPreview: document.getElementById('idBackPreview'),
    portraitImage: document.getElementById('portraitImage'),
    idFrontImage: document.getElementById('idFrontImage'),
    idBackImage: document.getElementById('idBackImage'),
    submitBtn: document.getElementById('submitBtn'),
    resetBtn: document.getElementById('resetBtn'),
    successModal: document.getElementById('successModal'),
    previewModal: document.getElementById('previewModal'),
    previewImage: document.getElementById('previewImage'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    previewCloseBtn: document.getElementById('previewCloseBtn'),
  };

  const errorEls = {
    name: document.getElementById('nameError'),
    gender: document.getElementById('genderError'),
    education: document.getElementById('educationError'),
    personType: document.getElementById('personTypeError'),
    idCard: document.getElementById('idCardError'),
    workUnit: document.getElementById('workUnitError'),
    creditCode: document.getElementById('creditCodeError'),
    phone: document.getElementById('phoneError'),
    street: document.getElementById('streetError'),
    portrait: document.getElementById('portraitError'),
    idFront: document.getElementById('idFrontError'),
    idBack: document.getElementById('idBackError'),
  };

  // =============================================
  // 工具函数
  // =============================================

  function getRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  function showError(field, message) {
    if (errorEls[field]) {
      errorEls[field].textContent = message;
      errorEls[field].classList.toggle('visible', !!message);
    }
    const inputMap = {
      name: dom.name, idCard: dom.idCard, workUnit: dom.workUnit,
      creditCode: dom.creditCode, phone: dom.phone, education: dom.education, street: dom.street,
    };
    if (inputMap[field]) inputMap[field].classList.toggle('error', !!message);
  }

  function clearAllErrors() {
    Object.keys(errorEls).forEach(key => showError(key, ''));
    document.querySelectorAll('.form-input.error, .form-select.error').forEach(el => el.classList.remove('error'));
  }

  function showToast(message, duration) {
    duration = duration || 3000;
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration);
  }

  // =============================================
  // 照片上传处理（增强版 - 触发检测）
  // =============================================

  const uploadConfigs = [
    {
      input: 'portraitInput', area: 'portraitArea', preview: 'portraitPreview',
      image: 'portraitImage', placeholderId: 'portraitPlaceholder', replaceBtn: 'portraitReplace',
      errorKey: 'portrait', label: '电子免冠证件照', isPortrait: true,
      checks: ['face', 'sharpness', 'background'],
    },
    {
      input: 'idFrontInput', area: 'idFrontArea', preview: 'idFrontPreview',
      image: 'idFrontImage', placeholderId: 'idFrontPlaceholder', replaceBtn: 'idFrontReplace',
      errorKey: 'idFront', label: '身份证正面照片', isPortrait: false, side: 'front',
      checks: ['sharpness', 'ocr'],
    },
    {
      input: 'idBackInput', area: 'idBackArea', preview: 'idBackPreview',
      image: 'idBackImage', placeholderId: 'idBackPlaceholder', replaceBtn: 'idBackReplace',
      errorKey: 'idBack', label: '身份证反面照片', isPortrait: false, side: 'back',
      checks: ['sharpness'],
    },
  ].map(c => ({
    ...c,
    inputEl: document.getElementById(c.input),
    areaEl: document.getElementById(c.area),
    previewEl: document.getElementById(c.preview),
    imageEl: document.getElementById(c.image),
    replaceEl: document.getElementById(c.replaceBtn),
    placeholderEl: document.getElementById(c.placeholderId),
  }));

  /** 存储图片文件引用（用于上传） */
  const uploadedFiles = { portrait: null, idFront: null, idBack: null };
  /** 存储 OCR 识别结果 */
  const ocrResults = {};

  function setupUploadHandlers() {
    uploadConfigs.forEach(cfg => {
      cfg.inputEl.addEventListener('change', function () { handleFileSelect(this, cfg); });

      cfg.areaEl.addEventListener('dragover', e => { e.preventDefault(); cfg.areaEl.classList.add('dragover'); });
      cfg.areaEl.addEventListener('dragleave', e => { e.preventDefault(); cfg.areaEl.classList.remove('dragover'); });
      cfg.areaEl.addEventListener('drop', e => {
        e.preventDefault();
        cfg.areaEl.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          cfg.inputEl.files = e.dataTransfer.files;
          handleFileSelect(cfg.inputEl, cfg);
        }
      });
      cfg.areaEl.addEventListener('click', function (e) {
        if (this.classList.contains('has-file') && !e.target.classList.contains('upload-replace')) return;
        cfg.inputEl.click();
      });

      if (cfg.replaceEl) {
        cfg.replaceEl.addEventListener('click', function (e) {
          e.stopPropagation();
          resetUpload(cfg);
          setTimeout(() => cfg.inputEl.click(), 100);
        });
      }

      cfg.imageEl.addEventListener('click', function (e) {
        e.stopPropagation();
        if (this.src) {
          dom.previewImage.src = this.src;
          dom.previewModal.classList.add('show');
        }
      });
    });
  }

  function handleFileSelect(input, cfg) {
    const file = input.files[0];
    if (!file) return;

    const err = validateImageFile(file, cfg.label);
    if (err) { showError(cfg.errorKey, err); input.value = ''; return; }

    showError(cfg.errorKey, '');
    uploadedFiles[cfg.errorKey === 'portrait' ? 'portrait' : cfg.errorKey === 'idFront' ? 'idFront' : 'idBack'] = file;

    const reader = new FileReader();
    reader.onload = async function (e) {
      const dataUrl = e.target.result;
      cfg.imageEl.src = dataUrl;
      cfg.previewEl.style.display = 'flex';
      cfg.placeholderEl.style.display = 'none';
      cfg.areaEl.classList.add('has-file');

      // 执行图片检测
      if (cfg.isPortrait) {
        await runPortraitChecks(cfg, dataUrl);
      } else if (cfg.side === 'front') {
        await runIdFrontChecks(cfg, dataUrl);
      }
    };
    reader.onerror = function () { showError(cfg.errorKey, '图片读取失败，请重新上传'); };
    reader.readAsDataURL(file);
  }

  function resetUpload(cfg) {
    cfg.inputEl.value = '';
    cfg.imageEl.src = '';
    cfg.previewEl.style.display = 'none';
    cfg.placeholderEl.style.display = 'flex';
    cfg.areaEl.classList.remove('has-file');
    const key = cfg.errorKey === 'portrait' ? 'portrait' : cfg.errorKey === 'idFront' ? 'idFront' : 'idBack';
    uploadedFiles[key] = null;
    if (cfg.side === 'front') delete ocrResults.idCard;
    // 清除检测提示
    const statusEl = cfg.areaEl.querySelector('.check-status');
    if (statusEl) statusEl.remove();
  }

  function validateImageFile(file, label) {
    if (!file) return `请上传${label}`;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return '仅支持 JPG/PNG 格式';
    if (file.size > 10 * 1024 * 1024) return '图片大小不能超过 10MB';
    return '';
  }

  // =============================================
  // 图片检测（证件照）
  // =============================================

  async function runPortraitChecks(cfg, dataUrl) {
    const img = new Image();
    img.src = dataUrl;
    await new Promise(resolve => { img.onload = resolve; });

    // 显示检测状态
    const statusEl = document.createElement('div');
    statusEl.className = 'check-status';
    statusEl.style.cssText = 'font-size:12px;color:#666;padding:4px 8px;text-align:center;';
    cfg.areaEl.appendChild(statusEl);

    // 1. 人脸检测
    statusEl.textContent = '🔍 检测人脸...';
    await sleep(100);
    const faceResult = await detectFace(img);
    if (!faceResult.hasFace) {
      showError(cfg.errorKey, faceResult.message);
      statusEl.textContent = '❌ ' + faceResult.message;
      return;
    }

    // 2. 清晰度检测
    statusEl.textContent = '🔍 检测清晰度...';
    await sleep(100);
    const sharpResult = checkSharpness(img);
    if (!sharpResult.isSharp) {
      showError(cfg.errorKey, sharpResult.message);
      statusEl.textContent = '❌ ' + sharpResult.message;
      return;
    }

    // 3. 背景检测
    statusEl.textContent = '🔍 检测背景...';
    await sleep(100);
    const bgResult = checkBackground(img, 'any');
    if (!bgResult.isSolid) {
      showError(cfg.errorKey, bgResult.message);
      statusEl.textContent = '❌ ' + bgResult.message;
      return;
    }

    // 全部通过
    statusEl.textContent = '✅ 照片检测通过';
    statusEl.style.color = '#34a853';
    showError(cfg.errorKey, '');
  }

  async function runIdFrontChecks(cfg, dataUrl) {
    const img = new Image();
    img.src = dataUrl;
    await new Promise(resolve => { img.onload = resolve; });

    const statusEl = document.createElement('div');
    statusEl.className = 'check-status';
    statusEl.style.cssText = 'font-size:12px;color:#666;padding:4px 8px;text-align:center;';
    cfg.areaEl.appendChild(statusEl);

    // 1. 清晰度检测
    statusEl.textContent = '🔍 检测清晰度...';
    await sleep(100);
    const sharpResult = checkSharpness(img);
    if (!sharpResult.isSharp) {
      showError(cfg.errorKey, sharpResult.message);
      statusEl.textContent = '❌ ' + sharpResult.message;
      return;
    }

    // 2. OCR 识别
    statusEl.textContent = '🔍 OCR识别身份证信息...（可能需要几秒钟）';
    await sleep(100);
    try {
      const ocrResult = await ocrIdCard(dataUrl, 'front');
      if (ocrResult.success) {
        ocrResults.idCard = ocrResult.fields.idCard || '';
        ocrResults.ocrName = ocrResult.fields.name || '';
        ocrResults.ocrGender = ocrResult.fields.gender || '';

        // 对比姓名
        const typedName = dom.name.value.trim();
        if (ocrResult.fields.name && typedName && !ocrResult.fields.name.includes(typedName) && !typedName.includes(ocrResult.fields.name)) {
          statusEl.textContent = '⚠️ 姓名与身份证不一致，请核对';
          statusEl.style.color = '#ea4335';
          showError(cfg.errorKey, `OCR识别姓名为"${ocrResult.fields.name}"，与填写的不一致`);
          return;
        }

        // 对比身份证号
        if (ocrResult.fields.idCard) {
          const typedId = dom.idCard.value.trim().toUpperCase();
          if (typedId && ocrResult.fields.idCard !== typedId) {
            statusEl.textContent = '⚠️ 身份证号与OCR识别不一致';
            statusEl.style.color = '#ea4335';
            showError(cfg.errorKey, `OCR识别号码为"${ocrResult.fields.idCard}"，与填写的不一致`);
            return;
          }
          // 自动填充身份证号
          if (!typedId) {
            dom.idCard.value = ocrResult.fields.idCard;
          }
        }

        statusEl.textContent = '✅ 身份证信息识别通过';
        statusEl.style.color = '#34a853';
        showError(cfg.errorKey, '');
      } else {
        statusEl.textContent = '⚠️ OCR识别失败，但仍可提交';
        statusEl.style.color = '#fbbc04';
      }
    } catch (e) {
      console.warn('OCR 失败:', e);
      statusEl.textContent = '⚠️ OCR识别失败，但仍可提交（手动核对）';
      statusEl.style.color = '#fbbc04';
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // =============================================
  // 增强表单验证
  // =============================================

  async function validateFormEnhanced() {
    const errors = {};

    // 姓名
    const nameErr = await validateNameSafe(dom.name.value);
    if (nameErr) errors.name = nameErr;

    // 性别
    if (!getRadioValue('gender')) errors.gender = '请选择性别';

    // 学历
    if (!dom.education.value) errors.education = '请选择学历';

    // 人员类型
    if (!getRadioValue('personType')) errors.personType = '请选择人员类型';

    // 身份证
    const idCardVal = dom.idCard.value.trim().toUpperCase();
    const idErr = validateIdCard(idCardVal);
    if (idErr) errors.idCard = idErr;

    // 工作单位
    if (!dom.workUnit.value.trim()) errors.workUnit = '请输入工作单位';
    else if (dom.workUnit.value.trim().length < 2) errors.workUnit = '工作单位名称过短';

    // 统一社会信用代码
    const creditErr = validateCreditCode(dom.creditCode.value);
    if (creditErr) errors.creditCode = creditErr;

    // 手机号
    const phoneErr = validatePhone(dom.phone.value);
    if (phoneErr) errors.phone = phoneErr;

    // 街道
    if (!dom.street.value) errors.street = '请选择所属街道';

    // 照片
    if (!dom.portraitInput.files[0]) errors.portrait = '请上传电子免冠证件照';
    if (!dom.idFrontInput.files[0]) errors.idFront = '请上传身份证正面照片';
    if (!dom.idBackInput.files[0]) errors.idBack = '请上传身份证反面照片';

    return errors;
  }

  async function validateNameSafe(v) {
    try { return validateName(v); } catch (e) { return !v.trim() ? '请输入姓名' : ''; }
  }

  /** 提交前完整验证（含异步检查） */
  async function preSubmitValidation() {
    const errors = await validateFormEnhanced();

    // 显示所有错误
    let firstErrKey = null;
    for (const [key, msg] of Object.entries(errors)) {
      showError(key, msg);
      if (!firstErrKey) firstErrKey = key;
    }

    if (firstErrKey) {
      // 滚动到第一个错误
      const elMap = {
        name: dom.name, gender: document.querySelector('.radio-group'), education: dom.education,
        personType: document.querySelectorAll('.radio-group')[1], idCard: dom.idCard,
        workUnit: dom.workUnit, creditCode: dom.creditCode, phone: dom.phone, street: dom.street,
        portrait: dom.portraitArea, idFront: dom.idFrontArea, idBack: dom.idBackArea,
      };
      const target = elMap[firstErrKey];
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(errorEls[firstErrKey]?.textContent || '请检查表单填写');
      return false;
    }

    // 报名时间段检查
    const windowCheck = await checkRegistrationWindow();
    if (!windowCheck.allowed) {
      showToast(windowCheck.message);
      return false;
    }

    // 身份证查重
    const dupCheck = await checkIdCardDuplicate(dom.idCard.value);
    if (dupCheck.duplicate) {
      showError('idCard', '此身份证号码已报名，请勿重复提交');
      dom.idCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('此身份证号码已报名');
      return false;
    }

    // OCR 姓名一致性检查（如果已识别的姓名与填写的不同）
    if (ocrResults.ocrName) {
      const typedName = dom.name.value.trim();
      if (typedName && !ocrResults.ocrName.includes(typedName) && !typedName.includes(ocrResults.ocrName)) {
        showError('name', `OCR识别姓名"${ocrResults.ocrName}"与填写不一致`);
        dom.name.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
    }

    // OCR 身份证号一致性检查
    if (ocrResults.idCard) {
      const typedId = dom.idCard.value.trim().toUpperCase();
      if (typedId && ocrResults.idCard !== typedId) {
        showError('idCard', `OCR识别号码"${ocrResults.idCard}"与填写不一致`);
        dom.idCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
    }

    return true;
  }

  // =============================================
  // 提交报名
  // =============================================

  async function handleSubmit(e) {
    e.preventDefault();
    clearAllErrors();

    if (!await preSubmitValidation()) return;

    dom.submitBtn.classList.add('loading');
    dom.submitBtn.disabled = true;

    try {
      const now = new Date();

      // 生成报名编号
      const { count } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', now.toISOString().slice(0, 10) + 'T00:00:00Z');

      const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
      const regNo = 'WX' + dateStr + String((count || 0) + 1).padStart(4, '0');
      const randomSuffix = Math.random().toString(36).substring(2, 8);

      // 上传照片（并行）
      const [portraitUrl, idFrontUrl, idBackUrl] = await Promise.all([
        uploadToSupabase(dom.portraitInput.files[0], 'portrait', `${regNo}_${randomSuffix}`),
        uploadToSupabase(dom.idFrontInput.files[0], 'idfront', `${regNo}_${randomSuffix}`),
        uploadToSupabase(dom.idBackInput.files[0], 'idback', `${regNo}_${randomSuffix}`),
      ]);

      // 写入数据库
      const { error } = await supabase.from('registrations').insert({
        registration_no: regNo,
        name: dom.name.value.trim(),
        gender: getRadioValue('gender'),
        education: dom.education.value,
        person_type: getRadioValue('personType'),
        id_card: dom.idCard.value.trim().toUpperCase(),
        work_unit: dom.workUnit.value.trim(),
        credit_code: dom.creditCode.value.trim().toUpperCase(),
        phone: dom.phone.value.trim(),
        street: dom.street.value,
        portrait_url: portraitUrl,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        submit_time: now.toISOString(),
        status: 'pending',
      });

      if (error) throw error;

      console.log(`✅ 报名成功: ${regNo}`);
      showSuccessModal(regNo);
      resetForm();

    } catch (err) {
      console.error('❌ 提交出错:', err);
      showToast(err.message || '提交失败，请检查网络连接后重试');
    } finally {
      dom.submitBtn.classList.remove('loading');
      dom.submitBtn.disabled = false;
    }
  }

  async function uploadToSupabase(file, folder, fileName) {
    const ext = file.name.split('.').pop();
    const filePath = `${folder}/${fileName}.${ext}`;
    const { error } = await supabase.storage
      .from('registration-photos')
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`照片上传失败: ${error.message}`);
    const { data } = supabase.storage.from('registration-photos').getPublicUrl(filePath);
    return data.publicUrl;
  }

  // =============================================
  // 弹窗与重置
  // =============================================

  function showSuccessModal(regNo) {
    const modalBody = dom.successModal.querySelector('.modal-body');
    if (regNo && modalBody) {
      modalBody.innerHTML = `
        <p>您的报名信息已成功提交。</p>
        <p style="font-size:18px;font-weight:700;color:#1a73e8;margin:8px 0;">报名编号：${regNo}</p>
        <p>请牢记报名编号以便后续查询。</p>
        <p>我们会尽快与您联系确认。</p>
        <p class="modal-info">如需修改信息，请联系工作人员。</p>
      `;
    }
    dom.successModal.classList.add('show');
  }

  function hideSuccessModal() { dom.successModal.classList.remove('show'); }
  function hidePreviewModal() { dom.previewModal.classList.remove('show'); }

  function resetForm() {
    dom.form.reset();
    uploadConfigs.forEach(c => resetUpload(c));
    clearAllErrors();
    document.querySelectorAll('.radio-item.checked').forEach(el => el.classList.remove('checked'));
    delete ocrResults.idCard;
    delete ocrResults.ocrName;
  }

  function handleResetClick(e) {
    if (e) e.preventDefault();
    if (window.confirm('确定要重新填写吗？已填写的内容将被清空。')) {
      resetForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // =============================================
  // 单字段实时验证
  // =============================================

  function setupFieldValidation() {
    dom.name.addEventListener('blur', () => showError('name', validateNameSafe(dom.name.value) || ''));
    dom.idCard.addEventListener('blur', () => showError('idCard', validateIdCard(dom.idCard.value)));

    dom.idCard.addEventListener('input', function () {
      if (errorEls.idCard.classList.contains('visible')) showError('idCard', '');
      this.value = this.value.replace(/[^0-9xX]/g, '');
      if (this.value.length > 18) this.value = this.value.slice(0, 18);
      if (this.value.length === 18 && this.value[17].toUpperCase() === 'X') {
        this.value = this.value.slice(0, 17) + 'X';
      }
    });

    dom.creditCode.addEventListener('input', function () {
      if (errorEls.creditCode.classList.contains('visible')) showError('creditCode', '');
      this.value = this.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
      if (this.value.length > 18) this.value = this.value.slice(0, 18);
    });
    dom.creditCode.addEventListener('blur', () => showError('creditCode', validateCreditCode(dom.creditCode.value)));

    dom.phone.addEventListener('input', function () {
      if (errorEls.phone.classList.contains('visible')) showError('phone', '');
      this.value = this.value.replace(/\D/g, '');
      if (this.value.length > 11) this.value = this.value.slice(0, 11);
    });
    dom.phone.addEventListener('blur', () => showError('phone', validatePhone(dom.phone.value)));

    dom.workUnit.addEventListener('input', () => {
      if (errorEls.workUnit.classList.contains('visible') && dom.workUnit.value.trim().length >= 2) showError('workUnit', '');
    });

    dom.education.addEventListener('change', () => {
      if (errorEls.education.classList.contains('visible')) showError('education', '');
    });
    dom.street.addEventListener('change', () => {
      if (errorEls.street.classList.contains('visible')) showError('street', '');
    });
    document.querySelectorAll('input[name="gender"]').forEach(el => {
      el.addEventListener('change', () => { if (errorEls.gender.classList.contains('visible')) showError('gender', ''); });
    });
    document.querySelectorAll('input[name="personType"]').forEach(el => {
      el.addEventListener('change', () => { if (errorEls.personType.classList.contains('visible')) showError('personType', ''); });
    });
  }

  // =============================================
  // 单选样式
  // =============================================

  function setupRadioStyling() {
    document.querySelectorAll('.radio-item input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', function () {
        const group = this.closest('.radio-group');
        if (group) group.querySelectorAll('.radio-item').forEach(item => item.classList.remove('checked'));
        if (this.checked) this.closest('.radio-item').classList.add('checked');
      });
    });
  }

  // =============================================
  // 初始化
  // =============================================

  function init() {
    setupFieldValidation();
    setupRadioStyling();
    setupUploadHandlers();

    dom.form.addEventListener('submit', handleSubmit);
    dom.resetBtn.addEventListener('click', handleResetClick);

    dom.modalCloseBtn.addEventListener('click', hideSuccessModal);
    dom.previewCloseBtn.addEventListener('click', hidePreviewModal);
    dom.successModal.addEventListener('click', e => { if (e.target === this) hideSuccessModal(); });
    dom.previewModal.addEventListener('click', e => { if (e.target === this) hidePreviewModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { hideSuccessModal(); hidePreviewModal(); } });

    console.log('✅ 万鑫安全培训报名系统（增强版）初始化完成');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
