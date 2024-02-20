import * as THREE from "three";
import { Floor } from "./floor";
import { Floorplan as ModelFloorplan } from "../model/floorplan";
import { Scene } from "../model/scene";
import { LumberYard } from "./lumberyard";
import { RailMaker, RailSpec } from "./railmaker";
import { WallType } from "../model/wall";
import { Utils } from "../core/utils";
//import { Utils } from '../core/utils';

export class Floorplan {
  private floors: Floor[] = [];
  private railObjects: THREE.Object3D[] = [];
  private lumberYard = new LumberYard();
  private railMaker = new RailMaker(this.lumberYard);

  constructor(
    private scene: Scene,
    private floorplan: ModelFloorplan,
  ) {
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

    this.floors = [];
    this.railObjects = [];

    // draw floors
    this.floorplan.getRooms().forEach((room) => {
      var threeFloor = new Floor(this.scene, room);
      this.floors.push(threeFloor);
      threeFloor.addToScene();
    });

    this.floorplan.getWalls().forEach((wall) => {
      if (wall.wallType == WallType.Railing) {
        // if it's too long, break it up.
        const MAX_RAIL_LENGTH_FEET = 8;
        const MAX_RAIL_LENGTH_CM = MAX_RAIL_LENGTH_FEET * 12 * 2.54;

        const segments = Math.ceil((wall.length() + 0.001) / MAX_RAIL_LENGTH_CM);

        for (let seg = 0; seg < segments; seg++) {
          const start_t = seg / segments;
          const end_t = (seg + 1)/segments;
          const startBase = Utils.interp2(wall.start, wall.end, start_t);
          const endBase = Utils.interp2(wall.start, wall.end, end_t);
          const spec = new RailSpec({ startBase, endBase });
          const rails = this.railMaker.makeRail(spec);
          rails.userData = wall;
          this.railObjects.push(rails);
          this.scene.add(rails);
        }

      }
    });
  }
}
