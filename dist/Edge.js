export class Edge {
    leftSite;
    rightSite;
    start = null;
    end = null;
    constructor(leftSite, rightSite) {
        this.leftSite = leftSite;
        this.rightSite = rightSite;
    }
    toString() {
        return `Edge[${this.leftSite} - ${this.rightSite}] start=${this.start} end=${this.end}`;
    }
}
