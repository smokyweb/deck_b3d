import * as THREE from 'three';
import { Floor } from './floor';
import { Item } from '../items/item';
import { Edge } from './edge';
import { Controls } from './controls';
import { Floorplan as ModelFloorplan } from '../model/floorplan';
import { Scene } from '../model/scene';

export class Floorplan {

  private floors: Floor[] = [];
  private edges: Edge[] = [];
  private kenObjects: Item[] = [];

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

    this.edges.forEach((edge) => {
      edge.remove();
    });
    this.floors = [];
    this.edges = [];
    this.kenObjects = [];

    const scope = this;
    // draw floors
    this.floorplan.getRooms().forEach((room) => {
      var threeFloor = new Floor(scope.scene, room);
      scope.floors.push(threeFloor);
      threeFloor.addToScene();
    });

    // not doing this since we have real rails now.
    if (false) {
      // draw edges
      this.floorplan.wallEdges().forEach((edge) => {
        var threeEdge = new Edge(
          scope.scene, edge, scope.controls);
        scope.edges.push(threeEdge);
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
      const item = scope.scene.makeRailItem(wall);
      if (item) {
        scope.kenObjects.push(item);
        scope.scene.items.push(item);
        scope.scene.add(item);
        scope.scene.itemLoadedCallbacks.fire(item);
      } else {
      }
    });
  }
}
