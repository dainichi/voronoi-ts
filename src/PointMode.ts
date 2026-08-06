import { Point } from "./Point.js";
import { parabolaIntersection, parabolaY } from "./Geometry.js";
import type { SiteMode } from "./SiteMode.js";
import {
    boundsForPoints,
    drawCircle,
    drawLine,
    drawSweepLine,
    extendRayToBounds,
    type Bounds,
    type Viewport
} from "./Viewport.js";
import { CircleEvent } from "./sweep/CircleEvent.js";
import { purgeStaleCircleEvents } from "./sweep/EventQueue.js";
import { Voronoi, type BeachSegment } from "./point/Voronoi.js";

const SITES_KEY = "voronoi-ts-point-sites";
const LEGACY_SITES_KEY = "voronoi-ts-sites";

export class PointMode implements SiteMode {
    readonly name = "points";
    readonly listTitle = "Points";
    readonly instructions = "Left click to add a point. Drag a point to move it. Right click a point to delete it. Scroll to zoom.";
    readonly footer = "Points are shown in world coordinates. Selected point is highlighted.";
    readonly inputPlaceholder = "x,y or x y";

    sites: Point[] = [
        {x: 250, y: 100},
        {x: 200, y: 200},
        {x: 400, y: 280},
        {x: 100, y: 300}
    ];
    selectedIndex = -1;
    algorithmComplete = false;

    private voronoi = new Voronoi([]);
    private lastCircle: { center: Point; radius: number } | null = null;
    hoveredCenter: {center: Point; radius: number} | null = null;
    selectedCenter: {center: Point; radius: number} | null = null;

    loadSites(): void {
        const stored = localStorage.getItem(SITES_KEY) ?? localStorage.getItem(LEGACY_SITES_KEY);
        if (!stored) return;

        try {
            const data = JSON.parse(stored) as { x: number; y: number }[];
            if (Array.isArray(data)) {
                this.sites = data.map((d) => ({x: d.x, y: d.y} as Point));
            }
        } catch {
            // Ignore JSON parse errors.
        }
    }

    saveSites(): void {
        localStorage.setItem(SITES_KEY, JSON.stringify(this.sites.map((s) => ({ x: s.x, y: s.y }))));
    }

    resetAlgorithm(): void {
        this.saveSites();
        this.voronoi = new Voronoi(this.sites.map((s) => ({x:s.x, y:s.y} as Point)));
        this.algorithmComplete = false;
        this.lastCircle = null;
        this.hoveredCenter = null;
        this.selectedCenter = null;
    }

    stepAlgorithm(): void {
        if (this.algorithmComplete) return;
        const next = this.voronoi.pq.peek();
        this.lastCircle = next instanceof CircleEvent ? next.circle : null;
        if (!this.voronoi.step()) {
            this.algorithmComplete = true;
        }
    }

    singlePixelStep(scale: number): void {
        if (this.algorithmComplete) return;
        this.discardInvalidCircleEvents();

        const next = this.voronoi.pq.peek();
        const sweepY = this.voronoi.sweepY;
        if (!next || !Number.isFinite(sweepY)) {
            this.stepAlgorithm();
            return;
        }

        const nextSweepY = sweepY - 1 / scale;
        if (nextSweepY <= next.y) {
            this.stepAlgorithm();
            return;
        }

        this.voronoi.sweepY = nextSweepY;
    }

    runAlgorithmToEnd(): void {
        if (this.algorithmComplete) return;
        this.lastCircle = null;
        while (this.voronoi.step()) {}
        this.algorithmComplete = true;
    }

    getBounds(): Bounds {
        return boundsForPoints(this.sites, { minX: -100, minY: -100, maxX: 100, maxY: 100 }, 50, 0.2);
    }

    addSite(point: Point): void {
        this.sites.push(point);
        this.selectedIndex = this.sites.length - 1;
        this.resetAlgorithm();
    }

    removeSite(index: number): void {
        if (index < 0 || index >= this.sites.length) return;
        this.sites.splice(index, 1);
        this.selectedIndex = Math.min(this.selectedIndex, this.sites.length - 1);
        this.resetAlgorithm();
    }

    moveSite(index: number, point: Point): void {
        if (index < 0 || index >= this.sites.length) return;
        this.sites[index] = point;
        this.resetAlgorithm();
    }

    getVertices(): {point: Point; label: string}[] {
        return Array.from(this.voronoi.circles).map(vc => ({
            point: vc.center,
            label: `r = ${vc.radius.toFixed(2)}`
        }));
    }

    onHover(screenX: number, screenY: number, viewport: Viewport): boolean {
        const threshold = 10;
        for (const vc of this.voronoi.circles) {
            const s = viewport.worldToScreen(vc.center);
            if (Math.hypot(s.x - screenX, s.y - screenY) < threshold) {
                if (this.hoveredCenter === vc) return false;
                this.hoveredCenter = vc;
                return true;
            }
        }
        if (this.hoveredCenter === null) return false;
        this.hoveredCenter = null;
        return true;
    }

    selectVoronoiVertex(index: number):void {
        const all = Array.from(this.voronoi.circles);
        this.selectedCenter = all[index] ?? null;
    }

    draw(ctx: CanvasRenderingContext2D, viewport: Viewport, canvas: HTMLCanvasElement): void {
        const sweepY = this.voronoi.sweepY;
        const isIntermediate = Number.isFinite(sweepY) && sweepY !== Infinity;

        this.drawEdges(ctx, viewport, canvas);
        if (isIntermediate) {
            drawSweepLine(ctx, viewport, canvas, sweepY);
            this.drawCircleEvents(ctx, viewport);
            this.drawBeachLine(ctx, viewport, canvas);
        }
        const focusedCircle = this.lastCircle ?? this.hoveredCenter ?? this.selectedCenter;
        if (focusedCircle) {
            ctx.save();
            ctx.strokeStyle = "#4a90e2";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            drawCircle(ctx, viewport, focusedCircle);
            ctx.restore();
        }
        this.drawProcessedCenters(ctx, viewport);
        this.drawSites(ctx, viewport);
    }

    private discardInvalidCircleEvents(): void {
        purgeStaleCircleEvents(this.voronoi.pq);
    }

    private drawEdges(ctx: CanvasRenderingContext2D, viewport: Viewport, canvas: HTMLCanvasElement): void {
        ctx.save();
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1.5;
        const rect = canvas.getBoundingClientRect();
        const bounds = {
            minX: viewport.screenToWorldX(0),
            maxX: viewport.screenToWorldX(rect.width),
            minY: viewport.screenToWorldY(rect.height),
            maxY: viewport.screenToWorldY(0)
        };
        const sweepY = this.voronoi.sweepY;
        const finalState = !Number.isFinite(sweepY) && sweepY < 0;
        this.voronoi.edges.forEach((edge) => {
            if (edge.start && edge.end) {
                drawLine(ctx, viewport, edge.start, edge.end);
                return;
            }

            if (edge.siteA.y === edge.siteB.y) {
                const x = (edge.siteA.x + edge.siteB.x) / 2;
                const topY = edge.start?.y ?? bounds.maxY;
                const botY = edge.end?.y ?? (finalState ? bounds.minY : parabolaY(edge.siteA, sweepY, x));
                drawLine(ctx, viewport, {x, y: topY}, {x, y: botY});
                return;
            }

            if (finalState) {
                const A = edge.siteA;
                const B = edge.siteB;

                if (edge.start) {
                    const far = extendRayToBounds(edge.start, {x: A.y - B.y, y: B.x - A.x}, bounds);
                    if (far) drawLine(ctx, viewport, edge.start, far);
                } else if (edge.end) {
                    const far = extendRayToBounds(edge.end, {x: B.y - A.y, y: A.x - B.x}, bounds);
                    if (far) drawLine(ctx, viewport, edge.end, far);
                } else {
                    const mid = {x: (A.x + B.x) / 2, y: (A.y + B.y) / 2};
                    const dir = {x: A.y - B.y, y: B.x - A.x};
                    const far1 = extendRayToBounds(mid, dir, bounds);
                    const far2 = extendRayToBounds(mid, {x: -dir.x, y: -dir.y}, bounds);
                    if (far1 && far2) drawLine(ctx, viewport, far1, far2);
                }
                return;
            }

            const x1 = edge.start
                ? edge.start.x
                : parabolaIntersection(edge.siteA, edge.siteB, sweepY);
            const y1 = edge.start
                ? edge.start.y
                : parabolaY(edge.siteA, sweepY, x1);

            const x2 = edge.end
                ? edge.end.x
                : parabolaIntersection(edge.siteB, edge.siteA, sweepY);
            const y2 = edge.end
                ? edge.end.y
                : parabolaY(edge.siteA, sweepY, x2);

            drawLine(ctx, viewport, {x: x1, y: y1}, {x: x2, y: y2});
        });
        ctx.restore();
    }

    private drawSites(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        ctx.save();
        this.sites.forEach((site, index) => {
            const s = viewport.worldToScreen(site);
            ctx.fillStyle = index === this.selectedIndex ? "#0047ab" : "#d92b2b";
            ctx.beginPath();
            ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();
        });
        ctx.restore();
    }

    private drawProcessedCenters(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        if (this.voronoi.circles.size === 0) return;
        ctx.save();
        ctx.fillStyle = "#c71585";
        for (const {center} of this.voronoi.circles) {
            const s = viewport.worldToScreen(center);
            ctx.beginPath();
            ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    private drawCircleEvents(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        if (!this.voronoi.beachRoot) return;
        ctx.save();
        ctx.strokeStyle = "#4a90e2";
        ctx.lineWidth = 1;
        let arc: BeachSegment | undefined = this.voronoi.beachRoot;
        while (arc) {
            const ce = arc.circleEvent;
            if (ce && ce.valid) {
                drawCircle(ctx, viewport, ce.circle);
            }
            arc = arc.next;
        }
        ctx.restore();
    }

    private drawBeachLine(ctx: CanvasRenderingContext2D, viewport: Viewport, canvas: HTMLCanvasElement): void {
        if (!this.voronoi.beachRoot) return;
        const sweepY = this.voronoi.sweepY;
        if (!Number.isFinite(sweepY)) return;

        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 4]);

        let arc: BeachSegment | undefined = this.voronoi.beachRoot;
        while (arc) {
            this.drawBeachArc(ctx, viewport, canvas, arc, sweepY);
            arc = arc.next;
        }

        ctx.restore();
    }

    private drawBeachArc(ctx: CanvasRenderingContext2D, viewport: Viewport, canvas: HTMLCanvasElement, arc: BeachSegment, sweepY: number): void {
        if (arc.site.y === sweepY) {
            this.drawDegenerateArc(ctx, viewport, arc, sweepY);
            return;
        }

        let leftX = viewport.screenToWorldX(0);
        let rightX = viewport.screenToWorldX(canvas.getBoundingClientRect().width);
        if (arc.prev) {
            const t = parabolaIntersection(arc.prev.site, arc.site, sweepY);
            if (Number.isFinite(t)) leftX = t;
        }
        if (arc.next) {
            const t = parabolaIntersection(arc.site, arc.next.site, sweepY);
            if (Number.isFinite(t)) rightX = t;
        }
        if (rightX <= leftX) return;

        const samples = Math.min(Math.max(2, Math.floor(Math.abs(viewport.worldToScreenX(rightX) - viewport.worldToScreenX(leftX)))), 5000);
        const dx = (rightX - leftX) / samples;
        let started = false;

        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
            const x = leftX + dx * i;
            const y = parabolaY(arc.site, sweepY, x);
            if (!Number.isFinite(y) || y < sweepY) {
                started = false;
                continue;
            }
            const sx = viewport.worldToScreenX(x);
            const sy = viewport.worldToScreenY(y);
            if (!started) {
                ctx.moveTo(sx, sy);
                started = true;
            } else {
                ctx.lineTo(sx, sy);
            }
        }
        ctx.stroke();
    }

    private drawDegenerateArc(ctx: CanvasRenderingContext2D, viewport: Viewport, arc: BeachSegment, sweepY: number): void {
        const siteX = arc.site.x;

        const above = (arc.prev && arc.prev.site.y !== sweepY) ? arc.prev
                    : (arc.next && arc.next.site.y !== sweepY) ? arc.next
                    : null;

        const topWorldY = above ? parabolaY(above.site, sweepY, siteX) : viewport.screenToWorldY(0);

        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(viewport.worldToScreenX(siteX), viewport.worldToScreenY(sweepY));
        ctx.lineTo(viewport.worldToScreenX(siteX), viewport.worldToScreenY(topWorldY));
        ctx.stroke();
        ctx.restore();
    }
}
