document.addEventListener('DOMContentLoaded', () => {
    // 画面コンテナ要素
    const cameraContainer = document.getElementById('camera-container');
    const previewContainer = document.getElementById('preview-container');
    const editorContainer = document.getElementById('editor-container');
    const albumContainer = document.getElementById('album-container');
    
    // カメラ関連
    const videoElement = document.getElementById('camera-stream');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const previewImg = document.getElementById('preview-img');
    const activeIdolBadge = document.getElementById('active-idol-badge');
    
    // キャンバス関連
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
    
    const previewRetakeBtn = document.getElementById('preview-retake-btn');
    const previewOkBtn = document.getElementById('preview-ok-btn');
    
    const retakeBtn = document.getElementById('retake-btn');
    const saveBtn = document.getElementById('save-btn');

    // アルバム・モーダル関連
    const albumOpenBtn = document.getElementById('album-open-btn');
    const albumBackBtn = document.getElementById('album-back-btn');
    const albumGrid = document.getElementById('album-grid');
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxInfo = document.getElementById('lightbox-info');
    const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
    const lightboxDownloadBtn = document.getElementById('lightbox-download-btn');
    const lightboxDeleteBtn = document.getElementById('lightbox-delete-btn');

    // ツールバー
    const toolColor = document.getElementById('tool-color');
    const toolSize = document.getElementById('tool-size');
    const toolEraser = document.getElementById('tool-eraser');
    const toolStamp = document.getElementById('tool-stamp');
    const toolClear = document.getElementById('tool-clear');

    // ポップアップモーダル
    const modalOverlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // 状態管理
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

    // カラーパレット
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

    // 保存データの取得
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
    let selectedNewColor = customColorPalette[1].hex;

    function updateActiveBadge() {
        const active = getActiveIdol();
        if (active && (active.group || active.idol)) {
            activeIdolBadge.textContent = `選択: ${active.group} / ${active.idol}`;
            activeIdolBadge.style.borderColor = active.color;
        } else {
            activeIdolBadge.textContent = '選択: なし（タップして選択）';
            activeIdolBadge.style.borderColor = 'rgba(255,255,255,0.3)';
        }
    }
    updateActiveBadge();

    function generateUniqueSerial() {
        const todayStr = new Date().toISOString().split('T')[0];
        let usedSerials = JSON.parse(localStorage.getItem(`cheki_serials_${todayStr}`)) || [];
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        let attempts = 0;
        do {
            code = '';
            for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
            attempts++;
        } while (usedSerials.includes(code) && attempts < 1000);
        usedSerials.push(code);
        localStorage.setItem(`cheki_serials_${todayStr}`, JSON.stringify(usedSerials));
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

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('カメラ機能に対応していません（HTTPS通信が必要です）。');
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
                if (flashBtn) flashBtn.style.display = 'none';
            } else {
                videoElement.classList.remove('camera-mirrored');
                if (flashBtn) flashBtn.style.display = 'flex';
            }
        } catch (err) {
            console.error('カメラ起動エラー:', err);
        }
    }

    activeIdolBadge.addEventListener('click', openSelectIdolModal);
    if (settingsBtn) settingsBtn.addEventListener('click', openSelectIdolModal);

    function openSelectIdolModal() {
        let groupOptions = groups.map(g => `<option value="${g}" ${g === currentGroup ? 'selected' : ''}>${g}</option>`).join('');
        groupOptions += `<option value="__NEW__">＋ 新規グループ追加</option>`;

        let paletteHtml = customColorPalette.map(c => `
            <div class="color-chip-wrapper setting-color-chip ${c.hex === selectedNewColor ? 'selected-chip' : ''}" data-color="${c.hex}" style="cursor:pointer;">
                <div class="color-chip" style="background-color: ${c.hex}; width:32px; height:32px; border-radius:50%; border:2px solid ${c.hex === '#FFFFFF' ? '#ccc' : '#fff'};"></div>
                <span class="color-label" style="font-size:0.7rem; color:#fff;">${c.displayName}</span>
            </div>
        `).join('');

        let html = `
            <p style="text-align:center; font-weight:bold;">推しメン選択・登録</p>
            <div class="settings-container">
                <div class="setting-form-box">
                    <div class="setting-group"><label>現在選択中のグループ</label><select id="group-select">${groupOptions}</select></div>
                    <div id="new-group-input-box" class="setting-group" style="display:none;"><input type="text" id="new-group-name" placeholder="新しいグループ名を入力"></div>
                </div>
                <div class="setting-form-box">
                    <p style="font-size:0.8rem; font-weight:bold; color:#ff3366;">メンバーを追加</p>
                    <div class="setting-group"><label>アイドル名</label><input type="text" id="new-idol-name" placeholder="例: 推しメン名前"></div>
                    <div class="setting-group"><label>メンカラを選択</label><div class="palette-grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">${paletteHtml}</div></div>
                    <button id="add-idol-btn" class="btn primary" style="padding:6px; margin-top:8px; width:100%;">追加する</button>
                </div>
                <div class="idol-list-box"><p style="font-size:0.8rem; font-weight:bold;">メンバー選択 (タップで選択)</p><div id="idol-items-container"></div></div>
            </div>
        `;
        openModal(html);
        renderIdolListInModal();

        const groupSelect = document.getElementById('group-select');
        const newGroupInputBox = document.getElementById('new-group-input-box');

        groupSelect.addEventListener('change', (e) => {
            newGroupInputBox.style.display = e.target.value === '__NEW__' ? 'flex' : 'none';
            if (e.target.value !== '__NEW__') {
                currentGroup = e.target.value;
                saveData();
                renderIdolListInModal();
            }
        });

        document.querySelectorAll('.setting-color-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                selectedNewColor = e.currentTarget.getAttribute('data-color');
            });
        });

        document.getElementById('add-idol-btn').addEventListener('click', () => {
            let selectedGroup = currentGroup;
            if (groupSelect.value === '__NEW__') {
                const inputVal = document.getElementById('new-group-name').value.trim();
                if (!inputVal) return alert('グループ名を入力してください。');
                selectedGroup = inputVal;
                if (!groups.includes(selectedGroup)) groups.push(selectedGroup);
                currentGroup = selectedGroup;
            }
            const nameVal = document.getElementById('new-idol-name').value.trim();
            if (!nameVal) return alert('アイドル名を入力してください。');

            const newItem = { id: Date.now(), group: selectedGroup, idol: nameVal, color: selectedNewColor };
            idolList.push(newItem);
            activeIdolId = newItem.id;
            currentColor = newItem.color;
            saveData();
            openSelectIdolModal();
            updateActiveBadge();
        });
    }

    function renderIdolListInModal() {
        const container = document.getElementById('idol-items-container');
        if (!container) return;
        const filteredList = idolList.filter(item => item.group === currentGroup);
        if (filteredList.length === 0) {
            container.innerHTML = '<p style="font-size:0.8rem; color:#888; text-align:center;">メンバーがいません</p>';
            return;
        }
        container.innerHTML = filteredList.map(item => `
            <div class="idol-list-item ${item.id === activeIdolId ? 'selected' : ''}" style="border-left: 4px solid ${item.color}; padding: 6px; margin-bottom: 4px; display: flex; justify-content: space-between;" data-id="${item.id}">
                <div><strong>${item.idol}</strong></div>
                <button class="action-sm-btn danger delete-btn" data-id="${item.id}">削除</button>
            </div>
        `).join('');

        container.querySelectorAll('.idol-list-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) return;
                activeIdolId = Number(el.getAttribute('data-id'));
                currentColor = getActiveIdol().color;
                saveData();
                renderIdolListInModal();
                updateActiveBadge();
                modalOverlay.classList.remove('active');
            });
        });

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(e.currentTarget.getAttribute('data-id'));
                idolList = idolList.filter(item => item.id !== id);
                if (activeIdolId === id) activeIdolId = idolList.length > 0 ? idolList[0].id : null;
                saveData();
                renderIdolListInModal();
                updateActiveBadge();
            });
        });
    }

    function saveData() {
        localStorage.setItem('cheki_groups', JSON.stringify(groups));
        localStorage.setItem('cheki_current_group', currentGroup);
        localStorage.setItem('cheki_idol_list', JSON.stringify(idolList));
        localStorage.setItem('cheki_active_idol_id', activeIdolId);
        localStorage.setItem('cheki_album_photos', JSON.stringify(albumPhotos));
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
            if (!capabilities.torch) return alert('このカメラはフラッシュ未対応です。');
            try {
                flashOn = !flashOn;
                await track.applyConstraints({ advanced: [{ torch: flashOn }] });
                flashBtn.classList.toggle('active-tool', flashOn);
            } catch (err) { console.error(err); }
        });
    }

    if (timerBtn) {
        timerBtn.addEventListener('click', () => {
            if (timerSeconds === 0) { timerSeconds = 3; timerBadge.textContent = '3秒'; timerBtn.classList.add('active-tool'); }
            else if (timerSeconds === 3) { timerSeconds = 5; timerBadge.textContent = '5秒'; }
            else if (timerSeconds === 5) { timerSeconds = 10; timerBadge.textContent = '10秒'; }
            else { timerSeconds = 0; timerBadge.textContent = 'オフ'; timerBtn.classList.remove('active-tool'); }
        });
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

        const dataUrl = tempCanvas.toDataURL('image/png');
        capturedImageObj = new Image();
        capturedImageObj.onload = () => {
            previewImg.src = dataUrl;
            switchScreen(previewContainer);
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

    if (previewRetakeBtn) {
        previewRetakeBtn.addEventListener('click', () => {
            switchScreen(cameraContainer);
            startCamera();
        });
    }

    if (previewOkBtn) {
        previewOkBtn.addEventListener('click', () => {
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

    function openModal(htmlContent) {
        modalBody.innerHTML = htmlContent;
        modalOverlay.classList.add('active');
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
    }

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
            let html = `<p style="text-align:center; font-weight:bold; margin-bottom:15px;">ペンの太さを選択</p>
                <div style="display:flex; justify-content:space-around; gap:10px;">
                    <button class="btn size-select-btn ${penSize === 10 ? 'primary' : 'secondary'}" data-size="10">細</button>
                    <button class="btn size-select-btn ${penSize === 25 ? 'primary' : 'secondary'}" data-size="25">中</button>
                    <button class="btn size-select-btn ${penSize === 45 ? 'primary' : 'secondary'}" data-size="45">太</button>
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
                <div style="display:flex; justify-content:space-around; gap:15px;">
                    <button class="btn eraser-size-btn ${eraserSize === 15 ? 'primary' : 'secondary'}" data-size="15">中</button>
                    <button class="btn eraser-size-btn ${eraserSize === 40 ? 'primary' : 'secondary'}" data-size="40">太</button>
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

    function updateActiveTool(activeBtn) {
        [toolColor, toolSize, toolEraser, toolStamp].forEach(btn => btn && btn.classList.remove('active-tool'));
        if (activeBtn) activeBtn.classList.add('active-tool');
    }

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

    if (toolClear) {
        toolClear.addEventListener('click', () => {
            if (confirm('落書きをクリアしますか？')) {
                doodleCtx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
                redrawCanvas();
            }
        });
    }

    if (retakeBtn) {
        retakeBtn.addEventListener('click', () => {
            switchScreen(cameraContainer);
            startCamera();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            redrawCanvas();
            const dataURL = canvas.toDataURL('image/png');
            const active = getActiveIdol();
            const safeGroup = active.group ? `${active.group}_` : '';
            const safeIdol = active.idol ? `${active.idol}_` : '';
            const fileName = `cheki_${safeGroup}${safeIdol}${currentSerialNo}.png`;

            albumPhotos.unshift({
                id: Date.now(),
                url: dataURL,
                type: 'edited',
                serial: currentSerialNo,
                date: new Date().toLocaleDateString()
            });
            saveData();

            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataURL;
            link.click();
        });
    }

    // アルバム処理
    if (albumOpenBtn) {
        albumOpenBtn.addEventListener('click', () => {
            renderAlbumGrid('all');
            switchScreen(albumContainer);
        });
    }

    if (albumBackBtn) {
        albumBackBtn.addEventListener('click', () => {
            switchScreen(cameraContainer);
            startCamera();
        });
    }

    function renderAlbumGrid(filterType = 'all') {
        if (!albumGrid) return;
        albumGrid.innerHTML = '';
        const items = albumPhotos.filter(p => filterType === 'all' || p.type === filterType);
        if (items.length === 0) {
            albumGrid.innerHTML = '<p style="grid-column: span 4; text-align: center; color: #888; font-size: 0.8rem; padding: 20px;">写真がありません</p>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'album-item';
            div.innerHTML = `
                <img src="${item.url}" alt="album">
                <span class="album-tag ${item.type}">${item.type === 'edited' ? 'チェキ' : '写真'}</span>
            `;
            div.addEventListener('click', () => openLightbox(item));
            albumGrid.appendChild(div);
        });
    }

    function openLightbox(item) {
        currentSelectedAlbumItem = item;
        lightboxImg.src = item.url;
        lightboxInfo.textContent = `${item.date} #${item.serial || ''}`;
        lightboxModal.classList.add('active');
    }

    if (lightboxCloseBtn) {
        lightboxCloseBtn.addEventListener('click', () => lightboxModal.classList.remove('active'));
    }

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
            if (confirm('この写真をアルバムから削除しますか？')) {
                albumPhotos = albumPhotos.filter(p => p.id !== currentSelectedAlbumItem.id);
                saveData();
                lightboxModal.classList.remove('active');
                renderAlbumGrid('all');
            }
        });
    }

    // 初期化（カメラ画面のみを起動）
    function init() {
        switchScreen(cameraContainer);
        startCamera();
    }

    init();
});
