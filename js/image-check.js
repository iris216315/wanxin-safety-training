/**
 * =============================================
 * 万鑫安全培训报名 - 图片检测模块
 * =============================================
 *
 * 功能：
 * - 人脸检测（FaceDetector API）
 * - 清晰度检测（Laplacian 方差）
 * - 背景纯色检测
 * - 身份证 OCR（Tesseract.js）
 */

// =============================================
// 人脸检测（使用浏览器内置 FaceDetector API）
// =============================================

/**
 * 检测图片中是否有人脸
 * @param {HTMLImageElement|HTMLCanvasElement} imgEl
 * @returns {{ hasFace: boolean, faceCount: number, message: string }}
 */
async function detectFace(imgEl) {
  // 检查 FaceDetector API 是否可用
  if (!window.FaceDetector) {
    console.warn('FaceDetector API 不可用，跳过人脸检测');
    return { hasFace: true, faceCount: 1, message: '' };
  }

  try {
    const detector = new FaceDetector({ fastMode: true });
    const faces = await detector.detect(imgEl);

    if (faces.length === 0) {
      return { hasFace: false, faceCount: 0, message: '未检测到人脸，请上传正面免冠证件照' };
    }
    if (faces.length > 1) {
      return { hasFace: false, faceCount: faces.length, message: '检测到多张人脸，请上传单人证件照' };
    }

    // 检查人脸是否在画面中央区域
    const imgW = imgEl.naturalWidth || imgEl.width;
    const imgH = imgEl.naturalHeight || imgEl.height;
    const face = faces[0];
    const faceCenterX = face.boundingBox.x + face.boundingBox.width / 2;
    const faceCenterY = face.boundingBox.y + face.boundingBox.height / 2;
    const centerX = imgW / 2;
    const centerY = imgH / 2;

    // 人脸中心偏离不超过画面 20%
    const maxOffsetX = imgW * 0.2;
    const maxOffsetY = imgH * 0.2;

    if (Math.abs(faceCenterX - centerX) > maxOffsetX || Math.abs(faceCenterY - centerY) > maxOffsetY) {
      return { hasFace: false, faceCount: 1, message: '人脸未居中，请调整照片' };
    }

    // 人脸占比太小（太小的人脸说明可能不是证件照格式）
    const faceArea = face.boundingBox.width * face.boundingBox.height;
    const imgArea = imgW * imgH;
    const faceRatio = faceArea / imgArea;

    if (faceRatio < 0.02) {
      return { hasFace: false, faceCount: 1, message: '人脸占比过小，请上传更近景的证件照' };
    }

    return { hasFace: true, faceCount: 1, message: '' };
  } catch (ee) {
    console.warn('人脸检测出错:', ee);
    return { hasFace: true, faceCount: 1, message: '' };
  }
}

// =============================================
// 清晰度检测（Laplacian 方差）
// =============================================

/**
 * 检测图片清晰度
 * @param {HTMLImageElement|HTMLCanvasElement} imgEl
 * @returns { { isSharp: boolean, score: number, message: string } }
 */
function checkSharpness(imgEl) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = 200; // 缩小到200px宽以提高性能
    const h = Math.round((w / imgEl.naturalWidth) * imgEl.naturalHeight);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(imgEl, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // 计算 Laplacian 方差（灰度图）
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

        // 简单 Laplacian 近似
        const left = (y * w + (x - 1)) * 4;
        const right = (y * w + (x + 1)) * 4;
        const up = ((y - 1) * w + x) * 4;
        const down = ((y + 1) * w + x) * 4;

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

    const variance = (sumSq / count) - (sum / count) * (sum / count);
    const threshold = 50; // 经验阈值，低于此值说明图片模糊

    if (variance < threshold) {
      return { isSharp: false, score: Math.round(variance), message: '照片模糊，请上传清晰的证件照' };
    }
    return { isSharp: true, score: Math.round(variance), message: '' };
  } catch (e) {
    console.warn('清晰度检测出错:', e);
    return { isSharp: true, score: 100, message: '' };
  }
}

// =============================================
// 背景颜色检测
// =============================================

/**
 * 检测证件照背景是否为纯色
 * @param {HTMLImageElement|HTMLCanvasElement} imgEl
 * @param {string} expectedColor - 'white' | 'blue' | 'red' | 'any'
 * @returns {{ isSolid: boolean, dominantColor: string, message: string }}
 */
function checkBackground(imgEl, expectedColor) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    ctx.drawImage(imgEl, 0, 0);

    const samplePoints = [];
    const w = canvas.width;
    const h = canvas.height;

    // 在边缘和角落采样
    const margin = Math.round(Math.min(w, h) * 0.05);
    // 上边
    for (let x = margin; x < w - margin; x += Math.max(1, Math.round(w / 20))) {
      samplePoints.push({ x, y: margin });
    }
    // 下边
    for (let x = margin; x < w - margin; x += Math.max(1, Math.round(w / 20))) {
      samplePoints.push({ x, y: h - margin });
    }
    // 左边
    for (let y = margin; y < h - margin; y += Math.max(1, Math.round(h / 20))) {
      samplePoints.push({ x: margin, y });
    }
    // 右边
    for (let y = margin; y < h - margin; y += Math.max(1, Math.round(h / 20))) {
      samplePoints.push({ x: w - margin, y });
    }

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let rSum = 0, gSum = 0, bSum = 0;
    let varianceSum = 0;

    for (const p of samplePoints) {
      const idx = (p.y * w + p.x) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
    }

    const n = samplePoints.length;
    const avgR = rSum / n;
    const avgG = gSum / n;
    const avgB = bSum / n;

    // 计算颜色方差（判断是否纯色）
    for (const p of samplePoints) {
      const idx = (p.y * w + p.x) * 4;
      varianceSum += (data[idx] - avgR) ** 2 + (data[idx + 1] - avgG) ** 2 + (data[idx + 2] - avgB) ** 2;
    }
    const stdDev = Math.sqrt(varianceSum / n);

    // 判断主色调
    let dominantColor = 'other';
    if (avgR > 200 && avgG > 200 && avgB > 200) dominantColor = 'white';
    else if (avgB > 150 && avgR < 100 && avgG < 150) dominantColor = 'blue';
    else if (avgR > 150 && avgG < 100 && avgB < 100) dominantColor = 'red';

    // 方差 > 2000 说明背景不纯
    const isSolid = stdDev < 50;

    if (!isSolid) {
      return { isSolid: false, dominantColor, message: '照片背景不是纯色，请使用纯色背景的证件照' };
    }

    if (expectedColor && expectedColor !== 'any' && dominantColor !== expectedColor) {
      const colorNames = { white: '白色', blue: '蓝色', red: '红色' };
      return {
        isSolid: true,
        dominantColor,
        message: `照片背景应为${colorNames[expectedColor] || expectedColor}，当前为${colorNames[dominantColor] || dominantColor}色`
      };
    }

    return { isSolid: true, dominantColor, message: '' };
  } catch (e) {
    console.warn('背景检测出错:', e);
    return { isSolid: true, dominantColor: 'unknown', message: '' };
  }
}

// =============================================
// 身份证 OCR（使用 Tesseract.js）
// =============================================

/**
 * 对身份证图片进行 OCR 识别
 * @param {string} dataUrl - 图片的 data URL
 * @param {'front'|'back'} side - 身份证面
 * @returns {Promise<{ success: boolean, text: string, fields: object, message: string }>}
 */
async function ocrIdCard(dataUrl, side) {
  try {
    if (typeof Tesseract === 'undefined') {
      return { success: false, text: '', fields: {}, message: 'OCR 库未加载' };
    }

    const result = await Tesseract.recognize(
      dataUrl,
      'chi_sim+eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR 进度: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );

    const text = result.data.text;
    const fields = {};

    if (side === 'front') {
      // 尝试提取身份证号
      const idMatch = text.match(/\d{6}\d{8}\d{3}[\dXx]/);
      if (idMatch) fields.idCard = idMatch[0].toUpperCase();

      // 尝试提取姓名（在"姓名"之后）
      const nameMatch = text.match(/姓名[：:]\s*([^\n\r]{2,8})/);
      if (nameMatch) fields.name = nameMatch[1].trim();

      const genderMatch = text.match(/(男|女)/);
      if (genderMatch) fields.gender = genderMatch[0];

      // 尝试提取出生日期
      const birthMatch = text.match(/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/);
      if (birthMatch) fields.birth = birthMatch[0].replace(/\s+/g, '');

      // 地址
      const addrMatch = text.match(/住址[：:]\s*([^\n\r]{5,50})/);
      if (addrMatch) fields.address = addrMatch[1].trim();
    }

    return { success: true, text, fields, message: '' };
  } catch (e) {
    console.error('OCR 失败:', e);
    return { success: false, text: '', fields: {}, message: '身份证识别失败，请重新上传清晰照片' };
  }
}
