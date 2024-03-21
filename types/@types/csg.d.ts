
declare module 'csg' {
  export class CSG {
    private polygons: Polygon[];
    public constructor();
    public clone(): CSG;
    public toPolygons(): Polygon[];
    public union(csg: CSG): CSG;
    public subtract(csg: CSG): CSG;
    public intersect(csg: CSG): CSG;
    public inverse(): CSG;
  }
  export interface CubeOptions {
    radius?: number | [number, number, number];
    center?: [number, number, number];
  }

  export function fromPolygons(polygons: Polygon[]): CSG; 
  export function cube(options: CubeOptions): CSG;
  export interface SphereOptions {
    center?: [number, number, number];
    radius?: number;
    slices?: number;
    stacks?: number;
  }
  export function sphere(options: SphereOptions): CSG;

  export interface CylinderOptions {
    start?: [number, number, number];
    end?: [number, number, number];
    radius?: number;
    slices?: number;
  }
  export function cylinder(options: CylinderOptions): CSG;

  export class Vertex {
    public readonly pos: Vector;
    public normal: Vector; // this mutates!
    constructor(pos: Vector, normal: Vector);
    public clone(): Vertex;
    public flip(): void; // MUTATES the object!
    public interpolate(other: Vertex, t: number): Vertex;
  }
  export class Plane {
    public normal: Vector; // this mutates!
    public readonly w: number;
    public constructor(normal: Vector, w: number);
    public static EPSILON: number;
    public static fromPoints(a: Vector, b: Vector, c: Vector): Plane;
    public clone(): Plane;
    public flip(): void;
    public splitPolygon(polygon: Polygon, coplanarFront: Polygon[],
      coplanarBack: Polygon[], front: Polygon[], back: Polygon[]): void;
  }


  export class Polygon {
    public readonly vertices: Vertex[]; // flip() mutates these
    public readonly shared: any;
    public readonly plane: Plane;
    constructor(vertices: Vertex[], shared: any);
    public clone(): Polygon;
    public flip(): void; // mutates!
  }
  export class Node {
    public plane: Plane | null;
    public front: Node | null;
    public back: Node | null;
    public polygons: Polygon[];
    public constructor(polygons: Polygon[]);
    public clone(): Node;
    public invert(): void; // MUTATES
    public clipPolygons(polygons: Polygon): Polygon[];
    public clipTo(bsp: Node): void; // MUTATES
    public build(polygons: Polygon[]): void; // MUTATES
  }
  export class Vector {
    public readonly x: number;
    public readonly y: number;
    public readonly z: number;
    public constructor(x: object | number | number[], y?: number, z?: number);
    public clone(): Vector;
    public negated(): Vector;
    public plus(a: Vector): Vector;
    public minus(a: Vector): Vector;
    public times(a: Vector): Vector;
    public dividedBy(a: number): Vector;
    public dot(a: Vector): number;
    public lerp(a: Vector, t: number): Vector;
    public length(): number;
    public unit(): Vector;
    public cross(a: Vector): Vector;
  }

}
