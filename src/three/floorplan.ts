import * as THREE from 'three';
import { Floor } from './floor';
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
    this.railObjects.forEach((obj) => {
      this.scene.scene.remove(obj);
    });

    this.edges.forEach((edge) => {
      edge.remove();
    });
    this.floors = [];
    this.edges = [];
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

    this.floorplan.getWalls().forEach((wall) => {
      const start = wall.getStart();
      const end = wall.getEnd();
      const startBase = start.position();
      const endBase = end.position(); 
      const spec = new RailSpec({ startBase, endBase });
      const rails = this.railMaker.makeRail(spec);
      this.railObjects.push(rails);
      this.scene.add(rails);
    });
  }
}
