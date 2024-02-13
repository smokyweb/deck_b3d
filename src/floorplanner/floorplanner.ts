
import { Floorplan } from '../model/floorplan';
import { Corner } from '../model/corner';
import { Wall, WallType } from '../model/wall';
import { FloorplannerView, FloorplannerMode } from './floorplanner_view';
import { Vector2 as V2 } from 'three';
import { Point } from '../core/utils';


/** how much will we move a corner to make a wall axis aligned (cm) */
const snapTolerance = 25;

/** 
 * The Floorplanner implements an interactive tool for creation of floorplans.
 */
export class Floorplanner {

  /** */
  public mode: FloorplannerMode = FloorplannerMode.MOVE;

  /** */
  private _activeWall: (Wall | null) = null;

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

  /** clientX/clientY coords */
  private readonly mouse = new V2(0,0);

  /** mouse position at last click */
  private readonly last = new V2(0,0);

  /** */
  private cmPerPixel: number = 1;

  private contextMenuWall: HTMLElement;
  private contextMenuRailingCheckbox: HTMLInputElement;

  public get activeWall(): Wall | null {
    return this._activeWall;
  }
  public set activeWall(newWall: Wall | null) {
    if (newWall !== this._activeWall) {
      this._activeWall = newWall;
      this.updateContextMenu();
    }
  }
  private updateContextMenu() {
    if (this.activeWall) {
      this.contextMenuWall.hidden = false;
      this.contextMenuRailingCheckbox.checked = 
          (this.activeWall.wallType == WallType.Railing);
    } else {
      this.contextMenuWall.hidden = true;
    }
  }
  private railingCheckboxHandler(_e: Event) {
    if (this.activeWall) {
      if (this.contextMenuRailingCheckbox.checked) {
        this.activeWall.wallType = WallType.Railing;
      } else {
        this.activeWall.wallType = WallType.Blank;;
      }
      this.view.draw();
    }
  }
  /** */
  public get pixelsPerFoot() {
    return 30.48 / this.cmPerPixel;
  }

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

    const cm = document.querySelector("#context-menu-wall");

    if (cm instanceof HTMLElement) {
      this.contextMenuWall = cm;
    } else {
      throw Error("Couldn't find #context-menu-wall");
    }

    const rc = cm.querySelector("#railing-checkbox");
    if (rc instanceof HTMLInputElement) {
      this.contextMenuRailingCheckbox = rc;
      rc.addEventListener("change",  (e: Event) => this.railingCheckboxHandler(e));
    } else {
      throw Error("Couldn't find railing checkbox");
    }


    // Initialization:

    this.setMode(FloorplannerMode.MOVE);

    this.canvasElement.addEventListener("mousedown", (e: MouseEvent) => {
      this.mousedown(e);
    });
    this.canvasElement.addEventListener("mousemove", (event: MouseEvent) => {
      this.mousemove(event);
    });
    this.canvasElement.addEventListener("mouseup", (_e: MouseEvent) => {
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
      this.reset()
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
    this.last.set(event.clientX, event.clientY);

    // delete
    if (this.mode == FloorplannerMode.DELETE) {
      if (this.activeCorner) {
        this.activeCorner.removeAll();
      } else if (this.activeWall) {
        this.activeWall.remove();
      } else {
        this.setMode(FloorplannerMode.MOVE);
      }
    }
  }


  /** */
  private mousemove(event: MouseEvent) {
    const offset = this.clientToOffset(event.clientX, event.clientY);

    this.mouseMoved = true;

    // update mouse
    const client = new V2(event.clientX, event.clientY);

    this.mouse.copy(this.offsetToWorld(offset));

    // update target (snapped position of actual mouse)
    if (this.mode == FloorplannerMode.DRAW || (this.mode == FloorplannerMode.MOVE && this.mouseDown)) {
      this.updateTarget();
    }

    // update object target
    if (this.mode != FloorplannerMode.DRAW && !this.mouseDown) {
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
      const mouseDelta = new V2().subVectors(this.last, client);
      this.origin.add(mouseDelta)
      this.last.copy(client);
      this.view.draw();
    }

    // dragging
    if (this.mode == FloorplannerMode.MOVE && this.mouseDown) {
      if (this.activeCorner) {
        this.activeCorner.move(this.mouse.x, this.mouse.y);
        this.activeCorner.snapToAxis(snapTolerance);
      } else if (this.activeWall) {
        const rawPos = this.offsetToWorld(client);
        const lastPos = this.offsetToWorld(this.last);
        const moveDelta = new V2().subVectors(rawPos, lastPos);
        this.activeWall.relativeMove(moveDelta.x, moveDelta.y);
        this.activeWall.snapToAxis(snapTolerance);
        this.last.copy(client);
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
    const zoomFactor = 1.15;
    const mouseScreenPos = this.clientToOffset(event.clientX, event.clientY);
    const mouseWorldPos = this.offsetToWorld(mouseScreenPos);

    let scale = this.cmPerPixel;
    //console.log(event);
    if (event.deltaY > 0) {
      //console.log("zoom out");
      scale *= zoomFactor;
    } else if (event.deltaY < 0) {
      //console.log("zoom in");
      scale /= zoomFactor;
    }
    this.setView(scale, mouseWorldPos, mouseScreenPos);
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
    this.setView(scale, planCenter, { x: screenCenterX, y: screenCenterY});
  }
  public setView(scale: number, worldPt: Point, screenPt: Point) {
    // want to set the origin so that worldPt goes to screenPt
    // screenPt.x = (worldPt.x / this.cmPerPixel) - this.origin.x
    this.origin.x = worldPt.x / scale - screenPt.x;
    this.origin.y = worldPt.y / scale - screenPt.y;
    this.cmPerPixel = scale;
    this.view.draw();
  }

}
