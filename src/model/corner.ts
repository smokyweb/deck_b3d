import * as THREE from "three";
import { Utils } from "../core/utils";
import { Floorplan } from "./floorplan";
import { Wall } from "./wall";

/** */
const cornerTolerance: number = 20;

/**
 * Corners are used to define Walls.
 */
export class Corner extends THREE.Vector2 {
  /** Array of start walls. */
  private wallStarts: Wall[] = [];

  /** Array of end walls. */
  private wallEnds: Wall[] = [];

  /** Callbacks to be fired on movement. */
  private moved_callbacks = $.Callbacks();

  /** Callbacks to be fired on removal. */
  private deleted_callbacks = $.Callbacks();

  /** Callbacks to be fired in case of action. */
  private action_callbacks = $.Callbacks();

  public id: string;

  /** Constructs a corner.
   * @param floorplan The associated floorplan.
   * @param x X coordinate.
   * @param y Y coordinate.
   * @param id An optional unique id. If not set, created internally.
   */
  constructor(
    private floorplan: Floorplan,
    x: number,
    y: number,
    _id?: string,
  ) {
    super(x, y);
    this.id = _id || Utils.guid();
  }

  /** Add function to moved callbacks.
   * @param func The function to be added.
   */
  public fireOnMove(func: (x: number, y: number) => void) {
    this.moved_callbacks.add(func);
  }

  /** Add function to deleted callbacks.
   * @param func The function to be added.
   */
  public fireOnDelete(func: (c: Corner) => void) {
    this.deleted_callbacks.add(func);
  }

  /** Add function to action callbacks.
   * @param func The function to be added.
   */
  // FIXME: What type is 'action'?
  public fireOnAction(func: (action: any) => void) {
    this.action_callbacks.add(func);
  }

  public position(): THREE.Vector2 {
    return new THREE.Vector2(this.x, this.y);
  }
  /**
   *
   */
  public snapToAxis(tolerance: number): { x: boolean; y: boolean } {
    // try to snap this corner to an axis
    var snapped = {
      x: false,
      y: false,
    };

    this.adjacentCorners().forEach((corner) => {
      if (Math.abs(corner.x - this.x) < tolerance) {
        this.x = corner.x;
        snapped.x = true;
      }
      if (Math.abs(corner.y - this.y) < tolerance) {
        this.y = corner.y;
        snapped.y = true;
      }
    });
    return snapped;
  }

  /** Moves corner relatively to new position.
   * @param dx The delta x.
   * @param dy The delta y.
   */
  public relativeMove(dx: number, dy: number) {
    this.move(this.x + dx, this.y + dy);
  }

  // FIXME: delete this
  //  private fireAction(action: any) {
  //    this.action_callbacks.fire(action)
  //  }

  /** Remove callback. Fires the delete callbacks. */
  public remove() {
    this.deleted_callbacks.fire(this);
  }

  /** Removes all walls. */
  public removeAll() {
    for (var i = 0; i < this.wallStarts.length; i++) {
      this.wallStarts[i].remove();
    }
    for (var i = 0; i < this.wallEnds.length; i++) {
      this.wallEnds[i].remove();
    }
    this.remove();
  }

  /** Moves corner to new position.
   * @param newX The new x position.
   * @param newY The new y position.
   */
  public move(newX: number, newY: number) {
    this.x = newX;
    this.y = newY;
    this.mergeWithIntersected();
    this.moved_callbacks.fire(this.x, this.y);

    this.wallStarts.forEach((wall) => {
      wall.fireMoved();
    });

    this.wallEnds.forEach((wall) => {
      wall.fireMoved();
    });
  }

  /** Gets the adjacent corners.
   * @returns Array of corners.
   */
  public adjacentCorners(): Corner[] {
    var retArray = [];
    for (var i = 0; i < this.wallStarts.length; i++) {
      retArray.push(this.wallStarts[i].end);
    }
    for (var i = 0; i < this.wallEnds.length; i++) {
      retArray.push(this.wallEnds[i].start);
    }
    return retArray;
  }

  /** Checks if a wall is connected.
   * @param wall A wall.
   * @returns True in case of connection.
   */
  private isWallConnected(wall: Wall): boolean {
    for (var i = 0; i < this.wallStarts.length; i++) {
      if (this.wallStarts[i] == wall) {
        return true;
      }
    }
    for (var i = 0; i < this.wallEnds.length; i++) {
      if (this.wallEnds[i] == wall) {
        return true;
      }
    }
    return false;
  }

  /**
   *
   */
  public distanceFrom(x: number, y: number): number {
    var distance = Utils.distance(x, y, this.x, this.y);
    //console.log('x,y ' + x + ',' + y + ' to ' + this.getX() + ',' + this.getY() + ' is ' + distance);
    return distance;
  }

  /** Gets the distance from a wall.
   * @param wall A wall.
   * @returns The distance.
   */
  public distanceFromWall(wall: Wall): number {
    return wall.distanceFrom(this.x, this.y);
  }

  /** Gets the distance from a corner.
   * @param corner A corner.
   * @returns The distance.
   */
  public distanceFromCorner(corner: Corner): number {
    return this.distanceFrom(corner.x, corner.y);
  }

  /** Detaches a wall.
   * @param wall A wall.
   */
  public detachWall(wall: Wall) {
    Utils.removeValue(this.wallStarts, wall);
    Utils.removeValue(this.wallEnds, wall);
    if (this.wallStarts.length == 0 && this.wallEnds.length == 0) {
      this.remove();
    }
  }

  /** Attaches a start wall.
   * @param wall A wall.
   */
  public attachStart(wall: Wall) {
    this.wallStarts.push(wall);
  }

  /** Attaches an end wall.
   * @param wall A wall.
   */
  public attachEnd(wall: Wall) {
    this.wallEnds.push(wall);
  }

  /** Get wall to corner.
   * @param corner A corner.
   * @return The associated wall or null.
   */
  public wallTo(corner: Corner): Wall | null {
    for (var i = 0; i < this.wallStarts.length; i++) {
      if (this.wallStarts[i].end === corner) {
        return this.wallStarts[i];
      }
    }
    return null;
  }

  /** Get wall from corner.
   * @param corner A corner.
   * @return The associated wall or null.
   */
  public wallFrom(corner: Corner): Wall | null {
    for (var i = 0; i < this.wallEnds.length; i++) {
      if (this.wallEnds[i].start === corner) {
        return this.wallEnds[i];
      }
    }
    return null;
  }

  /** Get wall to or from corner.
   * @param corner A corner.
   * @return The associated wall or null.
   */
  public wallToOrFrom(corner: Corner): Wall | null {
    return this.wallTo(corner) || this.wallFrom(corner);
  }

  /**
   *
   */
  private combineWithCorner(corner: Corner) {
    // update position to other corner's
    this.x = corner.x;
    this.y = corner.y;
    // absorb the other corner's wallStarts and wallEnds
    for (var i = corner.wallStarts.length - 1; i >= 0; i--) {
      corner.wallStarts[i].start = this;
    }
    for (var i = corner.wallEnds.length - 1; i >= 0; i--) {
      corner.wallEnds[i].end = this;
    }
    // delete the other corner
    corner.removeAll();
    this.removeDuplicateWalls();
    this.floorplan.update();
  }

  public mergeWithIntersected(): boolean {
    //console.log('mergeWithIntersected for object: ' + this.type);
    // check corners
    for (var i = 0; i < this.floorplan.getCorners().length; i++) {
      var corner = this.floorplan.getCorners()[i];
      if (this.distanceFromCorner(corner) < cornerTolerance && corner != this) {
        this.combineWithCorner(corner);
        return true;
      }
    }
    // check walls
    for (var i = 0; i < this.floorplan.getWalls().length; i++) {
      var wall = this.floorplan.getWalls()[i];
      if (
        this.distanceFromWall(wall) < cornerTolerance &&
        !this.isWallConnected(wall)
      ) {
        // update position to be on wall
        var intersection = Utils.closestPointOnLine(
          this.x,
          this.y,
          wall.start.x,
          wall.start.y,
          wall.end.x,
          wall.end.y,
        );
        this.x = intersection.x;
        this.y = intersection.y;
        // merge this corner into wall by breaking wall into two parts
        this.floorplan.newWall(this, wall.end);
        wall.end = this;
        this.floorplan.update();
        return true;
      }
    }
    return false;
  }

  /** Ensure we do not have duplicate walls (i.e. same start and end points) */
  private removeDuplicateWalls() {
    // delete the wall between these corners, if it exists
    // FIXME:  should really be something like { [index: string]: boolean }
    var wallEndpoints: any = {};
    // FIXME:  should really be something like { [ index: string]: Corner }
    var wallStartpoints: any = {};
    for (var i = this.wallStarts.length - 1; i >= 0; i--) {
      const start = this.wallStarts[i];
      if (start) {
        if (start.end === this) {
          // remove zero length wall
          start.remove();
        } else {
          const end = start.end;
          if (end && end.id) {
            if (end.id in wallEndpoints) {
              // remove duplicated wall
              start.remove();
            } else {
              wallEndpoints[end.id] = true;
            }
          }
        }
      }
    }
    for (var i = this.wallEnds.length - 1; i >= 0; i--) {
      const start = this.wallEnds[i].start;
      if (start) {
        if (start === this) {
          // removed zero length wall
          this.wallEnds[i].remove();
        } else if (start.id && start.id in wallStartpoints) {
          // removed duplicated wall
          this.wallEnds[i].remove();
        } else {
          wallStartpoints[start.id] = true;
        }
      }
    }
  }
}
