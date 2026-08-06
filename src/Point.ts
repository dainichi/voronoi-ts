export type Point = {x:number, y:number};

export type Vec2 = Point;

export function sub(a: Point, b: Point): Point {
    return {x: a.x - b.x, y: a.y - b.y};
}

export function add(a: Point, b: Point): Point {
    return {x: a.x + b.x, y: a.y + b.y};
}

export function scale(a: Point, s: number): Point {
    return {x: a.x * s, y: a.y * s};
}

export function dot(a: Point, b: Point): number {
    return a.x * b.x + a.y * b.y;
}

export function perp(a: Point): Point {
    return {x: -a.y, y: a.x};
}

export function length(a: Point): number {
    return Math.hypot(a.x, a.y);
}

export function normalize(a: Point): Point {
    const len = length(a);
    return {x: a.x / len, y: a.y / len};
}