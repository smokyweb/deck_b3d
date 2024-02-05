import * as THREE from 'three';
import { Utils } from '../core/utils';
import { Model } from '../model/model';
import { Wall } from '../model/wall';
import { Item } from './item';
import { Metadata } from './metadata';


/**
 * A Wall Item is an entity to be placed related to a wall.
 */
export abstract class WallItem extends Item {
  /** The currently applied wall edge. */
  public currentWall: Wall | null = null;
  /* TODO:
     This caused a huge headache.
     HalfEdges get destroyed/created every time floorplan is edited.
     This item should store a reference to a wall and front/back,
     and grab its edge reference dynamically whenever it needs it.
   */

  /** used for finding rotations */
  private refVec = new THREE.Vector2(0, 1.0);

  /** */
  private wallOffsetScalar = 0;

  /** */
  private sizeX = 0;

  /** */
  private sizeY = 0;

  /** */
  protected addToWall = false;

  /** */
  protected boundToFloor = false;

  /** */
  protected frontVisible = false;

  /** */
  protected backVisible = false;

  constructor(model: Model, metadata: Metadata, geometry: THREE.Geometry, material: THREE.MeshFaceMaterial, position: THREE.Vector3, rotation: number, scale: THREE.Vector3) {
    super(model, metadata, geometry, material, position, rotation, scale);

    this.allowRotate = false;
  };

  /** Get the closet wall edge.
   * @returns The wall edge.
   */
  public closestWall(): Wall | null {

    var walls = this.model.floorplan.walls;

    var closestWall: Wall | null = null;
    var minDistance: number | null = null;

    var itemX = this.position.x;
    var itemZ = this.position.z;

    walls.forEach((wall: Wall) => {
      var distance = wall.distanceFrom(itemX, itemZ);
      if (minDistance === null || distance < minDistance) {
        minDistance = distance;
        closestWall = wall;
      }
    });

    return closestWall;
  }

  /** */
  public override removed() {
    if (this.currentWall != null && this.addToWall) {
      Utils.removeValue(this.currentWall.items, this as unknown as Item);
      this.redrawWall();
    }
  }

  /** */
  private redrawWall() {
    if (this.addToWall && this.currentWall) {
      this.currentWall.fireRedraw();
    }
  }

  /** */
  public updateEdgeVisibility(visible: boolean, front: boolean) {
    if (front) {
      this.frontVisible = visible;
    } else {
      this.backVisible = visible;
    }
    this.visible = (this.frontVisible || this.backVisible);
  }

  /** */
  private updateSize() {
    this.wallOffsetScalar = (this.geometry.boundingBox.max.z - this.geometry.boundingBox.min.z) * this.scale.z / 2.0;
    this.sizeX = (this.geometry.boundingBox.max.x - this.geometry.boundingBox.min.x) * this.scale.x;
    this.sizeY = (this.geometry.boundingBox.max.y - this.geometry.boundingBox.min.y) * this.scale.y;
  }

  /** */
  public resized() {
    if (this.boundToFloor) {
      this.position.y = 0.5 * (this.geometry.boundingBox.max.y - this.geometry.boundingBox.min.y) * this.scale.y + 0.01;
    }

    this.updateSize();
    this.redrawWall();
  }

  /** */
  public placeInRoom() {
    const closestWall= this.closestWall();
    if (closestWall) {
      this.changeWall(closestWall);
    }
    this.updateSize();

    if (!this.position_set && closestWall) {
      // position not set
      var center = closestWall.center();
      var newPos = new THREE.Vector3(
        center.x,
        closestWall.height / 2.0,
        center.y);
      this.boundMove(newPos);
      this.position.copy(newPos);
      this.redrawWall();
    }
  };

  /** */
  // FIXME:  Figure out proper type of intersection arg
  public override moveToPosition(vec3: THREE.Vector3, intersection: any) {
    this.changeWall(intersection.object.edge);
    this.boundMove(vec3);
    this.position.copy(vec3);
    this.redrawWall();
  }

  /** */
  protected getWallOffset() {
    return this.wallOffsetScalar;
  }

  /** */
  private changeWall(wall: Wall) {
    if (this.currentWall != null) {
      if (this.addToWall) {
        Utils.removeValue(this.currentWall.items, this);
        this.redrawWall();
      } else {
        Utils.removeValue(this.currentWall.onItems, this);
      }
    }

    // handle subscription to wall being removed
    if (this.currentWall != null) {
      // FIXME: This doesn't work.  bind returs a different object every time
      this.currentWall.dontFireOnDelete(this.remove.bind(this));
    }
    wall.fireOnDelete(this.remove.bind(this));

    // find angle between wall normals
    var normal2 = new THREE.Vector2();
    // FIXME:  THREE.Mesh.geometry has type Geometry|BufferGeometry,
    //         and BufferGeometry may have a 'normal' BufferAttribute, but no
    //         'faces' member.  Right now we know this geometry has a faces attribute 
    //         because we just made it, but the normal should really be calculated 
    //         independently.
    if (wall.plane.geometry && 'faces' in wall.plane.geometry) {
      const faces = wall.plane.geometry.faces;
      var normal3 = faces[0].normal;
      normal2.x = normal3.x;
      normal2.y = normal3.z;
    }

    var angle = Utils.angle(
      this.refVec.x, this.refVec.y,
      normal2.x, normal2.y);
    this.rotation.y = angle;

    // update currentWall
    this.currentWall = wall;
    if (this.addToWall) {
      wall.items.push(this);
      this.redrawWall();
    } else {
      wall.onItems.push(this);
    }
  }

  /** Returns an array of planes to use other than the ground plane
   * for passing intersection to clickPressed and clickDragged */
  public override customIntersectionPlanes(): THREE.Mesh[] {
    return this.model.floorplan.wallPlanes();
  }

  /** takes the move vec3, and makes sure object stays bounded on plane */
  private boundMove(vec3: THREE.Vector3) {
    var tolerance = 1;
    var wall = this.currentWall;
    if (wall) {

      const minX = this.sizeX / 2.0 + tolerance;
      const maxX = wall.length() - minX;
      vec3.x = Utils.clamp(vec3.x, minX, maxX);

      const minY = this.sizeY / 2.0 + tolerance;
      const maxY = wall.height - minY;

      if (this.boundToFloor) {
        vec3.y = minY;
      } else {
        vec3.y = Utils.clamp(vec3.y, minY, maxY);
      }

      vec3.z = this.getWallOffset();

      vec3.applyMatrix4(wall.invInteriorTransform);
    }
  }
}
