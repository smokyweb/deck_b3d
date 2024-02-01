import * as THREE from 'three';
import { Utils } from '../core/utils';
import { Factory } from '../items/factory';
import { Item } from '../items/item';
import { Model } from './model';
import { Wall } from './wall';
import { Metadata } from '../items/metadata';

/**
 * The Scene is a manager of Items and also links to a ThreeJS scene.
 */
export class Scene {

  /** The associated ThreeJS scene. */
  public scene: THREE.Scene;

  /** */
  public items: Item[] = [];

  /** */
  public needsUpdate = false;

  /** The Json loader. */
  private loader: THREE.JSONLoader;

  /** */
  public itemLoadingCallbacks = $.Callbacks();

  /** Item */
  // FIXME: add public method boilerplate for this
  public itemLoadedCallbacks = $.Callbacks();

  /** Item */
  // FIXME: add public method boilerplate for this
  public itemRemovedCallbacks = $.Callbacks();

  /** rail item for future use */
  private railGeom: THREE.Geometry | null = null; 
  private railMat: THREE.Material[] | null = null;

  /**
   * Constructs a scene.
   * @param model The associated model.
   * @param textureDir The directory from which to load the textures.
   */
  constructor(public model: Model, _textureDir: string) {
    this.scene = new THREE.Scene();

    // init item loader
    this.loader = new THREE.JSONLoader();
    this.loader.crossOrigin = "";

    // load the rail item
    const scope = this;
    const loaderCallback = function (geometry: THREE.Geometry, materials: THREE.Material[]) {
      scope.railGeom = geometry;
      geometry.computeBoundingBox();
      scope.railMat = materials;
      scope.model.floorplan.update();
    }

    console.log("loading DeckRail");
    this.loader.load(
      "models/js/Olson_Deck_DeckRail.js",
      loaderCallback,
      undefined // TODO_Ekki 
    );
  }

  private midpoint(p1: {x: number, y: number}, p2: {x: number, y: number}): {x: number, y: number} 
  {
    return { x: (p1.x + p2.x)*0.5, y: (p1.y + p2.y)*0.5 }
  }
  public makeRailItem(wall: Wall): Item | null {
    if (this.railGeom !== null && this.railMat !== null) {
      const theClass = Factory.getClass(8);
      const start = wall.start;
      const end = wall.end;
      // not sure why negative sign is necessary here.  Probably because
      // of legacy confusion with left and right handed coordinates.
      const rotation = -Math.atan2(end.y - start.y, end.x - start.x);
      const wallLength = Utils.distance(start.x, start.y, end.x, end.y);
      const geom = this.railGeom.clone();
      geom.computeBoundingBox();
      const mat = this.railMat.map((m) => m.clone());
      const railBox = geom.boundingBox;
      const horizscale = wallLength / (railBox.max.x - railBox.min.x);
      const railHeight = railBox.max.y - railBox.min.y;
      const vertscale = wall.height / railHeight;
      const pos = this.midpoint(start, end);
      const item = new (theClass)(
        this.model,
        {}, geom,
        new THREE.MeshFaceMaterial(mat),
        new THREE.Vector3(pos.x, 0, pos.y), rotation, 
        new THREE.Vector3(horizscale, vertscale, horizscale) 
      );
      item.initObject();
      this.itemLoadedCallbacks.fire(item);
      return item;
    } else {
      return null;
    }
  }

  /** Adds a non-item, basically a mesh, to the scene.
   * @param mesh The mesh to be added.
   */
  public add(obj: THREE.Object3D) {
    this.scene.add(obj);
  }

  /** Removes a non-item, basically a mesh, from the scene.
   * @param mesh The mesh to be removed.
   */
  public remove(mesh: THREE.Mesh) {
    this.scene.remove(mesh);
    Utils.removeValue(this.items, mesh);
  }

  /** Gets the scene.
   * @returns The scene.
   */
  public getScene(): THREE.Scene {
    return this.scene;
  }

  /** Gets the items.
   * @returns The items.
   */
  public getItems(): Item[] {
    return this.items;
  }

  /** Gets the count of items.
   * @returns The count.
   */
  public itemCount(): number {
    return this.items.length
  }

  /** Removes all items. */
  public clearItems() {
    const items_copy = this.items.slice()
    items_copy.forEach((item) => {
      this.removeItem(item, true);
    });
    this.items = []
  }

  /**
   * Removes an item.
   * @param item The item to be removed.
   * @param dontRemove If not set, also remove the item from the items list.
   */
  public removeItem(item: Item, dontRemove?: boolean) {
    dontRemove = dontRemove || false;
    // use this for item meshes
    this.itemRemovedCallbacks.fire(item);
    item.removed();
    this.scene.remove(item);
    if (!dontRemove) {
      Utils.removeValue(this.items, item);
    }
  }

  /**
   * Creates an item and adds it to the scene.
   * @param itemType The type of the item given by an enumerator.
   * @param fileName The name of the file to load.
   * @param metadata TODO
   * @param position The initial position.
   * @param rotation The initial rotation around the y axis.
   * @param scale The initial scaling.
   * @param fixed True if fixed.
   */
  public addItem(itemType: number, fileName: string, metadata: Metadata, position?: THREE.Vector3, rotation?: number, scale?: THREE.Vector3, fixed?: boolean) {
    itemType = itemType || 1;
    var scope = this;
    // FIXME:  Make this an arrow function, get rid of scope
    var loaderCallback = function (geometry: THREE.Geometry, materials: THREE.Material[]) {
      var item = new (Factory.getClass(itemType))(
        scope.model,
        metadata, geometry,
        new THREE.MeshFaceMaterial(materials),
        position, rotation, scale
      );
      item.fixed = fixed || false;
      scope.items.push(item);
      scope.add(item);
      item.initObject();
      scope.itemLoadedCallbacks.fire(item);
    }

    this.itemLoadingCallbacks.fire();
    this.loader.load(
      fileName,
      loaderCallback,
      undefined // TODO_Ekki 
    );
  }
}
