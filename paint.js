"use strict";

/*
 * KIDBYTE PAINT STUDIO V2.1
 * Includes 8 shapes, sheet-only zoom engine, flood fill, text, undo history, and local image export.
 */

const $ = id => document.getElementById(id);

const canvas = $("paintCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const canvasWrapper = $("canvasWrapper");

const brushSizeInput = $("brushSize");
const sizeVal = $("sizeVal");
const undoBtn = $("undoBtn");
const clearBtn = $("clearBtn");
const saveImgBtn = $("saveImgBtn");
const canvasCoords = $("canvasCoords");
const customColorPicker = $("customColorPicker");

// Sheet Zoom Control Elements
const zoomSlider = $("zoomSlider");
const zoomOutBtn = $("zoomOutBtn");
const zoomInBtn = $("zoomInBtn");
const zoomResetBtn = $("zoomResetBtn");

let currentTool = "brush";
let currentColor = "#242541";
let currentSize = 5;
let currentZoom = 100;

let isDrawing = false;
let startX = 0;
let startY = 0;
let undoStack = [];
const MAX_UNDO_STEPS = 15;

// Initialize White Background on Startup
function initCanvas() {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
}

function saveState() {
    if (undoStack.length >= MAX_UNDO_STEPS) {
        undoStack.shift();
    }
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

function undo() {
    if (undoStack.length > 1) {
        undoStack.pop(); // Remove current state
        const previousState = undoStack[undoStack.length - 1];
        ctx.putImageData(previousState, 0, 0);
        showToast("Undo performed ↶");
    } else {
        showToast("Nothing left to undo!");
    }
}

// Toast Notification
let toastTimer;
function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2400);
}

// SHEET ZOOM ENGINE (SCALES SHEET ONLY)
function setZoom(val) {
    currentZoom = Math.min(300, Math.max(20, val));
    canvasWrapper.style.transform = `scale(${currentZoom / 100})`;
    zoomSlider.value = currentZoom;
    zoomResetBtn.textContent = `${Math.round(currentZoom)}%`;
}

zoomSlider.addEventListener("input", e => setZoom(Number(e.target.value)));
zoomOutBtn.addEventListener("click", () => setZoom(currentZoom - 10));
zoomInBtn.addEventListener("click", () => setZoom(currentZoom + 10));
zoomResetBtn.addEventListener("click", () => setZoom(100));

// Tool Selection Handlers
document.querySelectorAll(".tool-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentTool = btn.dataset.tool;
        showToast(`Tool: ${btn.title}`);
    });
});

// Color Swatches Handlers
document.querySelectorAll(".color-swatch").forEach(swatch => {
    swatch.addEventListener("click", () => {
        document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
        swatch.classList.add("active");
        currentColor = swatch.dataset.color;
        customColorPicker.value = currentColor;
    });
});

customColorPicker.addEventListener("input", e => {
    currentColor = e.target.value;
    document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
});

// Brush Size Slider
brushSizeInput.addEventListener("input", e => {
    currentSize = e.target.value;
    sizeVal.textContent = `${currentSize}px`;
});

// Accurate Mouse Coordinate Helper (Accounts for Sheet Zoom)
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

let snapshot = null;

// Mouse Down Event
canvas.addEventListener("mousedown", e => {
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    if (currentTool === "fill") {
        floodFill(Math.floor(startX), Math.floor(startY), hexToRgba(currentColor));
        saveState();
        return;
    }

    if (currentTool === "text") {
        const userText = prompt("Enter text to add to canvas:", "KidByte Art!");
        if (userText) {
            ctx.fillStyle = currentColor;
            ctx.font = `${Math.max(14, currentSize * 3)}px "Trebuchet MS", Arial, sans-serif`;
            ctx.fillText(userText, startX, startY);
            saveState();
            showToast("Text added! 🔤");
        }
        return;
    }

    isDrawing = true;
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (currentTool === "brush" || currentTool === "eraser") {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
    }
});

// Mouse Move Event
canvas.addEventListener("mousemove", e => {
    const pos = getMousePos(e);
    canvasCoords.textContent = `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;

    if (!isDrawing) return;

    if (currentTool === "brush" || currentTool === "eraser") {
        ctx.strokeStyle = currentTool === "eraser" ? "#FFFFFF" : currentColor;
        ctx.lineWidth = currentSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else if (snapshot) {
        ctx.putImageData(snapshot, 0, 0);
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        drawShape(currentTool, startX, startY, pos.x, pos.y);
    }
});

// Mouse Up / Leave Event
function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        saveState();
    }
}

canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

// DRAWING ENGINE FOR ALL 8 SHAPES
function drawShape(tool, x1, y1, x2, y2) {
    ctx.beginPath();

    if (tool === "line") {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    } else if (tool === "rectangle") {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (tool === "circle") {
        let radius = Math.hypot(x2 - x1, y2 - y1);
        ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (tool === "triangle") {
        ctx.moveTo(x1 + (x2 - x1) / 2, y1);
        ctx.lineTo(x1, y2);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.stroke();
    } else if (tool === "diamond") {
        let midX = x1 + (x2 - x1) / 2;
        let midY = y1 + (y2 - y1) / 2;
        ctx.moveTo(midX, y1);
        ctx.lineTo(x2, midY);
        ctx.lineTo(midX, y2);
        ctx.lineTo(x1, midY);
        ctx.closePath();
        ctx.stroke();
    } else if (tool === "star") {
        drawStar(x1 + (x2 - x1) / 2, y1 + (y2 - y1) / 2, 5, Math.abs(x2 - x1) / 2, Math.abs(x2 - x1) / 4);
    } else if (tool === "arrow") {
        drawArrow(x1, y1, x2, y2);
    } else if (tool === "heart") {
        drawHeart(x1, y1, x2 - x1, y2 - y1);
    }
}

// STAR DRAWING HELPER
function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.stroke();
}

// ARROW DRAWING HELPER
function drawArrow(x1, y1, x2, y2) {
    let w = x2 - x1;
    let h = y2 - y1;
    ctx.moveTo(x1, y1 + h * 0.33);
    ctx.lineTo(x1 + w * 0.6, y1 + h * 0.33);
    ctx.lineTo(x1 + w * 0.6, y1);
    ctx.lineTo(x2, y1 + h * 0.5);
    ctx.lineTo(x1 + w * 0.6, y2);
    ctx.lineTo(x1 + w * 0.6, y1 + h * 0.67);
    ctx.lineTo(x1, y1 + h * 0.67);
    ctx.closePath();
    ctx.stroke();
}

// HEART DRAWING HELPER
function drawHeart(x, y, w, h) {
    let topCurveHeight = h * 0.3;
    ctx.moveTo(x + w / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x + w / 2, y, x, y, x, y + topCurveHeight);
    ctx.bezierCurveTo(x, y + (h + topCurveHeight) / 2, x + w / 2, y + h, x + w / 2, y + h);
    ctx.bezierCurveTo(x + w / 2, y + h, x + w, y + (h + topCurveHeight) / 2, x + w, y + topCurveHeight);
    ctx.bezierCurveTo(x + w, y, x + w / 2, y, x + w / 2, y + topCurveHeight);
    ctx.closePath();
    ctx.stroke();
}

// Flood Fill Algorithm (Paint Bucket)
function hexToRgba(hex) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(char => char + char).join("");
    const num = parseInt(c, 16);
    return [num >> 16, (num >> 8) & 255, num & 255, 255];
}

function floodFill(startX, startY, fillColor) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    const height = canvas.height;

    const startIndex = (startY * width + startX) * 4;
    const startR = data[startIndex];
    const startG = data[startIndex + 1];
    const startB = data[startIndex + 2];
    const startA = data[startIndex + 3];

    if (startR === fillColor[0] && startG === fillColor[1] && startB === fillColor[2] && startA === fillColor[3]) {
        return;
    }

    const queue = [[startX, startY]];
    const visited = new Uint8Array(width * height);

    while (queue.length > 0) {
        const [x, y] = queue.pop();
        const idx = y * width + x;

        if (x < 0 || x >= width || y < 0 || y >= height || visited[idx]) continue;

        const pixelIdx = (y * width + x) * 4;
        if (
            data[pixelIdx] === startR &&
            data[pixelIdx + 1] === startG &&
            data[pixelIdx + 2] === startB &&
            data[pixelIdx + 3] === startA
        ) {
            data[pixelIdx] = fillColor[0];
            data[pixelIdx + 1] = fillColor[1];
            data[pixelIdx + 2] = fillColor[2];
            data[pixelIdx + 3] = fillColor[3];
            visited[idx] = 1;

            queue.push([x + 1, y]);
            queue.push([x - 1, y]);
            queue.push([x, y + 1]);
            queue.push([x, y - 1]);
        }
    }

    ctx.putImageData(imgData, 0, 0);
    showToast("Bucket fill applied! 🪣");
}

// Button Actions
undoBtn.addEventListener("click", undo);

clearBtn.addEventListener("click", () => {
    if (confirm("Clear your entire canvas artwork?")) {
        initCanvas();
        showToast("Canvas cleared 🗑️");
    }
});

saveImgBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "kidbyte-artwork.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("Artwork saved successfully! 💾");
});

// Initialize on Load
initCanvas();