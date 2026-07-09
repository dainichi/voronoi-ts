import { Point } from "./Point.js";

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export class Viewport {
    offsetX = 0;
    offsetY = 0;
    scale = 1;

    constructor(private readonly canvas: HTMLCanvasElement) {}

    worldToScreen(p: Point): Point {
        return new Point(this.worldToScreenX(p.x), this.worldToScreenY(p.y));
    }

    worldToScreenX(x: number): number {
        return this.offsetX + x * this.scale;
    }

    worldToScreenY(y: number): number {
        return this.offsetY - y * this.scale;
    }

    screenToWorldX(x: number): number {
        return (x - this.offsetX) / this.scale;
    }

    screenToWorldY(y: number): number {
        return (this.offsetY - y) / this.scale;
    }

    reset(bounds: Bounds): void {
        const rect = this.canvas.getBoundingClientRect();
        const worldWidth = bounds.maxX - bounds.minX;
        const worldHeight = bounds.maxY - bounds.minY;
        this.scale = Math.min(rect.width / worldWidth, rect.height / worldHeight) * 0.9;
        if (this.scale <= 0) this.scale = 1;
        this.offsetX = rect.width / 2 - (bounds.minX + bounds.maxX) / 2 * this.scale;
        this.offsetY = rect.height / 2 + (bounds.minY + bounds.maxY) / 2 * this.scale;
    }

    pan(dx: number, dy: number): void {
        this.offsetX += dx;
        this.offsetY += dy;
    }

    zoomAt(screenX: number, screenY: number, deltaY: number): void {
        const worldX = this.screenToWorldX(screenX);
        const worldY = this.screenToWorldY(screenY);
        const factor = Math.exp(-deltaY * 0.001);
        this.scale *= factor;
        this.offsetX = screenX - worldX * this.scale;
        this.offsetY = screenY + worldY * this.scale;
    }

    resize(width: number, height: number, previousWidth: number, previousHeight: number): void {
        const centerWorldX = this.screenToWorldX(previousWidth / 2);
        const centerWorldY = this.screenToWorldY(previousHeight / 2);
        this.offsetX = width / 2 - centerWorldX * this.scale;
        this.offsetY = height / 2 + centerWorldY * this.scale;
    }
}

export function boundsForPoints(points: Point[], emptyBounds: Bounds, padMinimum: number, padRatio: number): Bounds {
    if (points.length === 0) {
        return emptyBounds;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    });

    const padX = Math.max(padMinimum, (maxX - minX) * padRatio);
    const padY = Math.max(padMinimum, (maxY - minY) * padRatio);
    return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY };
}

export function drawLine(ctx: CanvasRenderingContext2D, viewport: Viewport, a: Point, b: Point): void {
    ctx.beginPath();
    ctx.moveTo(viewport.worldToScreenX(a.x), viewport.worldToScreenY(a.y));
    ctx.lineTo(viewport.worldToScreenX(b.x), viewport.worldToScreenY(b.y));
    ctx.stroke();
}

export function drawCircle(ctx: CanvasRenderingContext2D, viewport: Viewport, center: Point, radius: number): void {
    const left = viewport.worldToScreenX(center.x - radius);
    const top = viewport.worldToScreenY(center.y + radius);
    const diameter = 2 * radius * viewport.scale;
    ctx.beginPath();
    ctx.ellipse(left + diameter / 2, top + diameter / 2, diameter / 2, diameter / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
}

export function drawSweepLine(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    canvas: HTMLCanvasElement,
    y: number
): void {
    ctx.save();
    ctx.strokeStyle = "#1f77b4";
    ctx.lineWidth = 2;
    const sy = viewport.worldToScreenY(y);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(canvas.getBoundingClientRect().width, sy);
    ctx.stroke();
    ctx.restore();
}

export function extendRayToBounds(p: Point, d: Point, bounds: Bounds): Point | null {
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
