import * as THREE from 'three';
import { Scene } from '../model/scene';
import { Floorplan as ModelFloorplan } from '../model/floorplan';
import { Utils } from '../core/utils';

export class Lights {

  private tol: number = 1;
  private height: number = 300; // TODO: share with Blueprint.Wall

  private dirLight: THREE.DirectionalLight;


  // function contents here used to be in init()
  constructor(private scene: Scene, private floorplan: ModelFloorplan) {
    var light = new THREE.HemisphereLight(0xffffff, 0x888888, 1.1);
    light.position.set(0, this.height, 0);
    this.scene.add(light);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0);
    this.dirLight.color.setHSL(1, 1, 0.1);

    this.dirLight.castShadow = true;

    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;

    const camera = this.dirLight.shadow.camera;
    if (camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera) {
      camera.far = this.height + this.tol;
    }
    this.dirLight.shadow.bias = -0.0001;
    // FIXME: shadowDarkness field has disappeared in 0.69 -> 0.81.  Fix?
    //this.dirLight.shadowDarkness = 0.2;
    this.dirLight.visible = true;
    // FIXME: This is now "legacy".
    //this.dirLight.shadowCameraVisible = false;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.floorplan.fireOnUpdatedRooms(() => this.updateShadowCamera());
  }
  private updateShadowCamera() {

    var size2 = this.floorplan.getSize2();
    var d = (Math.max(size2.x, size2.y) + this.tol) / 2.0;

    const center2 = this.floorplan.getCenter2();
    
    // FIXME: CoordinateConfusion
    const pos = Utils.deflatten(center2, this.height);
    this.dirLight.position.copy(pos);
    this.dirLight.target.position.copy(Utils.deflatten(center2));
    //dirLight.updateMatrix();
    //dirLight.updateWorldMatrix()
    const c = this.dirLight.shadow.camera;
    if (c instanceof THREE.OrthographicCamera) {
      c.left = -d;
      c.right = d;
      c.top = d;
      c.bottom = -d;
    } else {
      throw Error("shadow camera is not OrthographicCamera");
    }
    if (typeof c?.updateProjectionMatrix === 'function') {
      c.updateProjectionMatrix();
    }
  }

  // FIXME: This is extremely sketch.
  //init();
}
