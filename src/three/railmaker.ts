
import * as THREE from 'three';
import { Utils } from '../core/utils';
import { LumberYard } from './lumberyard';

export class RailSpec {
  public postStock: string = "4x4";
  public railTopStock: string = "2x4";
  public railBottomStock: string = "1x1";
  public slatStock: string = "1x1";
  public includeStartPost: boolean = true;
  public includeEndPost: boolean = true;
  public postTopInches: number = 40;
  public postBottomInches: number = -30;
  public railTopInches: number = 36;
  public railBottomInches: number = 4;
  public slatIntervalInches: number = 5;
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
    const topRailCenterHeight = spec.railTopInches - topStock.thickness/2;
    group.add(this.newHoriz(spec, spec.railTopStock, topRailCenterHeight));
    const bottomStock = LumberYard.lumberDimensions.get(spec.railBottomStock);
    if (!bottomStock) {
      throw Error(`railBottomStock '${spec.railBottomStock}' doesn't exist`);
    }
    const bottomRailCenterHeight = spec.railBottomInches + bottomStock.thickness/2;
    group.add(this.newHoriz(spec, spec.railBottomStock, bottomRailCenterHeight));

    const postStock = LumberYard.lumberDimensions.get(spec.postStock);
    if (!postStock) {
      throw Error(`postStock '${spec.postStock}' doesn't exist`);
    }
    const basedist = spec.startBase.distanceTo(spec.endBase);
    // rail is:   
    //   1/2 post stock width
    //   offset
    //   nslats times:
    //     1/2 slatInterval
    //     slat centered here
    //     1/2 slatInterval
    //   offset
    //   1/2 post stock width
    // so postStockWidth + 2*offset + nslats*slatInterval = basedist
    const nslats = Math.floor((basedist - postStock.width)/spec.slatIntervalInches);
    const offset = (basedist - postStock.width - nslats*spec.slatIntervalInches)/2;
    for (let i = 0; i < nslats; i++) {
      const interpdist = postStock.width/2 + offset + i*spec.slatIntervalInches;
      // normalized interpolation parameter, 0 to 1
      const t = interpdist / basedist;
      const slatloc = this.interp2(spec.startBase, spec.endBase, t);
      const slatBase = Utils.deflatten(slatloc, bottomRailCenterHeight);
      const slatTop = Utils.deflatten(slatloc, topRailCenterHeight);
      const slat = this.lumberYard.makeLumberFromTo(spec.slatStock, slatBase, slatTop);
      group.add(slat);
    }
    return group;
  }

  
  private interp1(a1: number, a2: number, x: number) {
    return (a1*x) + (a2*(1-x));
  }
  private interp2(p1: THREE.Vector2, p2: THREE.Vector2, t: number) {
    return new THREE.Vector2(this.interp1(p1.x, p2.x, t), this.interp1(p1.y, p2.y, t));
  }

  private newPost(spec: RailSpec, base2: THREE.Vector2, ): THREE.Mesh {
      const postSizeInches = spec.postTopInches - spec.postBottomInches;
      const post = this.lumberYard.makeLumber(spec.postStock, postSizeInches);
      post.translateY(spec.postTopInches - postSizeInches/2);
      post.rotateZ(Math.PI/2);
      post.position.add(Utils.deflatten(base2));
      return post;
  }
  private newHoriz(spec: RailSpec, stock: string, centerHeight: number): THREE.Mesh {
    const from = Utils.deflatten(spec.startBase, centerHeight);
    const to = Utils.deflatten(spec.endBase, centerHeight);
    return this.lumberYard.makeLumberFromTo(stock, from, to);
  }

}
