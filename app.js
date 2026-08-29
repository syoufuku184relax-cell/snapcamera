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
    let useFrontCamera = true;
    let isDrawing = false;
    let isEraser = false;
    let capturedImageObj = null;

    // 1. カメラ起動処理
      async function startCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        // 比率の固定を外し、カメラのデフォルトに任せる
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
            } else {
                videoElement.classList.remove('camera-mirrored');
            }
        } catch (err) {
            console.error('カメラの起動に失敗しました:', err);
            alert('カメラの起動に失敗しました: ' + err.name); // エラー内容を画面に出す
        }
    }

    switchCameraBtn.addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        startCamera();
    });

    // 2. 撮影処理 ＆ 9:16上寄せ配置
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
            const dWidth = canvas.width;
            const dHeight = (capturedImageObj.height / capturedImageObj.width) * dWidth;
            ctx.drawImage(capturedImageObj, 0, 0, dWidth, dHeight);
        }
    }

    // 3. 全体への落書き機能
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

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    eraserBtn.addEventListener('click', () => {
        isEraser = !isEraser;
        eraserBtn.style.backgroundColor = isEraser ? '#ff3366' : '#555';
    });

    clearBtn.addEventListener('click', () => {
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
        link.download = `doodle_${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    });

    startCamera();
});
