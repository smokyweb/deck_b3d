import * as THREE from "three";
import * as CSG from "csg";

  /**
   * Converting back and forth between textured Mesh 
   * objects and CSG objects is complicated.  Why is this complicated?
   *
   *  1.  Geometry objects have texture coordinates, and CSG objects don't.
   *
   *  2.  Geometry objects have local coordinates.  The object3D has a
   *      transform (Object3D.matrix , or equivalently .rotation+.position+.scale) that sends
   *      local coordinates to global coordinates, but CSG objects are just in
   *      global coordinates.
   *
   *  3.  CSG objects have convex polygonal faces, but Geometry's are made up of
   *      triangles.
   *
   *  4.  Texture coordinates, if they aren't all custom, are typically computed in some way based on
   *      the local position and normal of a vertex.
   *
   *  
   *  So to convert a THREE.Mesh to a CSG, you need to iterate over all the
   *  triangles in the geometry object, apply the transform to the coordinates,
   *  and put the triangles back together into a CSG.  Many of these triangles
   *  will be coplanar, but that's ok, the CSG algorithms detect this and
   *  reassemble the triangles into polygonal faces.  This process discards the
   *  texture coordinates.
   *
   *  You need to keep track of the initial Mesh's transform and Material, and
   *  have a way to generate/regenerate texture coordinates if you want to
   *  transform back into a Mesh.
   *  
   *  Then you do your CSG operations, typically cutting away pieces of it.
   *
   *  Then you have your pared-down CSG and want to turn it back into a THREE.Mesh.
   *
   *  To convert a CSG back into a THREE.Mesh, you take the CSG's face vertices
   *  (and normals), to them apply the *inverse* of the transfrom from before
   *  to get everything back into local coordinates, use the local vertex information
   *  with the uvgen function to make texture coordinates, and put the local vertex
   *  info, texture coordinates, and triangle info into the Geometry.
   *
   *  Then you create a Mesh with the old transform, old Material, and new Geometry.
   */

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
  const scratchPos = new THREE.Vector3();
  const scratchNorm = new THREE.Vector3();
  const scratchScale = new THREE.Vector3();
  if (matrix) {
    inv_matrix = new THREE.Matrix4();
    inv_matrix.getInverse(matrix);
    inv_quaternion = new THREE.Quaternion();
    inv_matrix.decompose(scratchPos, inv_quaternion, scratchScale);
  }

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

export function bufferGeometryToCSG(
  geom: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  shared?: any
): CSG.CSG {
  const positions = geom.getAttribute("position");
  const normals = geom.getAttribute("normal");
  const index = geom.getIndex();

  const quaternion = new THREE.Quaternion();
  const scratchPosition = new THREE.Vector3();
  const scratchScale = new THREE.Vector3();
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
