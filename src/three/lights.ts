import THREE from 'three';
import { Scene } from '../model/scene';
import { Floorplan as ModelFloorplan } from '../model/floorplan';

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

    this.dirLight.shadowMapWidth = 1024;
    this.dirLight.shadowMapHeight = 1024;

    this.dirLight.shadowCameraFar = this.height + this.tol;
    this.dirLight.shadowBias = -0.0001;
    // FIXME: shadowDarkness field has disappeared in 0.69 -> 0.81.  Fix?
    //this.dirLight.shadowDarkness = 0.2;
    this.dirLight.visible = true;
    // FIXME: This is now "legacy".
    //this.dirLight.shadowCameraVisible = false;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.floorplan.fireOnUpdatedRooms(() => this.updateShadowCamera());
  }
  private getDirLight() {
    return this.dirLight;
  }

  private updateShadowCamera() {

    var size = this.floorplan.getSize();
    var d = (Math.max(size.z, size.x) + this.tol) / 2.0;

    var center = this.floorplan.getCenter();
    var pos = new THREE.Vector3(
      center.x, this.height, center.z);
    this.dirLight.position.copy(pos);
    this.dirLight.target.position.copy(center);
    //dirLight.updateMatrix();
    //dirLight.updateWorldMatrix()
    this.dirLight.shadowCameraLeft = -d;
    this.dirLight.shadowCameraRight = d;
    this.dirLight.shadowCameraTop = d;
    this.dirLight.shadowCameraBottom = -d;
    // this is necessary for updates
    const camera = this.dirLight?.shadow?.camera;
    if (camera instanceof THREE.OrthographicCamera) {
      // assume camera is orthographiccamera   
      const c = camera as THREE.OrthographicCamera;
      c.left = this.dirLight.shadowCameraLeft;
      c.right = this.dirLight.shadowCameraRight;
      c.top = this.dirLight.shadowCameraTop;
      c.bottom = this.dirLight.shadowCameraBottom;
      c.updateProjectionMatrix();
    }
  }

  // FIXME: This is extremely sketch.
  //init();
}
