/**
 * =============================================
 * 台州万鑫安全技术咨询有限公司
 * 安全培训报名网站 - 主逻辑
 * =============================================
 */

(function () {
  'use strict';

  // =============================================
  // 配置
  // =============================================
  const CONFIG = {
    apiUrl: '', // 部署时修改为实际API地址，留空使用本地存储
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

  // 上传文件数据（Base64）
  const uploadData = {
    portrait: null,
    idFront: null,
    idBack: null,
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
      // 验证出生日期
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
    // 输入框高亮
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

  /** Toast 提示（替代 alert） */
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

  /** 弹出确认框（模拟） */
  function showConfirm(message, onConfirm, onCancel) {
    if (window.confirm(message)) {
      if (onConfirm) onConfirm();
    } else {
      if (onCancel) onCancel();
    }
  }

  // =============================================
  // 表单验证（完整验证）
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

    // 验证照片上传
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

    // 照片
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
        // 滚动到上传区域
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
    // 失焦验证
    dom.name.addEventListener('blur', () => showError('name', VALIDATORS.name(dom.name.value)));
    dom.idCard.addEventListener('blur', () => showError('idCard', VALIDATORS.idCard(dom.idCard.value)));
    dom.workUnit.addEventListener('blur', () => showError('workUnit', VALIDATORS.workUnit(dom.workUnit.value)));
    dom.creditCode.addEventListener('blur', () => showError('creditCode', VALIDATORS.creditCode(dom.creditCode.value)));
    dom.phone.addEventListener('blur', () => showError('phone', VALIDATORS.phone(dom.phone.value)));

    // 输入时清除错误 + 格式化
    dom.name.addEventListener('input', () => {
      if (errorEls.name.classList.contains('visible')) showError('name', '');
    });

    dom.idCard.addEventListener('input', function () {
      if (errorEls.idCard.classList.contains('visible')) showError('idCard', '');
      // 只允许数字和X
      this.value = this.value.replace(/[^0-9xX]/g, '');
      if (this.value.length > 18) this.value = this.value.slice(0, 18);
      // 末位自动大写
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

    // 选择变更时清除错误
    dom.education.addEventListener('change', () => {
      if (errorEls.education.classList.contains('visible')) showError('education', '');
    });
    dom.street.addEventListener('change', () => {
      if (errorEls.street.classList.contains('visible')) showError('street', '');
    });

    // 单选变更
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
    // 监听单选变化，添加 .checked 类
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
        dataKey: 'portrait',
      },
      {
        input: dom.idFrontInput,
        area: dom.idFrontArea,
        preview: dom.idFrontPreview,
        image: dom.idFrontImage,
        placeholderId: 'idFrontPlaceholder',
        replaceBtn: 'idFrontReplace',
        errorKey: 'idFront',
        dataKey: 'idFront',
      },
      {
        input: dom.idBackInput,
        area: dom.idBackArea,
        preview: dom.idBackPreview,
        image: dom.idBackImage,
        placeholderId: 'idBackPlaceholder',
        replaceBtn: 'idBackReplace',
        errorKey: 'idBack',
        dataKey: 'idBack',
      },
    ];

    uploadConfigs.forEach((cfg) => {
      // 文件选择
      cfg.input.addEventListener('change', function () {
        handleFileSelect(this, cfg);
      });

      // 拖拽上传
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

      // 点击上传区域触发文件选择
      cfg.area.addEventListener('click', function (e) {
        // 如果已经有文件且点击的不是重新上传按钮，不触发
        if (this.classList.contains('has-file') && !e.target.classList.contains('upload-replace')) {
          return;
        }
      });

      // 重新上传按钮
      const replaceBtn = document.getElementById(cfg.replaceBtn);
      if (replaceBtn) {
        replaceBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          resetUpload(cfg);
          // 触发文件选择
          setTimeout(() => cfg.input.click(), 100);
        });
      }

      // 点击预览图片放大
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

    const label = cfg.dataKey === 'portrait' ? '电子免冠证件照' : '身份证照片';
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
      uploadData[cfg.dataKey] = dataUrl;
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
    uploadData[cfg.dataKey] = null;
  }

  // =============================================
  // 提交表单
  // =============================================
  async function handleSubmit(e) {
    e.preventDefault();

    clearAllErrors();

    if (!validateAndScroll()) return;

    // 收集数据
    const formData = {
      name: dom.name.value.trim(),
      gender: getRadioValue('gender'),
      education: dom.education.value,
      personType: getRadioValue('personType'),
      idCard: dom.idCard.value.trim().toUpperCase(),
      workUnit: dom.workUnit.value.trim(),
      creditCode: dom.creditCode.value.trim().toUpperCase(),
      phone: dom.phone.value.trim(),
      street: dom.street.value,
      portrait: uploadData.portrait,
      idFront: uploadData.idFront,
      idBack: uploadData.idBack,
      submitTime: new Date().toISOString(),
    };

    // 加载状态
    dom.submitBtn.classList.add('loading');
    dom.submitBtn.disabled = true;

    try {
      let result;

      if (CONFIG.apiUrl) {
        // 远程提交
        const response = await fetch(CONFIG.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error(`服务器响应异常 (${response.status})`);
        result = await response.json();
      } else {
        // 本地存储模式
        result = await saveToLocalStorage(formData);
      }

      if (result.success) {
        showSuccessModal();
        dom.form.reset();
        resetAllUploads();
        clearAllErrors();
        // 重置单选样式
        document.querySelectorAll('.radio-item.checked').forEach((el) => el.classList.remove('checked'));
      } else {
        showToast('提交失败：' + (result.message || '未知错误'));
      }
    } catch (err) {
      console.error('提交出错:', err);
      showToast('提交失败，请检查网络连接后重试');
    } finally {
      dom.submitBtn.classList.remove('loading');
      dom.submitBtn.disabled = false;
    }
  }

  // =============================================
  // 本地存储
  // =============================================
  function saveToLocalStorage(formData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const key = 'wx_training_registrations';
          let records = [];
          try {
            const stored = localStorage.getItem(key);
            if (stored) records = JSON.parse(stored);
            if (!Array.isArray(records)) records = [];
          } catch (e) { /* ignore */ }

          // 生成报名编号
          const now = new Date();
          const regNo = 'WX' + now.getFullYear()
            + String(now.getMonth() + 1).padStart(2, '0')
            + String(now.getDate()).padStart(2, '0')
            + String(records.length + 1).padStart(4, '0');

          formData.registrationNo = regNo;

          records.push(formData);
          localStorage.setItem(key, JSON.stringify(records));

          resolve({ success: true, registrationNo: regNo });
        } catch (e) {
          resolve({ success: false, message: '数据存储失败：' + e.message });
        }
      }, 800);
    });
  }

  // =============================================
  // 重置所有上传
  // =============================================
  function resetAllUploads() {
    const configs = [
      { placeholderId: 'portraitPlaceholder', preview: dom.portraitPreview, area: dom.portraitArea, input: dom.portraitInput, key: 'portrait' },
      { placeholderId: 'idFrontPlaceholder', preview: dom.idFrontPreview, area: dom.idFrontArea, input: dom.idFrontInput, key: 'idFront' },
      { placeholderId: 'idBackPlaceholder', preview: dom.idBackPreview, area: dom.idBackArea, input: dom.idBackInput, key: 'idBack' },
    ];
    configs.forEach((c) => {
      c.input.value = '';
      c.preview.style.display = 'none';
      document.getElementById(c.placeholderId).style.display = 'flex';
      c.area.classList.remove('has-file');
      uploadData[c.key] = null;
    });
  }

  // =============================================
  // 弹窗控制
  // =============================================
  function showSuccessModal() {
    dom.successModal.classList.add('show');
  }

  function hideSuccessModal() {
    dom.successModal.classList.remove('show');
  }

  function hidePreviewModal() {
    dom.previewModal.classList.remove('show');
  }

  // =============================================
  // 重置表单
  // =============================================
  function handleReset(e) {
    if (e) e.preventDefault();
    showConfirm('确定要重新填写吗？已填写的内容将被清空。', () => {
      dom.form.reset();
      clearAllErrors();
      resetAllUploads();
      document.querySelectorAll('.radio-item.checked').forEach((el) => el.classList.remove('checked'));
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

    // ESC 关闭弹窗
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        hideSuccessModal();
        hidePreviewModal();
      }
    });

    console.log('✅ 安全培训报名网站初始化完成');
    console.log('📋 当前模式:', CONFIG.apiUrl ? '远程模式' : '本地模式（数据存储在浏览器中）');
    console.log('💡 提示: 打开浏览器开发者工具 → Application → Local Storage 查看已提交数据');
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
