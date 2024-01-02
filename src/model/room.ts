import * as THREE from 'three';
import { Point, FloorPlane } from '../core/utils';
import { Corner } from './corner';
import { Floorplan } from './floorplan';
import { HalfEdge } from './half_edge';


//TODO
//var Vec2 = require('vec2')
//var segseg = require('segseg')
//var Polygon = require('polygon')


/** Default texture to be used if nothing is provided. */
const defaultRoomTexture = {
  url: "rooms/textures/hardwood.png",
  scale: 400
}

/** 
 * A Room is the combination of a Floorplan with a floor plane. 
 */
export class Room {

  /** */
  public interiorCorners: Point[] = [];

  /** */
  private edgePointer: HalfEdge | null = null;

  /** floor plane for intersection testing */
  public floorPlane: FloorPlane | null = null;

  /** */
  private floorChangeCallbacks = $.Callbacks();

  /**
   *  ordered CCW
   */
  constructor(private floorplan: Floorplan, public corners: Corner[]) {
    this.updateWalls();
    this.updateInteriorCorners();
    this.generatePlane();
  }

  public getUuid(): string {
    var cornerUuids = this.corners.map((c) => c.id);
    cornerUuids.sort();
    return cornerUuids.join();
  }

  public fireOnFloorChange(callback: () => void) {
    this.floorChangeCallbacks.add(callback);
  }

  public getTexture() {
    var uuid = this.getUuid();
    var tex = this.floorplan.getFloorTexture(uuid);
    return tex || defaultRoomTexture;
  }

  /** 
   * textureStretch always true, just an argument for consistency with walls
   */
  public setTexture(textureUrl: string, _textureStretch: boolean, textureScale: number) {
    var uuid = this.getUuid();
    this.floorplan.setFloorTexture(uuid, textureUrl, textureScale);
    this.floorChangeCallbacks.fire();
  }

  private generatePlane() {
    var points: THREE.Vector2[] = [];
    this.interiorCorners.forEach((corner) => {
      points.push(new THREE.Vector2(
        corner.x,
        corner.y));
    });
    var shape = new THREE.Shape(points);
    var geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geometry,
      new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide
      }));
    mesh.visible = false;
    mesh.rotation.set(Math.PI / 2, 0, 0);
    this.floorPlane = Object.assign(mesh, {room: this});
  }

  private updateInteriorCorners() {
    var edge = this.edgePointer;
    while (edge) {
      this.interiorCorners.push(edge.interiorStart());
      edge.generatePlane();
      if (edge.next === this.edgePointer) {
        break;
      } else {
        edge = edge.next;
      }
    }
  }

  /** 
   * Populates each wall's half edge relating to this room
   * this creates a fancy doubly connected edge list (DCEL)
   */
  private updateWalls() {

    var prevEdge = null;
    var firstEdge = null;

    for (var i = 0; i < this.corners.length; i++) {

      var firstCorner = this.corners[i];
      var secondCorner = this.corners[(i + 1) % this.corners.length];

      // find if wall is heading in that direction
      var wallTo = firstCorner.wallTo(secondCorner);
      var wallFrom = firstCorner.wallFrom(secondCorner);

      let edge = null;
      if (wallTo) {
        edge = new HalfEdge(this, wallTo, true);
      } else if (wallFrom) {
        edge = new HalfEdge(this, wallFrom, false);
      } else {
        // something horrible has happened
        throw Error("corners arent connected by a wall, uh oh");
      }

      if (i == 0) {
        firstEdge = edge;
      } else {
        if (prevEdge === null) {
          throw Error("prevEdge was null");
        }
        edge.prev = prevEdge;
        prevEdge.next = edge;
        if (i + 1 == this.corners.length) {
          if (firstEdge == null) {
            throw Error("firstEdge was null");
          }
          firstEdge.prev = edge;
          edge.next = firstEdge;
        }
      }
      prevEdge = edge;
    }

    // hold on to an edge reference
    this.edgePointer = firstEdge;
  }
}
