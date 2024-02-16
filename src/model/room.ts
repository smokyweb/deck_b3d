import * as THREE from "three";
import { FloorPlane } from "../core/utils";
import { Corner } from "./corner";
import { Floorplan, TextureSpec } from "./floorplan";

//TODO
//var Vec2 = require('vec2')
//var segseg = require('segseg')
//var Polygon = require('polygon')

/** Default texture to be used if nothing is provided. */
const defaultRoomTexture = {
  url: "rooms/textures/hardwood.png",
  scale: 400,
};

/**
 * A Room is the combination of a Floorplan with a floor plane.
 */
export class Room {
  /** floor plane for intersection testing */
  public floorPlane: FloorPlane | null = null;

  /** */
  private floorChangeCallbacks = $.Callbacks();

  /**
   *  ordered CCW
   */
  constructor(
    private floorplan: Floorplan,
    public corners: Corner[],
  ) {
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

  public getTexture(): TextureSpec {
    var uuid = this.getUuid();
    var tex = this.floorplan.getFloorTexture(uuid);
    return tex || defaultRoomTexture;
  }

  /**
   * textureStretch always true, just an argument for consistency with walls
   */
  public setTexture(
    textureUrl: string,
    _textureStretch: boolean,
    textureScale: number,
  ) {
    var uuid = this.getUuid();
    this.floorplan.setFloorTexture(uuid, textureUrl, textureScale);
    this.floorChangeCallbacks.fire();
  }

  private generatePlane() {
    var points: THREE.Vector2[] = [];
    this.corners.forEach((corner: Corner) => {
      points.push(new THREE.Vector2(corner.x, corner.y));
    });

    var shape = new THREE.Shape(points);
    var geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
      }),
    );
    mesh.visible = false;
    mesh.rotation.set(Math.PI / 2, 0, 0);
    this.floorPlane = Object.assign(mesh, { room: this });
  }

  /**
   * Populates each wall's half edge relating to this room
   * this creates a fancy doubly connected edge list (DCEL)
   */
}
