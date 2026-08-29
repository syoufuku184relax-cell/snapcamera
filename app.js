document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
    const cameraContainer = document.getElementById('camera-container');
    const previewContainer = document.getElementById('preview-container');
    const editorContainer = document.getElementById('editor-container');
    
    const videoElement = document.getElementById('camera-stream');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const previewImg = document.getElementById('preview-img');
    const activeIdolBadge = document.getElementById('active-idol-badge');
    
    const canvas = document.getElementById('paint-canvas');
    const ctx = canvas.getContext('2d');

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

    // アイコンツールバー
    const toolColor = document.getElementById('tool-color');
    const toolSize = document.getElementById('tool-size');
    const toolEraser = document.getElementById('tool-eraser');
    const toolStamp = document.getElementById('tool-stamp');
    const toolClear = document.getElementById('tool-clear');

    // モーダル要素
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
    
    let currentSize = 10;
    let capturedImageObj = null;

    // 指定されたメンカラパレット（色名・短縮表示付き）
    const customColorPalette = [
        { name: '白', short: '白', hex: '#FFFFFF' },
        { name: '赤', short: '赤', hex: '#FF0000' },
        { name: '青', short: '青', hex: '#0000FF' },
        { name: '黄', short: '黄', hex: '#FFFF00' },
        { name: '紫', short: '紫', hex: '#FF00FF' },
        { name: '緑', short: '緑', hex: '#00FF00' },
        { name: 'ピンク', short: 'ピnk', hex: '#FF69B4' },
        { name: 'オレンジ', short: 'オラ', hex: '#FFA500' },
        { name: 'パステルブルー', short: 'パス', hex: '#ADD8E6' },
        { name: 'エメラルドグリーン', short: 'エメ', hex: '#50C878' },
        { name: '黒', short: '黒', hex: '#000000' }
    ];

    // 複数登録可能なアイドルリストの管理 (localStorageから復元)
    let idolList = [];
    try {
        const saved = localStorage.getItem('cheki_idol_list');
        idolList = saved ? JSON.parse(saved) : [
            { id: 1, group: 'サンプルグループ', idol: '推しメン名前', color: '#FF0000' }
        ];
    } catch (e) {
        idolList = [{ id: 1, group: 'サンプルグループ', idol: '推しメン名前', color: '#FF0000' }];
    }

    let activeIdolId = Number(localStorage.getItem('cheki_active_idol_id')) || (idolList.length > 0 ? idolList[0].id : null);

    function getActiveIdol() {
        return idolList.find(item => item.id === activeIdolId) || idolList[0] || { group: '', idol: '', color: '#ff3366' };
    }

    let currentColor = getActiveIdol().color;

    function updateActiveBadge() {
        const active = getActiveIdol();
        if (active && (active.group || active.idol)) {
            activeIdolBadge.textContent = `選択: ${active.group} / ${active.idol}`;
            activeIdolBadge.style.borderColor = active.color;
        } else {
            activeIdolBadge.textContent = '選択: なし（設定から追加）';
            activeIdolBadge.style.borderColor = 'rgba(255,255,255,0.3)';
        }
    }
    updateActiveBadge();

    // 1. カメラ起動処理（フォールバック機能付き）
    async function startCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        // カメラ権限チェック
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('お使いのブラウザ・環境ではカメラ機能（getUserMedia）がサポートされていないか、HTTPSでアクセスされていない可能性があります。');
            return;
        }

        const primaryConstraints = {
            video: {
                facingMode: useFrontCamera ? 'user' : 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        try {
            currentStream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
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
            console.warn('詳細設定でのカメラ起動に失敗。デフォルト設定で再試行します:', err);
            // 互換性のためのフォールバック処理
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                videoElement.srcObject = currentStream;
                await videoElement.play();
            } catch (fallbackErr) {
                console.error('カメラの起動に失敗しました:', fallbackErr);
                alert(`カメラのアクセスに失敗しました:\n${fallbackErr.name} - ${fallbackErr.message}\n\n・カメラの利用許可が「拒否」されていないか確認してください。\n・他のアプリでカメラが使用中ではないか確認してください。`);
            }
        }
    }

    // 設定ボタン：複数登録可能な設定画面を表示
    settingsBtn.addEventListener('click', () => {
        openSettingsModal();
    });

    function openSettingsModal() {
        let html = `
            <p style="text-align:center; font-weight:bold;">推しメン設定（複数登録）</p>
            <div class="settings-container">
                <div class="setting-form-box">
                    <p style="font-size:0.8rem; font-weight:bold; color:#ff3366;">新規追加</p>
                    <div class="setting-group">
                        <label>グループ名</label>
                        <input type="text" id="new-group" placeholder="例: 〇〇アイドル">
                    </div>
                    <div class="setting-group">
                        <label>アイドル名</label>
                        <input type="text" id="new-idol" placeholder="例: 推しメン名前">
                    </div>
                    <div class="setting-group">
                        <label>メンカラ</label>
                        <select id="new-color">
                            ${customColorPalette.map(c => `<option value="${c.hex}">${c.name} (${c.short})</option>`).join('')}
                        </select>
                    </div>
                    <button id="add-idol-btn" class="btn primary" style="padding:6px; font-size:0.85rem; margin-top:4px;">リストに追加</button>
                </div>

                <div class="idol-list-box">
                    <p style="font-size:0.8rem; font-weight:bold;">登録済みリスト (タップして切替)</p>
                    <div id="idol-items-container" style="display:flex; flex-direction:column; gap:6px;">
                    </div>
                </div>
            </div>
        `;
        openModal(html);
        renderIdolListInModal();

        document.getElementById('add-idol-btn').addEventListener('click', () => {
            const g = document.getElementById('new-group').value.trim();
            const i = document.getElementById('new-idol').value.trim();
            const c = document.getElementById('new-color').value;

            if (!g && !i) {
                alert('グループ名かアイドル名を入力してください。');
                return;
            }

            const newItem = {
                id: Date.now(),
                group: g,
                idol: i,
                color: c
            };

            idolList.push(newItem);
            if (!activeIdolId) {
                activeIdolId = newItem.id;
                currentColor = newItem.color;
            }
            saveIdolData();
            renderIdolListInModal();
            updateActiveBadge();
        });
    }

    function renderIdolListInModal() {
        const container = document.getElementById('idol-items-container');
        if (!container) return;

        if (idolList.length === 0) {
            container.innerHTML = '<p style="font-size:0.8rem; color:#888; text-align:center;">登録がありません</p>';
            return;
        }

        container.innerHTML = idolList.map(item => `
            <div class="idol-list-item ${item.id === activeIdolId ? 'selected' : ''}" style="border-left-color: ${item.color};" data-id="${item.id}">
                <div class="idol-info select-target" data-id="${item.id}">
                    <strong style="color:#fff;">${item.group || '(グループなし)'}</strong>
                    <span style="color:#ccc;">${item.idol || '(名前なし)'}</span>
                </div>
                <div class="idol-actions">
                    <button class="action-sm-btn danger delete-btn" data-id="${item.id}">削除</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.select-target').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.getAttribute('data-id'));
                activeIdolId = id;
                const active = getActiveIdol();
                currentColor = active.color;
                saveIdolData();
                renderIdolListInModal();
                updateActiveBadge();
            });
        });

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(e.currentTarget.getAttribute('data-id'));
                idolList = idolList.filter(item => item.id !== id);
                if (activeIdolId === id) {
                    activeIdolId = idolList.length > 0 ? idolList[0].id : null;
                    currentColor = activeIdolId ? getActiveIdol().color : '#ff3366';
                }
                saveIdolData();
                renderIdolListInModal();
                updateActiveBadge();
            });
        });
    }

    function saveIdolData() {
        localStorage.setItem('cheki_idol_list', JSON.stringify(idolList));
        localStorage.setItem('cheki_active_idol_id', activeIdolId);
    }

    switchCameraBtn.addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        flashOn = false;
        flashBtn.classList.remove('active-tool');
        startCamera();
    });

    flashBtn.addEventListener('click', async () => {
        if (!currentStream) return;
        const track = currentStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};

        if (!capabilities.torch) {
            alert('このデバイス/カメラはフラッシュ機能に対応していません。');
            return;
        }

        try {
            flashOn = !flashOn;
            await track.applyConstraints({
                advanced: [{ torch: flashOn }]
            });
            if (flashOn) {
                flashBtn.classList.add('active-tool');
            } else {
                flashBtn.classList.remove('active-tool');
            }
        } catch (err) {
            console.error('フラッシュ切替エラー:', err);
        }
    });

    timerBtn.addEventListener('click', () => {
        if (timerSeconds === 0) {
            timerSeconds = 3;
            timerBadge.textContent = '3秒';
            timerBtn.classList.add('active-tool');
        } else if (timerSeconds === 3) {
            timerSeconds = 5;
            timerBadge.textContent = '5秒';
        } else if (timerSeconds === 5) {
            timerSeconds = 10;
            timerBadge.textContent = '10秒';
        } else {
            timerSeconds = 0;
            timerBadge.textContent = 'オフ';
            timerBtn.classList.remove('active-tool');
        }
    });

    // 2. 撮影処理 ➔ プレビューへ
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

        capturedImageObj = new Image();
        capturedImageObj.onload = () => {
            previewImg.src = tempCanvas.toDataURL('image/png');
            cameraContainer.classList.remove('active');
            previewContainer.classList.add('active');
        };
        capturedImageObj.src = tempCanvas.toDataURL('image/png');
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

            const countdownInterval = setInterval(() => {
                remaining--;
                if (remaining > 0) {
                    countdownOverlay.textContent = remaining;
                } else {
                    clearInterval(countdownInterval);
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
        redrawCanvas();

        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        const active = getActiveIdol();
        const safeGroup = active.group ? `${active.group}_` : '';
        const safeIdol = active.idol ? `${active.idol}_` : '';
        link.download = `cheki_${safeGroup}${safeIdol}${Date.now()}.png`;
        link.href = dataURL;
        link.click();

        previewContainer.classList.remove('active');
        editorContainer.classList.add('active');
    });

    function redrawCanvas() {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (capturedImageObj) {
            const frameLeft = 60;
            const frameTop = 120;
            const frameRight = 60;
            const frameBottom = 350;

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

        const active = getActiveIdol();
        if (active.group || active.idol) {
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 42px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            
            const textString = `${active.group} ${active.idol}`.trim();
            ctx.fillText(textString, 80, canvas.height - 120);

            ctx.fillStyle = active.color;
            ctx.fillRect(80, canvas.height - 100, 200, 12);
        }
    }

    // 3. モーダル＆お絵描きツール設定
    function openModal(htmlContent) {
        modalBody.innerHTML = htmlContent;
        modalOverlay.classList.add('active');
    }

    modalCloseBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
    });

    toolColor.addEventListener('click', () => {
        isEraser = false;
        isStampMode = false;
        updateActiveTool(toolColor);

        let html = '<p style="text-align:center; font-weight:bold;">カラーを選択</p><div class="palette-grid">';
        customColorPalette.forEach(c => {
            html += `
                <div class="color-chip-wrapper" data-color="${c.hex}">
                    <div class="color-chip" style="background-color: ${c.hex};"></div>
                    <span class="color-label">${c.name}<br>(${c.short})</span>
                </div>
            `;
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

    toolSize.addEventListener('click', () => {
        isEraser = false;
        isStampMode = false;
        updateActiveTool(toolSize);

        let html = `
            <p style="text-align:center; font-weight:bold;">ペンの太さ: <span id="size-val">${currentSize}</span>px</p>
            <input type="range" id="modal-size-range" min="2" max="60" value="${currentSize}" style="width:100%; margin:20px 0;">
        `;
        openModal(html);

        const range = document.getElementById('modal-size-range');
        const sizeVal = document.getElementById('size-val');
        range.addEventListener('input', (e) => {
            currentSize = e.target.value;
            sizeVal.textContent = currentSize;
        });
    });

    toolEraser.addEventListener('click', () => {
        isEraser = true;
        isStampMode = false;
        updateActiveTool(toolEraser);
    });

    toolStamp.addEventListener('click', () => {
        isEraser = false;
        isStampMode = true;
        updateActiveTool(toolStamp);

        const stamps = ['⭐', '❤️', '🔥', '🎉', '🌸', '👍', '🐱', '🐶', '✨'];
        let html = '<p style="text-align:center; font-weight:bold;">スタンプを選択</p><div class="stamp-grid">';
        stamps.forEach(s => {
            html += `<div class="stamp-item" data-stamp="${s}">${s}</div>`;
        });
        html += '</div>';

        openModal(html);

        document.querySelectorAll('.stamp-item').forEach(item => {
            item.addEventListener('click', (e) => {
                selectedStamp = e.target.getAttribute('data-stamp');
                modalOverlay.classList.remove('active');
            });
        });
    });

    function updateActiveTool(activeBtn) {
        [toolColor, toolSize, toolEraser, toolStamp].forEach(btn => btn.classList.remove('active-tool'));
        activeBtn.classList.add('active-tool');
    }

    // 4. キャンバス描画操作
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

        if (isStampMode) {
            ctx.font = '80px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(selectedStamp, pos.x, pos.y);
        } else {
            isDrawing = true;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }
        e.preventDefault();
    }

    function drawAction(e) {
        if (!isDrawing || isStampMode) return;
        const pos = getEventPos(e);

        ctx.lineTo(pos.x, pos.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = currentSize;

        if (isEraser) {
            ctx.strokeStyle = '#FFFFFF';
        } else {
            ctx.strokeStyle = currentColor;
        }

        ctx.stroke();
        e.preventDefault();
    }

    function stopAction() {
        isDrawing = false;
    }

    canvas.addEventListener('mousedown', startAction);
    canvas.addEventListener('mousemove', drawAction);
    window.addEventListener('mouseup', stopAction);

    canvas.addEventListener('touchstart', startAction, { passive: false });
    canvas.addEventListener('touchmove', drawAction, { passive: false });
    canvas.addEventListener('touchend', stopAction);

    toolClear.addEventListener('click', () => {
        if (confirm('落書きをすべて消去しますか？')) {
            redrawCanvas();
        }
    });

    retakeBtn.addEventListener('click', () => {
        editorContainer.classList.remove('active');
        cameraContainer.classList.add('active');
        startCamera();
    });

    saveBtn.addEventListener('click', () => {
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        const active = getActiveIdol();
        const safeGroup = active.group ? `${active.group}_` : '';
        const safeIdol = active.idol ? `${active.idol}_` : '';
        link.download = `cheki_${safeGroup}${safeIdol}${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    });

    // 初期起動
    startCamera();
});
