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
        return idolList.find(item => item.id === activeIdolId) || idolList[0] || { group: '', idol: '', color: '#ff3366' };
    }

    let currentColor = getActiveIdol().color;

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

    // カメラ画面のバッジをタップした時も選択モーダルを開く
    activeIdolBadge.addEventListener('click', () => {
        openSelectIdolModal();
    });

    settingsBtn.addEventListener('click', () => {
        openSelectIdolModal();
    });

    // アイドル選択＆管理のポップアップモーダル（画面中央）
    function openSelectIdolModal() {
        let groupOptions = groups.map(g => `<option value="${g}" ${g === currentGroup ? 'selected' : ''}>${g}</option>`).join('');
        groupOptions += `<option value="__NEW__">＋ 新規グループ追加</option>`;

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
                        <label>メンカラ</label>
                        <select id="new-idol-color">
                            ${customColorPalette.map(c => `<option value="${c.hex}">${c.name} (${c.displayName})</option>`).join('')}
                        </select>
                    </div>
                    <button id="add-idol-btn" class="btn primary" style="padding:6px; font-size:0.85rem; margin-top:4px;">追加する</button>
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

        // グループ切替イベント
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

        // メンバー追加イベント
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
            const colorVal = document.getElementById('new-idol-color').value;

            if (!nameVal) {
                alert('アイドル名を入力してください。');
                return;
            }

            const newItem = {
                id: Date.now(),
                group: selectedGroup,
                idol: nameVal,
                color: colorVal
            };

            idolList.push(newItem);
            activeIdolId = newItem.id;
            currentColor = newItem.color;

            saveData();
            openSelectIdolModal(); // モーダル再描画
            updateActiveBadge();
        });
    }

    function renderIdolListInModal() {
        const container = document.getElementById('idol-items-container');
        if (!container) return;

        // 現在のグループに所属するメンバーをフィルタリング
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

        // メンバー選択
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
                modalOverlay.classList.remove('active'); // 選択完了でモーダル閉じる
            });
        });

        // 削除ボタン
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(e.currentTarget.getAttribute('data-id'));
                idolList = idolList.filter(item => item.id !== id);
                if (activeIdolId === id) {
                    activeIdolId = idolList.length > 0 ? idolList[0].id : null;
                    currentColor = activeIdolId ? getActiveIdol().color : '#ff3366';
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
