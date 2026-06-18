export abstract class Event {
    constructor(
        public readonly x: number,
        public readonly y: number
    ) {}

    compareTo(other: Event): number {
        if (this.y > other.y) return -1;
        if (this.y < other.y) return 1;
        if (this.x < other.x) return -1;
        if (this.x > other.x) return 1;
        return 0;
    }
}