import { Point } from "./Point.js";
import type { Bounds, Viewport } from "./Viewport.js";

export interface SiteMode {
    readonly name: "points" | "polygon";
    readonly listTitle: string;
    readonly instructions: string;
    readonly footer: string;
    readonly inputPlaceholder: string;
    readonly sites: Point[];
    selectedIndex: number;
    algorithmComplete: boolean;

    loadSites(): void;
    saveSites(): void;
    resetAlgorithm(): void;
    stepAlgorithm(): void;
    singlePixelStep(scale: number): void;
    runAlgorithmToEnd(): void;
    getBounds(): Bounds;
    addSite(point: Point): void;
    removeSite(index: number): void;
    moveSite(index: number, point: Point): void;
    getVertices(): { point: Point; label?: string }[];
    onHover(screenX: number, screenY: number, viewport: Viewport): boolean;
    selectVoronoiVertex(index: number): void;
    draw(ctx: CanvasRenderingContext2D, viewport: Viewport, canvas: HTMLCanvasElement): void;
}
