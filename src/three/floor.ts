import * as THREE from "three";
import { Scene } from "../model/scene";
import { Room } from "../model/room";
import * as CSG from "csg";
import { csgToBlueMesh } from "../core/csgutil";

export class Floor {
  private floorPlane: THREE.Mesh | null = null;
  private floorTexture: THREE.Texture | null = null;
  private floorClip: THREE.Object3D | null = null;

  constructor(private scene: Scene, private room: Room) {
    this.room.fireOnFloorChange(() => this.redraw);
    this.build();
    // roofs look weird, so commented out
  }

  private build() {
    this.floorPlane = this.buildFloor();
    this.floorClip = this.buildFloorClip();
  }

  private redraw() {
    this.removeFromScene();
    this.build();
    this.addToScene();
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
    if (this.floorPlane) {
      this.scene.add(this.floorPlane);
    }
    // hack so we can do intersect testing
    if (this.room.floorPlane) {
      this.scene.add(this.room.floorPlane);
    }
    if (this.floorClip) {
      this.scene.add(this.floorClip);
    }
  }

  public removeFromScene() {
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
  }
}
