/// <reference path="../../lib/three.d.ts" />
/// <reference path="floor.ts" />
/// <reference path="edge.ts" />

module BP3D.Three {
  export var Floorplan = function (scene: Model.Scene, floorplan: Model.Floorplan, controls) {
    console.log("THREE.Floorplan.init");

    var scope = this;

    this.scene = scene;
    this.floorplan = floorplan;
    this.controls = controls;

    this.floors = [];
    this.edges = [];
    this.kenObjects = [];

    floorplan.fireOnUpdatedRooms(redraw);

    function redraw() {
      console.log("THREE.Floorplan.redraw() entry", scope.scene);
      // clear scene
      scope.floors.forEach((floor) => {
        floor.removeFromScene();
      });
      scope.kenObjects.forEach((item) => {
        scope.scene.removeItem(item);
      });

      scope.edges.forEach((edge) => {
        edge.remove();
      });
      scope.floors = [];
      scope.edges = [];
      scope.kenObjects = [];

      // draw floors
     scope.floorplan.getRooms().forEach((room) => {
        var threeFloor = new Three.Floor(scene, room);
        scope.floors.push(threeFloor);
        threeFloor.addToScene();
      });

      // not doing this since we have real rails now.
      if (false) {
        // draw edges
        scope.floorplan.wallEdges().forEach((edge) => {
          var threeEdge = new Three.Edge(
            scene, edge, scope.controls);
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
      scope.floorplan.getWalls().forEach((wall) => {
        // this code mostly copied from model/scene/addItem, but 
        // can't use that call because it reloads the urls every time.
        const item = scope.scene.makeRailItem(wall);
        if (item) {
          console.log("made rail item ", item);

          scope.kenObjects.push(item);
          scope.scene.items.push(item);
          scope.scene.add(item);
          scope.scene.itemLoadedCallbacks.fire(item);
        } else {
          console.log("railItem not made");
        }
      });
      console.log("THREE.Floorplan.redraw() exit", scope.scene);
    }
  }
}
