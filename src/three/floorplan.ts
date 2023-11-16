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
      console.log("THREE.Floorplan.redraw()");
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

      // draw edges
      scope.floorplan.wallEdges().forEach((edge) => {
        var threeEdge = new Three.Edge(
          scene, edge, scope.controls);
        scope.edges.push(threeEdge);
      });

      // FIXME: this Factory thing is stupid, it just discards all the 
      //    type info that causes a typescript compile error.  The type 
      //    errors should be fixed.
      const itemClass = Items.Factory.getClass(8); // 8 == floorItem
      scope.floorplan.getWalls().forEach((wall) => {
        // stick a sphere on it.
        // this code is based on the loader callback in Model.Scene.addItem()
        const geometry = new THREE.SphereGeometry( 15, 32, 16 ); 
        const material = new THREE.MeshBasicMaterial( { color: 0xaa00aa } ); 
        const pos = midpoint(wall.start, wall.end);
        const item = new itemClass(scene.model, {}, geometry, material, {x: pos.x, y: wall.height/2, z: pos.y}, 0, new THREE.Vector3(5, 5, 5));

        scope.kenObjects.push(item);
        scope.scene.add(item);
        item.initObject();
        scope.scene.itemLoadedCallbacks.fire(item);
        console.log("done with item", item);
      });
    }
    function midpoint(p1: {x: number, y: number}, p2: {x: number, y: number}): {x: number, y: number} 
    {
      return { x: (p1.x + p2.x)*0.5, y: (p1.y + p2.y)*0.5 }
    }
  }
}
