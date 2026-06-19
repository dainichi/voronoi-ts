import { Point } from "./Point.js";
import { Voronoi } from "./Voronoi.js";

const v = new Voronoi([
    new Point(250, 100),
    new Point(200, 200),
    new Point(400, 280),
    new Point(100, 300)
]);

v.compute();
console.log(v.edges);