import * as THREE from "three";
import { Utils } from "../core/utils";
import { Model } from "../model/model";
import { Metadata } from "./metadata";
import { Scene } from "../model/scene";

/**
 * An Item is an abstract entity for all things placed in the scene,
 * e.g. at walls or on the floor.
 */
export abstract class Item {
  /** */
  private scene: Scene;

  /** */
  private errorGlow = new THREE.Mesh();

  public readonly threeObj: THREE.Mesh;

  /** */
  private _hover: boolean = false;
  get hover(): boolean {
    return this._hover;
  }
  set hover(b: boolean) {
    if (b != this._hover) {
      this._hover = b;
      this.updateHighlight();
    }
  }

  /** */
  private _selected = false;
  get selected(): boolean {
    return this._selected;
  }
  set selected(s: boolean) {
    if (s != this._selected) {
      this._selected = s;
      this.updateHighlight();
    }
  }

  /** */
  private error = false;

  /** */
  private emissiveColor = 0x444444;

  /** */
  private errorColor = 0xff0000;

  /** */
  resizable: boolean;

  /** Does this object affect other floor items */
  protected obstructFloorMoves = true;

  /** */
  public position_set: boolean;

  /** Show rotate option in context menu */
  public allowRotate = true;

  /** */
  public fixed = false;

  /** dragging */
  private dragOffset = new THREE.Vector3();

  /** */
  public halfSize: THREE.Vector3;

  /** Constructs an item.
   */
  constructor(
    protected model: Model,
    public metadata: Metadata,
    geometry: THREE.Geometry,
    material: THREE.MeshFaceMaterial,
    position: THREE.Vector3,
    rotation: number,
    scale: THREE.Vector3
  ) {
    this.threeObj = new THREE.Mesh(geometry, material);
    this.threeObj.userData = this;

    this.scene = this.model.scene;

    this.errorColor = 0xff0000;

    this.resizable = metadata.resizable || false;

    const tobj = this.threeObj;
    tobj.castShadow = true;
    tobj.receiveShadow = false;

    if (position) {
      this.threeObj.position.copy(position);
      this.position_set = true;
    } else {
      this.position_set = false;
    }

    // center in its boundingbox
    tobj.geometry.computeBoundingBox();
    tobj.geometry.applyMatrix(
      new THREE.Matrix4().makeTranslation(
        -0.5 *
          (tobj.geometry.boundingBox.max.x + tobj.geometry.boundingBox.min.x),
        -0.5 *
          (tobj.geometry.boundingBox.max.y + tobj.geometry.boundingBox.min.y),
        -0.5 *
          (tobj.geometry.boundingBox.max.z + tobj.geometry.boundingBox.min.z)
      )
    );
    tobj.geometry.computeBoundingBox();
    this.halfSize = this.objectHalfSize();

    if (rotation) {
      tobj.rotation.y = rotation;
    }

    if (scale != null) {
      this.setScale(scale.x, scale.y, scale.z);
    }
  }

  /** */
  public remove() {
    this.scene.removeItem(this);
  }

  /** */
  public resize(height: number, width: number, depth: number) {
    var x = width / this.getWidth();
    var y = height / this.getHeight();
    var z = depth / this.getDepth();
    this.setScale(x, y, z);
  }

  /** */
  public setScale(x: number, y: number, z: number) {
    var scaleVec = new THREE.Vector3(x, y, z);
    this.halfSize.multiply(scaleVec);
    this.threeObj.scale.multiply(scaleVec);
    this.resized();
    this.scene.needsUpdate = true;
  }

  /** */
  public setFixed(fixed: boolean) {
    console.log(`setFixed(${fixed})`);
    this.fixed = fixed;
  }

  /** Subclass can define to take action after a resize. */
  protected abstract resized(): void;

  /** */
  public getHeight(): number {
    return this.halfSize.y * 2.0;
  }

  /** */
  public getWidth(): number {
    return this.halfSize.x * 2.0;
  }

  /** */
  public getDepth(): number {
    return this.halfSize.z * 2.0;
  }

  /** */
  public abstract placeInRoom(): void;

  /** */
  public initObject() {
    this.placeInRoom();
    // select and stuff
    this.scene.needsUpdate = true;
  }

  /** */
  public removed() {}

  /** on is a bool */
  public updateHighlight() {
    var on = this.hover || this.selected;
    var hex = on ? this.emissiveColor : 0x000000;
    (<THREE.MeshFaceMaterial>this.threeObj.material).materials.forEach(
      (material) => {
        // TODO_Ekki emissive doesn't exist anymore?
        (<any>material).emissive.setHex(hex);
      }
    );
    this.scene.needsUpdate = true;
  }

  /** intersection has attributes point (vec3) and object (THREE.Mesh) */
  public clickPressed(intersection: THREE.Intersection) {
    this.dragOffset.copy(intersection.point).sub(this.threeObj.position);
  }

  /** */
  public clickDragged(intersection: THREE.Intersection) {
    if (intersection) {
      this.moveToPosition(
        intersection.point.sub(this.dragOffset),
        intersection
      );
    }
  }

  /** */
  public rotate(intersection: THREE.Intersection) {
    var angle = Utils.angle(
      0,
      1,
      intersection.point.x - this.threeObj.position.x,
      intersection.point.z - this.threeObj.position.z
    );

    var snapTolerance = Math.PI / 16.0;

    // snap to intervals near Math.PI/2
    for (var i = -4; i <= 4; i++) {
      if (Math.abs(angle - i * (Math.PI / 2)) < snapTolerance) {
        angle = i * (Math.PI / 2);
        break;
      }
    }

    this.threeObj.rotation.y = angle;
  }

  /** */
  public moveToPosition(
    vec3: THREE.Vector3,
    _intersection: THREE.Intersection
  ) {
    this.threeObj.position.copy(vec3);
  }

  /** */
  public clickReleased() {
    if (this.error) {
      this.hideError();
    }
  }

  /**
   * Returns an array of planes to use other than the ground plane
   * for passing intersection to clickPressed and clickDragged
   */
  public customIntersectionPlanes(): THREE.Mesh[] {
    return [];
  }

  /**
   * returns the 2d corners of the bounding polygon
   *
   * offset is Vector3 (used for getting corners of object at a new position)
   *
   * TODO: handle rotated objects better!
   * FIXME: xDim and yDim are presumed 'x' and 'z' respectively, actual args ignored
   */
  public getCorners(
    _xDim: PropertyKey,
    _yDim: PropertyKey,
    position: THREE.Vector3
  ) {
    position = position || this.threeObj.position;

    var halfSize = this.halfSize.clone();

    var c1 = new THREE.Vector3(-halfSize.x, 0, -halfSize.z);
    var c2 = new THREE.Vector3(halfSize.x, 0, -halfSize.z);
    var c3 = new THREE.Vector3(halfSize.x, 0, halfSize.z);
    var c4 = new THREE.Vector3(-halfSize.x, 0, halfSize.z);

    var transform = new THREE.Matrix4();
    //console.log(this.rotation.y);
    transform.makeRotationY(this.threeObj.rotation.y); //  + Math.PI/2)

    c1.applyMatrix4(transform);
    c2.applyMatrix4(transform);
    c3.applyMatrix4(transform);
    c4.applyMatrix4(transform);

    c1.add(position);
    c2.add(position);
    c3.add(position);
    c4.add(position);

    //halfSize.applyMatrix4(transform);

    //var min = position.clone().sub(halfSize);
    //var max = position.clone().add(halfSize);

    var corners = [
      { x: c1.x, y: c1.z },
      { x: c2.x, y: c2.z },
      { x: c3.x, y: c3.z },
      { x: c4.x, y: c4.z },
    ];

    return corners;
  }

  /** */
  public abstract isValidPosition(vec3: THREE.Vector3): boolean;

  /** */
  public showError(vec3: THREE.Vector3) {
    vec3 = vec3 || this.threeObj.position;
    if (!this.error) {
      this.error = true;
      this.errorGlow = this.createGlow(this.errorColor, 0.8, true);
      this.scene.add(this.errorGlow);
    }
    this.errorGlow.position.copy(vec3);
  }

  /** */
  public hideError() {
    if (this.error) {
      this.error = false;
      this.scene.remove(this.errorGlow);
    }
  }

  /** */
  private objectHalfSize(): THREE.Vector3 {
    var objectBox = new THREE.Box3();
    objectBox.setFromObject(this.threeObj);
    return objectBox.max.clone().sub(objectBox.min).divideScalar(2);
  }

  /** */
  public createGlow(
    color: any,
    opacity: number,
    ignoreDepth: boolean
  ): THREE.Mesh {
    ignoreDepth = ignoreDepth || false;
    opacity = opacity || 0.2;
    var glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      blending: THREE.AdditiveBlending,
      opacity: 0.2,
      transparent: true,
      depthTest: !ignoreDepth,
    });

    var glow = new THREE.Mesh(
      <THREE.Geometry>this.threeObj.geometry.clone(),
      glowMaterial
    );
    glow.position.copy(this.threeObj.position);
    glow.rotation.copy(this.threeObj.rotation);
    glow.scale.copy(this.threeObj.scale);
    return glow;
  }

  // Should be called to dispose all contained textures and materials
  public dispose() {
    console.log("dispose material", this.threeObj.material);
    Utils.doDispose(this.threeObj.material);
  }
}
