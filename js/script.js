/**
 * =============================================
 * 台州万鑫安全技术咨询有限公司
 * 安全培训报名网站 - 主逻辑
 * =============================================
 *
 * 数据存储：Supabase (PostgreSQL + Storage)
 * 数据库：isgzgscaljosdsxatclo.supabase.co
 */

(function () {
  'use strict';

  // =============================================
  // Supabase 初始化
  // =============================================
  const SUPABASE_URL = 'https://isgzgscaljosdsxatclo.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_Bd3-2QXZ9doG_-6fzkAfeg_TzXSiCiV';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // =============================================
  // 配置
  // =============================================
  const CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedImageTypes: ['image/jpeg', 'image/png'],
  };

  // =============================================
  // DOM 引用
  // =============================================
  const $ = (id) => document.getElementById(id);
  const dom = {
    form: $('signupForm'),
    name: $('name'),
    gender: document.querySelectorAll('input[name="gender"]'),
    education: $('education'),
    personType: document.querySelectorAll('input[name="personType"]'),
    idCard: $('idCard'),
    workUnit: $('workUnit'),
    creditCode: $('creditCode'),
    phone: $('phone'),
    street: $('street'),
    portraitInput: $('portraitInput'),
    idFrontInput: $('idFrontInput'),
    idBackInput: $('idBackInput'),
    portraitArea: $('portraitArea'),
    idFrontArea: $('idFrontArea'),
    idBackArea: $('idBackArea'),
    portraitPreview: $('portraitPreview'),
    idFrontPreview: $('idFrontPreview'),
    idBackPreview: $('idBackPreview'),
    portraitImage: $('portraitImage'),
    idFrontImage: $('idFrontImage'),
    idBackImage: $('idBackImage'),
    submitBtn: $('submitBtn'),
    resetBtn: $('resetBtn'),
    successModal: $('successModal'),
    previewModal: $('previewModal'),
    previewImage: $('previewImage'),
    modalCloseBtn: $('modalCloseBtn'),
    previewCloseBtn: $('previewCloseBtn'),
  };

  // 错误信息元素
  const errorEls = {
    name: $('nameError'),
    gender: $('genderError'),
    education: $('educationError'),
    personType: $('personTypeError'),
    idCard: $('idCardError'),
    workUnit: $('workUnitError'),
    creditCode: $('creditCodeError'),
    phone: $('phoneError'),
    street: $('streetError'),
    portrait: $('portraitError'),
    idFront: $('idFrontError'),
    idBack: $('idBackError'),
  };

  // =============================================
  // 验证规则
  // =============================================
  const VALIDATORS = {
    name: (v) => {
      v = v.trim();
      if (!v) return '请输入姓名';
      if (v.length < 2) return '姓名至少2个字符';
      if (v.length > 30) return '姓名不能超过30个字符';
      return '';
    },

    gender: (v) => {
      if (!v) return '请选择性别';
      return '';
    },

    education: (v) => {
      if (!v) return '请选择学历';
      return '';
    },

    personType: (v) => {
      if (!v) return '请选择人员类型';
      return '';
    },

    idCard: (v) => {
      v = v.trim().toUpperCase();
      if (!v) return '请输入身份证号码';
      if (!/^\d{17}[\dX]$/.test(v)) return '身份证号码格式不正确，应为18位（末位可为X）';
      const year = parseInt(v.substr(6, 4), 10);
      const month = parseInt(v.substr(10, 2), 10);
      const day = parseInt(v.substr(12, 2), 10);
      const birth = new Date(year, month - 1, day);
      if (birth.getFullYear() !== year ||
          birth.getMonth() !== month - 1 ||
          birth.getDate() !== day) {
        return '身份证号码中出生日期无效';
      }
      const now = new Date();
      if (birth > now) return '出生日期不能是未来日期';
      if (now.getFullYear() - year > 150) return '出生日期异常';
      if (!checkIdCardChecksum(v)) return '身份证号码校验位不正确';
      return '';
    },

    workUnit: (v) => {
      v = v.trim();
      if (!v) return '请输入工作单位';
      if (v.length < 2) return '工作单位名称过短';
      if (v.length > 100) return '工作单位名称不能超过100个字符';
      return '';
    },

    creditCode: (v) => {
      v = v.trim().toUpperCase();
      if (!v) return '请输入统一社会信用代码';
      if (v.length !== 18) return '统一社会信用代码必须为18位';
      if (!/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/.test(v)) {
        return '统一社会信用代码格式不正确';
      }
      if (!checkCreditCodeChecksum(v)) return '统一社会信用代码校验位不正确';
      return '';
    },

    phone: (v) => {
      v = v.trim();
      if (!v) return '请输入联系电话';
      if (!/^1[3-9]\d{9}$/.test(v)) return '请输入正确的11位手机号码';
      return '';
    },

    street: (v) => {
      if (!v) return '请选择所属街道';
      const valid = ['洪家街道', '下陈街道', '海门街道', '葭芷街道', '白云街道', '前所街道', '章安街道'];
      if (!valid.includes(v)) return '请选择有效的街道';
      return '';
    },

    file: (file, fieldName) => {
      if (!file) return `请上传${fieldName}`;
      if (!CONFIG.allowedImageTypes.includes(file.type)) {
        return '仅支持 JPG/PNG 格式的图片';
      }
      if (file.size > CONFIG.maxFileSize) {
        return '图片大小不能超过 10MB';
      }
      return '';
    },
  };

  // =============================================
  // 校验函数
  // =============================================

  /** 身份证校验位检查（18位） */
  function checkIdCardChecksum(id) {
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(id[i], 10) * weights[i];
    }
    return checkCodes[sum % 11] === id[17].toUpperCase();
  }

  /** 统一社会信用代码校验位检查 */
  function checkCreditCodeChecksum(code) {
    const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
    const charMap = '0123456789ABCDEFGHJKLMNPQRTUWXY';
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      const idx = charMap.indexOf(code[i]);
      if (idx === -1) return false;
      sum += idx * weights[i];
    }
    const checkIdx = (31 - (sum % 31)) % 31;
    return charMap[checkIdx] === code[17];
  }

  /** 获取选中单选值 */
  function getRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  /** 显示字段错误 */
  function showError(field, message) {
    if (errorEls[field]) {
      errorEls[field].textContent = message;
      if (message) {
        errorEls[field].classList.add('visible');
      } else {
        errorEls[field].classList.remove('visible');
      }
    }
    const inputMap = {
      name: dom.name,
      idCard: dom.idCard,
      workUnit: dom.workUnit,
      creditCode: dom.creditCode,
      phone: dom.phone,
      education: dom.education,
      street: dom.street,
    };
    if (inputMap[field]) {
      inputMap[field].classList.toggle('error', !!message);
    }
  }

  /** 清除所有错误 */
  function clearAllErrors() {
    Object.keys(errorEls).forEach((key) => showError(key, ''));
    document.querySelectorAll('.form-input.error, .form-select.error').forEach((el) => {
      el.classList.remove('error');
    });
  }

  /** Toast 提示 */
  function showToast(message, duration) {
    duration = duration || 2500;
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, duration);
  }

  /** 弹出确认框 */
  function showConfirm(message, onConfirm, onCancel) {
    if (window.confirm(message)) {
      if (onConfirm) onConfirm();
    } else {
      if (onCancel) onCancel();
    }
  }

  // =============================================
  // 表单验证
  // =============================================
  function validateForm() {
    let isValid = true;

    const textFields = [
      { key: 'name', value: dom.name.value, validator: VALIDATORS.name },
      { key: 'gender', value: getRadioValue('gender'), validator: VALIDATORS.gender },
      { key: 'education', value: dom.education.value, validator: VALIDATORS.education },
      { key: 'personType', value: getRadioValue('personType'), validator: VALIDATORS.personType },
      { key: 'idCard', value: dom.idCard.value, validator: VALIDATORS.idCard },
      { key: 'workUnit', value: dom.workUnit.value, validator: VALIDATORS.workUnit },
      { key: 'creditCode', value: dom.creditCode.value, validator: VALIDATORS.creditCode },
      { key: 'phone', value: dom.phone.value, validator: VALIDATORS.phone },
      { key: 'street', value: dom.street.value, validator: VALIDATORS.street },
    ];

    textFields.forEach(({ key, value, validator }) => {
      const err = validator(value);
      showError(key, err);
      if (err) isValid = false;
    });

    const uploadFields = [
      { key: 'portrait', file: dom.portraitInput.files[0], label: '电子免冠证件照' },
      { key: 'idFront', file: dom.idFrontInput.files[0], label: '身份证正面照片' },
      { key: 'idBack', file: dom.idBackInput.files[0], label: '身份证反面照片' },
    ];

    uploadFields.forEach(({ key, file, label }) => {
      if (!file) {
        showError(key, `请上传${label}`);
        isValid = false;
      } else {
        const err = VALIDATORS.file(file, label);
        showError(key, err);
        if (err) isValid = false;
      }
    });

    return isValid;
  }

  /** 验证并滚动到第一个错误 */
  function validateAndScroll() {
    const fields = [
      { key: 'name', value: dom.name.value, validator: VALIDATORS.name, el: dom.name },
      { key: 'gender', value: getRadioValue('gender'), validator: VALIDATORS.gender },
      { key: 'education', value: dom.education.value, validator: VALIDATORS.education, el: dom.education },
      { key: 'personType', value: getRadioValue('personType'), validator: VALIDATORS.personType },
      { key: 'idCard', value: dom.idCard.value, validator: VALIDATORS.idCard, el: dom.idCard },
      { key: 'workUnit', value: dom.workUnit.value, validator: VALIDATORS.workUnit, el: dom.workUnit },
      { key: 'creditCode', value: dom.creditCode.value, validator: VALIDATORS.creditCode, el: dom.creditCode },
      { key: 'phone', value: dom.phone.value, validator: VALIDATORS.phone, el: dom.phone },
      { key: 'street', value: dom.street.value, validator: VALIDATORS.street, el: dom.street },
    ];

    let firstErrorKey = null;

    for (const { key, value, validator } of fields) {
      const err = validator(value);
      showError(key, err);
      if (err && !firstErrorKey) firstErrorKey = key;
    }

    const uploadFields = [
      { key: 'portrait', file: dom.portraitInput.files[0], label: '电子免冠证件照' },
      { key: 'idFront', file: dom.idFrontInput.files[0], label: '身份证正面照片' },
      { key: 'idBack', file: dom.idBackInput.files[0], label: '身份证反面照片' },
    ];

    let firstUploadErrorKey = null;
    uploadFields.forEach(({ key, file, label }) => {
      if (!file) {
        showError(key, `请上传${label}`);
        if (!firstUploadErrorKey) firstUploadErrorKey = key;
      } else {
        const err = VALIDATORS.file(file, label);
        showError(key, err);
        if (err && !firstUploadErrorKey) firstUploadErrorKey = key;
      }
    });

    const firstError = firstErrorKey || firstUploadErrorKey;
    if (firstError) {
      if (firstUploadErrorKey && !firstErrorKey) {
        const uploadAreaMap = {
          portrait: dom.portraitArea,
          idFront: dom.idFrontArea,
          idBack: dom.idBackArea,
        };
        const target = uploadAreaMap[firstError];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const inputMap = {
          name: dom.name,
          gender: document.querySelector('.radio-group'),
          education: dom.education,
          personType: document.querySelectorAll('.radio-group')[1],
          idCard: dom.idCard,
          workUnit: dom.workUnit,
          creditCode: dom.creditCode,
          phone: dom.phone,
          street: dom.street,
        };
        const target = inputMap[firstErrorKey];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast(errorEls[firstError] ? errorEls[firstError].textContent : '请检查表单填写');
    }

    return !firstError;
  }

  // =============================================
  // 单字段实时验证
  // =============================================
  function setupFieldValidation() {
    dom.name.addEventListener('blur', () => showError('name', VALIDATORS.name(dom.name.value)));
    dom.idCard.addEventListener('blur', () => showError('idCard', VALIDATORS.idCard(dom.idCard.value)));
    dom.workUnit.addEventListener('blur', () => showError('workUnit', VALIDATORS.workUnit(dom.workUnit.value)));
    dom.creditCode.addEventListener('blur', () => showError('creditCode', VALIDATORS.creditCode(dom.creditCode.value)));
    dom.phone.addEventListener('blur', () => showError('phone', VALIDATORS.phone(dom.phone.value)));

    dom.name.addEventListener('input', () => {
      if (errorEls.name.classList.contains('visible')) showError('name', '');
    });

    dom.idCard.addEventListener('input', function () {
      if (errorEls.idCard.classList.contains('visible')) showError('idCard', '');
      this.value = this.value.replace(/[^0-9xX]/g, '');
      if (this.value.length > 18) this.value = this.value.slice(0, 18);
      if (this.value.length === 18 && this.value[17].toUpperCase() === 'X') {
        this.value = this.value.slice(0, 17) + 'X';
      }
    });

    dom.workUnit.addEventListener('input', () => {
      if (errorEls.workUnit.classList.contains('visible')) showError('workUnit', '');
    });

    dom.creditCode.addEventListener('input', function () {
      if (errorEls.creditCode.classList.contains('visible')) showError('creditCode', '');
      this.value = this.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
      if (this.value.length > 18) this.value = this.value.slice(0, 18);
    });

    dom.phone.addEventListener('input', function () {
      if (errorEls.phone.classList.contains('visible')) showError('phone', '');
      this.value = this.value.replace(/\D/g, '');
      if (this.value.length > 11) this.value = this.value.slice(0, 11);
    });

    dom.education.addEventListener('change', () => {
      if (errorEls.education.classList.contains('visible')) showError('education', '');
    });
    dom.street.addEventListener('change', () => {
      if (errorEls.street.classList.contains('visible')) showError('street', '');
    });

    document.querySelectorAll('input[name="gender"]').forEach((el) => {
      el.addEventListener('change', () => {
        if (errorEls.gender.classList.contains('visible')) showError('gender', '');
      });
    });
    document.querySelectorAll('input[name="personType"]').forEach((el) => {
      el.addEventListener('change', () => {
        if (errorEls.personType.classList.contains('visible')) showError('personType', '');
      });
    });
  }

  // =============================================
  // 单选按钮样式增强
  // =============================================
  function setupRadioStyling() {
    document.querySelectorAll('.radio-item input[type="radio"]').forEach((radio) => {
      radio.addEventListener('change', function () {
        const group = this.closest('.radio-group');
        if (group) {
          group.querySelectorAll('.radio-item').forEach((item) => item.classList.remove('checked'));
        }
        if (this.checked) {
          this.closest('.radio-item').classList.add('checked');
        }
      });
    });
  }

  // =============================================
  // 文件上传处理
  // =============================================
  function setupUploadHandlers() {
    const uploadConfigs = [
      {
        input: dom.portraitInput,
        area: dom.portraitArea,
        preview: dom.portraitPreview,
        image: dom.portraitImage,
        placeholderId: 'portraitPlaceholder',
        replaceBtn: 'portraitReplace',
        errorKey: 'portrait',
      },
      {
        input: dom.idFrontInput,
        area: dom.idFrontArea,
        preview: dom.idFrontPreview,
        image: dom.idFrontImage,
        placeholderId: 'idFrontPlaceholder',
        replaceBtn: 'idFrontReplace',
        errorKey: 'idFront',
      },
      {
        input: dom.idBackInput,
        area: dom.idBackArea,
        preview: dom.idBackPreview,
        image: dom.idBackImage,
        placeholderId: 'idBackPlaceholder',
        replaceBtn: 'idBackReplace',
        errorKey: 'idBack',
      },
    ];

    uploadConfigs.forEach((cfg) => {
      cfg.input.addEventListener('change', function () {
        handleFileSelect(this, cfg);
      });

      cfg.area.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.classList.add('dragover');
      });
      cfg.area.addEventListener('dragleave', function (e) {
        e.preventDefault();
        this.classList.remove('dragover');
      });
      cfg.area.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          cfg.input.files = e.dataTransfer.files;
          handleFileSelect(cfg.input, cfg);
        }
      });

      cfg.area.addEventListener('click', function (e) {
        if (this.classList.contains('has-file') && !e.target.classList.contains('upload-replace')) {
          return;
        }
      });

      const replaceBtn = document.getElementById(cfg.replaceBtn);
      if (replaceBtn) {
        replaceBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          resetUpload(cfg);
          setTimeout(() => cfg.input.click(), 100);
        });
      }

      cfg.image.addEventListener('click', function (e) {
        e.stopPropagation();
        if (this.src) {
          dom.previewImage.src = this.src;
          dom.previewModal.classList.add('show');
        }
      });
    });
  }

  /** 处理文件选择 */
  function handleFileSelect(input, cfg) {
    const file = input.files[0];
    if (!file) return;

    const label = cfg.errorKey === 'portrait' ? '电子免冠证件照' : '身份证照片';
    const err = VALIDATORS.file(file, label);
    if (err) {
      showError(cfg.errorKey, err);
      input.value = '';
      return;
    }

    showError(cfg.errorKey, '');

    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      cfg.image.src = dataUrl;
      cfg.preview.style.display = 'flex';
      document.getElementById(cfg.placeholderId).style.display = 'none';
      cfg.area.classList.add('has-file');
    };
    reader.onerror = function () {
      showError(cfg.errorKey, '图片读取失败，请重新上传');
    };
    reader.readAsDataURL(file);
  }

  /** 重置上传状态 */
  function resetUpload(cfg) {
    cfg.input.value = '';
    cfg.image.src = '';
    cfg.preview.style.display = 'none';
    document.getElementById(cfg.placeholderId).style.display = 'flex';
    cfg.area.classList.remove('has-file');
  }

  // =============================================
  // Supabase 数据操作
  // =============================================

  /** 生成报名编号（查询当天已有数量） */
  async function generateRegNo() {
    const now = new Date();
    const dateStr = now.getFullYear()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0');

    const { count, error } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', now.toISOString().slice(0, 10) + 'T00:00:00Z');

    if (error) {
      console.warn('获取计数失败，使用备选方案:', error);
    }

    const seq = ((count || 0) + 1).toString().padStart(4, '0');
    return `WX${dateStr}${seq}`;
  }

  /** 上传图片到 Supabase Storage */
  async function uploadPhoto(file, folder, fileName) {
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from('registration-photos')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('图片上传失败:', error);
      throw new Error('照片上传失败，请重试');
    }

    const { data: urlData } = supabase.storage
      .from('registration-photos')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  // =============================================
  // 提交表单
  // =============================================
  async function handleSubmit(e) {
    e.preventDefault();

    clearAllErrors();

    if (!validateAndScroll()) return;

    // 加载状态
    dom.submitBtn.classList.add('loading');
    dom.submitBtn.disabled = true;

    try {
      const now = new Date();
      const regNo = await generateRegNo();
      const randomSuffix = Math.random().toString(36).substring(2, 8);

      // 1. 上传三张照片到 Supabase Storage（并行上传）
      const [portraitUrl, idFrontUrl, idBackUrl] = await Promise.all([
        uploadPhoto(dom.portraitInput.files[0], 'portrait', `${regNo}_${randomSuffix}`),
        uploadPhoto(dom.idFrontInput.files[0], 'idfront', `${regNo}_${randomSuffix}`),
        uploadPhoto(dom.idBackInput.files[0], 'idback', `${regNo}_${randomSuffix}`),
      ]);

      // 2. 写入数据库
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

      if (error) {
        console.error('数据库写入失败:', error);
        // 尝试清理已上传的图片（静默）
        supabase.storage.from('registration-photos').remove([
          `portrait/${regNo}_${randomSuffix}`,
          `idfront/${regNo}_${randomSuffix}`,
          `idback/${regNo}_${randomSuffix}`,
        ]).catch(() => {});

        throw new Error('数据保存失败，请稍后重试');
      }

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

  // =============================================
  // 重置表单
  // =============================================
  function resetAllUploads() {
    const configs = [
      { placeholderId: 'portraitPlaceholder', preview: dom.portraitPreview, area: dom.portraitArea, input: dom.portraitInput },
      { placeholderId: 'idFrontPlaceholder', preview: dom.idFrontPreview, area: dom.idFrontArea, input: dom.idFrontInput },
      { placeholderId: 'idBackPlaceholder', preview: dom.idBackPreview, area: dom.idBackArea, input: dom.idBackInput },
    ];
    configs.forEach((c) => {
      c.input.value = '';
      c.preview.style.display = 'none';
      document.getElementById(c.placeholderId).style.display = 'flex';
      c.area.classList.remove('has-file');
    });
  }

  function resetForm() {
    dom.form.reset();
    resetAllUploads();
    clearAllErrors();
    document.querySelectorAll('.radio-item.checked').forEach((el) => el.classList.remove('checked'));
  }

  // =============================================
  // 弹窗控制
  // =============================================
  function showSuccessModal(regNo) {
    const modalBody = dom.successModal.querySelector('.modal-body');
    if (regNo && modalBody) {
      modalBody.innerHTML = `
        <p>您的报名信息已成功提交。</p>
        <p style="font-size:18px;font-weight:700;color:#1a73e8;margin:8px 0;">
          报名编号：${regNo}
        </p>
        <p>我们会尽快与您联系确认。</p>
        <p class="modal-info">如需修改信息，请联系工作人员。</p>
      `;
    }
    dom.successModal.classList.add('show');
  }

  function hideSuccessModal() {
    dom.successModal.classList.remove('show');
  }

  function hidePreviewModal() {
    dom.previewModal.classList.remove('show');
  }

  // =============================================
  // 重置表单事件
  // =============================================
  function handleReset(e) {
    if (e) e.preventDefault();
    showConfirm('确定要重新填写吗？已填写的内容将被清空。', () => {
      resetForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    dom.resetBtn.addEventListener('click', handleReset);

    // 弹窗关闭
    dom.modalCloseBtn.addEventListener('click', hideSuccessModal);
    dom.previewCloseBtn.addEventListener('click', hidePreviewModal);

    dom.successModal.addEventListener('click', function (e) {
      if (e.target === this) hideSuccessModal();
    });
    dom.previewModal.addEventListener('click', function (e) {
      if (e.target === this) hidePreviewModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        hideSuccessModal();
        hidePreviewModal();
      }
    });

    console.log('✅ 安全培训报名网站初始化完成');
    console.log('📊 数据存储: Supabase (PostgreSQL + Storage)');
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
