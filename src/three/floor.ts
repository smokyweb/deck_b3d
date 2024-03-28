import * as THREE from "three";
import { Scene } from "../model/scene";
import { Room } from "../model/room";
import * as CSG from "csg";
import { csgToBlueMesh } from "../core/csgutil";
import { LumberYard } from "./lumberyard";
import { inToCm, degToRad, Utils } from "../core/utils";

export class Floor {
  private floorPlane: THREE.Mesh | null = null;
  private floorTexture: THREE.Texture | null = null;
  private floorClip: THREE.Object3D | null = null;
  private floorBoards: THREE.Group = new THREE.Group();

  constructor(private scene: Scene, private room: Room, private lumberyard: LumberYard) {
    this.room.fireOnFloorChange(() => this.redraw);
    this.build();
    // roofs look weird, so commented out
  }

  private build() {
    this.floorPlane = this.buildFloor();
    this.floorClip = this.buildFloorClip();
    this.scene.add(this.floorPlane);
    this.buildFloorBoards();
    this.scene.remove(this.floorPlane);
  }

  private redraw() {
    this.removeFromScene();
    this.build();
    this.addToScene();
  }

  private static experiment() {
    const mat: THREE.Matrix4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.2);
    const translation = new THREE.Vector3(0.1, 0.2, 0.3);
    const scale = new THREE.Vector3(1, 1, 1);

    mat.compose(translation, q, scale);
    console.log("mat: ", mat);
    console.log("mat.elements:", mat.elements);
  }


  private buildFloorBoards() {
    Floor.experiment();
    {
      const children = this.floorBoards.children.slice();
      children.forEach((child) => {
        this.floorBoards.remove(child);
      });
    }
    const floorboardAngleDeg = 30;
    const floorboardAngleRad = degToRad(floorboardAngleDeg);
    const fp = this.floorPlane;
    const floorStock = "2x8";
    const gapInches = 0.25;
    const gapCm = inToCm(gapInches);
    const dim = LumberYard.lumberDimensions.get(floorStock);


    if (!fp) {
      console.error("floorPlane is null");
      return;
    }
    if (!dim)  {
      console.error("dim is null");
      return;
    }
    console.log("fp: ", fp);
    fp.updateMatrix();
    fp.geometry.computeBoundingSphere();
    const bs = fp.geometry.boundingSphere.clone();
    bs.applyMatrix4(fp.matrix);

    console.log("boundingSphere: ", bs);
    const floorCenter = new THREE.Vector2(bs.center.x, bs.center.z);
    const floorRadius = bs.radius;
    const alongAxisUnit = new THREE.Vector2(Math.cos(floorboardAngleRad), Math.sin(floorboardAngleRad));
    const crossAxisUnit = new THREE.Vector2(-alongAxisUnit.y, alongAxisUnit.x);
    let distFromStart = 0;
    const startPoint = floorCenter.clone().addScaledVector(crossAxisUnit, -floorRadius);
    const boardWidthCm = inToCm(dim.width);
    const thicknessCm = inToCm(dim.thickness);
    const step = boardWidthCm + gapCm + 0.003;
    console.log(`floorRadius=${floorRadius}`);
    console.log("startPoint: ", startPoint);

    while (distFromStart < 2*floorRadius) {
      //console.log(`distFromStart = ${distFromStart}`);
      const centerPoint = startPoint.clone().addScaledVector(crossAxisUnit, distFromStart + boardWidthCm/2);
      const from = Utils.deflatten(centerPoint.clone().addScaledVector(alongAxisUnit, -floorRadius), -thicknessCm);
      const to = Utils.deflatten(centerPoint.clone().addScaledVector(alongAxisUnit, floorRadius), -thicknessCm);;
      const lumber = this.lumberyard.makeLumberFromTo(floorStock, from, to, Math.PI/2);
      this.floorBoards.add(lumber);
      if (this.floorBoards.children.length == 1) {
        console.log("added floorboard ", lumber);
      }
      distFromStart += step;
    }
  }

  private buildFloor() {
    var textureSettings = this.room.getTexture();
    // setup texture
    const textureLoader = new THREE.TextureLoader();
    // FIXME: Every instance of floor loads the texture again.  Should cache and share.
    this.floorTexture = textureLoader.load(
      textureSettings.url,
      (_t: THREE.Texture) => {
        this.scene.needsUpdate = true;
      }
    );
    this.floorTexture.wrapS = THREE.RepeatWrapping;
    this.floorTexture.wrapT = THREE.RepeatWrapping;
    this.floorTexture.repeat.set(1, 1);
    var floorMaterialTop = new THREE.MeshPhongMaterial({
      map: this.floorTexture,
      side: THREE.DoubleSide,
      // ambient: 0xffffff, TODO_Ekki
      color: 0xcccccc,
      specular: 0x0a0a0a,
    });

    var textureScale = textureSettings.scale;
    // http://stackoverflow.com/questions/19182298/how-to-texture-a-three-js-mesh-created-with-shapegeometry
    // scale down coords to fit 0 -> 1, then rescale

    var points: THREE.Vector2[] = [];
    this.room.corners.forEach((corner) => {
      console.log("floor corner ", corner);
      points.push(
        new THREE.Vector2(corner.x / textureScale, corner.y / textureScale)
      );
    });
    var shape = new THREE.Shape(points);

    var geometry = new THREE.ShapeGeometry(shape);

    var floor = new THREE.Mesh(geometry, floorMaterialTop);

    floor.rotation.set(Math.PI / 2, 0, 0);
    floor.scale.set(textureScale, textureScale, textureScale);
    floor.receiveShadow = true;
    floor.castShadow = false;
    console.log("floor is ", floor);
    return floor;
  }

  private buildFloorClip(): THREE.Object3D {
    const csg: CSG.CSG = this.room.csgClipRegion();
    //console.log("floor csg is", csg);
    const mesh: THREE.Object3D = csgToBlueMesh(csg);
    return mesh;
  }

  //  private buildRoof() {
  //    // setup texture
  //    var roofMaterial = new THREE.MeshBasicMaterial({
  //      side: THREE.FrontSide,
  //      color: 0xe5e5e5
  //    });
  //
  //    var points: THREE.Vector2[] = [];
  //    this.room.interiorCorners.forEach((corner) => {
  //      points.push(new THREE.Vector2(
  //        corner.x,
  //        corner.y));
  //    });
  //    var shape = new THREE.Shape(points);
  //    var geometry = new THREE.ShapeGeometry(shape);
  //    var roof = new THREE.Mesh(geometry, roofMaterial);
  //
  //    roof.rotation.set(Math.PI / 2, 0, 0);
  //    roof.position.y = 250;
  //    return roof;
  //  }

  public addToScene() {
    console.log("floor.addToScene");
    if (this.floorPlane) {
      this.scene.add(this.floorPlane);
    }
    // hack so we can do intersect testing
    if (this.room.floorPlane) {
      this.scene.add(this.room.floorPlane);
    }
    if (this.floorClip) {
      //this.scene.add(this.floorClip);
    }
    this.scene.add(this.floorBoards);
  }

  public removeFromScene() {
    console.log("floor.removeFromScene");
    if (this.floorPlane) {
      this.scene.remove(this.floorPlane);
    }
    this.floorTexture?.dispose();
    if (this.room.floorPlane) {
      this.scene.remove(this.room.floorPlane);
    }
    if (this.floorClip) {
      this.scene.remove(this.floorClip);
    }
    this.scene.remove(this.floorBoards);
  }
}
