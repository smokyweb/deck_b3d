/// <reference path="../../lib/jquery.d.ts" />
/// <reference path="../../lib/three.d.ts" />
/// <reference path="../core/utils.ts" />
/// <reference path="../three/main.ts" />

enum State {
  UNSELECTED = 0, // no object selected
  SELECTED = 1, // selected but inactive
  DRAGGING = 2, // performing an action while mouse depressed
  ROTATING = 3,  // rotating with mouse down
  ROTATING_FREE = 4, // rotating with mouse up
  PANNING = 5
};

function stateName(s: State): string {
  switch (s) {
    case State.UNSELECTED: return "UNSELECTED";
    case State.SELECTED: return "SELECTED";
    case State.DRAGGING: return "DRAGGING";
    case State.ROTATING: return "ROTATING";
    case State.ROTATING_FREE: return "ROTATING_FREE";
    case State.PANNING: return "PANNING";
    default: throw Error(`stateName: invalid state ${s}`); 
  }
}
module BP3D.Three {
  // TODO: Turn this into a proper class
  export class Controller {
    private enabled: boolean = true;
    private scene: Model.Scene;
    private plane: THREE.Mesh | null = null;
    private mouse = new THREE.Vector2();;
    private intersectedObject: Items.Item | null = null;
    private mouseoverObject: Items.Item | null = null;
    private selectedObject: Items.Item | null = null;
    private mouseDown: boolean = false;
    private mouseMoved: boolean = false;
    private rotateMouseOver: boolean = false;
    public needsUpdate: boolean = true;

    private state = State.UNSELECTED;
  
    // fixme:  three should be a Three.Main class
    // fixme:  controls should be a class
    // fixme:  hud should be a Three.HUD class
    constructor(private three: any, 
                private model: Model.Model, public camera: THREE.Camera, 
                private element: JQuery, private controls: any, 
                private hud: any) 
    {
      this.scene = model.scene;

      this.element.mousedown((event: JQuery.MouseDownEvent) => this.mouseDownEvent(event));
      this.element.mouseup((event: any) => this.mouseUpEvent(event));
      this.element.mousemove((event: any) => this.mouseMoveEvent(event));

      this.scene.itemRemovedCallbacks.add((item: Items.Item) => this.itemRemoved(item));
      this.scene.itemLoadedCallbacks.add((item: Items.Item) => this.itemLoaded(item));
      this.setGroundPlane();
    }

    // invoked via callback when item is loaded
    public itemLoaded(item: Items.Item) {
      if (!item.position_set) {
        this.setSelectedObject(item);
        this.switchState(State.DRAGGING);
        var pos = item.position.clone();
        pos.y = 0;
        var vec = this.three.projectVector(pos);
        this.clickPressed(vec);
      }
      item.position_set = true;
    }

    public clickPressed(vec2?: THREE.Vector2) {
      vec2 = vec2 || this.mouse;
      const sel = this.selectedObject;
      if (sel) {
        var intersection = this.itemIntersection(this.mouse, sel);
        console.log("controller.clickPressed", intersection);
        if (intersection) {
          sel.clickPressed(intersection);
        }
      }
    }

    public clickDragged(vec2?: THREE.Vector2) {
      vec2 = vec2 || this.mouse;
      const sel = this.selectedObject;
      if (sel) {
        var intersection = this.itemIntersection(this.mouse, sel);
        if (intersection) {
          if (this.isRotating()) {
            sel.rotate(intersection);
          } else {
            sel.clickDragged(intersection);
          }
        }
      }
    }

    public itemRemoved(item: Items.Item) {
      // invoked as a callback to event in Scene
      if (item === this.selectedObject) {
        this.selectedObject.setUnselected();
        this.selectedObject.mouseOff();
        this.setSelectedObject(null);
      }
    }

    public setGroundPlane() {
      // ground plane used to find intersections
      var size = 10000;
      this.plane = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial());
      this.plane.rotation.x = -Math.PI / 2;
      this.plane.visible = false;
      this.scene.add(this.plane);
    }

    public checkWallsAndFloors(event?: any) {

      // double click on a wall or floor brings up texture change modal
      if (this.state == State.UNSELECTED && this.mouseoverObject === null) {
        // check walls
        var wallEdgePlanes = this.model.floorplan.wallEdgePlanes();
        var wallIntersects = this.getIntersections(
          this.mouse, wallEdgePlanes, true);
        if (wallIntersects.length > 0) {
          var wall = (wallIntersects[0].object as Items.WallItem).currentWallEdge;
          this.three.wallClicked.fire(wall);
          return;
        }

        // check floors
        var floorPlanes = this.model.floorplan.floorPlanes();
        var floorIntersects = this.getIntersections(
          this.mouse, floorPlanes, false);
        if (floorIntersects.length > 0) {
          // FIXME:  floorPlanes should be Three.Floor
          var room = (floorIntersects[0].object as any).room;
          this.three.floorClicked.fire(room);
          return;
        }

        this.three.nothingClicked.fire();
      }

    }

    // FIXME: any
    public mouseMoveEvent(event: any) {
      if (this.enabled) {
        event.preventDefault();

        this.mouseMoved = true;

        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;

        if (!this.mouseDown) {
          this.updateIntersections();
        }

        switch (this.state) {
          case State.UNSELECTED:
            this.updateMouseover();
            break;
          case State.SELECTED:
            this.updateMouseover();
            break;
          case State.DRAGGING:
          case State.ROTATING:
          case State.ROTATING_FREE:
            this.clickDragged();
            this.hud.update();
            this.needsUpdate = true;
            break;
        }
      }
    }

    public isRotating() {
      return (this.state == State.ROTATING || this.state == State.ROTATING_FREE);
    }

    // FIXME: event needs a type
    public mouseDownEvent(event: any) {
      if (this.enabled) {
        console.log("controller mouseDown", event, stateName(this.state));
        event.preventDefault();

        this.mouseMoved = false;
        this.mouseDown = true;

        switch (this.state) {
          case State.SELECTED:
            if (this.rotateMouseOver) {
              this.switchState(State.ROTATING);
            } else if (this.intersectedObject != null) {
              this.setSelectedObject(this.intersectedObject);
              if (!this.intersectedObject.fixed) {
                this.switchState(State.DRAGGING);
              }
            }
            break;
          case State.UNSELECTED:
            if (this.intersectedObject != null) {
              this.setSelectedObject(this.intersectedObject);
              if (!this.intersectedObject.fixed) {
                this.switchState(State.DRAGGING);
              }
            }
            break;
          case State.DRAGGING:
          case State.ROTATING:
            break;
          case State.ROTATING_FREE:
            this.switchState(State.SELECTED);
            break;
        }
      }
    }

    // FIXME: event needs a type.
    public mouseUpEvent(event: any) {
      if (this.enabled) {
        this.mouseDown = false;

        switch (this.state) {
          case State.DRAGGING:
            if (!this.selectedObject) {
              throw Error("selectedObject is not set");
            }
            this.selectedObject.clickReleased();
            this.switchState(State.SELECTED);
            break;
          case State.ROTATING:
            if (!this.mouseMoved) {
              this.switchState(State.ROTATING_FREE);
            } else {
              this.switchState(State.SELECTED);
            }
            break;
          case State.UNSELECTED:
            if (!this.mouseMoved) {
              this.checkWallsAndFloors();
            }
            break;
          case State.SELECTED:
            if (this.intersectedObject == null && !this.mouseMoved) {
              this.switchState(State.UNSELECTED);
              this.checkWallsAndFloors();
            }
            break;
          case State.ROTATING_FREE:
            break;
        }
      }
    }

    public switchState(newState: State) {
      if (newState != this.state) {
        this.onExit(this.state);
        this.onEntry(newState);
      }
      this.state = newState;
      this.hud.setRotating(this.isRotating());
    }

    public onEntry(state: State) {
      console.log("onEntry", stateName(state))
      switch (this.state) {
        case State.UNSELECTED:
          this.setSelectedObject(null);
        case State.SELECTED:
          this.controls.enabled = true;
          break;
        case State.ROTATING:
        case State.ROTATING_FREE:
          this.controls.enabled = false;
          break;
        case State.DRAGGING:
          this.three.setCursorStyle("move");
          this.clickPressed();
          this.controls.enabled = false;
          break;
      }
    }

    public onExit(state: State) {
      console.log("onExit", stateName(state))
      switch (state) {
        case State.UNSELECTED:
        case State.SELECTED:
          break;
        case State.DRAGGING:
          if (this.mouseoverObject) {
            this.three.setCursorStyle("pointer");
          } else {
            this.three.setCursorStyle("auto");
          }
          break;
        case State.ROTATING:
        case State.ROTATING_FREE:
          break;
      }
    }

    // updates the vector of the intersection with the plane of a given
    // mouse position, and the intersected object
    // both may be set to null if no intersection found
    public updateIntersections() {

      // check the rotate arrow
      var hudObject = this.hud.getObject();
      if (hudObject != null) {
        var hudIntersects = this.getIntersections(
          this.mouse,
          hudObject,
          false, false, true);
        if (hudIntersects.length > 0) {
          this.rotateMouseOver = true;
          this.hud.setMouseover(true);
          this.intersectedObject = null;
          return;
        }
      }
      this.rotateMouseOver = false;
      this.hud.setMouseover(false);

      // check objects
      var items = this.model.scene.getItems();
      var intersects = this.getIntersections(
        this.mouse,
        items,
        false, true);

      if (intersects.length > 0) {
        // FIXME: this should not require a cast
        this.intersectedObject = intersects[0].object as Items.Item;
      } else {
        this.intersectedObject = null;
      }
    }

    // sets coords to -1 to 1
    public normalizeVector2(vec2: THREE.Vector2) {
      var retVec = new THREE.Vector2();
      retVec.x = ((vec2.x - this.three.widthMargin) / (window.innerWidth - this.three.widthMargin)) * 2 - 1;
      retVec.y = -((vec2.y - this.three.heightMargin) / (window.innerHeight - this.three.heightMargin)) * 2 + 1;
      return retVec;
    }

    //
    public mouseToVec3(vec2: THREE.Vector2) {
      var normVec2 = this.normalizeVector2(vec2)
      var vector = new THREE.Vector3(
        normVec2.x, normVec2.y, 0.5);
      vector.unproject(this.camera);
      return vector;
    }

    // returns the first intersection object
    public itemIntersection(vec2: THREE.Vector2, item: Items.Item): Core.Intersection | null {
      var customIntersections = item.customIntersectionPlanes();
      var intersections = null;
      if (customIntersections && customIntersections.length > 0) {
        intersections = this.getIntersections(vec2, customIntersections, true);
      } else {
        if (!this.plane) {
          throw Error("this.plane is not set, but we need it for intersecting");
        }
        intersections = this.getIntersections(vec2, this.plane);
      }
      if (intersections.length > 0) {
        return intersections[0];
      } else {
        return null;
      }
    }

    // filter by normals will only return objects facing the camera
    // objects can be an array of objects or a single object
    public getIntersections(vec2: THREE.Vector2, objects: THREE.Object3D[] | THREE.Object3D, 
          filterByNormals?: boolean, onlyVisible?: boolean, 
          recursive?: boolean, linePrecision?: number) {

      var vector = this.mouseToVec3(vec2);

      onlyVisible = onlyVisible || false;
      filterByNormals = filterByNormals || false;
      recursive = recursive || false;
      linePrecision = linePrecision || 20;


      var direction = vector.sub(this.camera.position).normalize();
      var raycaster = new THREE.Raycaster(
        this.camera.position,
        direction);
      raycaster.linePrecision = linePrecision;
      let intersections: Core.Intersection[] = [];
      if (objects instanceof Array) {
        intersections = raycaster.intersectObjects(objects, recursive);
      } else {
        intersections = raycaster.intersectObject(objects, recursive);
      }
      // filter by visible, if true
      if (onlyVisible) {
        intersections = Core.Utils.removeIf(intersections, function (intersection) {
          return !intersection.object.visible;
        });
      }

      // filter by normals, if true
      if (filterByNormals) {
        intersections = Core.Utils.removeIf(intersections, function (intersection) {
          var dot = intersection.face.normal.dot(direction);
          return (dot > 0)
        });
      }
      return intersections;
    }

    // manage the selected object
    public setSelectedObject(object: Items.Item | null) {
      if (object === null && this.state === State.UNSELECTED) {
        return; // prevent infinite loop in this horrible code
      }
      if (this.state === State.UNSELECTED) {
        this.switchState(State.SELECTED);
      }
      if (this.selectedObject != null) {
        this.selectedObject.setUnselected();
      }
      if (object != null) {
        this.selectedObject = object;
        this.selectedObject.setSelected();
        this.three.itemSelectedCallbacks.fire(object);
      } else {
        this.selectedObject = null;
        this.three.itemUnselectedCallbacks.fire();
      }
      this.needsUpdate = true;
    }

    // TODO: there MUST be simpler logic for expressing this
    public updateMouseover() {
      if (this.intersectedObject != null) {
        if (this.mouseoverObject != null) {
          if (this.mouseoverObject !== this.intersectedObject) {
            this.mouseoverObject.mouseOff();
            this.mouseoverObject = this.intersectedObject;
            this.mouseoverObject.mouseOver();
            this.needsUpdate = true;
          } else {
            // do nothing, mouseover already set
          }
        } else {
          this.mouseoverObject = this.intersectedObject;
          if (this.mouseoverObject) {
            this.mouseoverObject.mouseOver();
          }
          this.three.setCursorStyle("pointer");
          this.needsUpdate = true;
        }
      } else if (this.mouseoverObject != null) {
        this.mouseoverObject.mouseOff();
        this.three.setCursorStyle("auto");
        this.mouseoverObject = null;
        this.needsUpdate = true;
      }
    }

  }
}
