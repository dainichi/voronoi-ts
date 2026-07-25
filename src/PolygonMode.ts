import { beachSegmentIntersection, parabolaIntersection, parabolaY } from "./Geometry.js";
import { Point } from "./Point.js";
import type { SiteMode } from "./SiteMode.js";
import {
    boundsForPoints,
    drawCircle,
    drawLine,
    drawSweepLine,
    type Bounds,
    type Viewport
} from "./Viewport.js";
import type { BeachSegment } from "./polygon/BeachSegment.js";
import { CircleEvent } from "./sweep/CircleEvent.js";
import { purgeStaleCircleEvents } from "./sweep/EventQueue.js";
import { Voronoi, type VoronoiCenter } from "./polygon/Voronoi.js";
import { PolygonEdge } from "./polygon/PolygonEdge.js";
import { Vertex } from "./polygon/Vertex.js";

const SITES_KEY = "voronoi-ts-polygon-sites";

export class PolygonMode implements SiteMode {
    readonly name = "polygon";
    readonly listTitle = "Polygon Vertices";
    readonly instructions = "Left click to add a polygon vertex. Drag a vertex to move it. Right click a vertex to delete it. Scroll to zoom.";
    readonly footer = "Vertices are shown in world coordinates. The polygon is interpreted as one convex polygon for now.";
    readonly inputPlaceholder = "x,y or x y";

    sites = [new Point(2, 4), new Point(0, 0), new Point(4, 0)];
    selectedIndex = -1;
    algorithmComplete = false;
    hoveredCenter: VoronoiCenter | null = null;
    selectedCenter: VoronoiCenter | null = null;

    private voronoi = new Voronoi([]);
    private lastCircle: { center: Point; radius: number } | null = null;

    loadSites(): void {
        const stored = localStorage.getItem(SITES_KEY);
        if (!stored) return;

        try {
            const data = JSON.parse(stored) as { x: number; y: number }[];
            if (Array.isArray(data)) {
                this.sites = data.map((d) => new Point(d.x, d.y));
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
        this.voronoi = new Voronoi(this.sites.map((s) => new Point(s.x, s.y)));
        this.algorithmComplete = false;
        this.lastCircle = null;
        this.hoveredCenter = null;
        this.selectedCenter = null;
    }

    stepAlgorithm(): void {
        if (this.algorithmComplete) return;
        const next = this.voronoi.pq.peek();
        this.lastCircle = next instanceof CircleEvent ? { center: next.center, radius: next.radius } : null;
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
        return boundsForPoints(this.sites, { minX: -100, minY: -100, maxX: 100, maxY: 100 }, 1, 0.7);
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

    getVertices(): { point: Point; label: string }[] {
        return Array.from(this.voronoi.centers).map(vc => ({
            point: vc.center,
            label: `r=${vc.radius.toFixed(2)}`,
        }));
    }

    onHover(screenX: number, screenY: number, viewport: Viewport): boolean {
        const threshold = 10;
        for (const vc of this.voronoi.centers) {
            const s = viewport.worldToScreen(vc.center);
            if (Math.hypot(s.x - screenX, s.y - screenY) < threshold) {
                if(this.hoveredCenter === vc) return false;
                this.hoveredCenter = vc;
                return true;
            }
        }
        if (this.hoveredCenter === null) return false;{
            this.hoveredCenter = null;
            return true;
        }
    }

    selectVoronoiVertex(index: number): void {
        const all = Array.from(this.voronoi.centers);
        this.selectedCenter = all[index] ?? null;
    }

    draw(ctx: CanvasRenderingContext2D, viewport: Viewport, canvas: HTMLCanvasElement): void {
        const sweepY = this.voronoi.sweepY;
        const isIntermediate = Number.isFinite(sweepY) && sweepY !== Infinity;

        this.drawPolygon(ctx, viewport);
        this.drawProcessedCenters(ctx, viewport);
        this.drawEdges(ctx, viewport);
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
            drawCircle(ctx, viewport, focusedCircle.center, focusedCircle.radius);
            ctx.restore();
        }
    }

    private discardInvalidCircleEvents(): void {
        purgeStaleCircleEvents(this.voronoi.pq);
    }

    private drawEdges(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        ctx.save();
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1.5;
        const sweepY = this.voronoi.sweepY;
        this.voronoi.borders.forEach((border) => {
            if (!border.start) return;

            let endPt: Point;
            if (border.end) {
                endPt = border.end;
            } else {
                const arr = beachSegmentIntersection(border.rightSite, border.leftSite, sweepY);
                if (arr.length < 2 || !Number.isFinite(arr[0])) return;
                endPt = new Point(arr[0], arr[1]);
            }

            const {leftSite, rightSite} = border;
            if (leftSite instanceof Vertex && rightSite instanceof PolygonEdge) {
                this.drawParabolaSegment(ctx, viewport, leftSite, rightSite, border.start, endPt);
            } else if (leftSite instanceof PolygonEdge && rightSite instanceof Vertex) {
                this.drawParabolaSegment(ctx, viewport, rightSite, leftSite, border.start, endPt);
            } else {
                drawLine(ctx, viewport, border.start, endPt);
            }
        });
        ctx.restore();
    }

    private drawParabolaSegment(
        ctx: CanvasRenderingContext2D,
        viewport: Viewport,
        vertex: Vertex,
        edge: PolygonEdge,
        start: Point,
        end: Point
    ): void {
        const [a, b,, d] = edge.matRow;
        const p = (a * vertex.p.x + b * vertex.p.y - d) / 2;
        if (Math.abs(p) < 1e-12) { drawLine(ctx, viewport, start, end); return; }

        const Vx = vertex.p.x - p * a, Vy = vertex.p.y - p * b;
        const uStart = -b * (start.x - Vx) + a * (start.y - Vy);
        const uEnd   = -b * (end.x   - Vx) + a * (end.y   - Vy);

        // Arc-length estimate via midpoint for sample count
        const uMid = (uStart + uEnd) / 2, vMid = uMid * uMid / (4 * p);
        const msx = viewport.worldToScreenX(Vx + uMid * (-b) + vMid * a);
        const msy = viewport.worldToScreenY(Vy + uMid *  a   + vMid * b);
        const ssx = viewport.worldToScreenX(start.x), ssy = viewport.worldToScreenY(start.y);
        const sex = viewport.worldToScreenX(end.x), sey = viewport.worldToScreenY(end.y);
        const N = Math.min(5000, Math.max(2, Math.ceil(
            Math.hypot(msx - ssx, msy - ssy) + Math.hypot(sex - msx, sey - msy)
        )));

        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
            const u = uStart + (uEnd - uStart) * i / N;
            const v = u * u / (4 * p);
            const scx = viewport.worldToScreenX(Vx + u * (-b) + v * a);
            const scy = viewport.worldToScreenY(Vy + u *  a   + v * b);
            if (i === 0) ctx.moveTo(scx, scy); else ctx.lineTo(scx, scy);
        }
        ctx.stroke();
    }

    private drawPolygon(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        ctx.save();

        if (this.sites.length > 1) {
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.beginPath();

            const first = viewport.worldToScreen(this.sites[0]);
            ctx.moveTo(first.x, first.y);

            for (let i = 1; i < this.sites.length; i++) {
                const p = viewport.worldToScreen(this.sites[i]);
                ctx.lineTo(p.x, p.y);
            }

            ctx.lineTo(first.x, first.y);
            ctx.stroke();
        }

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
        if (this.voronoi.centers.size === 0) return;
        ctx.save();
        ctx.fillStyle = "#c71585";
        for (const { center } of this.voronoi.centers) {
            const s = viewport.worldToScreen(center);
            ctx.beginPath();
            ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    private drawCircleEvents(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        if (this.voronoi.beachSections.length === 0) return;
        ctx.save();
        ctx.strokeStyle = "#4a90e2";
        ctx.lineWidth = 1;
        for (const { head } of this.voronoi.beachSections) {
            let arc: BeachSegment | undefined = head;
            while (arc) {
                const ce = arc.circleEvent;
                if (ce && ce.valid) {
                    drawCircle(ctx, viewport, ce.center, ce.radius);
                }
                arc = arc.next;
            }
        }
        ctx.restore();
    }

    private drawBeachLine(ctx: CanvasRenderingContext2D, viewport: Viewport, canvas: HTMLCanvasElement): void {
        if (this.voronoi.beachSections.length === 0) return;
        const sweepY = this.voronoi.sweepY;
        if (!Number.isFinite(sweepY)) return;

        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 4]);

        for (const { head } of this.voronoi.beachSections) {
            let arc: BeachSegment | undefined = head;
            while (arc) {
                this.drawBeachSegment(ctx, viewport, arc, sweepY, canvas);
                arc = arc.next;
            }
        }

        ctx.restore();
    }

    private drawBeachSegment(ctx: CanvasRenderingContext2D, viewport: Viewport, arc: BeachSegment, sweepY: number, canvas: HTMLCanvasElement): void {
        if (arc.site instanceof PolygonEdge ) {
            const [x1, y1] = arc.prev
                ? beachSegmentIntersection(arc.prev.site, arc.site, sweepY).slice(0, 2)
                : [
                    arc.site.start.p.x + (arc.site.end.p.x - arc.site.start.p.x) * (sweepY - arc.site.start.p.y) / (arc.site.end.p.y - arc.site.start.p.y),
                    sweepY
                ];

            const [x2, y2] = arc.next
                ? beachSegmentIntersection(arc.site, arc.next.site, sweepY).slice(0, 2)
                : [
                    arc.site.start.p.x + (arc.site.end.p.x - arc.site.start.p.x) * (sweepY - arc.site.start.p.y) / (arc.site.end.p.y - arc.site.start.p.y),
                    sweepY
                ];

            ctx.beginPath();
            ctx.moveTo(viewport.worldToScreenX(x1), viewport.worldToScreenY(y1));
            ctx.lineTo(viewport.worldToScreenX(x2), viewport.worldToScreenY(y2));
            ctx.stroke();
        } else {
            let leftX = viewport.screenToWorldX(0);
            let rightX = viewport.screenToWorldX(canvas.getBoundingClientRect().width);
            if (arc.prev) {
                const [x,,] = beachSegmentIntersection(arc.prev.site, arc.site, sweepY);
                if (Number.isFinite(x)) leftX = x;
            }
            if (arc.next) {
                const [x,,] = beachSegmentIntersection(arc.site, arc.next.site, sweepY);
                if (Number.isFinite(x)) rightX = x;
            }
            if (rightX <= leftX) return;
    
            const samples = Math.min(Math.max(2, Math.floor(Math.abs(viewport.worldToScreenX(rightX) - viewport.worldToScreenX(leftX)))), 5000);
            const dx = (rightX - leftX) / samples;
            let started = false;
    
            ctx.beginPath();
            for (let i = 0; i <= samples; i++) {
                const x = leftX + dx * i;
                const y = parabolaY(arc.site.p, sweepY, x);
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
    }

    
}
