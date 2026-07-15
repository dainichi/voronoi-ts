import { arcIntersection } from "./Geometry.js";
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
import type { Arc } from "./polygon/Arc.js";
import { CircleEvent } from "./sweep/CircleEvent.js";
import { purgeStaleCircleEvents } from "./sweep/EventQueue.js";
import { Voronoi } from "./polygon/Voronoi.js";

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

    getVertices(): Point[] {
        const points = new Map<string, Point>();
        this.voronoi.edges.forEach((edge) => {
            if (edge.start) {
                points.set(`${edge.start.x.toFixed(4)},${edge.start.y.toFixed(4)}`, edge.start);
            }
            if (edge.end) {
                points.set(`${edge.end.x.toFixed(4)},${edge.end.y.toFixed(4)}`, edge.end);
            }
        });
        return Array.from(points.values());
    }

    draw(ctx: CanvasRenderingContext2D, viewport: Viewport, canvas: HTMLCanvasElement): void {
        const sweepY = this.voronoi.sweepY;
        const isIntermediate = Number.isFinite(sweepY) && sweepY !== Infinity;

        this.drawEdges(ctx, viewport);
        if (isIntermediate) {
            drawSweepLine(ctx, viewport, canvas, sweepY);
            this.drawCircleEvents(ctx, viewport);
            this.drawBeachLine(ctx, viewport);
        }
        if (this.lastCircle) {
            ctx.save();
            ctx.strokeStyle = "#4a90e2";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            drawCircle(ctx, viewport, this.lastCircle.center, this.lastCircle.radius);
            ctx.restore();
        }
        this.drawProcessedCenters(ctx, viewport);
        this.drawPolygon(ctx, viewport);
    }

    private discardInvalidCircleEvents(): void {
        purgeStaleCircleEvents(this.voronoi.pq);
    }

    private drawEdges(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        ctx.save();
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1.5;
        const sweepY = this.voronoi.sweepY;
        this.voronoi.edges.forEach((edge) => {
            if (edge.start && edge.end) {
                drawLine(ctx, viewport, edge.start, edge.end);
                return;
            }

            if (!edge.start) return;

            const [x2, y2] = edge.end
                ? [edge.end.x, edge.end.y]
                : arcIntersection(edge.rightSite, edge.leftSite, sweepY).slice(0, 2);

            drawLine(ctx, viewport, edge.start, new Point(x2, y2));
        });
        ctx.restore();
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
        for (const center of this.voronoi.centers) {
            const s = viewport.worldToScreen(center);
            ctx.beginPath();
            ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    private drawCircleEvents(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        if (!this.voronoi.beach) return;
        ctx.save();
        ctx.strokeStyle = "#4a90e2";
        ctx.lineWidth = 1;
        let arc: Arc | undefined = this.voronoi.beach.head;
        while (arc) {
            const ce = arc.circleEvent;
            if (ce && ce.valid) {
                drawCircle(ctx, viewport, ce.center, ce.radius);
            }
            arc = arc.next;
        }
        ctx.restore();
    }

    private drawBeachLine(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        if (!this.voronoi.beach) return;
        const sweepY = this.voronoi.sweepY;
        if (!Number.isFinite(sweepY)) return;

        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 4]);

        let arc: Arc | undefined = this.voronoi.beach.head;
        while (arc) {
            this.drawBeachArc(ctx, viewport, arc, sweepY);
            arc = arc.next;
        }

        ctx.restore();
    }

    private drawBeachArc(ctx: CanvasRenderingContext2D, viewport: Viewport, arc: Arc, sweepY: number): void {
        const [x1, y1] = arc.prev
            ? arcIntersection(arc.prev.edge, arc.edge, sweepY).slice(0, 2)
            : [
                arc.edge.start.p.x + (arc.edge.end.p.x - arc.edge.start.p.x) * (sweepY - arc.edge.start.p.y) / (arc.edge.end.p.y - arc.edge.start.p.y),
                sweepY
            ];

        const [x2, y2] = arc.next
            ? arcIntersection(arc.edge, arc.next.edge, sweepY).slice(0, 2)
            : [
                arc.edge.start.p.x + (arc.edge.end.p.x - arc.edge.start.p.x) * (sweepY - arc.edge.start.p.y) / (arc.edge.end.p.y - arc.edge.start.p.y),
                sweepY
            ];

        ctx.beginPath();
        ctx.moveTo(viewport.worldToScreenX(x1), viewport.worldToScreenY(y1));
        ctx.lineTo(viewport.worldToScreenX(x2), viewport.worldToScreenY(y2));
        ctx.stroke();
    }
}
