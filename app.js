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
        { name: '紫', short: '紫', hex: '#ff00ff' },
        { name: '緑', short: '緑', hex: '#00FF00' },
        { name: 'ピンク', short: 'ピnk', hex: '#FF69B4' },
        { name: 'オレンジ', short: 'オラ', hex: '#FFA500' },
        { name: 'パステルブルー', short: 'パス', hex: '#ADD8E6' },
        { name: 'エメラルドグリーン', short: 'エメ', hex: '#50C878' },
        { name: '黒', short: '黒', hex: '#000000' }
    ];

    // 複数登録可能なアイドルリストの管理 (localStorageから復元)
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
            activeIdolBadge.textContent = '選択: なし（設定から追加）';
            activeIdolBadge.style.borderColor = 'rgba(255,255,255,0.3)';
        }
    }
    updateActiveBadge();

    // 1. カメラ起動処理
    async function startCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: useFrontCamera ? 'user' : 'environment'
            },
            audio: false
        };

        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = currentStream;

            if (useFrontCamera) {
                videoElement.classList.add('camera-mirrored');
                flashBtn.style.display = 'none';
            } else {
                videoElement.classList.remove('camera-mirrored');
                flashBtn.style.display = 'flex';
            }
        } catch (err) {
            console.error('カメラの起動に失敗しました:', err);
            alert('カメラの起動に失敗しました。');
        }
    }

    // 設定ボタン：複数登録可能な設定画面を表示
    settingsBtn.addEventListener('click', () => {
        openSettingsModal();
    });

    function openSettingsModal() {
        let html = `
            <p style="text-align:center; font-weight:
