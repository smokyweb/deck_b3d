
import * as THREE from 'three';
import { inToCm, cmToIn } from '../core/utils';


export interface LumberDim {
  // These are cross-grain dimensions.  Width is typically the longer one.
    width: number; 
    thickness: number; 
    nominalDim: string;
  };



export class LumberYard {
  
  // @ts-ignore
  private sidegrain: THREE.Texture;

//  from https://www.lowes.com/n/how-to/nominal-actual-lumber-sizes
//  Nominal: 1 x 2 Actual Size: 3/4 x 1-1/2
//  Nominal: 1 x 3 Actual Size: 3/4 x 2-1/2
//  Nominal: 1 x 4 Actual Size: 3/4 x 3-1/2
//  Nominal: 1 x 5 Actual Size: 3/4 x 4-1/2
//  Nominal: 1 x 6 Actual Size: 3/4 x 5-1/2
//  Nominal: 1 x 8 Actual Size: 3/4 x 7-1/4
//  Nominal: 1 x 10 Actual Size: 3/4 x 9-1/4
//  Nominal: 1 x 12 Actual Size: 3/4 x 11-1/4
//  Nominal: 2 x 2 Actual Size: 1-1/2 x 1-1/2
//  Nominal: 2 x 3 Actual Size: 1-1/2 x 2-1/2
//  Nominal: 2 x 4 Actual Size: 1-1/2 x 3-1/2
//  Nominal: 2 x 6 Actual Size: 1-1/2 x 5-1/2
//  Nominal: 2 x 8 Actual Size: 1-1/2 x 7-1/4
//  Nominal: 2 x 10 Actual Size: 1-1/2 x 9-1/4
//  Nominal: 2 x 12 Actual Size: 1-1/2 x 11-1/4
//  Nominal: 4 x 4 Actual Size: 3-1/2 x 3-1/2
//  Nominal: 4 x 6 Actual Size: 3-1/2 x 5-1/2
//  Nominal: 6 x 6 Actual Size: 5-1/2 x 5-1/2
  public static readonly lumberDimensions: Map<string, LumberDim> = 
   new Map<string, LumberDim>([ 
      ["1x1", { nominalDim: "1x1", width: 0.75, thickness: 0.75 }],
      ["1x2", { nominalDim: "1x2", width: 1.5, thickness: 0.75 }],
      ["1x3", { nominalDim: "1x3", width: 2.5, thickness: 0.75 }],
      ["1x4", { nominalDim: "1x4", width: 3.5, thickness: 0.75 }],
      ["1x5", { nominalDim: "1x5", width: 4.5, thickness: 0.75 }],
      ["1x6", { nominalDim: "1x6", width: 5.5, thickness: 0.75 }],
      ["1x8", { nominalDim: "1x8", width: 7.25, thickness: 0.75 }],
      ["1x10", { nominalDim: "1x10", width: 9.25, thickness: 0.75 }],
      ["1x12", { nominalDim: "1x12", width: 11.25, thickness: 0.75 }],
      ["2x2", { nominalDim: "2x2", width: 1.5, thickness: 1.5 }],
      ["2x3", { nominalDim: "2x3", width: 2.5, thickness: 1.5 }],
      ["2x4", { nominalDim: "2x4", width: 3.5, thickness: 1.5 }],
      ["2x6", { nominalDim: "2x6", width: 5.5, thickness: 1.5 }],
      ["2x8", { nominalDim: "2x8", width: 7.25, thickness: 1.5 }],
      ["2x10", { nominalDim: "2x10", width: 9.25, thickness: 1.5 }],
      ["2x12", { nominalDim: "2x12", width: 11.25, thickness: 1.5 }],
      ["4x4", { nominalDim: "4x4", width: 3.5, thickness: 3.5 }],
      ["4x6", { nominalDim: "4x6", width: 5.5, thickness: 3.5 }],
      ["6x6", { nominalDim: "6x6", width: 5.5, thickness: 5.5 }]]);
  

  constructor() {
    const loader = new THREE.TextureLoader();
    this.sidegrain = loader.load("textures/sidegrain01.jpg");
  }
 
  // returns piece of lumber, centered at origin, length is along x axis, width is y axis,
  // thickness is z axis
  public makeLumber(nomDimension: string, lengthInches: number): THREE.Object3D {
    const size = LumberYard.lumberDimensions.get(nomDimension);
    if (!size) {
      throw Error(`Invalid lumber dimension '${nomDimension}'`);
    }
    return this.makeWoodInches(lengthInches, size.width, size.thickness);
  }
  // from and to are in the cm model space.
  public makeLumberFromTo(nomDimension: string, 
              from: THREE.Vector3, to: THREE.Vector3, 
              side?: boolean): THREE.Object3D 
  {
    side = side || false;
    const length = from.distanceTo(to);
    const lengthInches = cmToIn(length);
    // now making a transform to put the lumber in the right place.
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const shadowLength = Math.sqrt(dx*dx + dz*dz);
    const shadowAngle = -Math.atan2(dz, dx);
    const elevationAngle = Math.atan2(dy, shadowLength);
    const res = this.makeLumber(nomDimension, lengthInches);
    res.position.x = (from.x + dx/2);
    res.position.y = (from.y + dy/2);
    res.position.z = (from.z + dz/2);
    res.rotateY(shadowAngle);
    res.rotateZ(elevationAngle);
    if (side) {
      res.rotateX(Math.PI/2);
    }

    return res;
  }
  public makeWoodInches(lengthInches: number, widthInches: number, heightInches: number, outline: boolean = false): THREE.Object3D {
    return this.makeWood(inToCm(lengthInches), inToCm(widthInches), inToCm(heightInches), outline);
  }
  // Arguments are in cm.
  public makeWood(length: number, width: number, height: number, outline: boolean = false): THREE.Object3D {
    // TODO: custom BufferGeometry with wood texture subsampling from sidegrain
    const box = new THREE.BoxBufferGeometry(length, width, height);
    const texture = new THREE.MeshBasicMaterial({ map: this.sidegrain });
    const lumber = new THREE.Mesh(box, texture);
    const results: THREE.Object3D[] = [lumber];
    if (outline) {
      const edgeGeo = new THREE.EdgesGeometry(box, 1),
      line = new THREE.Line(edgeGeo,
                      new THREE.LineBasicMaterial({ color: 0x000000 }));
      results.push(line);
    }
    if (results.length == 1) {
      return results[0];
    } else {
      const group = new THREE.Group();
      results.forEach((r) => group.add(r));
      return group;
    }
  }

}
