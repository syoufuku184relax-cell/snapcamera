document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
    const cameraContainer = document.getElementById('camera-container');
    const editorContainer = document.getElementById('editor-container');
    const videoElement = document.getElementById('camera-stream');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const canvas = document.getElementById('paint-canvas');
    const ctx = canvas.getContext('2d');

    const captureBtn = document.getElementById('capture-btn');
    const switchCameraBtn = document.getElementById('switch-camera-btn');
    const flashBtn = document.getElementById('flash-btn');
    const timerBtn = document.getElementById('timer-btn');
    const timerBadge = document.getElementById('timer-badge');
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
    
    // タイマー設定 (0:オフ, 3:3秒, 5:5秒, 10:10秒)
    let timerSeconds = 0;
    let isCountingDown = false;

    let isDrawing = false;
    let isEraser = false;
    let isStampMode = false;
    let selectedStamp = '⭐';
    
    let currentColor = '#ff3366';
    let currentSize = 10;
    let capturedImageObj = null;

    // ズーム管理用
    let currentZoom = 1;
    let minZoom = 1;
    let maxZoom = 3;
    let initialPinchDistance = null;

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

            const track = currentStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            if (capabilities.zoom) {
                minZoom = capabilities.zoom.min || 1;
                maxZoom = capabilities.zoom.max || 3;
                currentZoom = minZoom;
            }
        } catch (err) {
            console.error('カメラの起動に失敗しました:', err);
            alert('カメラの起動に失敗しました。');
        }
    }

    // カメラ切替
    switchCameraBtn.addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        flashOn = false;
        flashBtn.classList.remove('active-tool');
        startCamera();
    });

    // フラッシュ（トーチ）のオンオフ
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
            console.error('フラッシュの切替に失敗しました:', err);
        }
    });

    // タイマー切替ボタン（オフ ➔ 3秒 ➔ 5秒 ➔ 10秒 ➔ オフ）
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

    // ピンチアウトによるズーム機能
    function getDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    videoElement.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialPinchDistance = getDistance(e.touches);
        }
    });

    videoElement.addEventListener('touchmove', async (e) => {
        if (e.touches.length === 2 && initialPinchDistance !== null) {
            const currentDistance = getDistance(e.touches);
            const scaleFactor = currentDistance / initialPinchDistance;
            
            const track = currentStream ? currentStream.getVideoTracks()[0] : null;
            if (!track) return;
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            if (!capabilities.zoom) return;

            let newZoom = currentZoom * scaleFactor;
            newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
            
            try {
                await track.applyConstraints({ advanced: [{ zoom: newZoom }] });
                currentZoom = newZoom;
            } catch (err) {
                console.error('ズーム適用エラー:', err);
            }
            initialPinchDistance = currentDistance;
        }
    });

    videoElement.addEventListener('touchend', () => {
        initialPinchDistance = null;
    });

    // 2. 撮影＆タイマー処理
    function executeCapture() {
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
    }

    captureBtn.addEventListener('click', () => {
        if (isCountingDown) return;

        if (timerSeconds === 0) {
            executeCapture();
        } else {
            // タイマー撮影の実行
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
                    executeCapture();
                }
            }, 1000);
        }
    });

    function redrawCanvas() {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (capturedImageObj) {
            const marginX = 60;
            const topMargin = 120;
            const dWidth = canvas.width - (marginX * 2);
            const dHeight = (capturedImageObj.height / capturedImageObj.width) * dWidth;

            ctx.drawImage(capturedImageObj, marginX, topMargin, dWidth, dHeight);
        }
    }

    // 3. モーダル＆お絵描き設定
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

        const colors = ['#ff3366', '#ff9933', '#ffff33', '#33cc66', '#3399ff', '#9933ff', '#ffffff', '#000000'];
        let html = '<p style="text-align:center; font-weight:bold;">カラーを選択</p><div class="palette-grid">';
        colors.forEach(c => {
            html += `<div class="color-chip" style="background-color: ${c};" data-color="${c}"></div>`;
        });
        html += '</div>';

        openModal(html);

        document.querySelectorAll('.color-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                currentColor = e.target.getAttribute('data-color');
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

    // 4. キャンバス描画・スタンプ操作
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
        link.download = `doodle_${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    });

    startCamera();
});
