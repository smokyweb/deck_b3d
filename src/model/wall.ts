import * as THREE from "three";
import * as Cfg from "../core/configuration";
import { Utils, WallPlane } from "../core/utils";
import { Corner } from "./corner";
import { WallItem } from "../items/wall_item";

/** The default wall texture. */
const defaultWallTexture = {
  url: "rooms/textures/wallmap.png",
  stretch: true,
  scale: 0,
};

export enum WallType {
  Blank,
  Railing,
}

/**
 * A Wall is the basic element to create Rooms.
 *
 * Walls consists of two half edges.
 */
export class Wall {
  /** The unique id of each wall. */
  public id: string;

  /** */
  public orphan = false;

  /** Items attached to this wall */
  public items: WallItem[] = [];

  /** */
  public onItems: WallItem[] = [];

  /** The front-side texture. */
  public frontTexture = defaultWallTexture;

  /** The back-side texture. */
  public backTexture = defaultWallTexture;

  /** Wall thickness. */
  public thickness = Cfg.Configuration.getNumericValue(Cfg.configWallThickness);

  /** Wall height. */
  public height = Cfg.Configuration.getNumericValue(Cfg.configWallHeight);
  public plane: WallPlane;

  /** Actions to be applied after movement. */
  private moved_callbacks = $.Callbacks();

  /** Actions to be applied on removal. */
  private deleted_callbacks = $.Callbacks();

  /** Actions to be applied explicitly. */
  private action_callbacks = $.Callbacks();

  public wallType: WallType = WallType.Railing;

  public readonly interiorTransform: THREE.Matrix4 = new THREE.Matrix4();
  public readonly invInteriorTransform: THREE.Matrix4 = new THREE.Matrix4();

  /**
   * Constructs a new wall.
   * @param start Start corner.
   * @param end End corner.
   */
  constructor(
    private _start: Corner,
    private _end: Corner,
  ) {
    this.id = this.getUuid();

    this.start.attachStart(this);
    this.end.attachEnd(this);

    this.plane = this.generatePlane();
    this.fireOnMove(() => this.updateTransforms());
  }

  private generatePlane(): WallPlane {
    const len = this.length();
    const hgt = this.height;
    const pg = new THREE.PlaneGeometry(len, hgt);
    // pg is centered on origin, in XY plane.
    pg.translate(len / 2, hgt / 2, 0);
    // pg lower left corner on origin, in XY plane
    const wallDelta = new THREE.Vector2().subVectors(this.end, this.start);
    const angle = -Math.atan2(wallDelta.y, wallDelta.x);
    pg.rotateY(angle);
    // pg lower left is on origin, in same orientation as final wall
    pg.translate(this.start.x, 0, this.start.y);
    // pg is in place

    const mesh = new THREE.Mesh(
      pg,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    mesh.visible = false;
    mesh.rotation.set(Math.PI / 2, 0, 0);
    return Object.assign(mesh, { wall: this });
  }

  public center(): THREE.Vector2 {
    return new THREE.Vector2()
      .addVectors(this.start, this.end)
      .multiplyScalar(0.5);
  }
  public length(): number {
    return new THREE.Vector2().subVectors(this.start, this.end).length();
  }

  private getUuid(): string {
    return [this.start.id, this.end.id].join();
  }

  public resetFrontBack() {
    this.orphan = false;
  }

  public snapToAxis(tolerance: number) {
    // order here is important, but unfortunately arbitrary
    this.start.snapToAxis(tolerance);
    this.end.snapToAxis(tolerance);
  }

  public fireOnMove(func: () => any) {
    this.moved_callbacks.add(func);
  }

  public fireOnDelete(func: (wall: Wall) => any) {
    this.deleted_callbacks.add(func);
  }

  public dontFireOnDelete(func: (wall: Wall) => any) {
    this.deleted_callbacks.remove(func);
  }

  // FIXME:  looks like nothing ever uses action_callbacks.
  public fireOnAction(func: (action: any) => any) {
    this.action_callbacks.add(func);
  }

  public fireAction(action: any) {
    this.action_callbacks.fire(action);
  }

  public relativeMove(dx: number, dy: number) {
    this.start.relativeMove(dx, dy);
    this.end.relativeMove(dx, dy);
  }

  public fireMoved() {
    this.moved_callbacks.fire();
  }

  public fireRedraw() {
    /*
    if (.frontEdge) {
      this.frontEdge.redrawCallbacks.fire();
    }
    if (this.backEdge) {
      this.backEdge.redrawCallbacks.fire();
    }*/
  }

  public remove() {
    this.start.detachWall(this);
    this.end.detachWall(this);
    this.deleted_callbacks.fire(this);
  }

  public get start() {
    return this._start;
  }
  public set start(corner: Corner) {
    this.start.detachWall(this);
    corner.attachStart(this);
    this._start = corner;
    this.fireMoved();
  }

  public get end() {
    return this._end;
  }
  public set end(corner: Corner) {
    this.end.detachWall(this);
    corner.attachEnd(this);
    this._end = corner;
    this.fireMoved();
  }
  private updateTransforms() {
    this.computeTransforms(
      this.interiorTransform,
      this.invInteriorTransform,
      this.start,
      this.end,
    );
  }

  public distanceFrom(x: number, y: number): number {
    return Utils.pointDistanceFromLine(
      x,
      y,
      this.start.x,
      this.start.y,
      this.end.x,
      this.end.y,
    );
  }
  private computeTransforms(
    transform: THREE.Matrix4,
    invTransform: THREE.Matrix4,
    from: THREE.Vector2,
    to: THREE.Vector2,
  ) {
    var v1 = from;
    var v2 = to;

    var angle = Utils.angle(1, 0, v2.x - v1.x, v2.y - v1.y);

    var tt = new THREE.Matrix4();
    tt.makeTranslation(-v1.x, 0, -v1.y);
    var tr = new THREE.Matrix4();
    tr.makeRotationY(-angle);
    transform.multiplyMatrices(tr, tt);
    invTransform.getInverse(transform);
  }
}
