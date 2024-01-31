
import { Floorplan } from '../model/floorplan';
import { Corner } from '../model/corner';
import { Wall } from '../model/wall';
import { FloorplannerView, floorplannerMode } from './floorplanner_view';
import { Vector2 as V2 } from 'three';


/** how much will we move a corner to make a wall axis aligned (cm) */
const snapTolerance = 25;

/** 
 * The Floorplanner implements an interactive tool for creation of floorplans.
 */
export class Floorplanner {

  /** */
  public mode = 0;

  /** */
  public activeWall: (Wall | null) = null;

  /** */
  public activeCorner: (Corner | null) = null;

  public readonly origin: V2 = new V2(0,0);

  public readonly target: V2 = new V2(0,0);

  /** drawing state */
  public lastNode: (Corner | null) = null;

  /** */
  public modeResetCallbacks = $.Callbacks();

  /** */
  private canvasElement: HTMLElement;

  /** */
  private view: FloorplannerView;

  /** */
  private mouseDown = false;

  /** */
  private mouseMoved = false;

  /** in ThreeJS coords */
  private readonly mouse = new V2(0,0);

  /** in ThreeJS coords */
  private readonly rawMouse = new V2(0,0);

  /** mouse position at last click */
  private readonly last = new V2(0,0);

  /** */
  private cmPerPixel: number;

  /** */
  private pixelsPerCm: number;

  // converts offset coords to world model coords
  public offsetToWorld(p: {x: number, y: number}): V2 {
    const rx = (p.x + this.origin.x) * this.cmPerPixel;
    const ry = (p.y + this.origin.y) * this.cmPerPixel;
    return new V2(rx, ry);
  }
  // converts world model coords to offset coords
  public worldToOffset(p: {x: number, y: number}): V2 {
    const rx = (p.x / this.cmPerPixel) - this.origin.x;
    const ry = (p.y / this.cmPerPixel) - this.origin.y;
    return new V2(rx, ry);
  }

  // Takes a mouse event clientX and clientY, turns it into coordinates
  // relative to the containing HTMLElement
  private clientToOffset(clientX: number, clientY: number): V2 {
    const bounds = this.canvasElement.getBoundingClientRect();
    const ox = clientX - bounds.left;
    const oy = clientY - bounds.top;
    return new V2(ox, oy);
  }
  /** */
  constructor(canvas: string, private floorplan: Floorplan) {
    const canvasElement = $("#" + canvas).get(0);
    if (!canvasElement) {
      throw Error("Canvas selector does not work");
    }

    this.canvasElement = canvasElement;

    this.view = new FloorplannerView(this.floorplan, this, canvas);

    var cmPerFoot = 30.48;
    var pixelsPerFoot = 15.0;
    this.cmPerPixel = cmPerFoot * (1.0 / pixelsPerFoot);
    this.pixelsPerCm = 1.0 / this.cmPerPixel;

    // Initialization:

    this.setMode(floorplannerMode.MOVE);

    var scope = this;

    this.canvasElement.addEventListener("mousedown", (_e: MouseEvent) => {
      scope.mousedown();
    });
    this.canvasElement.addEventListener("mousemove", (event: MouseEvent) => {
      scope.mousemove(event);
    });
    this.canvasElement.addEventListener("mouseup", (_e: MouseEvent) => {
      scope.mouseup();
    });
    this.canvasElement.addEventListener("mouseleave", () => {
      scope.mouseleave();
    });

    document.addEventListener("keyup", (e: KeyboardEvent) => {
      if (e.key == "Escape") {
        scope.escapeKey();
      }
    });

    floorplan.roomLoadedCallbacks.add(() => {
      scope.reset()
    });
  }

  //private THREE.Vector2

  /** */
  private escapeKey() {
    this.setMode(floorplannerMode.MOVE);
  }

  /** */
  private updateTarget() {
    if (this.mode == floorplannerMode.DRAW && this.lastNode) {
      if (Math.abs(this.mouse.x - this.lastNode.x) < snapTolerance) {
        this.target.x = this.lastNode.x;
      } else {
        this.target.x = this.mouse.x;
      }
      if (Math.abs(this.mouse.y - this.lastNode.y) < snapTolerance) {
        this.target.y = this.lastNode.y;
      } else {
        this.target.y = this.mouse.y;
      }
    } else {
      this.target.x = this.mouse.x;
      this.target.y = this.mouse.y;
    }

    this.view.draw();
  }

  /** */
  private mousedown() {
    this.mouseDown = true;
    this.mouseMoved = false;
    this.last.copy(this.rawMouse);

    // delete
    if (this.mode == floorplannerMode.DELETE) {
      if (this.activeCorner) {
        this.activeCorner.removeAll();
      } else if (this.activeWall) {
        this.activeWall.remove();
      } else {
        this.setMode(floorplannerMode.MOVE);
      }
    }
  }


  /** */
  private mousemove(event: MouseEvent) {
    const offset = this.clientToOffset(event.clientX, event.clientY);

    this.mouseMoved = true;

    // update mouse
    this.rawMouse.set(event.clientX, event.clientY);;

    this.mouse.copy(this.offsetToWorld(offset));

    // update target (snapped position of actual mouse)
    if (this.mode == floorplannerMode.DRAW || (this.mode == floorplannerMode.MOVE && this.mouseDown)) {
      this.updateTarget();
    }

    // update object target
    if (this.mode != floorplannerMode.DRAW && !this.mouseDown) {
      var hoverCorner = this.floorplan.overlappedCorner(this.mouse.x, this.mouse.y);
      var hoverWall = this.floorplan.overlappedWall(this.mouse.x, this.mouse.y);
      var draw = false;
      if (hoverCorner != this.activeCorner) {
        this.activeCorner = hoverCorner;
        draw = true;
      }
      // corner takes precendence
      if (this.activeCorner == null) {
        if (hoverWall != this.activeWall) {
          this.activeWall = hoverWall;
          draw = true;
        }
      } else {
        this.activeWall = null;
      }
      if (draw) {
        this.view.draw();
      }
    }

    // panning
    if (this.mouseDown && !this.activeCorner && !this.activeWall) {
      const mouseDelta = new V2().subVectors(this.last, this.rawMouse);
      this.origin.add(mouseDelta)
      this.last.copy(this.rawMouse);
      this.view.draw();
    }

    // dragging
    if (this.mode == floorplannerMode.MOVE && this.mouseDown) {
      if (this.activeCorner) {
        this.activeCorner.move(this.mouse.x, this.mouse.y);
        this.activeCorner.snapToAxis(snapTolerance);
      } else if (this.activeWall) {
        const rawPos = this.offsetToWorld(this.rawMouse);
        const lastPos = this.offsetToWorld(this.last);
        const moveDelta = new V2().subVectors(rawPos, lastPos);
        this.activeWall.relativeMove(moveDelta.x, moveDelta.y);
        this.activeWall.snapToAxis(snapTolerance);
        this.last.copy(this.rawMouse);
      }
      this.view.draw();
    }
  }

  /** */
  private mouseup() {
    this.mouseDown = false;

    // drawing
    if (this.mode == floorplannerMode.DRAW && !this.mouseMoved) {
      var corner = this.floorplan.newCorner(this.target.x, this.target.y);
      if (this.lastNode != null) {
        this.floorplan.newWall(this.lastNode, corner);
      }
      if (corner.mergeWithIntersected() && this.lastNode != null) {
        this.setMode(floorplannerMode.MOVE);
      }
      this.lastNode = corner;
    }
  }

  /** */
  private mouseleave() {
    this.mouseDown = false;
    //scope.setMode(scope.modes.MOVE);
  }

  /** */
  public reset() {
    this.resizeView();
    this.setMode(floorplannerMode.MOVE);
    this.resetOrigin();
    this.view.draw();
  }

  /** */
  public resizeView() {
    this.view.handleWindowResize();
  }

  /** */
  public setMode(mode: number) {
    this.lastNode = null;
    this.mode = mode;
    this.modeResetCallbacks.fire(mode);
    this.updateTarget();
  }

  /** Sets the origin so that floorplan is centered */
  private resetOrigin() {
    const iw = this.canvasElement.clientWidth;
    const ih = this.canvasElement.clientHeight;
    if (iw === undefined) {
      throw Error("innerWidth() undefined");
    }
    if (ih === undefined) {
      throw Error("innerHeight() undefined");
    }
    var centerX = iw / 2.0;
    var centerY = ih / 2.0;
    const centerFloorplan = this.floorplan.getCenter2();
    this.origin.x = centerFloorplan.x * this.pixelsPerCm - centerX;
    this.origin.y = centerFloorplan.y * this.pixelsPerCm - centerY;
  }

}
