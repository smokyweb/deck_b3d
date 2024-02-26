import * as THREE from "three";

import { Utils, FloorPlane, WallPlane } from "../core/utils";
import { Wall } from "./wall";
import { Corner } from "./corner";
import { Room } from "./room";

export interface TextureSpec {
  url: string;
  scale: number;
}
/** */
const defaultFloorPlanTolerance = 10.0;

/**
 * A Floorplan represents a number of Walls, Corners and Rooms.
 */
export class Floorplan {
  /** 
      This is an array of all Wall objects associated with the
      Floorplan, but not in any particular order.

      Every wall has a start corner and end corner.
  */
  public walls: Wall[] = [];

  /** 
      Corners store references to the walls they are parts of. 
  */
  private corners: Corner[] = [];

  /** 
      The main job of a Room is to render its floor and to hold
      a reference to the two-way HalfEdge chain around its 
      perimeter.
  */
  private rooms: Room[] = [];

  /** */
  private new_wall_callbacks = $.Callbacks();

  /** */
  private new_corner_callbacks = $.Callbacks();

  /** */
  private redraw_callbacks = $.Callbacks();

  /** */
  private updated_rooms = $.Callbacks();

  /** */
  public roomLoadedCallbacks = $.Callbacks();

  /**
   * Floor textures are owned by the floorplan, because room objects are
   * destroyed and created each time we change the floorplan.
   * floorTextures is a map of room UUIDs (string) to a object with
   * url and scale attributes.
   */
  private floorTextures: { [index: string]: TextureSpec } = {};

  /** Constructs a floorplan. */
  constructor() {}
  public wallPlanes(): WallPlane[] {
    var planes: WallPlane[] = [];
    this.walls.forEach((wall) => {
      planes.push(wall.plane);
    });
    return planes;
  }

  public getWalls(): Wall[] {
    return this.walls;
  }

  public floorPlanes(): FloorPlane[] {
    let result: FloorPlane[] = [];
    this.rooms.forEach((room: Room) => {
      if (room.floorPlane) {
        result.push(room.floorPlane);
      }
    });
    return result;
  }

  public fireOnNewWall(callback: (wall: Wall) => void) {
    this.new_wall_callbacks.add(callback);
  }

  public fireOnNewCorner(callback: (corner: Corner) => void) {
    this.new_corner_callbacks.add(callback);
  }

  public fireOnRedraw(callback: () => void) {
    this.redraw_callbacks.add(callback);
  }

  public fireOnUpdatedRooms(callback: () => void) {
    this.updated_rooms.add(callback);
  }

  /**
   * Creates a new wall.
   * @param start The start corner.
   * @param end he end corner.
   * @returns The new wall.
   */
  public newWall(start: Corner, end: Corner): Wall {
    var wall = new Wall(start, end);
    this.walls.push(wall);
    wall.fireOnDelete(() => {
      this.removeWall(wall);
    });
    this.new_wall_callbacks.fire(wall);
    this.update();
    return wall;
  }

  /** Removes a wall.
   * @param wall The wall to be removed.
   */
  private removeWall(wall: Wall) {
    Utils.removeValue(this.walls, wall);
    this.update();
  }

  /**
   * Creates a new corner.
   * @param x The x coordinate.
   * @param y The y coordinate.
   * @param id An optional id. If unspecified, the id will be created internally.
   * @returns The new corner.
   */
  public newCorner(x: number, y: number, id?: string): Corner {
    var corner = new Corner(this, x, y, id);
    this.corners.push(corner);
    corner.fireOnDelete(() => {
      this.removeCorner;
    });
    this.new_corner_callbacks.fire(corner);
    return corner;
  }

  /** Removes a corner.
   * @param corner The corner to be removed.
   */
  private removeCorner(corner: Corner) {
    Utils.removeValue(this.corners, corner);
  }

  /** Gets the corners. */
  public getCorners(): Corner[] {
    return this.corners;
  }

  /** Gets the rooms. */
  public getRooms(): Room[] {
    return this.rooms;
  }

  public overlappedCorner(
    x: number,
    y: number,
    tolerance?: number,
  ): Corner | null {
    tolerance = tolerance || defaultFloorPlanTolerance;
    for (var i = 0; i < this.corners.length; i++) {
      if (this.corners[i].distanceFrom(x, y) < tolerance) {
        return this.corners[i];
      }
    }
    return null;
  }

  public overlappedWall(x: number, y: number, tolerance?: number): Wall | null {
    tolerance = tolerance || defaultFloorPlanTolerance;
    for (var i = 0; i < this.walls.length; i++) {
      if (this.walls[i].distanceFrom(x, y) < tolerance) {
        return this.walls[i];
      }
    }
    return null;
  }

  // import and export -- cleanup
  public saveFloorplan(): any {
    var floorplan: any = {
      corners: {},
      walls: [],
      wallTextures: [],
      floorTextures: {},
      newFloorTextures: {},
    };

    this.corners.forEach((corner) => {
      floorplan.corners[corner.id] = {
        x: corner.x,
        y: corner.y,
      };
    });

    this.walls.forEach((wall) => {
      floorplan.walls.push({
        corner1: wall.start.id,
        corner2: wall.end.id,
        frontTexture: wall.frontTexture,
        backTexture: wall.backTexture,
      });
    });
    floorplan.newFloorTextures = this.floorTextures;
    return floorplan;
  }

  public loadFloorplan(floorplan: any) {
    console.log("loadFloorplan", floorplan);
    this.reset();

    var corners: { [index: string]: Corner } = {};
    if (
      floorplan == null ||
      !("corners" in floorplan) ||
      !("walls" in floorplan)
    ) {
      console.log("floorplan lacks something");
      return;
    }
    for (var id in floorplan.corners) {
      console.log("adding corner");
      var corner = floorplan.corners[id];
      corners[id] = this.newCorner(corner.x, corner.y, id);
    }
    floorplan.walls.forEach((wall: any) => {
      console.log("adding wall");
      var newWall = this.newWall(
        corners[wall.corner1 as string],
        corners[wall.corner2 as string],
      );
      if (wall.frontTexture) {
        newWall.frontTexture = wall.frontTexture;
      }
      if (wall.backTexture) {
        newWall.backTexture = wall.backTexture;
      }
    });

    if ("newFloorTextures" in floorplan) {
      this.floorTextures = floorplan.newFloorTextures;
    }

    this.update();
    this.roomLoadedCallbacks.fire();
  }

  public getFloorTexture(uuid: string): TextureSpec | null {
    if (uuid in this.floorTextures) {
      return this.floorTextures[uuid];
    } else {
      return null;
    }
  }

  public setFloorTexture(uuid: string, url: string, scale: number) {
    this.floorTextures[uuid] = {
      url: url,
      scale: scale,
    };
  }

  /** clear out obsolete floor textures */
  private updateFloorTextures() {
    var uuids = this.rooms.map((room) => room.getUuid());
    for (var uuid in this.floorTextures) {
      if (uuids.includes(uuid)) {
        delete this.floorTextures[uuid];
      }
    }
  }

  /** */
  private reset() {
    var tmpCorners = this.corners.slice(0);
    var tmpWalls = this.walls.slice(0);
    tmpCorners.forEach((corner) => {
      corner.remove();
    });
    tmpWalls.forEach((wall) => {
      wall.remove();
    });
    this.corners = [];
    this.walls = [];
  }

  /**
   * Update rooms
   */
  public update() {
    this.walls.forEach((wall) => {
      wall.resetFrontBack();
    });

    var roomCorners = this.findRooms(this.corners);
    this.rooms = [];
    roomCorners.forEach((corners) => {
      this.rooms.push(new Room(this, corners));
    });

    this.updateFloorTextures();
    this.updated_rooms.fire();
  }

  /**
   * Returns the center of the floorplan in the y plane
   */
  public getCenter2(): THREE.Vector2 {
    return this.getBounds().getCenter();
  }

  public getSize2(): THREE.Vector2 {
    return this.getBounds().getSize();
  }

  public getBounds(): THREE.Box2 {
    const result = new THREE.Box2();
    this.corners.forEach((corner) => result.expandByPoint(corner.position()));
    return result;
  }

  /*
   * Find the "rooms" in our planar straight-line graph.
   * Rooms are set of the smallest (by area) possible cycles in this graph.
   * @param corners The corners of the floorplan.
   * @returns The rooms, each room as an array of corners.
   */
  public findRooms(corners: Corner[]): Corner[][] {
    function _calculateTheta(
      previousCorner: Corner,
      currentCorner: Corner,
      nextCorner: Corner,
    ) {
      var theta = Utils.angle2pi(
        previousCorner.x - currentCorner.x,
        previousCorner.y - currentCorner.y,
        nextCorner.x - currentCorner.x,
        nextCorner.y - currentCorner.y,
      );
      return theta;
    }

    function _removeDuplicateRooms(roomArray: Corner[][]): Corner[][] {
      var results: Corner[][] = [];
      var lookup: { [index: string]: boolean } = {};
      var hashFunc = function (corner: Corner) {
        return corner.id;
      };
      var sep = "-";
      for (var i = 0; i < roomArray.length; i++) {
        // rooms are cycles, shift it around to check uniqueness
        var add = true;
        var room = roomArray[i];
        let str = null;
        for (var j = 0; j < room.length; j++) {
          var roomShift = Utils.cycle(room, j);
          str = roomShift.map(hashFunc).join(sep);
          if (lookup.hasOwnProperty(str)) {
            add = false;
          }
        }
        if (add && str) {
          results.push(roomArray[i]);
          lookup[str] = true;
        }
      }
      return results;
    }

    function _findTightestCycle(
      firstCorner: Corner,
      secondCorner: Corner,
    ): Corner[] {
      interface thing {
        corner: Corner;
        previousCorners: Corner[];
      }
      var stack: thing[] = [];

      let next: thing | undefined = {
        corner: secondCorner,
        previousCorners: [firstCorner],
      };
      let visited: { [index: string]: boolean } = {};
      visited[firstCorner.id] = true;

      while (next) {
        // update previous corners, current corner, and visited corners
        var currentCorner = next.corner;
        visited[currentCorner.id] = true;

        // did we make it back to the startCorner?
        if (next.corner === firstCorner && currentCorner !== secondCorner) {
          return next.previousCorners;
        }

        var addToStack: Corner[] = [];
        var adjacentCorners = next.corner.adjacentCorners();
        for (var i = 0; i < adjacentCorners.length; i++) {
          var nextCorner = adjacentCorners[i];

          // is this where we came from?
          // give an exception if its the first corner and we aren't at the second corner
          if (
            nextCorner.id in visited &&
            !(nextCorner === firstCorner && currentCorner !== secondCorner)
          ) {
            continue;
          }

          // nope, throw it on the queue
          addToStack.push(nextCorner);
        }

        var previousCorners = next.previousCorners.slice(0);
        previousCorners.push(currentCorner);
        if (addToStack.length > 1) {
          // visit the ones with smallest theta first
          var previousCorner =
            next.previousCorners[next.previousCorners.length - 1];
          addToStack.sort(function (a, b) {
            return (
              _calculateTheta(previousCorner, currentCorner, b) -
              _calculateTheta(previousCorner, currentCorner, a)
            );
          });
        }

        if (addToStack.length > 0) {
          // add to the stack
          addToStack.forEach((corner) => {
            stack.push({
              corner: corner,
              previousCorners: previousCorners,
            });
          });
        }

        // pop off the next one
        next = stack.pop();
      }
      return [];
    }

    // find tightest loops, for each corner, for each adjacent
    // TODO: optimize this, only check corners with > 2 adjacents, or isolated cycles
    var loops: Corner[][] = [];

    corners.forEach((firstCorner) => {
      firstCorner.adjacentCorners().forEach((secondCorner) => {
        loops.push(_findTightestCycle(firstCorner, secondCorner));
      });
    });

    // remove duplicates
    var uniqueLoops = _removeDuplicateRooms(loops);
    //remove CW loops
    var uniqueCCWLoops = uniqueLoops.filter((loop) => !Utils.isClockwise(loop));

    return uniqueCCWLoops;
  }
}
