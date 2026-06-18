export class Point {
    constructor(
        public readonly x: number,
        public readonly y: number
    ) {}

    toString(): string {
        return `Point(${this.x}, ${this.y})`;
    }
}