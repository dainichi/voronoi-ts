import { Point } from "./Point.js";
import { PointMode } from "./PointMode.js";
import { PolygonMode } from "./PolygonMode.js";
import type { SiteMode } from "./SiteMode.js";
import { Viewport } from "./Viewport.js";

type DragMode = "none" | "move" | "pan";
type SiteModeName = SiteMode["name"];

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const pointList = document.getElementById("point-list")!;
const vertexList = document.getElementById("vertex-list")!;
const coordinateInput = document.getElementById("coordinate-input") as HTMLInputElement;
const addPointBtn = document.getElementById("add-point-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const stepBtn = document.getElementById("step-btn") as HTMLButtonElement;
const singlePixelStepBtn = document.getElementById("single-pixel-step-btn") as HTMLButtonElement;
const runToEndBtn = document.getElementById("run-to-end-btn") as HTMLButtonElement;
const togglePanelBtn = document.getElementById("toggle-panel-btn") as HTMLButtonElement;
const modeSelect = document.getElementById("mode-select") as HTMLSelectElement;
const siteListTitle = document.getElementById("site-list-title")!;
const instructions = document.getElementById("instructions")!;
const footer = document.getElementById("footer")!;
const panel = document.getElementById("panel")!;
const app = document.getElementById("app")!;

const ACTIVE_MODE_KEY = "voronoi-ts-active-mode";
const SINGLE_PIXEL_STEP_INTERVAL_MS = 250;

const viewport = new Viewport(canvas);
const modes: Record<SiteModeName, SiteMode> = {
    points: new PointMode(),
    polygon: new PolygonMode()
};

let activeMode: SiteMode = modes.points;

const state = {
    dragMode: "none" as DragMode,
    dragStartX: 0,
    dragStartY: 0,
    dragSiteStartX: 0,
    dragSiteStartY: 0,
    pendingClick: false,
    clickStartX: 0,
    clickStartY: 0,
    singlePixelStepTimer: 0,
    suppressNextSinglePixelClick: false
};

function findSiteIndexAtScreen(x: number, y: number): number {
    const threshold = 10;
    for (let i = activeMode.sites.length - 1; i >= 0; i--) {
        const site = activeMode.sites[i];
        const s = viewport.worldToScreen(site);
        const dx = s.x - x;
        const dy = s.y - y;
        if (dx * dx + dy * dy <= threshold * threshold) {
            return i;
        }
    }
    return -1;
}

function resetAlgorithm(): void {
    activeMode.resetAlgorithm();
    updatePointList();
    updateVertexList();
    updateToolbarButtons();
    draw();
}

function updateToolbarButtons(): void {
    stepBtn.disabled = activeMode.algorithmComplete || activeMode.sites.length === 0;
    singlePixelStepBtn.disabled = activeMode.algorithmComplete || activeMode.sites.length === 0;
    runToEndBtn.disabled = activeMode.algorithmComplete || activeMode.sites.length === 0;
}

function stepAlgorithm(): void {
    if (activeMode.algorithmComplete) return;
    activeMode.stepAlgorithm();
    updateVertexList();
    updateToolbarButtons();
    draw();
}

function singlePixelStepAlgorithm(): void {
    if (activeMode.algorithmComplete) return;
    activeMode.singlePixelStep(viewport.scale);
    updateVertexList();
    updateToolbarButtons();
    draw();
}

function startSinglePixelStepHold(event: PointerEvent): void {
    if (event.button !== 0 || singlePixelStepBtn.disabled) return;

    state.suppressNextSinglePixelClick = true;
    singlePixelStepBtn.setPointerCapture(event.pointerId);
    singlePixelStepAlgorithm();
    if (activeMode.algorithmComplete) return;

    stopSinglePixelStepHold();
    state.singlePixelStepTimer = window.setInterval(() => {
        singlePixelStepAlgorithm();
        if (activeMode.algorithmComplete) {
            stopSinglePixelStepHold();
        }
    }, SINGLE_PIXEL_STEP_INTERVAL_MS);
}

function stopSinglePixelStepHold(): void {
    if (state.singlePixelStepTimer === 0) return;
    window.clearInterval(state.singlePixelStepTimer);
    state.singlePixelStepTimer = 0;
}

function handleSinglePixelStepClick(): void {
    if (state.suppressNextSinglePixelClick) {
        state.suppressNextSinglePixelClick = false;
        return;
    }
    singlePixelStepAlgorithm();
}

function runAlgorithmToEnd(): void {
    if (activeMode.algorithmComplete) return;
    activeMode.runAlgorithmToEnd();
    updateVertexList();
    updateToolbarButtons();
    draw();
}

function togglePanel(): void {
    const hidden = panel.classList.toggle("hidden");
    app.classList.toggle("panel-hidden", hidden);
    togglePanelBtn.textContent = hidden ? "Show panel" : "Hide panel";
}

function updateModeText(): void {
    siteListTitle.textContent = activeMode.listTitle;
    instructions.textContent = activeMode.instructions;
    footer.textContent = activeMode.footer;
    coordinateInput.placeholder = activeMode.inputPlaceholder;
}

function updatePointList(): void {
    pointList.innerHTML = "";
    activeMode.sites.forEach((site, index) => {
        const row = document.createElement("div");
        row.className = "list-item" + (index === activeMode.selectedIndex ? " selected" : "");
        row.innerHTML = `<span>${index + 1}. (${site.x.toFixed(1)}, ${site.y.toFixed(1)})</span><span>×</span>`;
        row.addEventListener("click", () => {
            activeMode.selectedIndex = index;
            draw();
            updatePointList();
        });
        row.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            activeMode.removeSite(index);
            updatePointList();
            updateVertexList();
            updateToolbarButtons();
            draw();
        });
        pointList.appendChild(row);
    });
}

function updateVertexList(): void {
    vertexList.innerHTML = "";
    const vertices = activeMode.getVertices();
    if (vertices.length === 0) {
        vertexList.textContent = "No vertices yet.";
        return;
    }
    vertices.forEach((vertex) => {
        const row = document.createElement("div");
        row.className = "list-item";
        row.textContent = `(${vertex.x.toFixed(1)}, ${vertex.y.toFixed(1)})`;
        vertexList.appendChild(row);
    });
}

function draw(): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    activeMode.draw(ctx, viewport, canvas);
}

function handlePointerDown(event: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const siteIndex = findSiteIndexAtScreen(x, y);
    state.dragStartX = x;
    state.dragStartY = y;
    state.clickStartX = x;
    state.clickStartY = y;
    state.pendingClick = false;

    if (event.button === 2) {
        if (siteIndex >= 0) {
            activeMode.removeSite(siteIndex);
            updatePointList();
            updateVertexList();
            updateToolbarButtons();
            draw();
        }
        return;
    }

    if (siteIndex >= 0) {
        activeMode.selectedIndex = siteIndex;
        state.dragMode = "move";
        state.dragSiteStartX = activeMode.sites[siteIndex].x;
        state.dragSiteStartY = activeMode.sites[siteIndex].y;
    } else {
        state.dragMode = "pan";
        state.pendingClick = true;
        canvas.style.cursor = "grab";
    }
    updatePointList();
}

function handlePointerMove(event: PointerEvent): void {
    if (state.dragMode === "none") return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dx = x - state.dragStartX;
    const dy = y - state.dragStartY;

    if (state.dragMode === "pan") {
        if (state.pendingClick && Math.hypot(x - state.clickStartX, y - state.clickStartY) > 5) {
            state.pendingClick = false;
        }
        if (!state.pendingClick) {
            viewport.pan(dx, dy);
            state.dragStartX = x;
            state.dragStartY = y;
            draw();
        }
        return;
    }

    if (state.dragMode === "move" && activeMode.selectedIndex >= 0) {
        const newX = state.dragSiteStartX + dx / viewport.scale;
        const newY = state.dragSiteStartY - dy / viewport.scale;
        activeMode.moveSite(activeMode.selectedIndex, new Point(newX, newY));
        updatePointList();
        updateVertexList();
        updateToolbarButtons();
        draw();
    }
}

function handlePointerUp(event: PointerEvent): void {
    if (state.dragMode === "pan" && state.pendingClick) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const point = new Point(viewport.screenToWorldX(x), viewport.screenToWorldY(y));
        activeMode.addSite(point);
        updatePointList();
        updateVertexList();
        updateToolbarButtons();
        draw();
    }
    state.dragMode = "none";
    state.pendingClick = false;
    canvas.style.cursor = "crosshair";
}

function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    viewport.zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY);
    draw();
}

function parseCoordinates(input: string): Point | null {
    const clean = input.trim().replace(/,/g, " ");
    const parts = clean.split(/\s+/);
    if (parts.length !== 2) return null;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
        return new Point(x, y);
    }
    return null;
}

function handleAddPoint(): void {
    const point = parseCoordinates(coordinateInput.value);
    if (!point) {
        coordinateInput.focus();
        return;
    }
    activeMode.addSite(point);
    coordinateInput.value = "";
    updatePointList();
    updateVertexList();
    updateToolbarButtons();
    draw();
}

function setActiveMode(modeName: SiteModeName, resetViewport: boolean): void {
    stopSinglePixelStepHold();
    activeMode.saveSites();
    activeMode = modes[modeName];
    modeSelect.value = modeName;
    localStorage.setItem(ACTIVE_MODE_KEY, modeName);
    activeMode.selectedIndex = Math.min(activeMode.selectedIndex, activeMode.sites.length - 1);
    activeMode.resetAlgorithm();
    if (resetViewport) {
        viewport.reset(activeMode.getBounds());
    }
    updateModeText();
    updatePointList();
    updateVertexList();
    updateToolbarButtons();
    draw();
}

function loadActiveModeName(): SiteModeName {
    const stored = localStorage.getItem(ACTIVE_MODE_KEY);
    return stored === "polygon" ? "polygon" : "points";
}

function init(): void {
    const ctx = canvas.getContext("2d")!;
    let lastWidth = 0;
    let lastHeight = 0;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    lastWidth = width;
    lastHeight = height;

    Object.values(modes).forEach((mode) => {
        mode.loadSites();
        mode.resetAlgorithm();
    });
    activeMode = modes[loadActiveModeName()];
    modeSelect.value = activeMode.name;
    viewport.reset(activeMode.getBounds());
    updateModeText();
    updatePointList();
    updateVertexList();
    updateToolbarButtons();
    draw();

    new ResizeObserver((entries) => {
        const { width: w, height: h } = entries[0].contentRect;
        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        viewport.resize(w, h, lastWidth, lastHeight);
        lastWidth = w;
        lastHeight = h;
        draw();
    }).observe(canvas);

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    addPointBtn.addEventListener("click", handleAddPoint);
    coordinateInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            handleAddPoint();
        }
    });
    resetBtn.addEventListener("click", resetAlgorithm);
    stepBtn.addEventListener("click", stepAlgorithm);
    singlePixelStepBtn.addEventListener("pointerdown", startSinglePixelStepHold);
    singlePixelStepBtn.addEventListener("pointerup", stopSinglePixelStepHold);
    singlePixelStepBtn.addEventListener("pointercancel", stopSinglePixelStepHold);
    singlePixelStepBtn.addEventListener("lostpointercapture", stopSinglePixelStepHold);
    singlePixelStepBtn.addEventListener("click", handleSinglePixelStepClick);
    runToEndBtn.addEventListener("click", runAlgorithmToEnd);
    togglePanelBtn.addEventListener("click", togglePanel);
    modeSelect.addEventListener("change", () => setActiveMode(modeSelect.value as SiteModeName, true));
}

init();
