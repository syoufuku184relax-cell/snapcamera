document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
    const cameraContainer = document.getElementById('camera-container');
    const editorContainer = document.getElementById('editor-container');
    const videoElement = document.getElementById('camera-stream');
    const canvas = document.getElementById('paint-canvas');
    const ctx = canvas.getContext('2d');

    const captureBtn = document.getElementById('capture-btn');
    const switchCameraBtn = document.getElementById('switch-camera-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const saveBtn = document.getElementById('save-btn');

    // アイコンボタン
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
    let isDrawing = false;
    let isEraser = false;
    let isStampMode = false;
    let selectedStamp = '⭐';
    
    let currentColor = '#ff3366';
    let currentSize = 10;
    let capturedImageObj = null;

    // 1. カメラ起動処理
    async function startCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: useFrontCamera ? 'user' : 'environment',
                aspectRatio: { ideal: 3/4 }
            },
            audio: false
        };

        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = currentStream;

            if (useFrontCamera) {
                videoElement.classList.add('camera-mirrored');
            } else {
                videoElement.classList.remove('camera-mirrored');
            }
        } catch (err) {
            console.error('カメラの起動に失敗しました:', err);
            alert('カメラへのアクセスが許可されていないか、利用できません。');
        }
    }

    switchCameraBtn.addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        startCamera();
    });

    // 2. 撮影処理 ＆ 9:16フレーム配置（左右は細く、上はやや広く、下は現状の1/3くらい広く＝下部にスペースを確保）
    captureBtn.addEventListener('click', () => {
        canvas.width = 1080;
        canvas.height = 1920;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const vWidth = videoElement.videoWidth;
        const vHeight = videoElement.videoHeight;

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
            redrawCanvas();
            cameraContainer.classList.remove('active');
            editorContainer.classList.add('active');
        };
        capturedImageObj.src = tempCanvas.toDataURL('image/png');
    });

    function redrawCanvas() {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (capturedImageObj) {
            // 要件：「左右は細く、上は左右よりやや広く、下は現状の1/3くらい」
            // 左右のマージンを60px（細め）、上部のマージンを120px（左右より広め）に設計
            const marginX = 60;
            const topMargin = 120;
            const dWidth = canvas.width - (marginX * 2); // 960px
            const dHeight = (capturedImageObj.height / capturedImageObj.width) * dWidth;

            ctx.drawImage(capturedImageObj, marginX, topMargin, dWidth, dHeight);
        }
    }

    // 3. モーダル表示制御
    function openModal(htmlContent) {
        modalBody.innerHTML = htmlContent;
        modalOverlay.classList.add('active');
    }

    modalCloseBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
    });

    // カラーパレットを開く
    toolColor.addEventListener('click', () => {
        isEraser = false;
        isStampMode = false;
        updateActiveTool(toolColor);

        const colors = ['#ff3366', '#ff9933', '#ffff33', '#33cc66', '#3399ff', '#9933ff', '#ffffff', '#000000'];
        let html = '<p style="text-align:center; font-weight:bold;">カラーを選択</p><div class="palette-grid">';
        colors.forEach(c => {
            html += `<div class="color-chip" style="background-color: ${c};" data-color="${c}"></div>`;
        });
        html += '</div>';

        openModal(html);

        // カラー選択イベント
        document.querySelectorAll('.color-chip').forEach(chip
