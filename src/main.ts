import { Point } from "./Point.js";
import { VoronoiEdge } from "./VoronoiEdge.js";
import { Voronoi } from "./Voronoi.js";
import { arcIntersection } from "./Geometry.js";
import type { Arc } from "./Arc.js";
import { CircleEvent } from "./CircleEvent.js";

type DragMode = "none" | "move" | "pan";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const pointList = document.getElementById("point-list")!;
const vertexList = document.getElementById("vertex-list")!;
const coordinateInput = document.getElementById("coordinate-input") as HTMLInputElement;
const addPointBtn = document.getElementById("add-point-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const stepBtn = document.getElementById("step-btn") as HTMLButtonElement;
const runToEndBtn = document.getElementById("run-to-end-btn") as HTMLButtonElement;
const togglePanelBtn = document.getElementById("toggle-panel-btn") as HTMLButtonElement;
const panel = document.getElementById("panel")!;

const app = document.getElementById("app")!;

const state = {
    sites: [new Point(2, 4), new Point(0, 0), new Point(4, 0) ] as Point[],
    selectedIndex: -1,
    dragMode: "none" as DragMode,
    dragStartX: 0,
    dragStartY: 0,
    dragSiteStartX: 0,
    dragSiteStartY: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    voronoi: new Voronoi([]),
    vertices: [] as Point[],
    algorithmComplete: false,
    lastCircle: null as { center: Point; radius: number  } | null,
    pendingClick: false,
    clickStartX: 0,
    clickStartY: 0
};

function worldToScreen(p: Point): Point {
    return new Point(worldToScreenX(p.x), worldToScreenY(p.y));
}

function worldToScreenX(x: number): number {
    return state.offsetX + x * state.scale;
}

function worldToScreenY(y: number): number {
    return state.offsetY - y * state.scale;
}

function screenToWorldX(x: number): number {
    return (x - state.offsetX) / state.scale;
}

function screenToWorldY(y: number): number {
    return (state.offsetY - y) / state.scale;
}

function findSiteIndexAtScreen(x: number, y: number): number {
    const threshold = 10;
    for (let i = state.sites.length - 1; i >= 0; i--) {
        const site = state.sites[i];
        const s = worldToScreen(site);
        const dx = s.x - x;
        const dy = s.y - y;
        if (dx * dx + dy * dy <= threshold * threshold) {
            return i;
        }
    }
    return -1;
}

function addSite(point: Point): void {
    state.sites.push(point);
    state.selectedIndex = state.sites.length - 1;
    resetAlgorithm();
}

function removeSite(index: number): void {
    if (index < 0 || index >= state.sites.length) return;
    state.sites.splice(index, 1);
    state.selectedIndex = Math.min(state.selectedIndex, state.sites.length - 1);
    resetAlgorithm();
}

const SITES_KEY = "voronoi-ts-sites";

function saveSites(): void {
    localStorage.setItem(SITES_KEY, JSON.stringify(state.sites.map((s) => ({ x: s.x, y: s.y }))));
}

function loadSites(): void {
    try {
        const stored = localStorage.getItem(SITES_KEY);
        if (!stored) return;
        const data = JSON.parse(stored) as { x: number; y: number }[];
        if (Array.isArray(data)) state.sites = data.map((d: any) => new Point(d.x, d.y));
    } catch {}// Ignore JSON parse errors
}

function resetAlgorithm(): void {
    saveSites();
    state.voronoi = new Voronoi(state.sites.map((s) => new Point(s.x, s.y)));
    state.algorithmComplete = false;
    state.lastCircle = null;
    state.vertices = extractVertices();
    updatePointList();
    updateVertexList();
    updateToolbarButtons();
    draw();
}

function extractVertices(): Point[] {
    const points = new Map<string, Point>();
    state.voronoi.edges.forEach((edge) => {
        if (edge.start) {
            points.set(`${edge.start.x.toFixed(4)},${edge.start.y.toFixed(4)}`, edge.start);
        }
        if (edge.end) {
            points.set(`${edge.end.x.toFixed(4)},${edge.end.y.toFixed(4)}`, edge.end);
        }
    });
    return Array.from(points.values());
}

function updateToolbarButtons(): void {
    stepBtn.disabled = state.algorithmComplete || state.sites.length === 0;
    runToEndBtn.disabled = state.algorithmComplete || state.sites.length === 0;
}

function stepAlgorithm(): void {
    if (state.algorithmComplete) return;
    const next = state.voronoi.pq[0];
    state.lastCircle = next instanceof CircleEvent ? { center: next.center, radius: next.radius } : null;
    if (!state.voronoi.step()) {
        state.algorithmComplete = true;
    }
    state.vertices = extractVertices();
    updateVertexList();
    updateToolbarButtons();
    draw();
}

function runAlgorithmToEnd(): void {
    if (state.algorithmComplete) return;
    state.lastCircle = null;
    while (state.voronoi.step()) {}
    state.algorithmComplete = true;
    state.vertices = extractVertices();
    updateVertexList();
    updateToolbarButtons();
    draw();
}

function togglePanel(): void {
    const hidden = panel.classList.toggle("hidden");
    app.classList.toggle("panel-hidden", hidden);
    togglePanelBtn.textContent = hidden ? "Show panel" : "Hide panel";
}

function updatePointList(): void {
    pointList.innerHTML = "";
    state.sites.forEach((site, index) => {
        const row = document.createElement("div");
        row.className = "list-item" + (index === state.selectedIndex ? " selected" : "");
        row.innerHTML = `<span>${index + 1}. (${site.x.toFixed(1)}, ${site.y.toFixed(1)})</span><span>×</span>`;
        row.addEventListener("click", () => {
            state.selectedIndex = index;
            draw();
            updatePointList();
        });
        row.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            removeSite(index);
        });
        pointList.appendChild(row);
    });
}

function updateVertexList(): void {
    vertexList.innerHTML = "";
    if (state.vertices.length === 0) {
        vertexList.textContent = "No vertices yet.";
        return;
    }
    state.vertices.forEach((vertex) => {
        const row = document.createElement("div");
        row.className = "list-item";
        row.textContent = `(${vertex.x.toFixed(1)}, ${vertex.y.toFixed(1)})`;
        vertexList.appendChild(row);
    });
}

function getBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    if (state.sites.length === 0) {
        return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    state.sites.forEach((site) => {
        minX = Math.min(minX, site.x);
        minY = Math.min(minY, site.y);
        maxX = Math.max(maxX, site.x);
        maxY = Math.max(maxY, site.y);
    });
    const padX = Math.max(1, (maxX - minX) * 0.7);
    const padY = Math.max(1, (maxY - minY) * 0.7);
    return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY };
}

function resetView(): void {
    const rect = canvas.getBoundingClientRect();
    const bounds = getBounds();
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    state.scale = Math.min(rect.width / worldWidth, rect.height / worldHeight) * 0.9;
    if (state.scale <= 0) state.scale = 1;
    state.offsetX = rect.width / 2 - (bounds.minX + bounds.maxX) / 2 * state.scale;
    state.offsetY = rect.height / 2 + (bounds.minY + bounds.maxY) / 2 * state.scale;
}

function draw(): void {
    const lastCircle = state.lastCircle;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const sweepY = state.voronoi.sweepY;
    const isIntermediate = Number.isFinite(sweepY) && sweepY !== Infinity;

    drawEdges(ctx);
    if (isIntermediate) {
        drawSweepLine(ctx, sweepY);
        drawCircleEvents(ctx);
        drawBeachLine(ctx);
    }
    if (lastCircle) {
        drawLastCircle(ctx, lastCircle.center, lastCircle.radius);
    }
    drawProcessedCenters(ctx);
    drawPolygon(ctx);
}

function drawEdges(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1.5;
    const rect = canvas.getBoundingClientRect();
    const bounds = {
        minX: screenToWorldX(0),
        maxX: screenToWorldX(rect.width),
        minY: screenToWorldY(rect.height),
        maxY: screenToWorldY(0)
    };
    const sweepY = state.voronoi.sweepY;
    const finalState = !Number.isFinite(sweepY) && sweepY < 0;
    state.voronoi.edges.forEach((edge) => {
        if (edge.start && edge.end) {
            drawLine(ctx, edge.start, edge.end);
            return;
        }

/*         if (edge.leftSite.y === edge.rightSite.y) {
            const x = (edge.leftSite.x + edge.rightSite.x) / 2;
            const topY = edge.start?.y ?? bounds.maxY;
            const botY = edge.end?.y ?? (finalState ? bounds.minY : parabolaY(edge.leftSite, sweepY, x));
            drawLine(ctx, new Point(x, topY), new Point(x, botY));
            return;
        }
 */
/*         if (finalState) {
            const A = edge.leftSite;
            const B = edge.rightSite;
            let ox: number;

            if (edge.start) {
                const far = extendRayToBounds(edge.start, new Point(A.y - B.y, B.x - A.x), bounds);
                if (far) drawLine(ctx, edge.start, far);
            } else if (edge.end) {
                const far = extendRayToBounds(edge.end, new Point(B.y - A.y, A.x - B.x), bounds);
                if (far) drawLine(ctx, edge.end, far);
            } else {
                const mid = new Point((A.x + B.x) / 2, (A.y + B.y) / 2);
                const dir = new Point(A.y - B.y, B.x - A.x);
                const far1 = extendRayToBounds(mid, dir, bounds);
                const far2 = extendRayToBounds(mid, new Point(-dir.x, -dir.y), bounds);
                if (far1 && far2) drawLine(ctx, far1, far2);
            }
            return;
        }
 */
        const x1 = edge.start?.x!
        const y1 = edge.start?.y!

        const [x2, y2] = edge.end
            ? [edge.end.x, edge.end.y]
            : arcIntersection(edge.rightSite, edge.leftSite, sweepY).slice(0, 2 );

        drawLine(ctx, new Point(x1, y1), new Point(x2, y2));
    });
    ctx.restore();
}

function drawLine(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
    ctx.beginPath();
    ctx.moveTo(worldToScreenX(a.x), worldToScreenY(a.y));
    ctx.lineTo(worldToScreenX(b.x), worldToScreenY(b.y));
    ctx.stroke();
}

//calculate the point at which the ray starting at p in the direction of d exits the bounding box defined by bounds
function extendRayToBounds(p: Point, d: Point, bounds: { minX: number; minY: number; maxX: number; maxY: number }): Point | null {
    let t = Infinity;
    if (Math.abs(d.x) > 1e-9) {
        const tMaxX = (bounds.maxX - p.x) / d.x;
        const tMinX = (bounds.minX - p.x) / d.x;
        const tX = Math.max(tMaxX, tMinX);
        if (tX > 0) { t = tX; }
    }
    if (Math.abs(d.y) > 1e-9) {
        const tMaxY = (bounds.maxY - p.y) / d.y;
        const tMinY = (bounds.minY - p.y) / d.y; 
        const tY = Math.max(tMaxY, tMinY);
        if (tY > 0 && tY < t) { t = tY; }
    }
    if (!Number.isFinite(t)) return null;
    return new Point(p.x + t * d.x, p.y + t * d.y);
}

function drawPolygon(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Draw edges.
    if (state.sites.length > 1) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();

        const first = worldToScreen(state.sites[0]);
        ctx.moveTo(first.x, first.y);

        for (let i = 1; i < state.sites.length; i++) {
            const p = worldToScreen(state.sites[i]);
            ctx.lineTo(p.x, p.y);
        }

        // Close the polygon.
        ctx.lineTo(first.x, first.y);
        ctx.stroke();
    }

    // Draw vertices.
    state.sites.forEach((site, index) => {
        const s = worldToScreen(site);
        ctx.fillStyle = index === state.selectedIndex ? "#0047ab" : "#d92b2b";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    ctx.restore();
}

function drawProcessedCenters(ctx: CanvasRenderingContext2D): void {
    if (state.voronoi.centers.size === 0) return;
    ctx.save();
    ctx.fillStyle = "#c71585";
    for (const center of state.voronoi.centers) {
        const s = worldToScreen(center);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawSweepLine(ctx: CanvasRenderingContext2D, y: number): void {
    ctx.save();
    ctx.strokeStyle = "#1f77b4";
    ctx.lineWidth = 2;
    const sy = worldToScreenY(y);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(canvas.getBoundingClientRect().width, sy);
    ctx.stroke();
    ctx.restore();
}

function drawLastCircle(ctx: CanvasRenderingContext2D, center: Point, radius: number): void {
    ctx.save();
    ctx.strokeStyle = "#4a90e2";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    drawCircle(ctx, center, radius);
    ctx.restore();
}

function drawCircleEvents(ctx: CanvasRenderingContext2D): void {
    if (!state.voronoi.beach) return;
    ctx.save();
    ctx.strokeStyle = "#4a90e2";
    ctx.lineWidth = 1;
    let arc: Arc | undefined = state.voronoi.beach.head;
    while (arc) {
        const ce = arc.circleEvent;
        if (ce && ce.valid) {
            drawCircle(ctx, ce.center, ce.radius);
        }
        arc = arc.next;
    }
    ctx.restore();
}

function drawCircle(ctx: CanvasRenderingContext2D, center: Point, radius: number): void {
    const left = worldToScreenX(center.x - radius);
    const top = worldToScreenY(center.y + radius);
    const diameter = 2 * radius * state.scale;
    ctx.beginPath();
    ctx.ellipse(left + diameter / 2, top + diameter / 2, diameter / 2, diameter / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
}

function drawBeachLine(ctx: CanvasRenderingContext2D): void {
    if (!state.voronoi.beach) return;
    const sweepY = state.voronoi.sweepY;
    if (!Number.isFinite(sweepY)) return;

    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);

    let arc: Arc | undefined = state.voronoi.beach.head;
    while (arc) {
        drawBeachArc(ctx, arc, sweepY);
        arc = arc.next;
    }

    ctx.restore();
}

/* function drawDegenerateArc(ctx: CanvasRenderingContext2D, arc: Arc, sweepY: number): void {
    const siteX = arc.site.x;

    const above = (arc.prev && arc.prev.site.y !== sweepY) ? arc.prev
                : (arc.next && arc.next.site.y !== sweepY) ? arc.next
                : null;

    const topWorldY = above ? parabolaY(above.site, sweepY, siteX) : screenToWorldY(0);

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(worldToScreenX(siteX), worldToScreenY(sweepY));
    ctx.lineTo(worldToScreenX(siteX), worldToScreenY(topWorldY));
    ctx.stroke();
    ctx.restore();
}
 */
function drawBeachArc(ctx: CanvasRenderingContext2D, arc: Arc, sweepY: number): void {
/*     if (arc.site.y === sweepY) {
        drawDegenerateArc(ctx, arc, sweepY);
        return;
    } */

    const [x1,y1] = arc.prev ? 
        arcIntersection(arc.prev.edge, arc.edge, sweepY).slice(0, 2) : 
        [arc.edge.start.p.x + (arc.edge.end.p.x - arc.edge.start.p.x) * (sweepY - arc.edge.start.p.y) / (arc.edge.end.p.y - arc.edge.start.p.y), sweepY];

    const [x2,y2] = arc.next ?
        arcIntersection(arc.edge, arc.next.edge, sweepY).slice(0, 2) :
        [arc.edge.start.p.x + (arc.edge.end.p.x - arc.edge.start.p.x) * (sweepY - arc.edge.start.p.y) / (arc.edge.end.p.y - arc.edge.start.p.y), sweepY];

    ctx.beginPath();
    ctx.moveTo(worldToScreenX(x1), worldToScreenY(y1));
    ctx.lineTo(worldToScreenX(x2), worldToScreenY(y2));
    ctx.stroke();
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
            removeSite(siteIndex);
        }
        return;
    }

    if (siteIndex >= 0) {
        state.selectedIndex = siteIndex;
        state.dragMode = "move";
        state.dragSiteStartX = state.sites[siteIndex].x;
        state.dragSiteStartY = state.sites[siteIndex].y;
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
            state.offsetX += dx;
            state.offsetY += dy;
            state.dragStartX = x;
            state.dragStartY = y;
            draw();
        }
        return;
    }

    if (state.dragMode === "move" && state.selectedIndex >= 0) {
        const newX = state.dragSiteStartX + dx / state.scale;
        const newY = state.dragSiteStartY - dy / state.scale;
        state.sites[state.selectedIndex] = new Point(newX, newY);
        resetAlgorithm();
        return;
    }
}

function handlePointerUp(event: PointerEvent): void {
    if (state.dragMode === "pan" && state.pendingClick) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const point = new Point(screenToWorldX(x), screenToWorldY(y));
        addSite(point);
        updatePointList();
    }
    state.dragMode = "none";
    state.pendingClick = false;
    canvas.style.cursor = "crosshair";
}

function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const worldX = screenToWorldX(mouseX);
    const worldY = screenToWorldY(mouseY);
    const delta = -event.deltaY;
    const factor = Math.exp(delta * 0.001);
    state.scale *= factor;
    //state.scale = Math.min(Math.max(state.scale * factor, 0.2), 10);
    state.offsetX = mouseX - worldX * state.scale;
    state.offsetY = mouseY + worldY * state.scale;
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
    addSite(point);
    coordinateInput.value = "";
}

function init(): void {
    const ctx = canvas.getContext("2d")!;
    let lastWidth = 0;
    let lastHeight = 0;
    const {width, height} = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    lastWidth = width;
    lastHeight = height;
    loadSites();
    resetView();
    resetAlgorithm();
    new ResizeObserver((entries) => {
        const { width:w, height:h} = entries[0].contentRect;
        const centerWorldX = screenToWorldX(lastWidth / 2);
        const centerWorldY = screenToWorldY(lastHeight / 2);
        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        state.offsetX = w / 2 - centerWorldX * state.scale;
        state.offsetY = h / 2 + centerWorldY * state.scale;
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
    runToEndBtn.addEventListener("click", runAlgorithmToEnd);
    togglePanelBtn.addEventListener("click", togglePanel);
}

init();
