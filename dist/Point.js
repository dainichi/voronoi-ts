export class Point {
    x;
    y;
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    toString() {
        return `Point(${this.x}, ${this.y})`;
    }
}
