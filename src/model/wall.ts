import * as Cfg  from '../core/configuration';
import { Utils } from '../core/utils';
import { Corner } from './corner';
import { HalfEdge } from './half_edge';
import { WallItem } from '../items/wall_item';

/** The default wall texture. */
const defaultWallTexture = {
  url: "rooms/textures/wallmap.png",
  stretch: true,
  scale: 0
}

/** 
 * A Wall is the basic element to create Rooms.
 * 
 * Walls consists of two half edges.
 */
export class Wall {

  /** The unique id of each wall. */
  public id: string;

  /** Front is the plane from start to end. */
  public frontEdge: HalfEdge | null= null;

  /** Back is the plane from end to start. */
  public backEdge: HalfEdge| null = null;

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

  /** Actions to be applied after movement. */
  private moved_callbacks = $.Callbacks();

  /** Actions to be applied on removal. */
  private deleted_callbacks = $.Callbacks();

  /** Actions to be applied explicitly. */
  private action_callbacks = $.Callbacks();

  /** 
   * Constructs a new wall.
   * @param start Start corner.
   * @param end End corner.
   */
  constructor(private _start: Corner, private _end: Corner) {
    this.id = this.getUuid();

    this.start.attachStart(this)
    this.end.attachEnd(this);

  }


  private getUuid(): string {
    return [this.start.id, this.end.id].join();
  }

  public resetFrontBack() {
    this.frontEdge = null;
    this.backEdge = null;
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
    this.action_callbacks.add(func)
  }

  public fireAction(action: any) {
    this.action_callbacks.fire(action)
  }

  public relativeMove(dx: number, dy: number) {
    this.start.relativeMove(dx, dy);
    this.end.relativeMove(dx, dy);
  }

  public fireMoved() {
    this.moved_callbacks.fire();
  }

  public fireRedraw() {
    if (this.frontEdge) {
      this.frontEdge.redrawCallbacks.fire();
    }
    if (this.backEdge) {
      this.backEdge.redrawCallbacks.fire();
    }
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

  public distanceFrom(x: number, y: number): number {
    return Utils.pointDistanceFromLine(x, y,
      this.start.x, this.start.y,
      this.end.x, this.end.y);
  }

//  /** Return the corner opposite of the one provided.
//   * @param corner The given corner.
//   * @returns The opposite corner.
//   */
//  private oppositeCorner(corner: Corner): Corner {
//    if (this.start === corner) {
//      return this.end;
//    } else if (this.end === corner) {
//      return this.start;
//    } else {
//      throw Error('Wall.oppositeCorner: Wall does not connect to corner');
//    }
//  }
}
