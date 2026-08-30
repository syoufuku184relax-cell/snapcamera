document.addEventListener('DOMContentLoaded', () => {
    // --- 要素の取得 ---
    const cameraContainer = document.getElementById('camera-container');
    const previewContainer = document.getElementById('preview-container');
    const editorContainer = document.getElementById('editor-container');
    const albumContainer = document.getElementById('album-container');
    
    const videoElement = document.getElementById('camera-stream');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const previewImg = document.getElementById('preview-img');
    const activeIdolBadge = document.getElementById('active-idol-badge');
    
    const canvas = document.getElementById('paint-canvas');
    const ctx = canvas.getContext('2d');

    // 落書き専用オフスクリーンキャンバス
    const doodleCanvas = document.createElement('canvas');
    const doodleCtx = doodleCanvas.getContext('2d');

    const captureBtn = document.getElementById('capture-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const switchCameraBtn = document.getElementById('switch-camera-btn');
    const flashBtn = document.getElementById('flash-btn');
    const timerBtn = document.getElementById('timer-btn');
    const timerBadge = document.getElementById('timer-badge');
    const albumOpenBtn = document.getElementById('album-open-btn');
    const albumBackBtn = document.getElementById('album-back-btn');
    
    const previewRetakeBtn = document.getElementById('preview-retake-btn');
    const previewOkBtn = document.getElementById('preview-ok-btn');
    
    const retakeBtn = document.getElementById('retake-btn');
    const saveBtn = document.getElementById('save-btn');

    // アルバム要素
    const albumGrid = document.getElementById('album-grid');
    const albumTabs = document.querySelectorAll('.album-tab');
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxInfo = document.getElementById('lightbox-info');
    const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
    const lightboxDownloadBtn = document.getElementById('lightbox-download-btn');
    const lightboxDeleteBtn = document.getElementById('lightbox-delete-btn');

    // ツールバー＆モーダル
    const toolColor = document.getElementById('tool-color');
    const toolSize = document.getElementById('tool-size');
    const toolEraser = document.getElementById('tool-eraser');
    const toolStamp = document.getElementById('tool-stamp');
    const toolClear = document.getElementById('tool-clear');

    const modalOverlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // --- 状態管理 ---
    let currentStream = null;
    let useFrontCamera = true;
    let flashOn = false;
    let timerSeconds = 0;
    let isCountingDown = false;

    let isDrawing = false;
    let isEraser = false;
    let isStampMode = false;
    let selectedStamp = '⭐';
    
    let penSize = 25;
    let eraserSize = 15;
    let capturedImageObj = null;
    let capturedRawDataUrl = ''; // 加工前画像DataURL
    let currentSerialNo = '';
    let currentAlbumTab = 'all';
    let currentSelectedImage = null; // ライトボックスで開いている画像オブジェクト

    // メンカラーパレット
    const customColorPalette = [
        { name: '白', displayName: '白', hex: '#FFFFFF' },
        { name: '赤', displayName: '赤', hex: '#FF0000' },
        { name: '青', displayName: '青', hex: '#0000FF' },
        { name: '黄', displayName: '黄', hex: '#FFFF00' },
        { name: '紫', displayName: '紫', hex: '#FF00FF' },
        { name: '緑', displayName: '緑', hex: '#00FF00' },
        { name: 'ピンク', displayName: 'ピンク', hex: '#FF69B4' },
        { name: 'オレンジ', displayName: 'オレンジ', hex: '#FFA500' },
        { name: 'パステルブルー', displayName: 'パステル', hex: '#ADD8E6' },
        { name: 'エメラルドグリーン', displayName: 'エメグリ', hex: '#50C878' },
        { name: '黒', displayName: '黒', hex: '#000000' }
    ];

    // LocalStorage 保持データ
    let groups = JSON.parse(localStorage.getItem('cheki_groups')) || ['サンプルグループ'];
    let currentGroup = localStorage.getItem('cheki_current_group') || groups[0] || '';
    let idolList = JSON.parse(localStorage.getItem('cheki_idol_list')) || [
        { id: 1, group: 'サンプルグループ', idol: '推しメン名前', color: '#FF0000' }
    ];
    let activeIdolId = Number(localStorage.getItem('cheki_active_idol_id')) || (idolList.length > 0 ? idolList[0].id : null);

    function getActiveIdol() {
        return idolList.find(item => item.id === activeIdolId) || idolList[0] || { group: '', idol: '', color: '#FFFFFF' };
    }

    let currentColor = getActiveIdol().color;
    let selectedNewColor = customColorPalette[1].hex;

    function updateActiveBadge() {
        const active = getActiveIdol();
        if (active && (active.group || active.idol)) {
            activeIdolBadge.textContent = `選択: ${active.group} / ${active.idol}`;
            activeIdolBadge.style.borderColor = active.color;
        } else {
            activeIdolBadge.textContent = '選択: なし';
            activeIdolBadge.style.borderColor = 'rgba(255,255,255,0.3)';
        }
    }
    updateActiveBadge();

    // --- IndexedDB（画像保存用データベース）の実装 ---
    const DB_NAME = 'ChekiAppDB';
    const STORE_NAME = 'photos';

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function saveImageToDB(imageData) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.add(imageData);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getAllImagesFromDB() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteImageFromDB(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    // 重複しない4桁識別番号生成
    function generateUniqueSerial() {
        const todayStr = new Date().toISOString().split('T')[0];
        let usedSerials = JSON.parse(localStorage.getItem(`cheki_serials_${todayStr}`)) || [];
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        let attempts = 0;

        do {
            code = '';
            for (let i = 0; i < 4; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            attempts++;
        } while (usedSerials.includes(code) && attempts < 1000);

        usedSerials.push(code);
        localStorage.setItem(`cheki_serials_${todayStr}`, JSON.stringify(usedSerials));
        return code;
    }

    // --- カメラ制御 ---
    async function startCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('カメラ機能がサポートされていないか、環境が無効です。');
            return;
        }

        try {
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: useFrontCamera ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            videoElement.srcObject = currentStream;
            await videoElement.play();

            if (useFrontCamera) {
                videoElement.classList.add('camera-mirrored');
                flashBtn.style.display = 'none';
            } else {
                videoElement.classList.remove('camera-mirrored');
                flashBtn.style.display = 'flex';
            }
        } catch (err) {
            console.error('カメラ起動エラー:', err);
        }
    }

    // 撮影処理
    async function processCapture() {
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

        capturedRawDataUrl = tempCanvas.toDataURL('image/png');

        // ★ 加工前（写真）をIndexedDBに自動追加保存
        const active = getActiveIdol();
        await saveImageToDB({
            type: 'raw',
            dataUrl: capturedRawDataUrl,
            group: active.group,
            idol: active.idol,
            createdAt: new Date().toISOString()
        });

        capturedImageObj = new Image();
        capturedImageObj.onload = () => {
            previewImg.src = capturedRawDataUrl;
            cameraContainer.classList.remove('active');
            previewContainer.classList.add('active');
        };
        capturedImageObj.src = capturedRawDataUrl;
    }

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

    previewRetakeBtn.addEventListener('click', () => {
        previewContainer.classList.remove('active');
        cameraContainer.classList.add('active');
        startCamera();
    });

    previewOkBtn.addEventListener('click', () => {
        canvas.width = 1080;
        canvas.height = 1920;
        doodleCanvas.width = canvas.width;
        doodleCanvas.height = canvas.height;
        doodleCtx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);

        currentSerialNo = generateUniqueSerial();
        redrawCanvas();

        previewContainer.classList.remove('active');
        editorContainer.classList.add('active');
    });

    // --- チェキ画像再描画 ---
    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const active = getActiveIdol();

        // 1. フレーム背景
        ctx.fillStyle = active.color || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. 写真画像
        if (capturedImageObj) {
            const frameLeft = 30, frameTop = 80, frameRight = 30, frameBottom = 280;
            const targetWidth = canvas.width - (frameLeft + frameRight);
            const targetHeight = canvas.height - (frameTop + frameBottom);

            const imgAspect = capturedImageObj.width / capturedImageObj.height;
            const targetAspect = targetWidth / targetHeight;

            let dWidth, dHeight, dx, dy;
            if (imgAspect > targetAspect) {
                dWidth = targetWidth;
                dHeight = targetWidth / imgAspect;
                dx = frameLeft;
                dy = frameTop + (targetHeight - dHeight) / 2;
            } else {
                dHeight = targetHeight;
                dWidth = targetHeight * imgAspect;
                dx = frameLeft + (targetWidth - dWidth) / 2;
                dy = frameTop;
            }
            ctx.drawImage(capturedImageObj, dx, dy, dWidth, dHeight);
        }

        // 3. テキスト（グループ名・アイドル名・日付・認識番号）
        const hex = (active.color || '#FFFFFF').replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 255;
        const g = parseInt(hex.substring(2, 4), 16) || 255;
        const b = parseInt(hex.substring(4, 6), 16) || 255;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        ctx.fillStyle = brightness > 128 ? '#111111' : '#FFFFFF';

        if (active.group || active.idol) {
            ctx.font = 'bold 42px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${active.group} ${active.idol}`.trim(), 50, canvas.height - 110);
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${dateStr}  #${currentSerialNo}`, canvas.width - 50, canvas.height - 110);

        // 4. 落書きレイヤー合成
        ctx.drawImage(doodleCanvas, 0, 0);
    }

    // --- お絵描き描画操作 ---
    function getEventPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    function startAction(e) {
        const pos = getEventPos(e);
        if (isStampMode) {
            doodleCtx.font = '80px sans-serif';
            doodleCtx.textAlign = 'center';
            doodleCtx.textBaseline = 'middle';
            doodleCtx.fillText(selectedStamp, pos.x, pos.y);
            redrawCanvas();
        } else {
            isDrawing = true;
            doodleCtx.beginPath();
            doodleCtx.moveTo(pos.x, pos.y);
        }
        e.preventDefault();
    }

    function drawAction(e) {
        if (!isDrawing || isStampMode) return;
        const pos = getEventPos(e);
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

    function stopAction() { isDrawing = false; }

    canvas.addEventListener('mousedown', startAction);
    canvas.addEventListener('mousemove', drawAction);
    window.addEventListener('mouseup', stopAction);
    canvas.addEventListener('touchstart', startAction, { passive: false });
    canvas.addEventListener('touchmove', drawAction, { passive: false });
    canvas.addEventListener('touchend', stopAction);

    // ツールバー操作
    toolColor.addEventListener('click', () => { isEraser = false; isStampMode = false; updateActiveTool(toolColor); openColorModal(); });
    toolSize.addEventListener('click', () => { isEraser = false; isStampMode = false; updateActiveTool(toolSize); openSizeModal(); });
    toolEraser.addEventListener('click', () => { isEraser = true; isStampMode = false; updateActiveTool(toolEraser); openEraserModal(); });
    toolStamp.addEventListener('click', () => { isEraser = false; isStampMode = true; updateActiveTool(toolStamp); openStampModal(); });

    function updateActiveTool(btn) {
        [toolColor, toolSize, toolEraser, toolStamp].forEach(b => b.classList.remove('active-tool'));
        btn.classList.add('active-tool');
    }

    function openModal(content) {
        modalBody.innerHTML = content;
        modalOverlay.classList.add('active');
    }
    modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));

    function openColorModal() {
        let html = '<p style="text-align:center; font-weight:bold;">カラーを選択</p><div class="palette-grid">';
        customColorPalette.forEach(c => {
            html += `<div class="color-chip-wrapper" data-color="${c.hex}"><div class="color-chip" style="background-color:${c.hex};"></div><span class="color-label">${c.displayName}</span></div>`;
        });
        html += '</div>';
        openModal(html);
        document.querySelectorAll('.color-chip-wrapper').forEach(chip => {
            chip.addEventListener('click', (e) => {
                currentColor = e.currentTarget.getAttribute('data-color');
                modalOverlay.classList.remove('active');
            });
        });
    }

    function openSizeModal() {
        let html = `
            <p style="text-align:center; font-weight:bold; margin-bottom:15px;">ペンの太さを選択</p>
            <div style="display:flex; justify-content:space-around; gap:10px;">
                <button class="btn size-btn ${penSize === 10 ? 'primary' : 'secondary'}" data-size="10" style="flex:1;">細 (10)</button>
                <button class="btn size-btn ${penSize === 25 ? 'primary' : 'secondary'}" data-size="25" style="flex:1;">中 (25)</button>
                <button class="btn size-btn ${penSize === 45 ? 'primary' : 'secondary'}" data-size="45" style="flex:1;">太 (45)</button>
            </div>`;
        openModal(html);
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                penSize = Number(e.currentTarget.getAttribute('data-size'));
                modalOverlay.classList.remove('active');
            });
        });
    }

    function openEraserModal() {
        let html = `
            <p style="text-align:center; font-weight:bold; margin-bottom:15px;">消しゴムの太さを選択</p>
            <div style="display:flex; justify-content:space-around; gap:15px;">
                <button class="btn eraser-btn ${eraserSize === 15 ? 'primary' : 'secondary'}" data-size="15" style="flex:1;">中 (15)</button>
                <button class="btn eraser-btn ${eraserSize === 40 ? 'primary' : 'secondary'}" data-size="40" style="flex:1;">太 (40)</button>
            </div>`;
        openModal(html);
        document.querySelectorAll('.eraser-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                eraserSize = Number(e.currentTarget.getAttribute('data-size'));
                modalOverlay.classList.remove('active');
            });
        });
    }

    function openStampModal() {
        const stamps = ['⭐', '❤️', '🔥', '🎉', '🌸', '👍', '🐱', '🐶', '✨'];
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
    }

    toolClear.addEventListener('click', () => {
        if (confirm('落書きをすべて消去しますか？')) {
            doodleCtx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
            redrawCanvas();
        }
    });

    retakeBtn.addEventListener('click', () => {
        editorContainer.classList.remove('active');
        cameraContainer.classList.add('active');
        startCamera();
    });

    // 加工後チェキの保存ボタン押下時
    saveBtn.addEventListener('click', async () => {
        redrawCanvas();
        const editedDataUrl = canvas.toDataURL('image/png');
        const active = getActiveIdol();

        // ★ 加工後画像をIndexedDBに追加保存
        await saveImageToDB({
            type: 'edited',
            dataUrl: editedDataUrl,
            group: active.group,
            idol: active.idol,
            serial: currentSerialNo,
            createdAt: new Date().toISOString()
        });

        // 画像の直接ダウンロード処理
        const link = document.createElement('a');
        link.download = `cheki_${active.group || ''}_${active.idol || ''}_${currentSerialNo}.png`;
        link.href = editedDataUrl;
        link.click();

        alert('アルバムと端末に保存しました！');
    });

    // --- ★ アルバム表示機能の処理 ---
    albumOpenBtn.addEventListener('click', () => {
        cameraContainer.classList.remove('active');
        albumContainer.classList.add('active');
        loadAlbumGrid();
    });

    albumBackBtn.addEventListener('click', () => {
        albumContainer.classList.remove('active');
        cameraContainer.classList.add('active');
        startCamera();
    });

    albumTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            albumTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentAlbumTab = e.target.getAttribute('data-type');
            loadAlbumGrid();
        });
    });

    async function loadAlbumGrid() {
        albumGrid.innerHTML = '';
        const allImages = await getAllImagesFromDB();
        
        // 降順ソート (新しい順)
        allImages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const filtered = allImages.filter(img => {
            if (currentAlbumTab === 'all') return true;
            return img.type === currentAlbumTab;
        });

        if (filtered.length === 0) {
            albumGrid.innerHTML = '<p style="grid-column: span 4; text-align:center; color:#888; padding:20px;">画像がありません</p>';
            return;
        }

        filtered.forEach(imgObj => {
            const item = document.createElement('div');
            item.className = 'album-item';

            const tagText = imgObj.type === 'edited' ? '加工後' : '加工前';
            const tagClass = imgObj.type === 'edited' ? 'edited' : 'raw';

            item.innerHTML = `
                <img src="${imgObj.dataUrl}" alt="チェキ" loading="lazy">
                <span class="album-tag ${tagClass}">${tagText}</span>
            `;

            // タップで全画面表示モーダルを開く
            item.addEventListener('click', () => {
                openLightbox(imgObj);
            });

            albumGrid.appendChild(item);
        });
    }

    // --- ★ 全画面表示（ライトボックス）機能 ---
    function openLightbox(imgObj) {
        currentSelectedImage = imgObj;
        lightboxImg.src = imgObj.dataUrl;

        const date = new Date(imgObj.createdAt);
        const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        
        let infoStr = `[${imgObj.type === 'edited' ? '加工後チェキ' : '加工前写真'}] ${dateStr}`;
        if (imgObj.group || imgObj.idol) {
            infoStr += `<br>${imgObj.group} / ${imgObj.idol}`;
        }
        lightboxInfo.innerHTML = infoStr;

        lightboxModal.classList.add('active');
    }

    lightboxCloseBtn.addEventListener('click', () => {
        lightboxModal.classList.remove('active');
    });

    lightboxDownloadBtn.addEventListener('click', () => {
        if (!currentSelectedImage) return;
        const link = document.createElement('a');
        link.download = `cheki_album_${currentSelectedImage.id}.png`;
        link.href = currentSelectedImage.dataUrl;
        link.click();
    });

    lightboxDeleteBtn.addEventListener('click', async () => {
        if (!currentSelectedImage) return;
        if (confirm('この画像をアルバムから削除しますか？')) {
            await deleteImageFromDB(currentSelectedImage.id);
            lightboxModal.classList.remove('active');
            loadAlbumGrid();
        }
    });

    // 初期化（カメラ起動）
    startCamera();
});
