// --- DOM要素の取得 ---
const cameraContainer = document.getElementById('camera-container');
const editorContainer = document.getElementById('editor-container');
const previewContainer = document.getElementById('design-preview-container');
const albumContainer = document.getElementById('album-container');

const cameraVideo = document.getElementById('camera-video');
const captureBtn = document.getElementById('capture-btn');
const photoCountEl = document.getElementById('photo-count');

const paintCanvas = document.getElementById('paint-canvas');
const ctx = paintCanvas.getContext('2d');

const toolColor = document.getElementById('tool-color');
const toolSize = document.getElementById('tool-size');
const toolEraser = document.getElementById('tool-eraser');
const toolStamp = document.getElementById('tool-stamp');
const toolClear = document.getElementById('tool-clear');
const toolFrame = document.getElementById('tool-frame');

const designPreviewImg = document.getElementById('design-preview-img');
const designRedrawBtn = document.getElementById('design-redraw-btn');
const designSaveBtn = document.getElementById('design-save-btn');

const albumGrid = document.getElementById('album-grid');
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxInfo = document.getElementById('lightbox-info');
const lightboxDownloadBtn = document.getElementById('lightbox-download-btn');
const lightboxDeleteBtn = document.getElementById('lightbox-delete-btn');
const lightboxCloseBtn = document.getElementById('lightbox-close-btn');

const modalOverlay = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.getElementById('modal-close-btn');

// --- アプリの状態管理 ---
let currentStream = null;
let capturedPhotos = [];
let albumPhotos = [];
let selectedPhotoIndex = -1;

let isDrawing = false;
let currentColor = '#ff2a6d';
let currentLineWidth = 5;
let isEraser = false;
let isStampMode = false;
let selectedStampIndex = -1;

// タイマー用
var designTimerInterval = null;
var designTimeRemaining = 60;
var isDesignTimerRunning = false;

// --- フレーム定義 ---
const frameList = [
  { id: 'default', name: '標準 (メンカラ枠)', type: 'color', src: '' },
  { id: 'tsukimi', name: 'お月見', type: 'image', src: 'frames/tsukimi.png' },
  { id: 'momiji',  name: '紅葉',   type: 'image', src: 'frames/momiji.png' }
];
let currentFrameId = 'default';
let loadedFrameImages = {};

function preloadFrames() {
  frameList.forEach(item => {
    if (item.type === 'image' && item.src) {
      const img = new Image();
      img.onload = () => {
        img.isLoaded = true;
        if (currentFrameId === item.id) redrawCanvas();
      };
      img.onerror = () => console.error('画像読み込み失敗:', item.src);
      img.src = item.src;
      loadedFrameImages[item.id] = img;
    }
  });
}
preloadFrames();

// --- 画面切り替え ---
function switchScreen(targetScreen) {
  [cameraContainer, editorContainer, previewContainer, albumContainer].forEach(s => {
    if (s) s.classList.remove('active');
  });
  if (targetScreen) targetScreen.classList.add('active');
}

// --- カメラ制御 ---
async function startCamera() {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
    const constraints = {
      video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } },
      audio: false
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (cameraVideo) cameraVideo.srcObject = currentStream;
  } catch (err) {
    console.error("カメラアクセスエラー:", err);
    alert("カメラの起動に失敗しました。アクセス許可を確認してください。");
  }
}

// 撮影処理
if (captureBtn) {
  captureBtn.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cameraVideo.videoWidth || 640;
    tempCanvas.height = cameraVideo.videoHeight || 480;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(cameraVideo, 0, 0, tempCanvas.width, tempCanvas.height);
    
    capturedPhotos = [tempCanvas.toDataURL('image/png')];
    setupCanvas();
    switchScreen(editorContainer);
  });
}

// --- Canvas描画制御 ---
function setupCanvas() {
  if (!paintCanvas) return;
  paintCanvas.width = 600;
  paintCanvas.height = 800;
  redrawCanvas();
}

function redrawCanvas() {
  if (!ctx || capturedPhotos.length === 0) return;
  ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);

  // 1. 写真描画
  const photo = new Image();
  photo.onload = () => {
    const margin = 40;
    const photoWidth = paintCanvas.width - (margin * 2);
    const photoHeight = photoWidth * (4 / 3);
    ctx.drawImage(photo, margin, margin, photoWidth, photoHeight);

    // 2. フレーム描画
    const selectedFrame = frameList.find(f => f.id === currentFrameId);
    if (selectedFrame && selectedFrame.type === 'image') {
      const frameImg = loadedFrameImages[selectedFrame.id];
      if (frameImg && frameImg.isLoaded) {
        ctx.drawImage(frameImg, 0, 0, paintCanvas.width, paintCanvas.height);
      }
    }
  };
  photo.src = capturedPhotos[0];
}

// --- 描画イベント（タッチ・マウス対応） ---
function startDrawing(e) {
  isDrawing = true;
  const rect = paintCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = (clientX - rect.left) * (paintCanvas.width / rect.width);
  const y = (clientY - rect.top) * (paintCanvas.height / rect.height);

  ctx.beginPath();
  ctx.moveTo(x, y);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const rect = paintCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = (clientX - rect.left) * (paintCanvas.width / rect.width);
  const y = (clientY - rect.top) * (paintCanvas.height / rect.height);

  ctx.lineWidth = currentLineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = currentColor;
  }

  ctx.lineTo(x, y);
  ctx.stroke();
}

function stopDrawing() {
  if (isDrawing) {
    ctx.closePath();
    isDrawing = false;
  }
}

if (paintCanvas) {
  paintCanvas.addEventListener('mousedown', startDrawing);
  paintCanvas.addEventListener('mousemove', draw);
  paintCanvas.addEventListener('mouseup', stopDrawing);
  paintCanvas.addEventListener('touchstart', startDrawing, { passive: false });
  paintCanvas.addEventListener('touchmove', draw, { passive: false });
  paintCanvas.addEventListener('touchend', stopDrawing);
}

// --- ツールバー処理 ---
function openModal(contentHtml) {
  if (modalBody) modalBody.innerHTML = contentHtml;
  if (modalOverlay) modalOverlay.classList.add('active');
}
if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
}

if (toolFrame) {
  toolFrame.addEventListener('click', () => {
    let html = '<p style="text-align:center; font-weight:bold; margin-bottom:12px;">フレーム選択</p><div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px;">';
    frameList.forEach(f => {
      html += `<button class="btn frame-select-btn ${f.id === currentFrameId ? 'primary' : 'secondary'}" data-frame="${f.id}" style="padding:12px; font-size:0.85rem;">${f.name}</button>`;
    });
    html += '</div>';
    openModal(html);

    document.querySelectorAll('.frame-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentFrameId = e.currentTarget.getAttribute('data-frame');
        redrawCanvas();
        modalOverlay.classList.remove('active');
      });
    });
  });
}

if (toolClear) {
  toolClear.addEventListener('click', () => {
    if (confirm("お絵かきを全消去しますか？")) redrawCanvas();
  });
}

// --- タイマー機能 ---
function playBeepSound(isHigh) {
  try {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    var audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = isHigh ? 880 : 440;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.warn('Audio error:', e);
  }
}

function updateTimerDisplay(seconds) {
  var display = document.getElementById('design-timer-display');
  var m = String(Math.floor(seconds / 60)).padStart(2, '0');
  var s = String(seconds % 60).padStart(2, '0');
  if (display) display.textContent = m + ':' + s;
}

function resetDesignTimer() {
  if (designTimerInterval) clearInterval(designTimerInterval);
  designTimerInterval = null;
  isDesignTimerRunning = false;
  
  var select = document.getElementById('design-timer-select');
  if (select) designTimeRemaining = parseInt(select.value, 10) || 60;
  updateTimerDisplay(designTimeRemaining);

  var btn = document.getElementById('design-timer-toggle-btn');
  if (btn) btn.textContent = 'スタート';

  var overlay = document.getElementById('design-timer-flash-overlay');
  if (overlay) {
    overlay.classList.remove('flash-warning', 'flash-timeout');
    overlay.style.opacity = '0';
  }
}

function startDesignTimer() {
  if (isDesignTimerRunning) return;
  isDesignTimerRunning = true;
  var btn = document.getElementById('design-timer-toggle-btn');
  if (btn) btn.textContent = 'ストップ';

  designTimerInterval = setInterval(function() {
    designTimeRemaining--;
    updateTimerDisplay(designTimeRemaining);

    var overlay = document.getElementById('design-timer-flash-overlay');

    if (designTimeRemaining === 10 && overlay) {
      overlay.style.backgroundColor = 'rgba(255, 215, 0, 0.4)';
      overlay.classList.remove('flash-timeout');
      overlay.classList.add('flash-warning');
    }

    if (designTimeRemaining <= 4 && designTimeRemaining > 0) {
      playBeepSound(false);
    }

    if (designTimeRemaining <= 0) {
      clearInterval(designTimerInterval);
      designTimerInterval = null;
      isDesignTimerRunning = false;
      playBeepSound(true);

      if (overlay) {
        overlay.classList.remove('flash-warning');
        overlay.classList.add('flash-timeout');
      }
      if (btn) btn.textContent = 'リセット';
    }
  }, 1000);
}

// タイマーイベント紐付け
document.addEventListener('click', function(e) {
  if (e.target && e.target.id === 'design-timer-toggle-btn') {
    if (isDesignTimerRunning) {
      resetDesignTimer();
    } else if (designTimeRemaining <= 0) {
      resetDesignTimer();
    } else {
      startDesignTimer();
    }
  }
  if (e.target && e.target.id === 'editor-complete-btn') {
    resetDesignTimer();
  }
});

document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'design-timer-select') {
    resetDesignTimer();
  }
});

// --- 初期化起動 ---
switchScreen(cameraContainer);
startCamera();
