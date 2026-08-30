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

    // ★ 落書き専用オフスクリーンキャンバス（画像・文字を消さないためのレイヤー）
    const doodleCanvas = document.createElement('canvas');
    const doodleCtx = doodleCanvas.getContext('2d');

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
    
    let penSize = 25; // 初期ペンの太さ: 中 (25)
    let eraserSize = 15; // 初期消しゴムの太さ: 中 (15)
    let capturedImageObj = null;
    let currentSerialNo = ''; // 現在のチェキの4桁識別番号

    // 指定されたメンカラパレット
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

    function getActiveIdol() {
        return idolList.find(item => item.id === activeIdolId) || idolList[0] || { group: '', idol: '', color: '#FFFFFF' };
    }

    let currentColor = getActiveIdol().color;
    let selectedNewColor = customColorPalette[1].hex; // 追加時の初期選択色 (赤)

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

    // ★ 重複しない4桁ランダム英数字を生成する関数
    function generateUniqueSerial() {
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        let usedSerials = JSON.parse(localStorage.getItem(`cheki_serials_${todayStr}`)) || [];

        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 誤読しやすいO,0,I,1を除外
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
    // --- チェキ画像再描画 ---
    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const active = getActiveIdol();

        // 1. フレーム全体の背景（メンカラ）
        ctx.fillStyle = active.color || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. 撮影画像（上部に余白を空けて描画）
        if (capturedImageObj) {
            const frameLeft = 60;
            const frameTop = 100;
            const targetWidth = canvas.width - (frameLeft * 2); // 960px
            const targetHeight = 1400; // 写真領域の高さ

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
            ctx.clip(); // 写真エリア外へのはみ出しをカット
            ctx.drawImage(capturedImageObj, dx, dy, dWidth, dHeight);
            ctx.restore();
        }

        // 3. テキスト描画（下部エリア）
        const hex = (active.color || '#FFFFFF').replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 255;
        const g = parseInt(hex.substring(2, 4), 16) || 255;
        const b = parseInt(hex.substring(4, 6), 16) || 255;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        ctx.fillStyle = brightness > 128 ? '#111111' : '#FFFFFF';

        // グループ名 & アイドル名 (下部左)
        if (active.group || active.idol) {
            ctx.font = 'bold 44px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            const textString = `${active.group} ${active.idol}`.trim();
            ctx.fillText(textString, 60, canvas.height - 120);
        }

        // 日付 & 識別番号 (下部右)
        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        ctx.font = '34px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${dateStr}  #${currentSerialNo}`, canvas.width - 60, canvas.height - 120);

        // 4. 手書き落書きレイヤーを重ねる
        ctx.drawImage(doodleCanvas, 0, 0);
    }

    // 1. カメラ起動処理
    async function startCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('お使いのブラウザ・環境ではカメラ機能がサポートされていないか、HTTPSでアクセスされていない可能性があります。');
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
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                videoElement.srcObject = currentStream;
                await videoElement.play();
            } catch (fallbackErr) {
                console.error('カメラの起動に失敗しました:', fallbackErr);
                alert(`カメラのアクセスに失敗しました:\n${fallbackErr.message}`);
            }
        }
    }

    activeIdolBadge.addEventListener('click', () => {
        openSelectIdolModal();
    });

    settingsBtn.addEventListener('click', () => {
        openSelectIdolModal();
    });

    // アイドル選択＆管理のポップアップモーダル
    function openSelectIdolModal() {
        let groupOptions = groups.map(g => `<option value="${g}" ${g === currentGroup ? 'selected' : ''}>${g}</option>`).join('');
        groupOptions += `<option value="__NEW__">＋ 新規グループ追加</option>`;

        let paletteHtml = customColorPalette.map(c => `
            <div class="color-chip-wrapper setting-color-chip ${c.hex === selectedNewColor ? 'selected-chip' : ''}" data-color="${c.hex}" style="cursor:pointer; display:flex; flex-direction:column; align-items:center;">
                <div class="color-chip" style="background-color: ${c.hex}; width:32px; height:32px; border-radius:50%; border:2px solid ${c.hex === '#FFFFFF' ? '#ccc' : '#fff'};"></div>
                <span class="color-label" style="font-size:0.7rem; margin-top:2px; color:#fff;">${c.displayName}</span>
            </div>
        `).join('');

        let html = `
            <p style="text-align:center; font-weight:bold;">推しメン選択・登録</p>
            <div class="settings-container">
                <div class="setting-form-box">
                    <div class="setting-group">
                        <label>現在選択中のグループ</label>
                        <select id="group-select">${groupOptions}</select>
                    </div>
                    <div id="new-group-input-box" class="setting-group" style="display:none;">
                        <input type="text" id="new-group-name" placeholder="新しいグループ名を入力">
                    </div>
                </div>

                <div class="setting-form-box">
                    <p style="font-size:0.8rem; font-weight:bold; color:#ff3366;">メンバーを追加</p>
                    <div class="setting-group">
                        <label>アイドル名</label>
                        <input type="text" id="new-idol-name" placeholder="例: 推しメン名前">
                    </div>
                    <div class="setting-group">
                        <label>メンカラを選択</label>
                        <div class="palette-grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-top:6px; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px;">
                            ${paletteHtml}
                        </div>
                    </div>
                    <button id="add-idol-btn" class="btn primary" style="padding:6px; font-size:0.85rem; margin-top:8px;">追加する</button>
                </div>

                <div class="idol-list-box">
                    <p style="font-size:0.8rem; font-weight:bold;">メンバー選択 (タップで選択)</p>
                    <div id="idol-items-container" style="display:flex; flex-direction:column; gap:6px;"></div>
                </div>
            </div>
        `;
        openModal(html);
        renderIdolListInModal();

        const groupSelect = document.getElementById('group-select');
        const newGroupInputBox = document.getElementById('new-group-input-box');

        groupSelect.addEventListener('change', (e) => {
            if (e.target.value === '__NEW__') {
                newGroupInputBox.style.display = 'flex';
            } else {
                newGroupInputBox.style.display = 'none';
                currentGroup = e.target.value;
                saveData();
                renderIdolListInModal();
            }
        });

        document.querySelectorAll('.setting-color-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                selectedNewColor = e.currentTarget.getAttribute('data-color');
                document.querySelectorAll('.setting-color-chip').forEach(c => c.style.opacity = '0.5');
                e.currentTarget.style.opacity = '1.0';
            });
        });

        document.getElementById('add-idol-btn').addEventListener('click', () => {
            let selectedGroup = currentGroup;

            if (groupSelect.value === '__NEW__') {
                const inputVal = document.getElementById('new-group-name').value.trim();
                if (!inputVal) {
                    alert('グループ名を入力してください。');
                    return;
                }
                selectedGroup = inputVal;
                if (!groups.includes(selectedGroup)) {
                    groups.push(selectedGroup);
                }
                currentGroup = selectedGroup;
            }

            const nameVal = document.getElementById('new-idol-name').value.trim();

            if (!nameVal) {
                alert('アイドル名を入力してください。');
                return;
            }

            const newItem = {
                id: Date.now(),
                group: selectedGroup,
                idol: nameVal,
                color: selectedNewColor
            };

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
            container.innerHTML = '<p style="font-size:0.8rem; color:#888; text-align:center;">このグループのメンバーはいません</p>';
            return;
        }

        container.innerHTML = filteredList.map(item => `
            <div class="idol-list-item ${item.id === activeIdolId ? 'selected' : ''}" style="border-left-color: ${item.color};" data-id="${item.id}">
                <div class="idol-info" style="pointer-events: none;">
                    <strong style="color:#fff;">${item.idol}</strong>
                    <span style="color:#ccc; font-size:0.75rem;">${item.group}</span>
                </div>
                <div class="idol-actions">
                    <button class="action-sm-btn danger delete-btn" data-id="${item.id}">削除</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.idol-list-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) return;

                const id = Number(el.getAttribute('data-id'));
                activeIdolId = id;
                const active = getActiveIdol();
                currentColor = active.color;

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
                if (activeIdolId === id) {
                    activeIdolId = idolList.length > 0 ? idolList[0].id : null;
                    currentColor = activeIdolId ? getActiveIdol().color : '#FFFFFF';
                }
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

        // 手書き落書き用レイヤーのキャンバスサイズも合わせる
        doodleCanvas.width = canvas.width;
        doodleCanvas.height = canvas.height;
        doodleCtx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);

        // 新規のユニーク認識番号を生成
        currentSerialNo = generateUniqueSerial();

        redrawCanvas();

        previewContainer.classList.remove('active');
        editorContainer.classList.add('active');
    });

    // ★ 全体描画処理（背景・画像・テキストを描画後に落書きレイヤーを重ねる）
    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const active = getActiveIdol();

        // 1. フレーム背景（メンカラ）
        ctx.fillStyle = active.color || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. 撮影画像
        if (capturedImageObj) {
            const frameLeft = 30;
            const frameTop = 80;
            const frameRight = 30;
            const frameBottom = 280;

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

        // 3. フレーム上の情報（グループ名・アイドル名・日付・認識番号）
        const hex = (active.color || '#FFFFFF').replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 255;
        const g = parseInt(hex.substring(2, 4), 16) || 255;
        const b = parseInt(hex.substring(4, 6), 16) || 255;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        
        // メンカラの明暗に合わせて視認性の良い文字色を判定
        const textColor = brightness > 128 ? '#111111' : '#FFFFFF';
        ctx.fillStyle = textColor;

        // グループ名 & アイドル名 (下部左)
        if (active.group || active.idol) {
            ctx.font = 'bold 42px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            const textString = `${active.group} ${active.idol}`.trim();
            ctx.fillText(textString, 50, canvas.height - 110);
        }

        // 日付 & 認識番号 (下部右)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}.${month}.${day}`;
        const serialStr = `#${currentSerialNo}`;

        ctx.font = '32px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${dateStr}  ${serialStr}`, canvas.width - 50, canvas.height - 110);

        // 4. 落書きレイヤーを上に合成
        ctx.drawImage(doodleCanvas, 0, 0);
    }

    // 3. モーダル＆お絵描きツール設定
    function openModal(htmlContent) {
        modalBody.innerHTML = htmlContent;
        modalOverlay.classList.add('active');
    }

    modalCloseBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
    });

    // カラーパレットモーダル
    toolColor.addEventListener('click', () => {
        isEraser = false;
        isStampMode = false;
        updateActiveTool(toolColor);

        let html = '<p style="text-align:center; font-weight:bold;">カラーを選択</p><div class="palette-grid">';
        customColorPalette.forEach(c => {
            html += `
                <div class="color-chip-wrapper" data-color="${c.hex}">
                    <div class="color-chip" style="background-color: ${c.hex};"></div>
                    <span class="color-label">${c.displayName}</span>
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

    // ★ ペンの太さ選択モーダル（細:10 / 中:25 / 太:45）
    toolSize.addEventListener('click', () => {
        isEraser = false;
        isStampMode = false;
        updateActiveTool(toolSize);

        let html = `
            <p style="text-align:center; font-weight:bold; margin-bottom:15px;">ペンの太さを選択</p>
            <div style="display:flex; justify-content:space-around; gap:10px;">
                <button class="btn size-select-btn ${penSize === 10 ? 'primary' : 'secondary'}" data-size="10" style="flex:1; padding:12px 0;">細 (10)</button>
                <button class="btn size-select-btn ${penSize === 25 ? 'primary' : 'secondary'}" data-size="25" style="flex:1; padding:12px 0;">中 (25)</button>
                <button class="btn size-select-btn ${penSize === 45 ? 'primary' : 'secondary'}" data-size="45" style="flex:1; padding:12px 0;">太 (45)</button>
            </div>
        `;
        openModal(html);

        document.querySelectorAll('.size-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                penSize = Number(e.currentTarget.getAttribute('data-size'));
                modalOverlay.classList.remove('active');
            });
        });
    });

    // ★ 消しゴムの太さ選択モーダル（中:15 / 太:40）
    toolEraser.addEventListener('click', () => {
        isEraser = true;
        isStampMode = false;
        updateActiveTool(toolEraser);

        let html = `
            <p style="text-align:center; font-weight:bold; margin-bottom:15px;">消しゴムの太さを選択</p>
            <div style="display:flex; justify-content:space-around; gap:15px;">
                <button class="btn eraser-size-btn ${eraserSize === 15 ? 'primary' : 'secondary'}" data-size="15" style="flex:1; padding:12px 0;">中 (15)</button>
                <button class="btn eraser-size-btn ${eraserSize === 40 ? 'primary' : 'secondary'}" data-size="40" style="flex:1; padding:12px 0;">太 (40)</button>
            </div>
        `;
        openModal(html);

        document.querySelectorAll('.eraser-size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                eraserSize = Number(e.currentTarget.getAttribute('data-size'));
                modalOverlay.classList.remove('active');
            });
        });
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

    // 4. キャンバス描画操作 (手書きレイヤー: doodleCanvas に描画)
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
            // 元画像を消さずに落書きだけを削る（透明化処理）
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
    }

    canvas.addEventListener('mousedown', startAction);
    canvas.addEventListener('mousemove', drawAction);
    window.addEventListener('mouseup', stopAction);

    canvas.addEventListener('touchstart', startAction, { passive: false });
    canvas.addEventListener('touchmove', drawAction, { passive: false });
    canvas.addEventListener('touchend', stopAction);

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

    saveBtn.addEventListener('click', () => {
        redrawCanvas();
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        const active = getActiveIdol();
        const safeGroup = active.group ? `${active.group}_` : '';
        const safeIdol = active.idol ? `${active.idol}_` : '';
        link.download = `cheki_${safeGroup}${safeIdol}${currentSerialNo}.png`;
        link.href = dataURL;
        link.click();
    });

    // 初期起動
    startCamera();
});

