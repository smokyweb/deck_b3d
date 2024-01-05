import * as THREE from 'three';
import { Floor } from './floor';
import { Item } from '../items/item';
import { Edge } from './edge';
import { Controls } from './controls';
import { Floorplan as ModelFloorplan } from '../model/floorplan';
import { Scene } from '../model/scene';
import { LumberYard } from './lumberyard';
import { RailMaker, RailSpec } from './railmaker';
//import { Utils } from '../core/utils';

export class Floorplan {

  private floors: Floor[] = [];
  private edges: Edge[] = [];
  private kenObjects: Item[] = [];
  private railObjects: THREE.Object3D[] = [];
  private lumberYard = new LumberYard();
  private railMaker = new RailMaker(this.lumberYard);

  constructor(private scene: Scene, private floorplan: ModelFloorplan, private controls: Controls) {
    this.floorplan.fireOnUpdatedRooms(() => this.redraw());
  }

  private redraw() {
    // clear scene
    this.floors.forEach((floor) => {
      floor.removeFromScene();
    });
    this.kenObjects.forEach((item) => {
      this.scene.removeItem(item);
    });
    this.railObjects.forEach((obj) => {
      this.scene.scene.remove(obj);
    });

    this.edges.forEach((edge) => {
      edge.remove();
    });
    this.floors = [];
    this.edges = [];
    this.kenObjects = [];
    this.railObjects = [];

    // draw floors
    this.floorplan.getRooms().forEach((room) => {
      var threeFloor = new Floor(this.scene, room);
      this.floors.push(threeFloor);
      threeFloor.addToScene();
    });

    // not doing this since we have real rails now.
    if (false) {
      // draw edges
      this.floorplan.wallEdges().forEach((edge) => {
        var threeEdge = new Edge(
          this.scene, edge, this.controls);
        this.edges.push(threeEdge);
      });
    }

    // FIXME: this Factory thing is stupid, it just discards all the 
    //    type info that causes a typescript compile error.  The type 
    //    errors should be fixed.
    // 1: FloorItem,
    // 2: WallItem,
    // 3: InWallItem,
    // 7: InWallFloorItem,
    // 8: OnFloorItem,
    // 9: WallFloorItem
    this.floorplan.getWalls().forEach((wall) => {
      // this code mostly copied from model/scene/addItem, but 
      // can't use that call because it reloads the urls every time.
//      const item = this.scene.makeRailItem(wall);
//      if (item) {
//        this.kenObjects.push(item);
//        this.scene.items.push(item);
//        this.scene.add(item);
//        this.scene.itemLoadedCallbacks.fire(item);
//      } else {
//      }
      
      const start = wall.getStart();
      const end = wall.getEnd();
      const startBase = start.position();
      const endBase = end.position(); 
      const postTopInches = 42;
      const spec = new RailSpec({ startBase, endBase, postTopInches});
      const rails = this.railMaker.makeRail(spec);
      this.railObjects.push(rails);
      this.scene.add(rails);
    });
  }
}
