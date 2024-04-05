import * as THREE from "three";
import * as CSG from "csg";

export interface UV {
  u: number;
  v: number;
}

export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export function csgToBufferGeometry(
  csg: CSG.CSG,
  matrix?: THREE.Matrix4,
  uvgen?: (pos: XYZ, normal: XYZ) => UV
): THREE.BufferGeometry {
  const geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  let inv_matrix: THREE.Matrix4 | null = null;
  let inv_quaternion: THREE.Quaternion | null = null;
  if (matrix) {
    inv_matrix = new THREE.Matrix4();
    inv_matrix.getInverse(matrix);
    inv_quaternion = new THREE.Quaternion();
    inv_matrix.decompose(scratchPosition, inv_quaternion, scratchScale);
  }

  const scratchPos = new THREE.Vector3();
  const scratchNorm = new THREE.Vector3();
  function addVertex(v: CSG.Vertex) {
    scratchPos.set(v.pos.x, v.pos.y, v.pos.z);
    scratchNorm.set(v.normal.x, v.normal.y, v.normal.z);

    if (inv_matrix && inv_quaternion) {
      scratchPos.applyMatrix4(inv_matrix);
      scratchNorm.applyQuaternion(inv_quaternion);
    }
    positions.push(scratchPos.x, scratchPos.y, scratchPos.z);
    normals.push(scratchNorm.x, scratchNorm.y, scratchNorm.z);
    if (uvgen) {
      const thisuv = uvgen(scratchPos, scratchNorm);
      uv.push(thisuv.u, thisuv.v);
    }
  }
  function addPolygon(p: CSG.Polygon) {
    const len = p.vertices.length;
    const firstIndex = positions.length/3;
    p.vertices.forEach(addVertex);
    // CSG.Polygons are convex, so we can use a fan decomposition.
    for (let j = 2; j < len; j++) {
      const i = j - 1;
      //console.log(`addTriangle(0, ${i}, ${j})`);
      index.push(firstIndex, firstIndex+i, firstIndex+j);
    }
  }
  //console.log("converting to blueMesh: ", csg);
  csg.toPolygons().forEach(addPolygon);
  geometry.addAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3)
  );
  geometry.addAttribute(
    "normal",
    new THREE.BufferAttribute(new Float32Array(normals), 3)
  );
  if (uv.length > 0) {
    geometry.addAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(uv), 2)
    );
  }
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(index), 1));
  return geometry;
}

export function csgToBlueMesh(csg: CSG.CSG): THREE.Mesh {
  const bg = csgToBufferGeometry(csg, undefined, undefined);
  const material = new THREE.MeshBasicMaterial({
    color: 0x0000ff,
    transparent: true,
    opacity: 0.3,
  });
  const mesh = new THREE.Mesh(bg, material);
  return mesh;
}

const scratchPosition = new THREE.Vector3();
const scratchScale = new THREE.Vector3();
export function bufferGeometryToCSG(
  geom: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  shared?: any
): CSG.CSG {
  const positions = geom.getAttribute("position");
  const normals = geom.getAttribute("normal");
  const index = geom.getIndex();

  const quaternion = new THREE.Quaternion();
  matrix.decompose(scratchPosition, quaternion, scratchScale);

  const triangles: CSG.Polygon[] = [];

  function extractWorldV3(i: number): CSG.Vertex {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const coord = new THREE.Vector3(x, y, z);
    coord.applyMatrix4(matrix); // convert to world coordinates
    const nx = normals.getX(i);
    const ny = normals.getY(i);
    const nz = normals.getZ(i);
    const norm = new THREE.Vector3(nx, ny, nz);
    norm.applyQuaternion(quaternion); // convert to world orientation

    return new CSG.Vertex(
      new CSG.Vector(coord.x, coord.y, coord.z),
      new CSG.Vector(norm.x, norm.y, norm.z)
    );
  }

  function extractTriangle(i1: number, i2: number, i3: number) {
    const vecs = [extractWorldV3(i1), extractWorldV3(i2), extractWorldV3(i3)];
    const poly = new CSG.Polygon(vecs, shared);
    triangles.push(poly);
  }

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      extractTriangle(index.array[i], index.array[i + 1], index.array[i + 2]);
    }
  } else {
    for (let i = 0; i < positions.count; i += 3) {
      extractTriangle(i, i + 1, i + 2);
    }
  }
  return CSG.fromPolygons(triangles);
}
