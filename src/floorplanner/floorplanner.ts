import { Floorplan } from "../model/floorplan";
import { Corner } from "../model/corner";
import { Wall, WallType } from "../model/wall";
import { FloorplannerView, FloorplannerMode } from "./floorplanner_view";
import { Vector2 as V2 } from "three";
import { Point } from "../core/utils";

/** how much will we move a corner to make a wall axis aligned (cm) */
const snapTolerance = 25;

/**
 * The Floorplanner implements an interactive tool for creation of floorplans.
 *
 * There are three coordiante systems we need to deal with.
 *
 * client coords:  These are the clientX/clientY values you get from MouseEvent
 * canvas coords:  a default Canvas2DContext draws in these
 * world coords:  These are the model coordinates that store locations of objects in the "world"
 *
 */
export class Floorplanner {
  /** */
  public mode: FloorplannerMode = FloorplannerMode.MOVE;

  /** */
  private _activeWall: Wall | null = null;

  /** */
  public activeCorner: Corner | null = null;

  /** model coordinates, position of mouse, snapped */
  public readonly target: V2 = new V2(0, 0);

  /** drawing state */
  public lastNode: Corner | null = null;

  /** set on mousedown(), cleared on mouseup() or mouseleave() */
  private mouseDown = false;

  /** set on mousemove(), cleared on mousedown() */
  private mouseMoved = false;

  /** */
  public modeResetCallbacks = $.Callbacks();

  /** */
  private canvasElement: HTMLElement;

  /** */
  private view: FloorplannerView;

  /** model coords */
  private readonly mouse = new V2(0, 0);

  /** mouse position at last click, canvas coords */
  private readonly last = new V2(0, 0);

  private contextMenuWall: HTMLElement;
  private contextMenuRailingCheckbox: HTMLInputElement;

  public get activeWall(): Wall | null {
    return this._activeWall;
  }
  public set activeWall(newWall: Wall | null) {
    if (newWall !== this._activeWall) {
      this._activeWall = newWall;
    }
    if (newWall) {
      this.lastActiveWall = newWall;
      this.updateContextMenu();
    }
  }
  public _lastActiveWall: Wall | null = null;
  public get lastActiveWall(): Wall | null {
    return this._lastActiveWall;
  }
  public set lastActiveWall(newWall: Wall | null) {
    if (this._lastActiveWall !== newWall) {
      this._lastActiveWall = newWall;
      this.updateContextMenu();
    }
  }
  private updateContextMenu() {
    if (this.lastActiveWall) {
      this.contextMenuWall.hidden = false;
      this.contextMenuRailingCheckbox.checked =
        this.lastActiveWall.wallType == WallType.Railing;
    } else {
      this.contextMenuWall.hidden = true;
    }
  }
  private railingCheckboxHandler(_e: Event) {
    if (this.lastActiveWall) {
      if (this.contextMenuRailingCheckbox.checked) {
        this.lastActiveWall.wallType = WallType.Railing;
      } else {
        this.lastActiveWall.wallType = WallType.Blank;
      }
      this.view.draw();
    }
  }
  /** */
  public get pixelsPerFoot() {
    return 30.48 / this.cmPerPixel;
  }

  // Takes a MouseEvent and makes a canvas coordinate out of the clientX and clientY
  public toCanvas(p: { clientX: number; clientY: number }): V2 {
    const bounds = this.canvasElement.getBoundingClientRect();
    return new V2(p.clientX - bounds.left, p.clientY - bounds.top);
  }

  /** */
  constructor(
    canvas: string,
    private floorplan: Floorplan,
  ) {
    const canvasElement = $("#" + canvas).get(0);
    if (!canvasElement) {
      throw Error("Canvas selector does not work");
    }

    this.canvasElement = canvasElement;

    this.view = new FloorplannerView(this.floorplan, this, canvas);

    const cm = document.querySelector("#context-menu-wall");

    if (cm instanceof HTMLElement) {
      this.contextMenuWall = cm;
    } else {
      throw Error("Couldn't find #context-menu-wall");
    }

    const rc = cm.querySelector("#railing-checkbox");
    if (rc instanceof HTMLInputElement) {
      this.contextMenuRailingCheckbox = rc;
      rc.addEventListener("change", (e: Event) =>
        this.railingCheckboxHandler(e),
      );
    } else {
      throw Error("Couldn't find railing checkbox");
    }

    // Initialization:

    this.setMode(FloorplannerMode.MOVE);

    this.canvasElement.addEventListener("mousedown", (event: MouseEvent) => {
      this.mousedown(event);
    });
    this.canvasElement.addEventListener("mousemove", (event: MouseEvent) => {
      this.mousemove(event);
    });
    this.canvasElement.addEventListener("mouseup", (_event: MouseEvent) => {
      this.mouseup();
    });
    this.canvasElement.addEventListener("mouseleave", () => {
      this.mouseleave();
    });
    this.canvasElement.addEventListener("wheel", (event: WheelEvent) => {
      this.wheelEvent(event);
    });

    document.addEventListener("keyup", (e: KeyboardEvent) => {
      if (e.key == "Escape") {
        this.escapeKey();
      }
    });

    floorplan.roomLoadedCallbacks.add(() => {
      this.reset();
    });
  }

  //private THREE.Vector2

  /** */
  private escapeKey() {
    this.setMode(FloorplannerMode.MOVE);
  }

  /** */
  private updateTarget() {
    if (this.mode == FloorplannerMode.DRAW && this.lastNode) {
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
  private mousedown(event: MouseEvent) {
    this.mouseDown = true;
    this.mouseMoved = false;
    this.last.copy(this.toCanvas(event));

    // delete
    if (this.mode == FloorplannerMode.DELETE) {
      if (this.activeCorner) {
        this.activeCorner.removeAll();
      } else if (this.activeWall) {
        this.activeWall.remove();
        this.lastActiveWall = this.activeWall = null;
      } else {
        this.setMode(FloorplannerMode.MOVE);
      }
    }
  }

  /** */
  private mousemove(event: MouseEvent) {
    this.mouseMoved = true;
    //console.log("move", event);

    // update mouse
    const client = new V2(event.clientX, event.clientY);
    const canvas = this.toCanvas(event);
    const world = this.canvasToWorld(canvas);
    const chatter = false;

    if (chatter) {
      console.log("client, canvas, world: ", client, canvas, world);
    }

    this.mouse.copy(this.canvasToWorld(canvas));

    // update target (snapped position of actual mouse)
    if (
      this.mode == FloorplannerMode.DRAW ||
      (this.mode == FloorplannerMode.MOVE && this.mouseDown)
    ) {
      this.updateTarget();
    }

    // update object target
    if (this.mode != FloorplannerMode.DRAW && !this.mouseDown) {
      var hoverCorner = this.floorplan.overlappedCorner(
        this.mouse.x,
        this.mouse.y,
      );
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
      const mouseDelta = new V2()
        .subVectors(canvas, this.last)
        .multiplyScalar(this.cmPerPixel);
      this.viewCenter.sub(mouseDelta);
      this.last.copy(canvas);
      this.view.draw();
    }

    // dragging
    if (this.mode == FloorplannerMode.MOVE && this.mouseDown) {
      if (this.activeCorner) {
        this.activeCorner.move(this.mouse.x, this.mouse.y);
        this.activeCorner.snapToAxis(snapTolerance);
      } else if (this.activeWall) {
        const rawPos = this.canvasToWorld(canvas);
        const lastPos = this.canvasToWorld(this.last);
        const moveDelta = new V2().subVectors(rawPos, lastPos);
        this.activeWall.relativeMove(moveDelta.x, moveDelta.y);
        this.activeWall.snapToAxis(snapTolerance);
        this.last.copy(canvas);
      }
      this.view.draw();
    }
  }

  /** */
  private mouseup() {
    this.mouseDown = false;

    // drawing
    if (this.mode == FloorplannerMode.DRAW && !this.mouseMoved) {
      var corner = this.floorplan.newCorner(this.target.x, this.target.y);
      if (this.lastNode != null) {
        this.floorplan.newWall(this.lastNode, corner);
      }
      if (corner.mergeWithIntersected() && this.lastNode != null) {
        this.setMode(FloorplannerMode.MOVE);
      }
      this.lastNode = corner;
    }
  }

  /** */
  private mouseleave() {
    this.mouseDown = false;
    //scope.setMode(scope.modes.MOVE);
  }

  private wheelEvent(event: WheelEvent) {
    //console.log("wheel", event);
    const zoomFactor = 1.15;
    const mouseCanvasPos = this.toCanvas(event);
    const mouseWorldPos = this.canvasToWorld(mouseCanvasPos);

    let scale = this.cmPerPixel;
    //console.log(event);
    if (event.deltaY > 0) {
      //console.log("zoom out");
      scale *= zoomFactor;
    } else if (event.deltaY < 0) {
      //console.log("zoom in");
      scale /= zoomFactor;
    }
    this.setView(scale, mouseWorldPos, mouseCanvasPos);
  }

  /** */
  public reset() {
    this.resizeView();
    this.setMode(FloorplannerMode.MOVE);
    this.resetOrigin();
    this.view.draw();
  }

  /** */
  public resizeView() {
    this.view.handleWindowResize();
  }

  /** */
  public setMode(mode: FloorplannerMode) {
    this.lastNode = null;
    this.mode = mode;
    this.modeResetCallbacks.fire(mode);
    this.updateTarget();
  }

  /** Sets the origin so that floorplan is centered */
  private resetOrigin() {
    const iw = this.canvasElement.clientWidth;
    const ih = this.canvasElement.clientHeight;
    if (ih == 0 || iw == 0) {
      // the element isn't set up right yet.
      return;
    }
    if (iw === undefined) {
      throw Error("clientWidth undefined");
    }
    if (ih === undefined) {
      throw Error("clientHeight undefined");
    }

    var screenCenterX = iw / 2.0;
    var screenCenterY = ih / 2.0;
    const planBounds = this.floorplan.getBounds();
    const planCenter = planBounds.getCenter();
    const planSize = planBounds.getSize();
    const xScale = planSize.x / iw;
    const yScale = planSize.y / ih;
    const scale = Math.max(xScale, yScale) * 1.3;

    //console.log(xScale, yScale, scale, this.cmPerPixel, this.pixelsPerCm);
    //console.log(planBounds);
    this.setView(scale, planCenter, { x: screenCenterX, y: screenCenterY });
  }

  /** cmPerPixel defines the view scale on the canvas */
  private cmPerPixel: number = 1;

  /** this world coordinate will be in the center of the canvas view */
  public readonly viewCenter: V2 = new V2(0, 0);

  // Transformation between Canvas coords and World coords
  // is defined by this.cmPerPixel and this.viewCenter // //
  // (p.x - centerX) * cmPerPixel == worldPt.x - viewCenter.x
  // so worldPt.x = (p.x - centerX)*cmPerPixel + viewCenter.x
  public canvasToWorld(p: { x: number; y: number }): V2 {
    const centerX = this.canvasElement.clientWidth / 2;
    const centerY = this.canvasElement.clientHeight / 2;

    const centerOffsetX = p.x - centerX;
    const centerOffsetY = p.y - centerY;
    return new V2(centerOffsetX, centerOffsetY)
      .multiplyScalar(this.cmPerPixel)
      .add(this.viewCenter);
  }
  // converts world model coords to offset coords
  // (p.x - centerX) * cmPerPixel == worldPt.x - viewCenter.x
  // (p.x - centerX) == (worldPt.x - viewCenter.x) / cmPerPixel
  // (p.x = centerX + (worldPt.x - viewCenter.x) / cmPerPixel
  public worldToCanvas(w: { x: number; y: number }): V2 {
    const centerX = this.canvasElement.clientWidth / 2;
    const centerY = this.canvasElement.clientHeight / 2;
    const ox = (w.x - this.viewCenter.x) / this.cmPerPixel;
    const oy = (w.y - this.viewCenter.y) / this.cmPerPixel;
    return new V2(ox + centerX, oy + centerY);
  }
  public setView(scale: number, worldPt: Point, screenPt: Point) {
    // want to set the viewCenter so that worldPt goes to screenPt
    // (screenPt.x - centerX) * scale == worldPt.x - viewCenter.x
    // viewCenter.x = worldPt.x - (screenPt.x - centerX)*scale
    const centerX = this.canvasElement.clientWidth / 2;
    const centerY = this.canvasElement.clientHeight / 2;
    this.viewCenter.x = worldPt.x - (screenPt.x - centerX) * scale;
    this.viewCenter.y = worldPt.y - (screenPt.y - centerY) * scale;
    this.cmPerPixel = scale;
    this.view.draw();
    //console.log(bounds, scale, worldPt, screenPt, this.viewCenter);
    this.checkTransforms();
  }
  private checkSamePoint(p1: V2, p2: V2, name: string): Boolean {
    if (p1.distanceTo(p2) > 0.001) {
      console.error(`Bad point check for "${name}": `, p1, p2);
      return false;
    }
    return true;
  }
  private checkCanvasRt(pCanvas: V2, name: string): Boolean {
    const pWorld = this.canvasToWorld(pCanvas);
    const pCanvasRt = this.worldToCanvas(pWorld);
    return this.checkSamePoint(pCanvas, pCanvasRt, `canvas roundtrip ${name}`);
  }
  private checkTransforms() {
    const width = this.canvasElement.clientWidth;
    const height = this.canvasElement.clientHeight;
    this.checkCanvasRt(new V2(0, 0), "ul");
    this.checkCanvasRt(new V2(width, 0), "ur");
    this.checkCanvasRt(new V2(0, height), "ll");
    this.checkCanvasRt(new V2(width, height), "lr");
  }
}
