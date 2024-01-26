
import * as THREE from 'three';
import { cmToIn, inToCm, Utils } from '../core/utils';
import { LumberYard } from './lumberyard';

export class RailSpec {
  public postStock: string = "4x4";
  public railTopStock: string = "2x4";
  public railBottomStock: string = "1x1";
  public slatStock: string = "1x1";
  public includeStartPost: boolean = true;
  public includeEndPost: boolean = true;
  public postTopInches: number = 40;
  public postBottomInches: number = -5;
  public railTopInches: number = 36;
  public railBottomInches: number = 4;
  public slatIntervalInches: number = 5;
  // startBase and endBase are in cm space
  public startBase: THREE.Vector2 = new THREE.Vector2(0, 0);
  public endBase: THREE.Vector2 = new THREE.Vector2(100, 0);
  constructor(opts?: any) {
    if (typeof opts === 'object') {
      for (const key in this) {
        if (opts.hasOwnProperty(key)) {
          this[key] = opts[key];
        }
      }
    }
  }
}

export class RailMaker {
  // TODO: constrain these to LumberYard stock types

  constructor(public lumberYard: LumberYard) {
  }
  // uses the current settings to make a 
  public makeRail(spec: RailSpec): THREE.Group {
    const group = new THREE.Group();
    if (spec.includeStartPost) {
      group.add(this.newPost(spec, spec.startBase));
    }
    if (spec.includeEndPost) {
      group.add(this.newPost(spec, spec.endBase));
    }
    
    const topStock = LumberYard.lumberDimensions.get(spec.railTopStock);
    if (!topStock) {
      throw Error(`railtopStock '${spec.railTopStock}' doesn't exist`);
    }
    const topRailCenterHeightInches = spec.railTopInches - topStock.thickness/2;
    group.add(this.newHoriz(spec, spec.railTopStock, topRailCenterHeightInches));
    const bottomStock = LumberYard.lumberDimensions.get(spec.railBottomStock);
    if (!bottomStock) {
      throw Error(`railBottomStock '${spec.railBottomStock}' doesn't exist`);
    }
    const bottomRailCenterHeightInches = spec.railBottomInches + bottomStock.thickness/2;
    group.add(this.newHoriz(spec, spec.railBottomStock, bottomRailCenterHeightInches));

    const postStock = LumberYard.lumberDimensions.get(spec.postStock);
    if (!postStock) {
      throw Error(`postStock '${spec.postStock}' doesn't exist`);
    }
    const baseDist = spec.startBase.distanceTo(spec.endBase);
    const baseDistInches = cmToIn(baseDist);
    // rail is:   
    //   1/2 post stock width
    //   offset
    //   nslats times:
    //     1/2 slatInterval
    //     slat centered here
    //     1/2 slatInterval
    //   offset
    //   1/2 post stock width
    // so postStockWidth + 2*offset + nslats*slatInterval = baseDist
    const nslats = Math.floor((baseDistInches - postStock.width)/spec.slatIntervalInches);
    const offsetInches = (baseDistInches - postStock.width - nslats*spec.slatIntervalInches)/2;
    const offset = inToCm(offsetInches);
    for (let i = 0; i < nslats; i++) {
      const interpDistInches = postStock.width/2 + offset + (i + 0.5)*spec.slatIntervalInches;
      // normalized interpolation parameter, 0 to 1
      const t = interpDistInches / baseDistInches;
      const slatloc = this.interp2(spec.startBase, spec.endBase, t);
      const slatBase = Utils.deflatten(slatloc, inToCm(bottomRailCenterHeightInches));
      const slatTop = Utils.deflatten(slatloc, inToCm(topRailCenterHeightInches));
      const slat = this.lumberYard.makeLumberFromTo(spec.slatStock, slatBase, slatTop);
      group.add(slat);
    }
    return group;
  }

  
  // t=0 means result is a1, t=1 means result is a2
  private interp1(a1: number, a2: number, t: number) {
    return (a1*(1-t)) + (a2*t);
  }
  // t=0 means result is p1, t=1 means result is p2
  private interp2(p1: THREE.Vector2, p2: THREE.Vector2, t: number) {
    return new THREE.Vector2(this.interp1(p1.x, p2.x, t), this.interp1(p1.y, p2.y, t));
  }

  private newPost(spec: RailSpec, base2: THREE.Vector2, ): THREE.Object3D {
      const postSizeInches = spec.postTopInches - spec.postBottomInches;
      const post = this.lumberYard.makeLumber(spec.postStock, postSizeInches);
      post.translateY(inToCm(spec.postTopInches - postSizeInches/2));
      post.rotateZ(Math.PI/2);
      post.position.add(Utils.deflatten(base2));
      return post;
  }
  private newHoriz(spec: RailSpec, stock: string, centerHeightInches: number): THREE.Object3D {
    const centerHeight = inToCm(centerHeightInches);
    const from = Utils.deflatten(spec.startBase, centerHeight);
    const to = Utils.deflatten(spec.endBase, centerHeight);
    return this.lumberYard.makeLumberFromTo(stock, from, to);
  }

}
