import { Point } from "./Point.js";
import { Edge } from "./Edge.js";
import { Voronoi } from "./Voronoi.js";

type DragMode = "none" | "move" | "pan";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const pointList = document.getElementById("point-list")!;
const vertexList = document.getElementById("vertex-list")!;
const coordinateInput = document.getElementById("coordinate-input") as HTMLInputElement;
const addPointBtn = document.getElementById("add-point-btn") as HTMLButtonElement;

const state = {
    sites: [
        new Point(250, 100),
        new Point(200, 200),
        new Point(400, 280),
        new Point(100, 300)
    ] as Point[],
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
    pendingClick: false,
    clickStartX: 0,
    clickStartY: 0
};

function resizeCanvas(): void {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    draw();
}

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
    recompute();
}

function removeSite(index: number): void {
    if (index < 0 || index >= state.sites.length) return;
    state.sites.splice(index, 1);
    state.selectedIndex = Math.min(state.selectedIndex, state.sites.length - 1);
    recompute();
}

function recompute(): void {
    state.voronoi = new Voronoi(state.sites.map((s) => new Point(s.x, s.y)));
    state.voronoi.compute();
    state.vertices = extractVertices();
    updatePointList();
    updateVertexList();
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
    const padX = Math.max(50, (maxX - minX) * 0.2);
    const padY = Math.max(50, (maxY - minY) * 0.2);
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    drawEdges(ctx);
    drawSites(ctx);
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
    console.log("Drawing edges for", state.voronoi, "with bounds", bounds);
    state.voronoi.edges.forEach((edge) => {
        if (edge.start && edge.end) {
            drawLine(ctx, edge.start, edge.end);
            return;
        }
        const A = edge.leftSite;
        const B = edge.rightSite;
        let o: Point, rdx: number, rdy: number;
        if (edge.start) {
            o = edge.start;
            rdx = A.y - B.y;
            rdy = B.x - A.x;
        } else if (edge.end) {
            o = edge.end;
            rdx = B.y - A.y;
            rdy = A.x - B.x;
        } else {
            console.warn("Edge with no start or end", edge);
            return;
        }
        const far = extendRayToBounds(o, new Point(rdx, rdy), bounds);
        if (far) {
            drawLine(ctx, o, far);
        }
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

function drawSites(ctx: CanvasRenderingContext2D): void {
    ctx.save();
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
        recompute();
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
    const factor = Math.exp(delta * 0.0015);
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
    resizeCanvas();
    resetView();
    recompute();
    window.addEventListener("resize", () => {
        resizeCanvas();
        resetView();
        draw();
    });
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
}

init();
