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
    const clearBtn = document.getElementById('clear-btn');
    const eraserBtn = document.getElementById('eraser-btn');

    const penColorInput = document.getElementById('pen-color');
    const penSizeInput = document.getElementById('pen-size');

    // 状態管理
    let currentStream = null;
    let useFrontCamera = true; // 初期はインカメラ
    let isDrawing = false;
    let isEraser = false;
    
    // キャプチャした元画像を保持する変数
    let capturedImageObj = null;

    // 1. カメラ起動処理
    async function startCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: useFrontCamera ? 'user' : 'environment',
                aspectRatio: { ideal: 3/4 } // 3:4の比率を意識
            },
            audio: false
        };

        try {
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = currentStream;
        } catch (err) {
            console.error('カメラの起動に失敗しました:', err);
            alert('カメラへのアクセスが許可されていないか、利用できません。');
        }
    }

    // カメラ切替ボタン
    switchCameraBtn.addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        startCamera();
    });

    // 2. 撮影処理 ＆ 9:16上寄せ配置
    captureBtn.addEventListener('click', () => {
        // 9:16 仮想キャンバスの解像度 (横1080 × 縦1920)
        canvas.width = 1080;
        canvas.height = 1920;

        // 背景を白で塗りつぶす
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ビデオのサイズを取得
        const vWidth = videoElement.videoWidth;
        const vHeight = videoElement.videoHeight;

        // 写真を配置するサイズを計算 (横幅はいっぱいの1080ピクセルにする)
        const dWidth = canvas.width;
        // 3:4の比率を維持して高さを計算
        const dHeight = (vHeight / vWidth) * dWidth;

        // プレビュー用に一時的なImageオブジェクトを作成して保持
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = vWidth;
        tempCanvas.height = vHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(videoElement, 0, 0, vWidth, vHeight);

        capturedImageObj = new Image();
        capturedImageObj.onload = () => {
            redrawCanvas();
            // 画面をエディターに切り替え
            cameraContainer.classList.remove('active');
            editorContainer.classList.add('active');
        };
        capturedImageObj.src = tempCanvas.toDataURL('image/png');
    });

    // キャンバス全体を描画し直す関数（画像＋落書きの維持用）
    function redrawCanvas() {
        // 背景クリア
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (capturedImageObj) {
            const dWidth = canvas.width;
            const dHeight = (capturedImageObj.height / capturedImageObj.width) * dWidth;
            // 上寄せ（Y座標 = 0）で配置
            ctx.drawImage(capturedImageObj, 0, 0, dWidth, dHeight);
        }
    }

    // 3. 全体への落書き機能 (タッチ & マウス対応)
    function getEventPos(e) {
        const rect = canvas.getBoundingClientRect();
        // 画面上の表示サイズと実際のキャンバス解像度の比率を計算
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function startDrawing(e) {
        isDrawing = true;
        const pos = getEventPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        e.preventDefault();
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getEventPos(e);

        ctx.lineTo(pos.x, pos.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = penSizeInput.value;

        if (isEraser) {
            // 消しゴムモード（白で上描き、または合成モード変更でも可）
            ctx.strokeStyle = '#FFFFFF';
        } else {
            ctx.strokeStyle = penColorInput.value;
        }

        ctx.stroke();
        e.preventDefault();
    }

    function stopDrawing() {
        isDrawing = false;
    }

    // イベントリスナーの登録（マウス・タッチ）
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    // ツール操作ボタン
    eraserBtn.addEventListener('click', () => {
        isEraser = !isEraser;
        eraserBtn.style.backgroundColor = isEraser ? '#ff3366' : '#555';
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('落書きをすべて消去しますか？')) {
            redrawCanvas();
        }
    });

    // 撮り直しボタン
    retakeBtn.addEventListener('click', () => {
        editorContainer.classList.remove('active');
        cameraContainer.classList.add('active');
        startCamera();
    });

    // 4. 保存機能
    saveBtn.addEventListener('click', () => {
        const dataURL = canvas.toDataURL('image/png');
        
        // スマホ向け：新しいタブで画像を開いて長押し保存を促す、またはリンクによるダウンロード
        const link = document.createElement('a');
        link.download = `doodle_${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    });

    // 初期化：アプリ起動時にカメラをスタート
    startCamera();
});
