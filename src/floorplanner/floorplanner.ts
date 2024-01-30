
import { Floorplan } from '../model/floorplan';
import { Corner } from '../model/corner';
import { Wall } from '../model/wall';
import { FloorplannerView, floorplannerMode } from './floorplanner_view';
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

  /** */
  public originX = 0;

  /** */
  public originY = 0;

  /** drawing state */
  public targetX = 0;

  /** drawing state */
  public targetY = 0;

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
  private mouseX = 0;

  /** in ThreeJS coords */
  private mouseY = 0;

  /** in ThreeJS coords */
  private rawMouseX = 0;

  /** in ThreeJS coords */
  private rawMouseY = 0;

  /** mouse position at last click */
  private lastX = 0;

  /** mouse position at last click */
  private lastY = 0;

  /** */
  private cmPerPixel: number;

  /** */
  private pixelsPerCm: number;

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

  /** */
  private escapeKey() {
    this.setMode(floorplannerMode.MOVE);
  }

  /** */
  private updateTarget() {
    if (this.mode == floorplannerMode.DRAW && this.lastNode) {
      if (Math.abs(this.mouseX - this.lastNode.x) < snapTolerance) {
        this.targetX = this.lastNode.x;
      } else {
        this.targetX = this.mouseX;
      }
      if (Math.abs(this.mouseY - this.lastNode.y) < snapTolerance) {
        this.targetY = this.lastNode.y;
      } else {
        this.targetY = this.mouseY;
      }
    } else {
      this.targetX = this.mouseX;
      this.targetY = this.mouseY;
    }

    this.view.draw();
  }

  /** */
  private mousedown() {
    this.mouseDown = true;
    this.mouseMoved = false;
    this.lastX = this.rawMouseX;
    this.lastY = this.rawMouseY;

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
    const bounds = this.canvasElement.getBoundingClientRect();
    const ox = event.clientX - bounds.left;
    const oy = event.clientY - bounds.top;

    this.mouseMoved = true;

    // update mouse
    this.rawMouseX = event.clientX;
    this.rawMouseY = event.clientY;

    this.mouseX = ox * this.cmPerPixel + this.originX * this.cmPerPixel;
    this.mouseY = oy * this.cmPerPixel + this.originY * this.cmPerPixel;

    // update target (snapped position of actual mouse)
    if (this.mode == floorplannerMode.DRAW || (this.mode == floorplannerMode.MOVE && this.mouseDown)) {
      this.updateTarget();
    }

    // update object target
    if (this.mode != floorplannerMode.DRAW && !this.mouseDown) {
      var hoverCorner = this.floorplan.overlappedCorner(this.mouseX, this.mouseY);
      var hoverWall = this.floorplan.overlappedWall(this.mouseX, this.mouseY);
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
      this.originX += (this.lastX - this.rawMouseX);
      this.originY += (this.lastY - this.rawMouseY);
      this.lastX = this.rawMouseX;
      this.lastY = this.rawMouseY;
      this.view.draw();
    }

    // dragging
    if (this.mode == floorplannerMode.MOVE && this.mouseDown) {
      if (this.activeCorner) {
        this.activeCorner.move(this.mouseX, this.mouseY);
        this.activeCorner.snapToAxis(snapTolerance);
      } else if (this.activeWall) {
        this.activeWall.relativeMove(
          (this.rawMouseX - this.lastX) * this.cmPerPixel,
          (this.rawMouseY - this.lastY) * this.cmPerPixel
        );
        this.activeWall.snapToAxis(snapTolerance);
        this.lastX = this.rawMouseX;
        this.lastY = this.rawMouseY;
      }
      this.view.draw();
    }
  }

  /** */
  private mouseup() {
    this.mouseDown = false;

    // drawing
    if (this.mode == floorplannerMode.DRAW && !this.mouseMoved) {
      var corner = this.floorplan.newCorner(this.targetX, this.targetY);
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
    this.originX = centerFloorplan.x * this.pixelsPerCm - centerX;
    this.originY = centerFloorplan.y * this.pixelsPerCm - centerY;
  }

  /** Convert from THREEjs coords to canvas coords. */
  public convertX(x: number): number {
    return (x - this.originX * this.cmPerPixel) * this.pixelsPerCm;
  }

  /** Convert from THREEjs coords to canvas coords. */
  public convertY(y: number): number {
    return (y - this.originY * this.cmPerPixel) * this.pixelsPerCm;
  }
}
