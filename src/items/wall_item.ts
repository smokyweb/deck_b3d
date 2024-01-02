import * as THREE from 'three';
import { Utils } from '../core/utils';
import { HalfEdge } from '../model/half_edge';
import { Model } from '../model/model';
import { Item } from './item';
import { Metadata } from './metadata';


/**
 * A Wall Item is an entity to be placed related to a wall.
 */
export abstract class WallItem extends Item {
  /** The currently applied wall edge. */
  public currentWallEdge: HalfEdge | null = null;
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
  public closestWallEdge(): HalfEdge | null {

    var wallEdges = this.model.floorplan.wallEdges();

    var wallEdge = null;
    var minDistance: number | null = null;

    var itemX = this.position.x;
    var itemZ = this.position.z;

    wallEdges.forEach((edge: HalfEdge) => {
      var distance = edge.distanceTo(itemX, itemZ);
      if (minDistance === null || distance < minDistance) {
        minDistance = distance;
        wallEdge = edge;
      }
    });

    return wallEdge;
  }

  /** */
  public override removed() {
    if (this.currentWallEdge != null && this.addToWall) {
      Utils.removeValue(this.currentWallEdge.wall.items, this as unknown as Item);
      this.redrawWall();
    }
  }

  /** */
  private redrawWall() {
    if (this.addToWall && this.currentWallEdge) {
      this.currentWallEdge.wall.fireRedraw();
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
    const closestWallEdge = this.closestWallEdge();
    if (closestWallEdge) {
      this.changeWallEdge(closestWallEdge);
    }
    this.updateSize();

    if (!this.position_set && closestWallEdge) {
      // position not set
      var center = closestWallEdge.interiorCenter();
      var newPos = new THREE.Vector3(
        center.x,
        closestWallEdge.wall.height / 2.0,
        center.y);
      this.boundMove(newPos);
      this.position.copy(newPos);
      this.redrawWall();
    }
  };

  /** */
  // FIXME:  Figure out proper type of intersection arg
  public override moveToPosition(vec3: THREE.Vector3, intersection: any) {
    this.changeWallEdge(intersection.object.edge);
    this.boundMove(vec3);
    this.position.copy(vec3);
    this.redrawWall();
  }

  /** */
  protected getWallOffset() {
    return this.wallOffsetScalar;
  }

  /** */
  private changeWallEdge(wallEdge: HalfEdge) {
    if (this.currentWallEdge != null) {
      if (this.addToWall) {
        Utils.removeValue(this.currentWallEdge.wall.items, this);
        this.redrawWall();
      } else {
        Utils.removeValue(this.currentWallEdge.wall.onItems, this);
      }
    }

    // handle subscription to wall being removed
    if (this.currentWallEdge != null) {
      this.currentWallEdge.wall.dontFireOnDelete(this.remove.bind(this));
    }
    wallEdge.wall.fireOnDelete(this.remove.bind(this));

    // find angle between wall normals
    var normal2 = new THREE.Vector2();
    // FIXME:  THREE.Mesh.geometry has type Geometry|BufferGeometry,
    //         and BufferGeometry may have a 'normal' BufferAttribute, but no
    //         'faces' member.  Right now we know this geometry has a faces attribute 
    //         because we just made it, but the normal should really be calculated 
    //         independently.
    if (wallEdge.plane?.geometry && 'faces' in wallEdge.plane?.geometry) {
      const faces = wallEdge.plane.geometry.faces;
      var normal3 = faces[0].normal;
      normal2.x = normal3.x;
      normal2.y = normal3.z;
    }

    var angle = Utils.angle(
      this.refVec.x, this.refVec.y,
      normal2.x, normal2.y);
    this.rotation.y = angle;

    // update currentWall
    this.currentWallEdge = wallEdge;
    if (this.addToWall) {
      wallEdge.wall.items.push(this);
      this.redrawWall();
    } else {
      wallEdge.wall.onItems.push(this);
    }
  }

  /** Returns an array of planes to use other than the ground plane
   * for passing intersection to clickPressed and clickDragged */
  public override customIntersectionPlanes(): THREE.Mesh[] {
    return this.model.floorplan.wallEdgePlanes();
  }

  /** takes the move vec3, and makes sure object stays bounded on plane */
  private boundMove(vec3: THREE.Vector3) {
    var tolerance = 1;
    var edge = this.currentWallEdge;
    if (edge) {
      vec3.applyMatrix4(edge.interiorTransform);

      if (vec3.x < this.sizeX / 2.0 + tolerance) {
        vec3.x = this.sizeX / 2.0 + tolerance;
      } else if (vec3.x > (edge.interiorDistance() - this.sizeX / 2.0 - tolerance)) {
        vec3.x = edge.interiorDistance() - this.sizeX / 2.0 - tolerance;
      }

      if (this.boundToFloor) {
        vec3.y = 0.5 * (this.geometry.boundingBox.max.y - this.geometry.boundingBox.min.y) * this.scale.y + 0.01;
      } else {
        if (vec3.y < this.sizeY / 2.0 + tolerance) {
          vec3.y = this.sizeY / 2.0 + tolerance;
        } else if (vec3.y > edge.height - this.sizeY / 2.0 - tolerance) {
          vec3.y = edge.height - this.sizeY / 2.0 - tolerance;
        }
      }

      vec3.z = this.getWallOffset();

      vec3.applyMatrix4(edge.invInteriorTransform);
    }
  }
}
