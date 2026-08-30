document.addEventListener('DOMContentLoaded', () => {
    // 画面要素
    const cameraContainer = document.getElementById('camera-container');
    const capturePreviewContainer = document.getElementById('capture-preview-container');
    const editorContainer = document.getElementById('editor-container');
    const designPreviewContainer = document.getElementById('design-preview-container');
    const albumContainer = document.getElementById('album-container');

    // 画像・キャンバス要素
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
    const editorPreviewBtn = document.getElementById('editor-preview-btn');
    const designRedrawBtn = document.getElementById('design-redraw-btn');
    const designSaveBtn = document.getElementById('design-save-btn');

    // アルバム・モーダル
    const albumOpenBtn = document.getElementById('album-open-btn');
    const albumBackBtn = document.getElementById('album-back-btn');
    const albumGrid = document.getElementById('album-grid');
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxInfo = document.getElementById('lightbox-info');
    const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
    const lightboxDownloadBtn = document.getElementById('lightbox-download-btn');
    const lightboxDeleteBtn = document.getElementById('lightbox-delete-btn');

    // ツール
    const toolColor = document.getElementById('tool-color');
    const toolSize = document.getElementById('tool-size');
    const toolEraser = document.getElementById('tool-eraser');
    const toolStamp = document.getElementById('tool-stamp');
    const toolClear = document.getElementById('tool-clear');

    const modalOverlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // 変数保持
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
    let currentSerialNo = '';
    let currentSelectedAlbumItem = null;

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

    let groups = JSON.parse(localStorage.getItem('cheki_groups')) || ['サンプルグループ'];
    let currentGroup = localStorage.getItem('cheki_current_group') || groups[0] || '';
    let idolList = JSON.parse(localStorage.getItem('cheki_idol_list')) || [
        { id: 1, group: 'サンプルグループ', idol: '推しメン名前', color: '#FF0000' }
    ];
    let activeIdolId = Number(localStorage.getItem('cheki_active_idol_id')) || (idolList.length > 0 ? idolList[0].id : null);
    let albumPhotos = JSON.parse(localStorage.getItem('cheki_album_photos')) || [];

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
            activeIdolBadge.textContent = `選択: ${active.group} / ${active.idol}`;
            activeIdolBadge.style.borderColor = active.color;
        } else {
            activeIdolBadge.textContent = '選択: なし';
            activeIdolBadge.style.borderColor = 'rgba(255,255,255,0.3)';
        }
    }
    updateActiveBadge();

    function generateUniqueSerial() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    }

    function redrawCanvas() {
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const active = getActiveIdol();

        ctx.fillStyle = active.color || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        ctx.fillText(`${dateStr}  #${currentSerialNo}`, canvas.width - 60, canvas.height - 120);

        ctx.drawImage(doodleCanvas, 0, 0);
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

    // --- 撮影 ➔ 撮影プレビュー ---
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

        const dataUrl = tempCanvas.toDataURL('image/png');
        capturedImageObj = new Image();
        capturedImageObj.onload = () => {
            capturePreviewImg.src = dataUrl;
            switchScreen(capturePreviewContainer);
        };
        capturedImageObj.src = dataUrl;
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

    // 撮り直し ➔ 撮影に戻る
    if (captureRetakeBtn) {
        captureRetakeBtn.addEventListener('click', () => {
            switchScreen(cameraContainer);
            startCamera();
        });
    }

    // 保存してデザインモードに移行
    if (captureOkBtn) {
        captureOkBtn.addEventListener('click', () => {
            canvas.width = 1080;
            canvas.height = 1920;
            doodleCanvas.width = canvas.width;
            doodleCanvas.height = canvas.height;
            doodleCtx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);

            currentSerialNo = generateUniqueSerial();
            redrawCanvas();
            switchScreen(editorContainer);
        });
    }

    // --- デザイン ➔ デザインプレビュー表示 ---
    if (editorPreviewBtn) {
        editorPreviewBtn.addEventListener('click', () => {
            redrawCanvas();
            designPreviewImg.src = canvas.toDataURL('image/png');
            switchScreen(designPreviewContainer);
        });
    }

    // 描画直し ➔ デザインモードに戻る
    if (designRedrawBtn) {
        designRedrawBtn.addEventListener('click', () => {
            switchScreen(editorContainer);
        });
    }

    // 保存 ➔ アルバム登録 ➔ 撮影モードに戻る
    if (designSaveBtn) {
        designSaveBtn.addEventListener('click', () => {
            const dataURL = canvas.toDataURL('image/png');
            const active = getActiveIdol();
            const safeGroup = active.group ? `${active.group}_` : '';
            const safeIdol = active.idol ? `${active.idol}_` : '';
            const fileName = `cheki_${safeGroup}${safeIdol}${currentSerialNo}.png`;

            albumPhotos.unshift({
                id: Date.now(),
                url: dataURL,
                serial: currentSerialNo,
                date: new Date().toLocaleDateString()
            });
            localStorage.setItem('cheki_album_photos', JSON.stringify(albumPhotos));

            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataURL;
            link.click();

            // 撮影モードへ復帰
            switchScreen(cameraContainer);
            startCamera();
        });
    }

    // タイマー切替
    if (timerBtn) {
        timerBtn.addEventListener('click', () => {
            if (timerSeconds === 0) { timerSeconds = 3; timerBadge.textContent = '3秒'; timerBtn.classList.add('active-tool'); }
            else if (timerSeconds === 3) { timerSeconds = 5; timerBadge.textContent = '5秒'; }
            else if (timerSeconds === 5) { timerSeconds = 10; timerBadge.textContent = '10秒'; }
            else { timerSeconds = 0; timerBadge.textContent = 'オフ'; timerBtn.classList.remove('active-tool'); }
        });
    }

    // カメラ切替
    if (switchCameraBtn) {
        switchCameraBtn.addEventListener('click', () => {
            useFrontCamera = !useFrontCamera;
            flashOn = false;
            if (flashBtn) flashBtn.classList.remove('active-tool');
            startCamera();
        });
    }

    // フラッシュ切替
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

    // 描画関連イベント
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

    if (canvas) {
        canvas.addEventListener('mousedown', startAction);
        canvas.addEventListener('mousemove', drawAction);
        window.addEventListener('mouseup', () => isDrawing = false);
        canvas.addEventListener('touchstart', startAction, { passive: false });
        canvas.addEventListener('touchmove', drawAction, { passive: false });
        canvas.addEventListener('touchend', () => isDrawing = false);
    }

    // ツールバー操作
    if (toolColor) {
        toolColor.addEventListener('click', () => {
            isEraser = false; isStampMode = false; updateActiveTool(toolColor);
            let html = '<p style="text-align:center; font-weight:bold;">カラーを選択</p><div class="palette-grid">';
            customColorPalette.forEach(c => {
                html += `<div class="color-chip-wrapper" data-color="${c.hex}"><div class="color-chip" style="background-color: ${c.hex};"></div><span class="color-label">${c.displayName}</span></div>`;
            });
            html += '</div>';
            openModal(html);
            document.querySelectorAll('.color-chip-wrapper').forEach(chip => {
                chip.addEventListener('click', (e) => {
                    currentColor = e.currentTarget.getAttribute('data-color');
                    modalOverlay.classList.remove('active');
                });
            });
        });
    }

    if (toolSize) {
        toolSize.addEventListener('click', () => {
            isEraser = false; isStampMode = false; updateActiveTool(toolSize);
            let html = `<p style="text-align:center; font-weight:bold; margin-bottom:15px;">ペンの太さ</p>
                <div style="display:flex; justify-content:space-around;">
                    <button class="btn size-select-btn secondary" data-size="10">細</button>
                    <button class="btn size-select-btn primary" data-size="25">中</button>
                    <button class="btn size-select-btn secondary" data-size="45">太</button>
                </div>`;
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
            isEraser = true; isStampMode = false; updateActiveTool(toolEraser);
            let html = `<p style="text-align:center; font-weight:bold; margin-bottom:15px;">消しゴムの太さ</p>
                <div style="display:flex; justify-content:space-around;">
                    <button class="btn eraser-size-btn primary" data-size="15">中</button>
                    <button class="btn eraser-size-btn secondary" data-size="40">太</button>
                </div>`;
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
        });
    }

    if (toolClear) {
        toolClear.addEventListener('click', () => {
            if (confirm('落書きをクリアしますか？')) {
                doodleCtx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
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
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));

    // アルバム表示
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
                localStorage.setItem('cheki_album_photos', JSON.stringify(albumPhotos));
                lightboxModal.classList.remove('active');
                renderAlbumGrid();
            }
        });
    }

    // 設定モーダル
    activeIdolBadge.addEventListener('click', openSettingsModal);
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);

    function openSettingsModal() {
        let groupOptions = groups.map(g => `<option value="${g}" ${g === currentGroup ? 'selected' : ''}>${g}</option>`).join('');
        let html = `
            <p style="text-align:center; font-weight:bold;">推しメン選択</p>
            <div style="margin-top:15px;">
                <label style="font-size:0.8rem;">グループ選択</label>
                <select id="group-select" style="width:100%; padding:8px; margin-top:4px; border-radius:6px; background:#333; color:#fff; border:1px solid #555;">${groupOptions}</select>
            </div>
            <div id="modal-idol-list" style="margin-top:15px; max-height:200px; overflow-y:auto;"></div>
        `;
        openModal(html);

        const groupSelect = document.getElementById('group-select');
        groupSelect.addEventListener('change', (e) => {
            currentGroup = e.target.value;
            localStorage.setItem('cheki_current_group', currentGroup);
            renderIdolItems();
        });

        renderIdolItems();
    }

    function renderIdolItems() {
        const container = document.getElementById('modal-idol-list');
        if (!container) return;
        const filtered = idolList.filter(i => i.group === currentGroup);
        container.innerHTML = filtered.map(item => `
            <div class="idol-select-item" style="padding:10px; border-left:4px solid ${item.color}; background:#333; margin-bottom:6px; border-radius:4px; cursor:pointer;" data-id="${item.id}">
                <strong>${item.idol}</strong>
            </div>
        `).join('');

        container.querySelectorAll('.idol-select-item').forEach(el => {
            el.addEventListener('click', () => {
                activeIdolId = Number(el.getAttribute('data-id'));
                currentColor = getActiveIdol().color;
                localStorage.setItem('cheki_active_idol_id', activeIdolId);
                updateActiveBadge();
                modalOverlay.classList.remove('active');
            });
        });
    }

    // 初期起動
    switchScreen(cameraContainer);
    startCamera();
});
