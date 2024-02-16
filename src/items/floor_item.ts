import * as THREE from "three";
import { Model } from "../model/model";
import { Item } from "./item";
import { Metadata } from "./metadata";
import { Utils } from "../core/utils";

/**
 * A Floor Item is an entity to be placed related to a floor.
 */
export abstract class FloorItem extends Item {
  constructor(
    model: Model,
    metadata: Metadata,
    geometry: THREE.Geometry,
    material: THREE.MeshFaceMaterial,
    position: THREE.Vector3,
    rotation: number,
    scale: THREE.Vector3,
  ) {
    super(model, metadata, geometry, material, position, rotation, scale);
  }

  /** */
  public placeInRoom() {
    if (!this.position_set) {
      const center2 = this.model.floorplan.getCenter2();
      // FIXME: CoordinateConfusion
      this.threeObj.position.x = center2.x;
      this.threeObj.position.z = center2.y;
      this.threeObj.position.y =
        0.5 *
        (this.threeObj.geometry.boundingBox.max.y -
          this.threeObj.geometry.boundingBox.min.y);
    }
  }

  /** Take action after a resize */
  public resized() {
    this.threeObj.position.y = this.halfSize.y;
  }

  /** */
  public override moveToPosition(
    vec3: THREE.Vector3,
    _intersection: THREE.Intersection,
  ) {
    //console.log("floor_item moveToPosition", vec3, intersection);
    // keeps the position in the room and on the floor
    if (!this.isValidPosition(vec3)) {
      this.showError(vec3);
      return;
    } else {
      this.hideError();
      vec3.y = this.threeObj.position.y; // keep it on the floor!
      //const oldpos = this.position.clone();
      this.threeObj.position.copy(vec3);
      //console.log("moved from ", oldpos, "to", this.position);
    }
  }

  /** */
  public isValidPosition(vec3: THREE.Vector3): boolean {
    var corners = this.getCorners("x", "z", vec3);

    // check if we are in a room
    var rooms = this.model.floorplan.getRooms();
    var isInARoom = false;
    for (var i = 0; i < rooms.length; i++) {
      if (
        Utils.pointInPolygon(vec3.x, vec3.z, rooms[i].corners) &&
        !Utils.polygonPolygonIntersect(corners, rooms[i].corners)
      ) {
        isInARoom = true;
      }
    }
    if (!isInARoom) {
      //console.log('object not in a room');
      return false;
    }

    // check if we are outside all other objects
    /*
    if (this.obstructFloorMoves) {
        var objects = this.model.items.getItems();
        for (var i = 0; i < objects.length; i++) {
            if (objects[i] === this || !objects[i].obstructFloorMoves) {
                continue;
            }
            if (!utils.polygonOutsidePolygon(corners, objects[i].getCorners('x', 'z')) ||
                utils.polygonPolygonIntersect(corners, objects[i].getCorners('x', 'z'))) {
                //console.log('object not outside other objects');
                return false;
            }
        }
    }*/

    return true;
  }
}
