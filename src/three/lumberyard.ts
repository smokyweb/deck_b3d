
import * as THREE from 'three';

function inToCm(inches: number): number {
  return inches*2.54;
}

// @ts-ignore: I'm sure this will be useful
function cmToIn(cm: number): number {
  return cm/2.54;

}

export interface LumberGirth {
  // These are cross-grain dimensions.  Width is typically the longer one.
  width: number, thickness: number, 
}

export class LumberYard {
  
  private sidegrain: THREE.Texture;

  private static lumberDimensions: Map<string, LumberGirth> = new Map( 
    [ ["1x2", { width: 1.5, thickness: 0.75 }],
      ["1x3", { width: 2.5, thickness: 0.75 }],
      ["1x4", { width: 3.5, thickness: 0.75 }],
      ["1x5", { width: 4.5, thickness: 0.75 }],
      ["1x6", { width: 5.5, thickness: 0.75 }],
      ["1x8", { width: 7.25, thickness: 0.75 }],
      ["1x10", { width: 9.25, thickness: 0.75 }],
      ["1x12", { width: 11.25, thickness: 0.75 }],
      ["2x2", { width: 1.5, thickness: 1.5 }],
      ["2x3", { width: 2.5, thickness: 1.5 }],
      ["2x4", { width: 3.5, thickness: 1.5 }],
      ["2x6", { width: 5.5, thickness: 1.5 }],
      ["2x8", { width: 7.25, thickness: 1.5 }],
      ["2x10", { width: 9.25, thickness: 1.5 }],
      ["2x12", { width: 11.25, thickness: 1.5 }],
      ["4x4", { width: 3.5, thickness: 3.5 }],
      ["4x6", { width: 5.5, thickness: 3.5 }],
      ["6x6", { width: 5.5, thickness: 5.5 }],
    ]);
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

  constructor() {
    const loader = new THREE.TextureLoader();
    this.sidegrain = loader.load("textures/sidegrain01.jpg");
  }
 
  // returns piece of lumber, centered at origin, length is along x axis, width is y axis,
  // thickness is z axis
  public makeLumber(nomDimension: string, lengthInches: number): THREE.Mesh {
    const size = LumberYard.lumberDimensions.get(nomDimension);
    if (!size) {
      throw Error(`Invalid lumber dimension '${nomDimension}'`);
    }
    return this.makeWood(lengthInches, size.width, size.thickness);
  }
  public makeWood(lengthInches: number, widthInches: number, heightInches: number): THREE.Mesh {
    // TODO: custom BufferGeometry with wood texture subsampling from sidegrain
    const box = new THREE.BoxGeometry(inToCm(lengthInches), inToCm(widthInches), inToCm(heightInches));
    const texture = new THREE.MeshBasicMaterial({ map: this.sidegrain, color: 0x00ff00 });
    return new THREE.Mesh(box, texture);
  }

}
