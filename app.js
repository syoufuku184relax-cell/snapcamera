// 安全な要素取得関数（要素がなくてもエラーで止めない）
function getEl(id) {
  return document.getElementById(id);
}

// --- DOM要素の取得 ---
const cameraContainer = getEl('camera-container');
const editorContainer = getEl('editor-container');
const previewContainer = getEl('design-preview-container');
const albumContainer = getEl('album-container');

const cameraVideo = getEl('camera-video');
const captureBtn = getEl('capture-btn');
const paintCanvas = getEl('paint-canvas');
const ctx = paintCanvas ? paintCanvas.getContext('2d') : null;

const toolClear = getEl('tool-clear');
const toolFrame = getEl('tool-frame');
const modalOverlay = getEl('modal-overlay');
const modalBody = getEl('modal-body');
const modalCloseBtn = getEl('modal-close-btn');

// --- 状態管理 ---
let currentStream = null;
let capturedPhotos = [];

// タイマー用
var designTimerInterval = null;
var designTimeRemaining = 60;
var isDesignTimerRunning = false;

// --- フレーム定義 ---
const frameList = [
  { id: 'default', name: '標準', type: 'color', src: '' },
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
    if (cameraVideo) {
      cameraVideo.srcObject = currentStream;
      await cameraVideo.play().catch(() => {});
    }
  } catch (err) {
    console.error("カメラアクセスエラー:", err);
  }
}

// 撮影処理
if (captureBtn) {
  captureBtn.addEventListener('click', () => {
    if (!cameraVideo) return;
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

  const photo = new Image();
  photo.onload = () => {
    const margin = 40;
    const photoWidth = paintCanvas.width - (margin * 2);
    const photoHeight = photoWidth * (4 / 3);
    ctx.drawImage(photo, margin, margin, photoWidth, photoHeight);

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
  } catch (e) {}
}

function updateTimerDisplay(seconds) {
  var display = getEl('design-timer-display');
  var m = String(Math.floor(seconds / 60)).padStart(2, '0');
  var s = String(seconds % 60).padStart(2, '0');
  if (display) display.textContent = m + ':' + s;
}

function resetDesignTimer() {
  if (designTimerInterval) clearInterval(designTimerInterval);
  designTimerInterval = null;
  isDesignTimerRunning = false;
  
  var select = getEl('design-timer-select');
  if (select) designTimeRemaining = parseInt(select.value, 10) || 60;
  updateTimerDisplay(designTimeRemaining);

  var btn = getEl('design-timer-toggle-btn');
  if (btn) btn.textContent = 'スタート';

  var overlay = getEl('design-timer-flash-overlay');
  if (overlay) {
    overlay.classList.remove('flash-warning', 'flash-timeout');
    overlay.style.opacity = '0';
  }
}

function startDesignTimer() {
  if (isDesignTimerRunning) return;
  isDesignTimerRunning = true;
  var btn = getEl('design-timer-toggle-btn');
  if (btn) btn.textContent = 'ストップ';

  designTimerInterval = setInterval(function() {
    designTimeRemaining--;
    updateTimerDisplay(designTimeRemaining);

    var overlay = getEl('design-timer-flash-overlay');

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

// イベントリスナー
document.addEventListener('click', function(e) {
  if (!e.target) return;
  if (e.target.id === 'design-timer-toggle-btn') {
    if (isDesignTimerRunning || designTimeRemaining <= 0) {
      resetDesignTimer();
    } else {
      startDesignTimer();
    }
  }
  if (e.target.id === 'editor-complete-btn') {
    resetDesignTimer();
  }
});

document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'design-timer-select') {
    resetDesignTimer();
  }
});

// 初期化起動
switchScreen(cameraContainer);
startCamera();
