/// <reference path="../../lib/three.d.ts" />
/// <reference path="floor.ts" />
/// <reference path="../items/item.ts" />
/// <reference path="edge.ts" />

module BP3D.Three {
  export class Floorplan {

    private floors: Three.Floor[] = [];
    private edges: Three.Edge[] = [];
    private kenObjects: Items.Item[] = [];

    constructor(private scene: Model.Scene, private floorplan: Model.Floorplan, private controls: Three.Controls) {
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
        var threeFloor = new Three.Floor(scope.scene, room);
        scope.floors.push(threeFloor);
        threeFloor.addToScene();
      });

      // not doing this since we have real rails now.
      if (false) {
        // draw edges
        this.floorplan.wallEdges().forEach((edge) => {
          var threeEdge = new Three.Edge(
            scope.scene, edge, scope.controls);
          scope.edges.push(threeEdge);
        });
      }

      // FIXME: this Factory thing is stupid, it just discards all the 
      //    type info that causes a typescript compile error.  The type 
      //    errors should be fixed.
      // 1: Items.FloorItem,
      // 2: Items.WallItem,
      // 3: Items.InWallItem,
      // 7: Items.InWallFloorItem,
      // 8: Items.OnFloorItem,
      // 9: Items.WallFloorItem
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
}
