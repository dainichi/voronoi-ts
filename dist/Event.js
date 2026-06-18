export class Event {
    x;
    y;
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    compareTo(other) {
        if (this.y > other.y)
            return -1;
        if (this.y < other.y)
            return 1;
        if (this.x < other.x)
            return -1;
        if (this.x > other.x)
            return 1;
        return 0;
    }
}
