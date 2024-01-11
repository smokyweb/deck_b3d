import * as THREE from 'three';
import { Main as ThreeMain } from '../three/main';
import { Scene } from '../model/scene';
import { Item } from '../items/item';
import { Model } from '../model/model';
import { Wall } from '../model/wall';
import { Controls } from './controls';
import { HUD } from './hud';
import { LumberYard } from './lumberyard';

enum State {
  UNSELECTED = 0, // no object selected
  SELECTED = 1, // selected but inactive
  DRAGGING = 2, // performing an action while mouse depressed
  ROTATING = 3,  // rotating with mouse down
  ROTATING_FREE = 4, // rotating with mouse up
  PANNING = 5
};

// @ts-ignore: this function is used when debugging
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

export class Controller {
  public enabled: boolean = true;
  private scene: Scene;
  private groundPlane: THREE.Mesh | null = null;
  private _intersectedObject: Item | null = null;
  get intersectedObject(): Item | null {
    return this._intersectedObject;
  }
  set intersectedObject(obj: Item | null) {
    if (obj !== this._intersectedObject) {
      //console.log("intersectedObject changed: from=", this._intersectedObject, "to=", obj);
    }
    this._intersectedObject = obj;
  }
  private mouseoverObject: Item | null = null;
  private selectedObject: Item | null = null;
  private mouseDown: boolean = false;
  private mouseMoved: boolean = false;
  private rotateMouseOver: boolean = false;
  public needsUpdate: boolean = true;

  private state = State.UNSELECTED;

  // fixme:  three should be a Three.Main class
  constructor(private three: ThreeMain, 
              private model: Model, public camera: THREE.Camera, 
              private htmlElement: HTMLElement, private controls: Controls, 
              private hud: HUD) 
  {
    this.scene = model.scene;
    const elt = this.htmlElement;
    elt.addEventListener("mousedown", (event: MouseEvent) => this.mouseDownEvent(event));
    elt.addEventListener("mouseup", (event: MouseEvent) => this.mouseUpEvent(event));
    elt.addEventListener("mousemove", (event: MouseEvent) => this.mouseMoveEvent(event));
    //console.log("adding keydown listener");
    // can't add this on the canvas because an HTMLElement needs to have the focus
    // in order to get keydown events.  By default, a canvas can't have the focus.
    // Normally the 'body' element has the focus.
    // So we add the listener to the document, events will bubble up.
    document.addEventListener("keydown", (event: KeyboardEvent) => this.keyboardEvent(event));
    //console.log("added keydown listener");

    this.scene.itemRemovedCallbacks.add((item: Item) => this.itemRemoved(item));
    this.scene.itemLoadedCallbacks.add((item: Item) => this.itemLoaded(item));
    this.setGroundPlane();
  }

  // invoked via callback when item is loaded
  public itemLoaded(item: Item) {
    if (!item.position_set) {
      this.setSelectedObject(item);
      var pos = item.position.clone();
      pos.y = 0;
      //var vec = this.three.projectVector(pos);
      //this.clickPressed(vec);
    }
    item.position_set = true;
  }

  public clickPressed(event: MouseEvent) {
    const sel = this.selectedObject;
    if (sel) {
      var intersection = this.itemIntersection(event, sel);
      //console.log("controller.clickPressed", intersection);
      if (intersection) {
        //console.log("controller.clickPressed found intersection");
        sel.clickPressed(intersection);
      } else {
        //console.log("controller.clickPressed missed");
      }
    }
  }

  public clickDragged(event: MouseEvent) {
    //console.log("controller clickDragged");
    const sel = this.selectedObject;
    let didnothing = true;
    if (sel && !sel.fixed) {
      var intersection = this.itemIntersection(event, sel);
      if (intersection) {
        if (this.isRotating()) {
          //console.log("controller.clickDragged is rotating");
          sel.rotate(intersection);
          didnothing = false;
        } else {
          //console.log("controller.clickDragged is moving an item");
          sel.clickDragged(intersection);
          didnothing = false;
        }
      } else {
        //console.log("controller.clickDragged got null intersection");
      }

    } else {
      //console.log("controller.clickDragged got null selection");
    }

    if (didnothing) {
      //console.log("controller.clickDragged did nothing");
    }
  }

  public itemRemoved(item: Item) {
    // invoked as a callback to event in Scene
    if (item === this.selectedObject) {
      this.selectedObject.selected = false;
      this.selectedObject.hover = false;
      this.setSelectedObject(null);
    }
  }

  public setGroundPlane() {
    // ground plane used to find intersections
    var size = 100000;
    this.groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial());
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.visible = false;
    this.scene.add(this.groundPlane);
  }

  public checkWallsAndFloors(event: MouseEvent) {

    // double click on a wall or floor brings up texture change modal
    if (this.state == State.UNSELECTED && this.mouseoverObject === null) {
      // check walls
      var wallEdgePlanes = this.model.floorplan.wallEdgePlanes();
      var wallIntersects = this.getIntersections(
        event, wallEdgePlanes, true);
      if (wallIntersects.length > 0) {
        const obj = wallIntersects[0].object as any;
        const wall = obj?.edge?.wall;
        if (wall instanceof Wall) {
          this.three.wallClicked.fire(wall);
          return;
        }
      }

      // check floors
      var floorPlanes = this.model.floorplan.floorPlanes();
      var floorIntersects = this.getIntersections(
        event, floorPlanes, false);
      if (floorIntersects.length > 0) {
        // FIXME:  floorPlanes should be Three.Floor
        var room = (floorIntersects[0].object as any).room;
        this.three.floorClicked.fire(room);
        return;
      }

      this.three.nothingClicked.fire();
    }

  }
  private lastkeys: string = "";
  private keyboardEvent(event: KeyboardEvent) {
    this.lastkeys = this.lastkeys.concat(event.key).slice(-5);
    //console.log(`keyboardEvent(${event.key}), lastkeys=${this.lastkeys}`); 
    if (this.lastkeys === 'zebra') {
      LumberYard.useZebra = !LumberYard.useZebra;
      this.model.floorplan.update();
    }
  }

  public mouseMoveEvent(event: MouseEvent) {
//    for(const item of this.scene.items) {
//      const intersections = this.getIntersections(event, item);
//      if (intersections.length > 0) {
//        item.mouseOver();
//      } else {
//        item.mouseOff();
//      }
//    }
    if (this.enabled) {
      //console.log("controller mouseMove", event, stateName(this.state));
      event.preventDefault();

      this.mouseMoved = true;

      if (!this.mouseDown) {
        this.updateIntersections(event);
      }

      switch (this.state) {
        case State.UNSELECTED:
        case State.SELECTED:
          break;
        case State.DRAGGING:
        case State.ROTATING:
        case State.ROTATING_FREE:
          this.clickDragged(event);
          this.hud.update();
          this.needsUpdate = true;
          break;
      }
    }
  }

  public isRotating() {
    return (this.state == State.ROTATING || this.state == State.ROTATING_FREE);
  }

  public mouseDownEvent(event: MouseEvent) {
    if (this.enabled) {
      //console.log("controller mouseDown", event, stateName(this.state));
      event.preventDefault();

      this.updateIntersections(event);

      this.mouseMoved = false;
      this.mouseDown = true;

      switch (this.state) {
        case State.SELECTED:
          if (this.rotateMouseOver) {
            this.switchState(State.ROTATING);
          } else if (this.intersectedObject != null) {
            this.setSelectedObject(this.intersectedObject);
            if (!this.intersectedObject.fixed) {
              this.clickPressed(event);
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

  public mouseUpEvent(_event: MouseEvent) {
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
        case State.SELECTED:
        case State.ROTATING_FREE:
          break;
      }
    }
  }

  public switchState(newState: State) {
    //console.trace(`switchState from ${stateName(this.state)} to ${stateName(newState)}`);
    if (newState != this.state) {
      this.onExit(this.state);
      this.onEntry(newState);
    }
    this.state = newState;
    this.hud.setRotating(this.isRotating());
  }

  public onEntry(newState: State) {
    //console.log("onEntry", stateName(state))
    switch (newState) {
      case State.UNSELECTED:
      case State.SELECTED:
        this.controls.enabled = true;
        break;
      case State.ROTATING:
      case State.ROTATING_FREE:
        this.controls.enabled = false;
        break;
      case State.DRAGGING:
        this.three.setCursorStyle("move");
        //this.clickPressed(event);
        this.controls.enabled = false;
        break;
    }
  }

  public onExit(state: State) {
    //console.log("onExit", stateName(state))
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
  public updateIntersections(event: MouseEvent) {
    //console.log("updateIntersections entry");

    // check the rotate arrow
    var hudObject = this.hud.getObject();
    if (hudObject != null) {
      var hudIntersects = this.getIntersections(
        event,
        hudObject,
        false, false, true);
      if (hudIntersects.length > 0) {
        //console.log("updateIntersections: hud object selected");
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
      event,
      items,
      false, true);
    //console.log("updateIntersections intersects: ", intersects);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (obj instanceof Item) {
        //console.log("updateIntersections: item selected", obj);
        this.intersectedObject = obj;
      }
    } else {
      //console.log("updateIntersections: no item selected");
      this.intersectedObject = null;
    }
  }

  // maps mouse event location to normalized opengl screen coordinates
  // ((0,0) at center, +y is up, ranges are -1 to +1)
  public screenNormalPointer(event: MouseEvent): THREE.Vector2 {
    const bounds = this.htmlElement.getBoundingClientRect();
    const ox = event.clientX - bounds.left;
    const oy = event.clientY - bounds.top;
    const rx = (ox / this.htmlElement.clientWidth) * 2 - 1;
    const ry = -(oy / this.htmlElement.clientHeight) * 2 + 1;
    return new THREE.Vector2(rx, ry);
  }


  // returns the first intersection object
  public itemIntersection(event: MouseEvent, item: Item): THREE.Intersection | null {
    var customIntersections = item.customIntersectionPlanes();
    var intersections = null;
    if (customIntersections && customIntersections.length > 0) {
      //console.log("custom intersections");
      intersections = this.getIntersections(event, customIntersections, true);
    } else {
      if (!this.groundPlane) {
        throw Error("this.groundPlane is not set, but we need it for intersecting");
      }
      //console.log("ground plane intersection");
      // FIXME: This is horrible.  Raycaster only intersects with visible objects
      this.groundPlane.visible = true;
      intersections = this.getIntersections(event, this.groundPlane);
      // FIXME: This is horrible.  Raycaster only intersects with visible objects
      this.groundPlane.visible = false;
    }
    if (intersections.length > 0) {
      return intersections[0];
    } else {
      return null;
    }
  }

  // filter by normals will only return objects facing the camera
  // objects can be an array of objects or a single object
  public getIntersections(event: MouseEvent, objects: THREE.Object3D[] | THREE.Object3D, 
        filterByNormals?: boolean, onlyVisible?: boolean, 
        recursive?: boolean, linePrecision?: number): THREE.Intersection[] {


    onlyVisible = onlyVisible || false;
    filterByNormals = filterByNormals || false;
    recursive = recursive || false;

    var raycaster = new THREE.Raycaster();
    const normPointer = this.screenNormalPointer(event);
    raycaster.setFromCamera(normPointer, this.camera);
    

    if (typeof linePrecision !== 'undefined') {
      raycaster.linePrecision = linePrecision;
    }
    let intersections: THREE.Intersection[] = [];
    if (objects instanceof Array) {
      //console.log("array", objects);
      intersections = raycaster.intersectObjects(objects, recursive);
    } else {
      //console.log("singular", objects);
      intersections = raycaster.intersectObject(objects, recursive);
    }
    //console.log("getIntersections", intersections);
    // filter by visible, if true
    if (onlyVisible) {
      intersections = intersections.filter((intersection) => intersection.object.visible);
    }

    // filter by normals, if true
    if (filterByNormals) {
      intersections = intersections.filter((intersection) => {
        var dot = intersection.face.normal.dot(raycaster.ray.direction);
        return (dot <= 0); // camera ray and surface normal are generally opposite
      });
    }
    //console.log("getIntersections after filtering", intersections);
    return intersections;
  }

  // manage the selected object
  public setSelectedObject(object: Item | null) {
    if (this.selectedObject === object) {
      //console.log("setSelectedObject idempotent");
      return; // anything else would be redundant
    }

    if (this.selectedObject != null) {
      //console.log("de-selecting ", this.selectedObject);
      this.selectedObject.selected = false;
      this.three.itemUnselectedCallbacks.fire();
      this.selectedObject = null;
    }
    if (object != null) {
      //console.log("selecting ", object);
      this.selectedObject = object;
      this.switchState(State.SELECTED);
      this.selectedObject.selected = true;
      this.three.itemSelectedCallbacks.fire(object);
    } else {
      this.switchState(State.UNSELECTED);
    }
    this.needsUpdate = true;
  }

  // TODO: there MUST be simpler logic for expressing this
  public updateMouseover() {
    if (this.intersectedObject != null) {
      if (this.mouseoverObject != null) {
        if (this.mouseoverObject !== this.intersectedObject) {
          this.mouseoverObject.hover = false;
          this.mouseoverObject = this.intersectedObject;
          this.mouseoverObject.hover = true;
          this.needsUpdate = true;
        } else {
          // do nothing, mouseover already set
        }
      } else {
        this.mouseoverObject = this.intersectedObject;
        if (this.mouseoverObject) {
          this.mouseoverObject.hover = true;
        }
        this.three.setCursorStyle("pointer");
        this.needsUpdate = true;
      }
    } else if (this.mouseoverObject != null) {
      this.mouseoverObject.hover = false;
      this.three.setCursorStyle("auto");
      this.mouseoverObject = null;
      this.needsUpdate = true;
    }
  }

}
