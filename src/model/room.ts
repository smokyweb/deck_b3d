import * as THREE from "three";
import { FloorPlane } from "../core/utils";
import { Corner } from "./corner";
import { Floorplan, TextureSpec } from "./floorplan";
import * as CSG from "csg";

//TODO
//var Vec2 = require('vec2')
//var segseg = require('segseg')
//var Polygon = require('polygon')

/** Default texture to be used if nothing is provided. */
const defaultRoomTexture = {
  url: "rooms/textures/hardwood.png",
  scale: 400,
};

/**
 * A Room is the combination of a Floorplan with a floor plane.
 */
export class Room {
  /** floor plane for intersection testing */
  public floorPlane: FloorPlane | null = null;

  /** */
  private floorChangeCallbacks = $.Callbacks();

  /**
   *  ordered CCW
   */
  constructor(
    private floorplan: Floorplan,
    public corners: Corner[],
  ) {
    this.generatePlane();
  }

  public getUuid(): string {
    var cornerUuids = this.corners.map((c) => c.id);
    cornerUuids.sort();
    return cornerUuids.join();
  }

  public fireOnFloorChange(callback: () => void) {
    this.floorChangeCallbacks.add(callback);
  }

  public getTexture(): TextureSpec {
    var uuid = this.getUuid();
    var tex = this.floorplan.getFloorTexture(uuid);
    return tex || defaultRoomTexture;
  }

  /**
   * textureStretch always true, just an argument for consistency with walls
   */
  public setTexture(
    textureUrl: string,
    _textureStretch: boolean,
    textureScale: number,
  ) {
    var uuid = this.getUuid();
    this.floorplan.setFloorTexture(uuid, textureUrl, textureScale);
    this.floorChangeCallbacks.fire();
  }

  private points(): THREE.Vector2[] {
    var points: THREE.Vector2[] = [];
    this.corners.forEach((corner: Corner) => {
      points.push(new THREE.Vector2(corner.x, corner.y));
    });
    return points;
  }
  private shape(): THREE.Shape {
    const points = this.points();
    const shape = new THREE.Shape(points);
    return shape;
  }
  private generatePlane() {
    //console.log("Room.generatePlane()");
    this.triangulate();
    var shape = this.shape();
    var geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
      }),
    );
    mesh.visible = false;
    mesh.rotation.set(Math.PI / 2, 0, 0);
    this.floorPlane = Object.assign(mesh, { room: this });
  }
  // the typings for THREE.js are wrong here, so we need
  // to lie about the types involved.
  private do_triangulate_call(contour: THREE.Vector2[]): THREE.Vector2[][] {
    const res = THREE.ShapeUtils.triangulate(contour as any as number[], false);
    return res as any as THREE.Vector2[][];
  }
  private triangulate(): THREE.Vector2[][] {
    const contour = this.points();
    const triangles: THREE.Vector2[][] = this.do_triangulate_call(contour);
    //console.log("triangulation: ", triangles);
    return triangles;
  }
  private static readonly PRISM_THICKNESS = 50;
  private static readonly PRISM_HALF_THICKNESS = Room.PRISM_THICKNESS / 2;
  private static readonly PRISM_FACES: number[][] = [
    [0, 1, 2],
    [5, 4, 3],
    [0, 3, 4, 1],
    [1, 4, 5, 2],
    [2, 5, 3, 0],
  ];

  public csgClipRegion(): CSG.CSG {
    function toV3(p: THREE.Vector2, height: number): CSG.Vector {
      return new CSG.Vector(p.x, -height, p.y);
    }
    function toPolygon(pts: CSG.Vector[], shared: any): CSG.Polygon {
      const plane: CSG.Plane = CSG.Plane.fromPoints(pts[0], pts[1], pts[2]);
      const vertices = pts.map((p) => new CSG.Vertex(p, plane.normal));
      return new CSG.Polygon(vertices, shared);
    }
    function triangleToPrism(tri: THREE.Vector2[]): CSG.CSG {
      const ht = Room.PRISM_HALF_THICKNESS;
      const corners: CSG.Vector[] = [
        toV3(tri[0], +ht),
        toV3(tri[1], +ht),
        toV3(tri[2], +ht),
        toV3(tri[0], -ht),
        toV3(tri[1], -ht),
        toV3(tri[2], -ht),
      ];
      const polys = Room.PRISM_FACES.map((face) => {
        const ps = face.map((i) => corners[i]);
        return toPolygon(ps, null);
      });
      return CSG.fromPolygons(polys);
    }
    const triangles = this.triangulate();
    const prisms = triangles.map(triangleToPrism);

    const result = prisms.reduce((a,b) => a.union(b), CSG.fromPolygons([]));
    return result;
  }
}
