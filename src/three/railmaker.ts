
import * as THREE from 'three';
import LumberYard from './lumberyard';

export class RailMaker {
  public lumberYard: LumberYard;
  public up: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  // TODO: constrain these to LumberYard stock types
  public postStock: string = "4x4";
  public railTopStock: string = "2x4";
  public railBottomStock: string = "1x1";
  public slatStock: string = "1x1";
  public includeStartPost: boolean = true;
  public includeEndPost: boolean = true;
  public postTopInches: number = 40;
  public railTopInches: number = 36;
  public railBottomInches: number = 4;
  public slatIntervalInches: number = 5;
  public startBase: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public endBase: THREE.Vector3 = new THREE.Vector3(100,0,0);

  constructor() {
  }
  // uses the current settings to make a 
  public makeRail(): THREE.Group {
    const group = new THREE.Group();
    if (this.includeStartPost) {
      group.add(this.newPost(startBase));
    }
    if (this.includeEndPost) {
      group.add(this.newPost(endBase));
    }
  }

  private newPost(base: THREE.Vector3) {
     
  }

}
