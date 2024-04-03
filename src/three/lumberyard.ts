import * as THREE from "three";
import { inToCm, cmToIn } from "../core/utils";
import * as CSG from "csg";
import { XYZ, UV, csgToBufferGeometry } from "../core/csgutil";

export interface LumberDim {
  // These are cross-grain dimensions.  Width is typically the longer one.
  width: number;
  thickness: number;
  nominalDim: string;
}

export interface LumberMeta {
  matrix: THREE.Matrix4;
  uvgen: UVGen;
  length: number;
  width: number;
  height: number;
  uvGen: UVGen;
}

export type UVGen = (pos: XYZ, normal: XYZ) => UV;

export class LumberYard {
  private sidegrain: THREE.Texture;
  private zebra: THREE.Texture;
  private count: number = 0;
  public static useZebra = false;

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
  public static readonly lumberDimensions: Map<string, LumberDim> = new Map<
    string,
    LumberDim
  >([
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
    ["6x6", { nominalDim: "6x6", width: 5.5, thickness: 5.5 }],
  ]);
  private textureSizeInches = 40; // range 0.0 to 1.0 represents 100 inches on the texture (a guess).

  constructor() {
    const loader = new THREE.TextureLoader();
    this.sidegrain = loader.load("textures/sidegrain02.jpg");
    this.zebra = loader.load("textures/zebra.jpg");
    this.sidegrain.wrapS = this.sidegrain.wrapT = THREE.MirroredRepeatWrapping;
    this.zebra.wrapS = this.sidegrain.wrapT = THREE.MirroredRepeatWrapping;
  }

  private makeUVGen(
    width: number,
    height: number,
    depth: number,
    in_s?: number,
    in_t?: number
  ): UVGen {
    var s: number;
    if (typeof in_s === "number") {
      s = in_s;
    } else {
      s = Math.random();
    }

    var t: number;
    if (typeof in_t === "number") {
      t = in_t;
    } else {
      t = Math.random();
    }
    const udelta = cmToIn(width) / this.textureSizeInches;
    // difference in v texture coordinate along y directioon
    const y_vdelta = cmToIn(height) / this.textureSizeInches;
    // difference in v texture coordinate along z directioon
    const z_vdelta = cmToIn(depth) / this.textureSizeInches;

    var ubase: number, u_xm: number, u_ym: number, u_zm: number;
    var vbase: number, v_xm: number, v_ym: number, v_zm: number;
    ubase = s + udelta / 2;
    u_xm = udelta / width;
    u_ym = 0;
    u_zm = 0;
    const uvgen = function (pos: XYZ, _normal: XYZ): { u: number; v: number } {
      let x = pos.x;
      let y = pos.y;
      let z = pos.z;
      var yzscale: number;

      // divide the surfaces of the sides of the board into 4 regions, the
      // top surface (+z), front surface(-y), the bottom surface (-z),
      // and the back surface(+y).  These surface regions meet up at the lines
      // where y=+-height/2 and z=+-depth/2.
      // For arbitrary xyz coordinates we can make a projection from (x,0,0) through the
      // (x,y,z) point onto the surface region and use the uv surface calculation
      // for that projected point to make a uv coordinate for the vertex.
      // This isn't the most accurate way to texture wood, but it's consistent and
      // conitnuous and good enough.

      // is (y,z) in the upper right?  i.e. is it above the line extending from (-height/2,+depth/2)
      // to (+height/2,  -depth/2)?  (0,0) and these endpoints should evaluate as 0 in the expression, (+y,+z)
      // should be positive.
      const upper_right = y * depth + z * height > 0;
      // is (y,z) in the upper left?  above the line extending from (-height/2,-depth/2) to (+height/2,+depth/2).
      // (0,0) and the endpoints should be 0, (-y,+z) should be positive.
      const upper_left = y * -depth + z * height > 0;
      if (upper_right) {
        if (upper_left) {
          // top surface
          yzscale = depth / 2 / z;
          vbase = t + y_vdelta / 2;
          v_xm = v_zm = 0;
          v_ym = y_vdelta / height;
        } else {
          // front surface
          yzscale = height / 2 / -y;
          vbase = t + y_vdelta + z_vdelta / 2;
          v_xm = v_ym = 0;
          v_zm = z_vdelta / depth;
        }
      } else {
        if (!upper_left) {
          // bottom surface
          yzscale = depth / 2 / -z;
          vbase = t + 1.5 * y_vdelta + z_vdelta;
          v_xm = v_zm = 0;
          v_ym = -y_vdelta / height;
        } else {
          // back surface
          yzscale = height / 2 / y;
          vbase = t + 2 * y_vdelta + 1.5 * z_vdelta;
          v_xm = v_ym = 0;
          v_zm = -z_vdelta / depth;
        }
      }

      // project the y and z out to the surface
      y *= yzscale;
      z *= yzscale;

      const u = ubase + u_xm * x + u_ym * y + u_zm * z;
      const v = vbase + v_xm * x + v_ym * y + v_zm * z;
      return { u, v };
    };
    return uvgen;
  }

  private retextureBG(geom: THREE.BufferGeometry, uvGen: UVGen) {
    const uvattr = geom.getAttribute("uv");
    const vertices = geom.getAttribute("position").array;
    const normals = geom.getAttribute("normal").array;
    const nnodes = vertices.length / 3;
    // difference in u texture coordinate along x direction
    // Loop over all vertices.  Look at the normal to see which
    // face we're on.  Then look at the position to figure out
    // what the texture coordinate should be.
    const norm = new THREE.Vector3();
    const vert = new THREE.Vector3();
    for (let i = 0; i < nnodes; i++) {
      const o3 = i * 3; // offset into vertices and normals arrays
      //const o2 = i*2; // offset into uvs array
      norm.x = normals[o3 + 0];
      norm.y = normals[o3 + 1];
      norm.z = normals[o3 + 2];
      vert.x = vertices[o3 + 0];
      vert.y = vertices[o3 + 1];
      vert.z = vertices[o3 + 2];
      // Figure out which face we're on, and set the appropriate texture coordinate
      const { u, v } = uvGen(vert, norm);
      uvattr.setXY(i, u, v);
    }
  }

  // returns piece of lumber, centered at origin, length is along x axis, width is y axis,
  // thickness is z axis
  public makeLumber(nomDimension: string, lengthInches: number): THREE.Mesh {
    const size = LumberYard.lumberDimensions.get(nomDimension);
    if (!size) {
      throw Error(`Invalid lumber dimension '${nomDimension}'`);
    }
    const wood = this.makeWoodInches(lengthInches, size.width, size.thickness);
    this.fixMeta(wood);
    return wood;
  }
  // from and to are in the cm model space.
  public makeLumberFromTo(
    nomDimension: string,
    from: THREE.Vector3,
    to: THREE.Vector3,
    rotation?: number
  ): THREE.Mesh {
    rotation = rotation || 0;
    const length = from.distanceTo(to);
    const lengthInches = cmToIn(length);
    // now making a transform to put the lumber in the right place.
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const shadowLength = Math.sqrt(dx * dx + dz * dz);
    const shadowAngle = -Math.atan2(dz, dx);
    const elevationAngle = Math.atan2(dy, shadowLength);
    const res = this.makeLumber(nomDimension, lengthInches);
    res.position.x = from.x + dx / 2;
    res.position.y = from.y + dy / 2;
    res.position.z = from.z + dz / 2;
    res.rotateY(shadowAngle);
    res.rotateZ(elevationAngle);
    res.rotateX(rotation);
    this.fixMeta(res);
    return res;
  }
  private currentTexture(): THREE.Texture {
    if (LumberYard.useZebra) {
      return this.zebra;
    } else {
      return this.sidegrain;
    }
  }
  public makeWoodInches(
    lengthInches: number,
    widthInches: number,
    heightInches: number
  ): THREE.Mesh {
    return this.makeWood(
      inToCm(lengthInches),
      inToCm(widthInches),
      inToCm(heightInches)
    );
  }
  // Arguments are in cm.
  public makeWood(length: number, width: number, height: number): THREE.Mesh {
    // TODO: custom BufferGeometry with wood texture subsampling from sidegrain
    const box = new THREE.BoxBufferGeometry(length, width, height);
    const texture = new THREE.MeshBasicMaterial({ map: this.currentTexture() });
    const lumber = new THREE.Mesh(box, texture);
    const uvGen = this.makeUVGen(length, width, height);
    this.retextureBG(box, uvGen);
    lumber.userData = {
      length,
      width,
      height,
      matrix: lumber.matrix.clone(),
      uvGen,
    };
    this.fixMeta(lumber);
    this.count++;
    return lumber;
  }
  public fixMeta(mesh: THREE.Mesh) {
    mesh.updateMatrix();
    if (mesh.userData) {
      mesh.userData.matrix = mesh.matrix.clone();
    } else {
      throw new Error("metadata not initialized");
    }
  }

  // csg must have started life as a piece of wood.  Then it was transformed
  // into a CSG, then (subtractive) actions performed on it.  Then
  public makeWoodFromCSG(csg: CSG.CSG, meta: LumberMeta): THREE.Mesh {
    const geom = csgToBufferGeometry(csg, meta.matrix, meta.uvGen);
    const texture = new THREE.MeshBasicMaterial({ map: this.currentTexture() });
    const lumber = new THREE.Mesh(geom, texture);
    lumber.matrix.identity();
    lumber.applyMatrix(meta.matrix);
    //console.log("lumber matrix", lumber.matrix);
    lumber.userData = meta;
    this.fixMeta(lumber);
    return lumber;
  }
}
