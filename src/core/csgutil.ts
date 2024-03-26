import * as THREE from "three";
import * as CSG from "csg";

export function csgToBlueMesh(csg: CSG.CSG): THREE.Object3D {
  const geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];

  function addVertex(v: CSG.Vertex) {
    positions.push(v.pos.x, v.pos.y, v.pos.z);
    normals.push(v.normal.x, v.normal.y, v.normal.z);
  }
  function addTriangle(v1: CSG.Vertex, v2: CSG.Vertex, v3: CSG.Vertex) {
    addVertex(v1);
    addVertex(v2);
    addVertex(v3);
  }
  function addPolygon(p: CSG.Polygon) {
    const len = p.vertices.length;
    for (let i = 1; i < len - 1; i++) {
      const j = (i + 1) % len;
      //console.log(`addTriangle(0, ${i}, ${j})`);
      addTriangle(p.vertices[0], p.vertices[i], p.vertices[j]);
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
  const material = new THREE.MeshBasicMaterial({
    color: 0x0000ff,
    transparent: true,
    opacity: 0.3,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
