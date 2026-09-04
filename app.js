document.addEventListener('DOMContentLoaded', () => {
  // 画面要素
  const cameraContainer = document.getElementById('camera-container');
  const capturePreviewContainer = document.getElementById('capture-preview-container');
  const editorContainer = document.getElementById('editor-container');
  const designPreviewContainer = document.getElementById('design-preview-container');
  const albumContainer = document.getElementById('album-container');

  // 画像・描画要素
  const videoElement = document.getElementById('camera-stream');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const capturePreviewImg = document.getElementById('capture-preview-img');
  const designPreviewImg = document.getElementById('design-preview-img');
  const activeIdolBadge = document.getElementById('active-idol-badge');
  const canvas = document.getElementById('paint-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const doodleCanvas = document.createElement('canvas');
  const doodleCtx = doodleCanvas.getContext('2d');

  // ボタン類
  const captureBtn = document.getElementById('capture-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const switchCameraBtn = document.getElementById('switch-camera-btn');
  const flashBtn = document.getElementById('flash-btn');
  const timerBtn = document.getElementById('timer-btn');
  const timerBadge = document.getElementById('timer-badge');
  const captureRetakeBtn = document.getElementById('capture-retake-btn');
  const captureOkBtn = document.getElementById('capture-ok-btn');
  const editorCompleteBtn = document.getElementById('editor-complete-btn');
  const designRedrawBtn = document.getElementById('design-redraw-btn');
  const designSaveBtn = document.getElementById('design-save-btn');

  // アルバム・モーダル要素
  const albumOpenBtn = document.getElementById('album-open-btn');
  const albumBackBtn = document.getElementById('album-back-btn');
  const albumGrid = document.getElementById('album-grid');
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxInfo = document.getElementById('lightbox-info');
  const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
  const lightboxDownloadBtn = document.getElementById('lightbox-download-btn');
  const lightboxDeleteBtn = document.getElementById('lightbox-delete-btn');

  // ツールバー要素
  const toolColor = document.getElementById('tool-color');
  const toolSize = document.getElementById('tool-size');
  const toolEraser = document.getElementById('tool-eraser');
  const toolStamp = document.getElementById('tool-stamp');
  const toolClear = document.getElementById('tool-clear');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // アプリ状態
  let currentStream = null;
  let useFrontCamera = true;
  let flashOn = false;
  let timerSeconds = 0;
  let isCountingDown = false;
  let isDrawing = false;
  let isEraser = false;
  let isStampMode = false;
  let selectedStamp = '';
  let penSize = 25;
  let eraserSize = 15;
  let capturedDataUrl = '';
  let capturedImageObj = null;
  let currentSerialNo = '';
  let currentSelectedAlbumItem = null;

  // スタンプ管理用構造
  let placedStamps = [];
  let selectedStampIndex = -1;
  let isDraggingStamp = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // --- タイマー状態管理 ---
  let designTimerInterval = null;
  let designTimeRemaining = 60;
  let isDesignTimerRunning = false;

  // パレットカラー
  const customColorPalette = [
    { name: '白', displayName: '白', hex: '#FFFFFF' },
    { name: '赤', displayName: '赤', hex: '#FF0000' },
    { name: '青', displayName: '青', hex: '#0000FF' },
    { name: '黄', displayName: '黄', hex: '#FFFF00' },
    { name: '紫', displayName: '紫', hex: '#FF00FF' },
    { name: '緑', displayName: '緑', hex: '#00FF00' },
    { name: 'ピンク', displayName: 'ピンク', hex: '#FF69B4' },
    { name: 'オレンジ', displayName: 'オレンジ', hex: '#FFA500' },
    { name: '黒', displayName: '黒', hex: '#000000' }
  ];

  // ストレージデータ取得
  let groups = JSON.parse(localStorage.getItem('cheki_groups')) || ['サンプルグループ'];
  let currentGroup = localStorage.getItem('cheki_current_group') || groups[0] || '';
  let idolList = JSON.parse(localStorage.getItem('cheki_idol_list')) || [
    { id: 1, group: 'サンプルグループ', idol: '推しメン名前', color: '#FF3366' }
  ];
  let activeIdolId = Number(localStorage.getItem('cheki_active_idol_id')) || (idolList.length > 0 ? idolList[0].id : null);
  let albumPhotos = JSON.parse(localStorage.getItem('cheki_album_photos')) || [];
  let selectedNewColor = customColorPalette[1].hex;

  function switchScreen(targetScreen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (targetScreen) targetScreen.classList.add('active');
  }

  function getActiveIdol() {
    return idolList.find(item => item.id === activeIdolId) || idolList[0] || { group: '', idol: '', color: '#FFFFFF' };
  }

  let currentColor = getActiveIdol().color;

  function updateActiveBadge() {
    const active = getActiveIdol();
    if (active && (active.group || active.idol)) {
      activeIdolBadge.textContent = `選択: ${active.group}/${active.idol}`;
      activeIdolBadge.style.borderColor = active.color;
    } else {
      activeIdolBadge.textContent = '選択: なし (タップして設定)';
      activeIdolBadge.style.borderColor = 'rgba(255,255,255,0.3)';
    }
  }
  updateActiveBadge();

  function saveData() {
    localStorage.setItem('cheki_groups', JSON.stringify(groups));
    localStorage.setItem('cheki_current_group', currentGroup);
    localStorage.setItem('cheki_idol_list', JSON.stringify(idolList));
    localStorage.setItem('cheki_active_idol_id', activeIdolId);
    localStorage.setItem('cheki_album_photos', JSON.stringify(albumPhotos));
  }

  function generateUniqueSerial() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  // --- 音声フィードバック (Web Audio API) ---
  function playBeepSound(isHigh) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = isHigh ? 880 : 440;
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn('オーディオ再生エラー:', e);
    }
  }

  // --- タイマー制御ロジック ---
  function updateTimerDisplay(seconds) {
    const display = document.getElementById('design-timer-display');
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    if (display) display.textContent = `${m}:${s}`;
  }

  function resetDesignTimer() {
    if (designTimerInterval) clearInterval(designTimerInterval);
    designTimerInterval = null;
    isDesignTimerRunning = false;

    const select = document.getElementById('design-timer-select');
    if (select) designTimeRemaining = parseInt(select.value, 10) || 60;
    updateTimerDisplay(designTimeRemaining);

    const btn = document.getElementById('design-timer-toggle-btn');
    if (btn) btn.textContent = 'スタート';

    const overlay = document.getElementById('design-timer-flash-overlay');
    if (overlay) {
      overlay.classList.remove('flash-warning', 'flash-timeout');
      overlay.style.opacity = '0';
    }
  }

  function startDesignTimer() {
    if (isDesignTimerRunning) return;
    isDesignTimerRunning = true;
    const btn = document.getElementById('design-timer-toggle-btn');
    if (btn) btn.textContent = 'ストップ';

    designTimerInterval = setInterval(() => {
      designTimeRemaining--;
      updateTimerDisplay(designTimeRemaining);

      const overlay = document.getElementById('design-timer-flash-overlay');

      if (designTimeRemaining === 10 && overlay) {
        overlay.style.opacity = '1';
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
          overlay.style.opacity = '1';
          overlay.classList.remove('flash-warning');
          overlay.classList.add('flash-timeout');
        }
        if (btn) btn.textContent = 'リセット';
      }
    }, 1000);
  }

  // タイマーイベント登録
  const timerToggleBtn = document.getElementById('design-timer-toggle-btn');
  if (timerToggleBtn) {
    timerToggleBtn.addEventListener('click', () => {
      if (isDesignTimerRunning || designTimeRemaining <= 0) {
        resetDesignTimer();
      } else {
        startDesignTimer();
      }
    });
  }

  const timerSelect = document.getElementById('design-timer-select');
  if (timerSelect) {
    timerSelect.addEventListener('change', () => {
      resetDesignTimer();
    });
  }

  // キャンバス描画
  function redrawCanvas() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const active = getActiveIdol();

    // 1. チェキフレーム(メンカラ)
    ctx.fillStyle = active.color || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. 撮影写真描画
    if (capturedImageObj) {
      const frameLeft = 60;
      const frameTop = 100;
      const targetWidth = canvas.width - (frameLeft * 2);
      const targetHeight = 1400;
      const imgAspect = capturedImageObj.width / capturedImageObj.height;
      const targetAspect = targetWidth / targetHeight;
      let dWidth, dHeight, dx, dy;

      if (imgAspect > targetAspect) {
        dHeight = targetHeight;
        dWidth = targetHeight * imgAspect;
        dx = frameLeft - (dWidth - targetWidth) / 2;
        dy = frameTop;
      } else {
        dWidth = targetWidth;
        dHeight = targetWidth / imgAspect;
        dx = frameLeft;
        dy = frameTop + (targetHeight - dHeight) / 2;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameLeft, frameTop, targetWidth, targetHeight);
      ctx.clip();
      ctx.drawImage(capturedImageObj, dx, dy, dWidth, dHeight);
      ctx.restore();
    }

    // 3. テキスト描画
    const hex = (active.color || '#FFFFFF').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 255;
    const b = parseInt(hex.substring(4, 6), 16) || 255;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    ctx.fillStyle = brightness > 128 ? '#111111' : '#FFFFFF';

    if (active.group || active.idol) {
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${active.group} ${active.idol}`.trim(), 60, canvas.height - 120);
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    ctx.font = '34px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${dateStr} #${currentSerialNo}`, canvas.width - 60, canvas.height - 120);

    // 4. 手描きドゥードゥル合成
    ctx.drawImage(doodleCanvas, 0, 0);

    // 5. スタンプ描画
    placedStamps.forEach((s, idx) => {
      ctx.font = `${s.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.char, s.x, s.y);

      if (idx === selectedStampIndex) {
        const half = s.size / 2;
        ctx.save();
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(s.x - half - 10, s.y - half - 10, s.size + 20, s.size + 20);
        ctx.restore();

        const btnX = s.x + half + 10;
        const btnY = s.y - half - 10;
        ctx.fillStyle = '#e63946';
        ctx.beginPath();
        ctx.arc(btnX, btnY, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×', btnX, btnY);
      }
    });
  }

  async function startCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: useFrontCamera ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      videoElement.srcObject = currentStream;
      await videoElement.play();
      if (useFrontCamera) {
        videoElement.classList.add('camera-mirrored');
        if (flashBtn) flashBtn.style.display = 'none';
      } else {
        videoElement.classList.remove('camera-mirrored');
        if (flashBtn) flashBtn.style.display = 'flex';
      }
    } catch (err) {
      console.error('カメラ起動エラー:', err);
    }
  }

  function processCapture() {
    const vWidth = videoElement.videoWidth || 640;
    const vHeight = videoElement.videoHeight || 480;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = vWidth;
    tempCanvas.height = vHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (useFrontCamera) {
      tempCtx.translate(vWidth, 0);
      tempCtx.scale(-1, 1);
    }
    tempCtx.drawImage(videoElement, 0, 0, vWidth, vHeight);
    capturedDataUrl = tempCanvas.toDataURL('image/png');
    capturedImageObj = new Image();
    capturedImageObj.onload = () => {
      capturePreviewImg.src = capturedDataUrl;
      switchScreen(capturePreviewContainer);
    };
    capturedImageObj.src = capturedDataUrl;
  }

  if (captureBtn) {
    captureBtn.addEventListener('click', () => {
      if (isCountingDown) return;
      if (timerSeconds === 0) {
        processCapture();
      } else {
        isCountingDown = true;
        captureBtn.disabled = true;
        let remaining = timerSeconds;
        countdownOverlay.textContent = remaining;
        const interval = setInterval(() => {
          remaining--;
          if (remaining > 0) {
            countdownOverlay.textContent = remaining;
          } else {
            clearInterval(interval);
            countdownOverlay.textContent = '';
            isCountingDown = false;
            captureBtn.disabled = false;
            processCapture();
          }
        }, 1000);
      }
    });
  }

  if (captureRetakeBtn) {
    captureRetakeBtn.addEventListener('click', () => {
      switchScreen(cameraContainer);
      startCamera();
    });
  }

  if (captureOkBtn) {
    captureOkBtn.addEventListener('click', () => {
      try {
        try {
          albumPhotos.unshift({
            id: Date.now(),
            url: capturedDataUrl,
            date: new Date().toLocaleDateString()
          });
          saveData();
        } catch (storageErr) {
          console.warn('LocalStorage保存警告:', storageErr);
        }

        canvas.width = 1080;
        canvas.height = 1920;
        doodleCanvas.width = canvas.width;
        doodleCanvas.height = canvas.height;
        doodleCtx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
        placedStamps = [];
        selectedStampIndex = -1;
        currentSerialNo = generateUniqueSerial();
        redrawCanvas();
        resetDesignTimer();
        switchScreen(editorContainer);
      } catch (err) {
        console.error('デザイン画面への遷移エラー:', err);
        alert('エラーが発生しました: ' + err.message);
      }
    });
  }

  if (editorCompleteBtn) {
    editorCompleteBtn.addEventListener('click', () => {
      resetDesignTimer();
      const tempSelected = selectedStampIndex;
      selectedStampIndex = -1;
      redrawCanvas();
      designPreviewImg.src = canvas.toDataURL('image/png');
      selectedStampIndex = tempSelected;
      switchScreen(designPreviewContainer);
    });
  }

  if (designRedrawBtn) {
    designRedrawBtn.addEventListener('click', () => {
      redrawCanvas();
      resetDesignTimer();
      switchScreen(editorContainer);
    });
  }

  if (designSaveBtn) {
    designSaveBtn.addEventListener('click', () => {
      try {
        selectedStampIndex = -1;
        redrawCanvas();
        const dataURL = canvas.toDataURL('image/png');
        const active = getActiveIdol();
        const safeGroup = active.group ? `${active.group}_` : '';
        const safeIdol = active.idol ? `${active.idol}_` : '';
        const fileName = `cheki_${safeGroup}${safeIdol}${currentSerialNo}.png`;

        try {
          albumPhotos.unshift({
            id: Date.now(),
            url: dataURL,
            serial: currentSerialNo,
            date: new Date().toLocaleDateString()
          });
          saveData();
        } catch (storageErr) {
          console.warn('LocalStorage保存警告:', storageErr);
        }

        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        switchScreen(cameraContainer);
        startCamera();
      } catch (err) {
        console.error('デザイン保存エラー:', err);
        alert('保存中にエラーが発生しました: ' + err.message);
      }
    });
  }

  // 設定ダイアログ関連
  activeIdolBadge.addEventListener('click', openSettingsModal);
  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);

  function openSettingsModal() {
    let groupOptions = groups.map(g => `<option value="${g}" ${g === currentGroup ? 'selected' : ''}>${g}</option>`).join('');
    groupOptions += '<option value="_NEW_">+ 新規グループ追加</option>';
    let paletteHtml = customColorPalette.map(c => `
      <div class="color-chip-wrapper setting-color-chip ${c.hex === selectedNewColor ? 'selected' : ''}" data-color="${c.hex}">
        <div class="color-chip" style="background-color: ${c.hex};"></div>
        <span class="color-label">${c.displayName}</span>
      </div>
    `).join('');

    let html = `
      <p style="text-align:center; font-weight:bold; margin-bottom:12px;">設定・メンバー登録</p>
      <div class="setting-section">
        <span class="setting-label">① グループ選択</span>
        <select id="group-select" class="setting-select">${groupOptions}</select>
        <div id="new-group-box" style="display:none;">
          <input type="text" id="new-group-input" class="setting-input" placeholder="新しいグループ名">
        </div>
      </div>
      <div class="setting-section">
        <span class="setting-label">② メンバー追加</span>
        <input type="text" id="new-idol-input" class="setting-input" placeholder="アイドル名(例: まい)">
        <span style="font-size:0.7rem; color:#ccc;">メンカラ (外枠フレームの色になります)</span>
        <div class="palette-grid">${paletteHtml}</div>
        <button id="add-idol-btn" class="btn primary" style="width: 100%; margin-top:10px; padding:8px;">追加する</button>
      </div>
      <div style="margin-top:10px;">
        <span class="setting-label">③ メンバー選択 (タップで決定)</span>
        <div id="modal-idol-list" style="max-height:160px; overflow-y:auto;"></div>
      </div>
    `;

    openModal(html);
    renderIdolItemsInModal();

    const groupSelect = document.getElementById('group-select');
    const newGroupBox = document.getElementById('new-group-box');
    groupSelect.addEventListener('change', (e) => {
      if (e.target.value === '_NEW_') {
        newGroupBox.style.display = 'block';
      } else {
        newGroupBox.style.display = 'none';
        currentGroup = e.target.value;
        saveData();
        renderIdolItemsInModal();
      }
    });

    document.querySelectorAll('.setting-color-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.setting-color-chip').forEach(c => c.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        selectedNewColor = e.currentTarget.getAttribute('data-color');
      });
    });

    document.getElementById('add-idol-btn').addEventListener('click', () => {
      let targetGroup = currentGroup;
      if (groupSelect.value === '_NEW_') {
        const newG = document.getElementById('new-group-input').value.trim();
        if (!newG) return alert('グループ名を入力してください');
        targetGroup = newG;
        if (!groups.includes(targetGroup)) groups.push(targetGroup);
        currentGroup = targetGroup;
      }
      const name = document.getElementById('new-idol-input').value.trim();
      if (!name) return alert('アイドル名を入力してください');
      const newItem = { id: Date.now(), group: targetGroup, idol: name, color: selectedNewColor };
      idolList.push(newItem);
      activeIdolId = newItem.id;
      currentColor = newItem.color;
      saveData();
      openSettingsModal();
      updateActiveBadge();
    });
  }

  function renderIdolItemsInModal() {
    const container = document.getElementById('modal-idol-list');
    if (!container) return;
    const filtered = idolList.filter(i => i.group === currentGroup);
    if (filtered.length === 0) {
      container.innerHTML = '<p style="font-size:0.75rem; color:#888; text-align:center;">メンバーが登録されていません</p>';
      return;
    }
    container.innerHTML = filtered.map(item => `
      <div class="idol-select-item" style="padding:8px; border-left:4px solid ${item.color}; background:${item.id === activeIdolId ? '#444' : '#2a2a2a'}; margin-bottom:4px; border-radius:4px; cursor:pointer; display: flex; justify-content:space-between; align-items:center;" data-id="${item.id}">
        <div><strong>${item.idol}</strong></div>
        <button class="btn danger del-idol-btn" data-id="${item.id}" style="padding:2px 8px; font-size:0.65rem;">削除</button>
      </div>
    `).join('');

    container.querySelectorAll('.idol-select-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('del-idol-btn')) return;
        activeIdolId = Number(el.getAttribute('data-id'));
        currentColor = getActiveIdol().color;
        saveData();
        updateActiveBadge();
        modalOverlay.classList.remove('active');
      });
    });

    container.querySelectorAll('.del-idol-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.getAttribute('data-id'));
        idolList = idolList.filter(i => i.id !== id);
        if (activeIdolId === id) activeIdolId = idolList.length > 0 ? idolList[0].id : null;
        saveData();
        renderIdolItemsInModal();
        updateActiveBadge();
      });
    });
  }

  // カメラ制御
  if (timerBtn) {
    timerBtn.addEventListener('click', () => {
      if (timerSeconds === 0) { timerSeconds = 3; timerBadge.textContent = '3秒'; timerBtn.classList.add('active-tool'); }
      else if (timerSeconds === 3) { timerSeconds = 5; timerBadge.textContent = '5秒'; }
      else if (timerSeconds === 5) { timerSeconds = 10; timerBadge.textContent = '10秒'; }
      else { timerSeconds = 0; timerBadge.textContent = 'オフ'; timerBtn.classList.remove('active-tool'); }
    });
  }

  if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', () => {
      useFrontCamera = !useFrontCamera;
      flashOn = false;
      if (flashBtn) flashBtn.classList.remove('active-tool');
      startCamera();
    });
  }

  if (flashBtn) {
    flashBtn.addEventListener('click', async () => {
      if (!currentStream) return;
      const track = currentStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (!capabilities.torch) return alert('フラッシュ未対応のカメラです。');
      try {
        flashOn = !flashOn;
        await track.applyConstraints({ advanced: [{ torch: flashOn }] });
        flashBtn.classList.toggle('active-tool', flashOn);
      } catch (err) { console.error(err); }
    });
  }

  // タッチ/マウスイベント
  function getEventPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function startAction(e) {
    const pos = getEventPos(e);

    if (selectedStampIndex !== -1) {
      const s = placedStamps[selectedStampIndex];
      const half = s.size / 2;
      const btnX = s.x + half + 10;
      const btnY = s.y - half - 10;
      const dist = Math.hypot(pos.x - btnX, pos.y - btnY);
      if (dist <= 30) {
        placedStamps.splice(selectedStampIndex, 1);
        selectedStampIndex = -1;
        redrawCanvas();
        e.preventDefault();
        return;
      }
    }

    let clickedStampIdx = -1;
    for (let i = placedStamps.length - 1; i >= 0; i--) {
      const s = placedStamps[i];
      const half = s.size / 2;
      if (pos.x >= s.x - half && pos.x <= s.x + half && pos.y >= s.y - half && pos.y <= s.y + half) {
        clickedStampIdx = i;
        break;
      }
    }

    if (clickedStampIdx !== -1) {
      selectedStampIndex = clickedStampIdx;
      isDraggingStamp = true;
      dragOffsetX = pos.x - placedStamps[clickedStampIdx].x;
      dragOffsetY = pos.y - placedStamps[clickedStampIdx].y;
      redrawCanvas();
      e.preventDefault();
      return;
    }

    if (isStampMode) {
      placedStamps.push({
        char: selectedStamp,
        x: pos.x,
        y: pos.y,
        size: 90
      });
      selectedStampIndex = placedStamps.length - 1;
      redrawCanvas();
      e.preventDefault();
      return;
    }

    selectedStampIndex = -1;
    isDrawing = true;
    doodleCtx.beginPath();
    doodleCtx.moveTo(pos.x, pos.y);
    redrawCanvas();
    e.preventDefault();
  }

  function drawAction(e) {
    const pos = getEventPos(e);

    if (isDraggingStamp && selectedStampIndex !== -1) {
      placedStamps[selectedStampIndex].x = pos.x - dragOffsetX;
      placedStamps[selectedStampIndex].y = pos.y - dragOffsetY;
      redrawCanvas();
      e.preventDefault();
      return;
    }

    if (!isDrawing || isStampMode) return;
    doodleCtx.lineTo(pos.x, pos.y);
    doodleCtx.lineCap = 'round';
    doodleCtx.lineJoin = 'round';
    if (isEraser) {
      doodleCtx.globalCompositeOperation = 'destination-out';
      doodleCtx.lineWidth = eraserSize;
      doodleCtx.stroke();
      doodleCtx.globalCompositeOperation = 'source-over';
    } else {
      doodleCtx.globalCompositeOperation = 'source-over';
      doodleCtx.lineWidth = penSize;
      doodleCtx.strokeStyle = currentColor;
      doodleCtx.stroke();
    }
    redrawCanvas();
    e.preventDefault();
  }

  function stopAction() {
    isDrawing = false;
    isDraggingStamp = false;
  }

  if (canvas) {
    canvas.addEventListener('mousedown', startAction);
    canvas.addEventListener('mousemove', drawAction);
    window.addEventListener('mouseup', stopAction);
    canvas.addEventListener('touchstart', startAction, { passive: false });
    canvas.addEventListener('touchmove', drawAction, { passive: false });
    canvas.addEventListener('touchend', stopAction);
  }

  // ツールバー
  if (toolColor) {
    toolColor.addEventListener('click', () => {
      isEraser = false; isStampMode = false; selectedStampIndex = -1; redrawCanvas();
      updateActiveTool(toolColor);
      let html = '<p style="text-align:center; font-weight:bold;">カラーを選択</p><div class="palette-grid">';
      customColorPalette.forEach(c => {
        html += `<div class="color-chip-wrapper" data-color="${c.hex}"><div class="color-chip" style="background-color: ${c.hex};"></div><span class="color-label">${c.displayName}</span></div>`;
      });
      html += '</div>';
      openModal(html);
      document.querySelectorAll('.color-chip-wrapper').forEach(chip => {
        chip.addEventListener('click', (e) => {
          modalOverlay.classList.remove('active');
          currentColor = e.currentTarget.getAttribute('data-color');
        });
      });
    });
  }

  if (toolSize) {
    toolSize.addEventListener('click', () => {
      isEraser = false; isStampMode = false; selectedStampIndex = -1; redrawCanvas();
      updateActiveTool(toolSize);
      let html = '<p style="text-align:center; font-weight:bold; margin-bottom:15px;">ペンの太さ</p><div style="display: flex; justify-content:space-around;"><button class="btn size-select-btn secondary" data-size="10">細</button><button class="btn size-select-btn primary" data-size="25">中</button><button class="btn size-select-btn secondary" data-size="45">太</button></div>';
      openModal(html);
      document.querySelectorAll('.size-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          penSize = Number(e.currentTarget.getAttribute('data-size'));
          modalOverlay.classList.remove('active');
        });
      });
    });
  }

  if (toolEraser) {
    toolEraser.addEventListener('click', () => {
      isEraser = true; isStampMode = false; selectedStampIndex = -1; redrawCanvas();
      updateActiveTool(toolEraser);
      let html = '<p style="text-align:center; font-weight:bold; margin-bottom: 15px;">消しゴムの太さ</p><div style="display: flex; justify-content:space-around;"><button class="btn eraser-size-btn primary" data-size="15">中</button><button class="btn eraser-size-btn secondary" data-size="40">太</button></div>';
      openModal(html);
      document.querySelectorAll('.eraser-size-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          eraserSize = Number(e.currentTarget.getAttribute('data-size'));
          modalOverlay.classList.remove('active');
        });
      });
    });
  }

  if (toolStamp) {
    toolStamp.addEventListener('click', () => {
      isEraser = false; isStampMode = true; updateActiveTool(toolStamp);
      const stamps = ['⭐', '💖', '✨', '🎀', '👑', '🐾', '🔥', '🎉', '🍀'];
      let html = '<p style="text-align:center; font-weight:bold;">スタンプを選択</p><div class="stamp-grid">';
      stamps.forEach(s => { html += `<div class="stamp-item" data-stamp="${s}">${s}</div>`; });
      html += '</div>';
      openModal(html);
      document.querySelectorAll('.stamp-item').forEach(item => {
        item.addEventListener('click', (e) => {
          selectedStamp = e.target.getAttribute('data-stamp');
          modalOverlay.classList.remove('active');
        });
      });
    });
  }

  if (toolClear) {
    toolClear.addEventListener('click', () => {
      if (confirm('落書き・スタンプをすべてクリアしますか？')) {
        doodleCtx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
        placedStamps = [];
        selectedStampIndex = -1;
        redrawCanvas();
      }
    });
  }

  function updateActiveTool(activeBtn) {
    [toolColor, toolSize, toolEraser, toolStamp].forEach(btn => btn && btn.classList.remove('active-tool'));
    if (activeBtn) activeBtn.classList.add('active-tool');
  }

  function openModal(htmlContent) {
    modalBody.innerHTML = htmlContent;
    modalOverlay.classList.add('active');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
  }

  // アルバム
  if (albumOpenBtn) {
    albumOpenBtn.addEventListener('click', () => {
      renderAlbumGrid();
      switchScreen(albumContainer);
    });
  }

  if (albumBackBtn) {
    albumBackBtn.addEventListener('click', () => {
      switchScreen(cameraContainer);
      startCamera();
    });
  }

  function renderAlbumGrid() {
    if (!albumGrid) return;
    albumGrid.innerHTML = '';
    if (albumPhotos.length === 0) {
      albumGrid.innerHTML = '<p style="grid-column: span 4; text-align: center; color: #888; font-size: 0.8rem; padding: 20px;">写真がありません</p>';
      return;
    }
    albumPhotos.forEach(item => {
      const div = document.createElement('div');
      div.className = 'album-item';
      div.innerHTML = `<img src="${item.url}" alt="album">`;
      div.addEventListener('click', () => {
        currentSelectedAlbumItem = item;
        lightboxImg.src = item.url;
        lightboxInfo.textContent = `${item.date} #${item.serial || ''}`;
        lightboxModal.classList.add('active');
      });
      albumGrid.appendChild(div);
    });
  }

  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', () => lightboxModal.classList.remove('active'));

  if (lightboxDownloadBtn) {
    lightboxDownloadBtn.addEventListener('click', () => {
      if (!currentSelectedAlbumItem) return;
      const a = document.createElement('a');
      a.href = currentSelectedAlbumItem.url;
      a.download = `cheki_${currentSelectedAlbumItem.id}.png`;
      a.click();
    });
  }

  if (lightboxDeleteBtn) {
    lightboxDeleteBtn.addEventListener('click', () => {
      if (!currentSelectedAlbumItem) return;
      if (confirm('削除しますか？')) {
        albumPhotos = albumPhotos.filter(p => p.id !== currentSelectedAlbumItem.id);
        saveData();
        lightboxModal.classList.remove('active');
        renderAlbumGrid();
      }
    });
  }

  const albumResetBtn = document.getElementById('album-reset-btn');
  if (albumResetBtn) {
    albumResetBtn.addEventListener('click', () => {
      if (albumPhotos.length === 0) {
        alert('削除する写真がありません。');
        return;
      }
      if (confirm('アルバム内の写真をすべて削除してもよろしいですか？ (元に戻せません)')) {
        albumPhotos = [];
        saveData();
        renderAlbumGrid();
        alert('アルバムをリセットしました。');
      }
    });
  }

  // 初期起動
  switchScreen(cameraContainer);
  startCamera();
});
