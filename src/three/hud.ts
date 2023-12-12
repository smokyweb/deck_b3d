/// <reference path="../../lib/three.d.ts" />
/// <reference path="../core/utils.ts" />

module BP3D.Three {
  /**
   * Drawings on "top" of the scene. e.g. rotate arrows
   */
  export class HUD {
    private scene = new THREE.Scene();

    private selectedItem: Items.Item | null = null;

    private rotating: boolean = false;
    private mouseover: boolean = false;

    private tolerance: number = 10;
    private height: number = 5;
    private distance: number = 20;
    private color: number|string = "#ffffff";
    private hoverColor: number|string = "#f1c40f";

    private activeObject: THREE.Object3D | null = null;
    constructor(private three: Three.Main) {
      three.itemSelectedCallbacks.add((item: Items.Item) => this.itemSelected(item));
      three.itemUnselectedCallbacks.add(() => this.itemUnselected());
    }

    public getScene(): THREE.Scene {
      return this.scene;
    }

    public getObject() {
      return this.activeObject;
    }

    private resetSelectedItem() {
      this.selectedItem = null;
      if (this.activeObject) {
        this.scene.remove(this.activeObject);
        this.activeObject = null;
      }
    }

    private itemSelected(item: Items.Item) {
      if (this.selectedItem != item) {
        this.resetSelectedItem();
        if (item.allowRotate && !item.fixed) {
          this.selectedItem = item;
          this.activeObject = this.makeObject(this.selectedItem);
          this.scene.add(this.activeObject);
        }
      }
    }

    private itemUnselected() {
      this.resetSelectedItem();
    }

    private setRotating(isRotating: boolean) {
      this.rotating = isRotating;
      this.setColor();
    }

    private setMouseover(isMousedOver: boolean) {
      this.mouseover = isMousedOver;
      this.setColor();
    }

    private setColor() {
      if (this.activeObject) {
        this.activeObject.children.forEach((obj: any) => {
          // FIXME: this is horrible.  There must be a sounder way to do this.
          const color = obj.material?.color;
          if (color && color instanceof THREE.Color) {
            (color as any).set(this.getColor());
          }
        });
      }
      this.three.setNeedsUpdate();
    }

    private getColor() {
      return (this.mouseover || this.rotating) ? this.hoverColor : this.color;
    }

    private update() {
      if (this.activeObject && this.selectedItem) {
        this.activeObject.rotation.y = this.selectedItem.rotation.y;
        this.activeObject.position.x = this.selectedItem.position.x;
        this.activeObject.position.z = this.selectedItem.position.z;
      }
    }

    private makeLineGeometry(item: Items.Item) {
      var geometry = new THREE.Geometry();

      geometry.vertices.push(
        new THREE.Vector3(0, 0, 0),
        this.rotateVector(item)
      );

      return geometry;
    }

    private rotateVector(item: Items.Item) {
      var vec = new THREE.Vector3(0, 0,
        Math.max(item.halfSize.x, item.halfSize.z) + 1.4 + this.distance);
      return vec;
    }

    private makeLineMaterial(rotating: boolean) {
      var mat = new THREE.LineBasicMaterial({
        color: this.getColor(),
        linewidth: 3
      });
      return mat;
    }

    private makeCone(item: Items.Item) {
      var coneGeo = new THREE.CylinderGeometry(5, 0, 10);
      var coneMat = new THREE.MeshBasicMaterial({
        color: this.getColor()
      });
      var cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(this.rotateVector(item));

      cone.rotation.x = -Math.PI / 2.0;

      return cone;
    }

    private makeSphere(item: Items.Item) {
      var geometry = new THREE.SphereGeometry(4, 16, 16);
      var material = new THREE.MeshBasicMaterial({
        color: this.getColor()
      });
      var sphere = new THREE.Mesh(geometry, material);
      return sphere;
    }

    private makeObject(item: Items.Item) {
      var object = new THREE.Object3D();
      var line = new THREE.Line(
        this.makeLineGeometry(item),
        this.makeLineMaterial(this.rotating),
        THREE.LinePieces);

      var cone = this.makeCone(item);
      var sphere = this.makeSphere(item);

      object.add(line);
      object.add(cone);
      object.add(sphere);

      object.rotation.y = item.rotation.y;
      object.position.x = item.position.x;
      object.position.z = item.position.z;
      object.position.y = this.height;

      return object;
    }
  }
}
