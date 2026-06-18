/**
 * =============================================
 * 万鑫安全培训报名 - 图片检测模块
 * =============================================
 *
 * 功能：
 * - 人像检测（皮肤色区域 + 分辨率 + 位置）
 * - 清晰度检测（Laplacian 方差）
 * - 身份证 OCR（Tesseract.js）
 */

// =============================================
// 人像检测（基于像素分析，不依赖 FaceDetector API）
// =============================================

/**
 * 检测图片是否包含人像特征
 * @param {HTMLImageElement} imgEl
 * @returns {{ hasFace: boolean, message: string }}
 */
function detectPortrait(imgEl) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');

    const w = 150;
    const h = Math.round((w / imgEl.naturalWidth) * imgEl.naturalHeight);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(imgEl, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // 1. 检查分辨率
    if (imgEl.naturalWidth < 100 || imgEl.naturalHeight < 100) {
      return { hasFace: false, message: '照片分辨率太低，请上传更清晰的图片' };
    }

    // 2. 检查宽高比
    const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
    if (ratio < 0.2 || ratio > 3.0) {
      return { hasFace: false, message: '照片比例异常，请上传正常的人像照' };
    }

    // 3. 分析画面中央区域（人脸位置）
    const sx = Math.round(w * 0.25), ex = Math.round(w * 0.75);
    const sy = Math.round(h * 0.15), ey = Math.round(h * 0.85);

    let sumGray = 0, sumSqGray = 0, warmPixels = 0, count = 0;

    for (let y = sy; y < ey && y < h; y++) {
      for (let x = sx; x < ex && x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        sumGray += gray;
        sumSqGray += gray * gray;
        // 暖色调像素（皮肤偏红）：R > G + 3
        if (r > g + 3) warmPixels++;
        count++;
      }
    }

    if (count === 0) return { hasFace: true, message: '' };

    const meanGray = sumGray / count;
    const variance = sumSqGray / count - meanGray * meanGray;
    const warmRatio = warmPixels / count;

    // 画面必须有足够的亮暗变化（不是纯色背景/空白照）
    if (variance < 20) {
      return { hasFace: false, message: '照片过于均匀，请上传人像照片' };
    }

    // 必须有足够的暖色调像素（人脸皮肤呈暖色）
    if (warmRatio < 0.03) {
      return { hasFace: false, message: '未检测到人像特征，请上传正面人像照片' };
    }

    return { hasFace: true, message: '' };
  } catch (e) {
    console.warn('人像检测出错:', e);
    return { hasFace: false, message: "人脸检测不可用", error: true };
  }
}

// =============================================
// 清晰度检测（Laplacian 方差）
// =============================================

function checkSharpness(imgEl) {
  try {
    if (!imgEl.naturalWidth || !imgEl.naturalHeight) {
      return { isSharp: true, score: 100, message: '' };
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = Math.min(imgEl.naturalWidth, 300);
    const h = Math.round((w / imgEl.naturalWidth) * imgEl.naturalHeight);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(imgEl, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let sum = 0;
    let sumSq = 0;
    let count = 0;

    // 限制在画面中央 50% 区域检测（人脸通常在中部）
    const startY = Math.round(h * 0.15);
    const endY = Math.round(h * 0.85);
    const startX = Math.round(w * 0.15);
    const endX = Math.round(w * 0.85);

    // 使用更大的步长加速
    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const idx = (y * w + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

        const left = (y * w + (x - 2)) * 4;
        const right = (y * w + (x + 2)) * 4;
        const up = ((y - 2) * w + x) * 4;
        const down = ((y + 2) * w + x) * 4;

        const gl = 0.299 * data[left] + 0.587 * data[left + 1] + 0.114 * data[left + 2];
        const gr = 0.299 * data[right] + 0.587 * data[right + 1] + 0.114 * data[right + 2];
        const gu = 0.299 * data[up] + 0.587 * data[up + 1] + 0.114 * data[up + 2];
        const gd = 0.299 * data[down] + 0.587 * data[down + 1] + 0.114 * data[down + 2];

        const laplacian = Math.abs(4 * gray - gl - gr - gu - gd);
        sum += laplacian;
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    if (count === 0) return { isSharp: true, score: 0, message: '' };

    const variance = (sumSq / count) - (sum / count) * (sum / count);

    // 阈值：低于此值可能模糊
    if (variance < 8) {
      return { isSharp: false, score: Math.round(variance), message: '照片太模糊，请上传更清晰的照片' };
    }
    return { isSharp: true, score: Math.round(variance), message: '' };
  } catch (e) {
    console.warn('清晰度检测出错:', e);
    return { isSharp: true, score: 100, message: "", error: true };
  }
}

// =============================================
// 身份证 OCR（使用 Tesseract.js）
// =============================================

async function ocrIdCard(dataUrl, side) {
  try {
    if (typeof Tesseract === 'undefined') {
      console.warn('Tesseract.js 未加载');
      return { success: false, text: '', fields: {}, message: 'OCR 库未加载' };
    }

    const result = await Tesseract.recognize(dataUrl, 'chi_sim+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR 进度: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    const text = result.data.text;
    console.log('OCR 原始文本:', text.substring(0, 200));

    const fields = {};

    if (side === 'front') {
      // 尝试提取身份证号
      const idMatch = text.match(/\d{6}\d{8}\d{3}[\dXx]/);
      if (idMatch) fields.idCard = idMatch[0].toUpperCase();

      // 尝试提取姓名
      const nameMatch = text.match(/姓名[：:]\s*([^\n\r]{2,8})/);
      if (nameMatch) fields.name = nameMatch[1].trim();

      const genderMatch = text.match(/(男|女)/);
      if (genderMatch) fields.gender = genderMatch[0];
    }

    return { success: true, text, fields, message: '' };
  } catch (e) {
    console.error('OCR 失败:', e);
    return { success: false, text: '', fields: {}, message: '身份证识别失败，请重试' };
  }
}
