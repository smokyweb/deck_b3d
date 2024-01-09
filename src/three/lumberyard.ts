
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
  private count: number = 0;

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
  private textureSizeInches = 100; // range 0.0 to 1.0 represents 100 inches on the texture (a guess). 
  

  constructor() {
    const loader = new THREE.TextureLoader();
    //this.sidegrain = loader.load("textures/sidegrain01.jpg");
    this.sidegrain = loader.load("textures/zebra.jpg");
    this.sidegrain.wrapS = this.sidegrain.wrapT = THREE.MirroredRepeatWrapping;
  }

  // width, depth, height:  x, y, and z dimensions of box
  // s, t:  starting coordinate in texture
  private retextureBox(geom: THREE.BoxBufferGeometry, width: number, height: number, depth: number,
    s?: number, t?: number) 
  {
    if (typeof s === 'undefined') {
      s = Math.random();
    }
    if (typeof t === 'undefined') {
      t = Math.random();
    }

    const uvattr = geom.getAttribute('uv');
    const vertices = geom.getAttribute('position').array;
    const normals = geom.getAttribute('normal').array;
    const sdelta = cmToIn(width) / this.textureSizeInches;
    const y_vdelta = cmToIn(height) / this.textureSizeInches;
    const z_vdelta = cmToIn(depth) / this.textureSizeInches;

    const nnodes = vertices.length / 3; 
    if (nnodes != 24) {
      throw Error(`bad number of vertices (${nnodes})`);
    }
    const norm = new THREE.Vector3();
    const vert = new THREE.Vector3();
    for (let i = 0; i < nnodes; i++) {
      const o3 = i*3; // offset into vertices and normals arrays
      //const o2 = i*2; // offset into uvs array
      norm.x = normals[o3+0];
      norm.y = normals[o3+1];
      norm.z = normals[o3+2];
      vert.x = vertices[o3 + 0];
      vert.y = vertices[o3 + 1];
      vert.z = vertices[o3 + 2];
      // Figure out which face we're on, and set the appropriate texture coordinate
      if (Math.abs(norm.x) < 0.1) { // not nx or px face
        let u = s;
        let v = t;
        if (vert.x > 0) {
          u += sdelta;
        }
        if (norm.z > 0.9) { // pz face
          if (vert.y < 0) {
            v += y_vdelta
          }
        } else if (norm.y < -0.9) { // ny face
          if (vert.z > 0) {
            v += y_vdelta;
          } else {
            v += y_vdelta + z_vdelta;
          }
        } else if (norm.z < -0.9) { // nz face
          if (vert.y < 0) {
            v += y_vdelta + z_vdelta;
          } else {
            v += 2*y_vdelta + z_vdelta;
          }
        } else if (norm.y > 0) { // py face
          if (vert.z < 0) {
            v += 2*y_vdelta  + z_vdelta;
          } else {
            v += 2*y_vdelta + 2*z_vdelta;
          }
        } else {
          throw Error(`Failed retextureBox on i=${i}`);
        }
        uvattr.setXY(i, u, v);
      }
    }
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
    this.retextureBox(box, length, width, height);
    const texture = new THREE.MeshBasicMaterial({ map: this.sidegrain });
    const lumber = new THREE.Mesh(box, texture);
    this.count++;
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
