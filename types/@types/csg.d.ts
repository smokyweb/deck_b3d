
declare module 'csg' {

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
