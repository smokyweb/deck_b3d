import * as THREE from "three";
import { Dimensioning } from "../core/dimensioning";
import { Floorplan } from "../model/floorplan";
import { Wall, WallType } from "../model/wall";
import { Room } from "../model/room";
import { Corner } from "../model/corner";
import { Floorplanner } from "./floorplanner";
import { Point } from "../core/utils";

/** */
export enum FloorplannerMode {
  MOVE,
  DRAW,
  DELETE,
  ADDPOST,
  DELETEPOST,
}

// grid parameters
const gridWidth = 1;
const gridColor = "#a0a0a0";

// room config
const roomColor = "#f9f9f9";

// wall config
const wallWidth = 5;
const wallWidthHover = 7;
const wallColorDefault = "#bbbbbb";
const wallColorRailing = "#bb8888";
const wallColorHover = "#008cba";
/*
const edgeColor = "#888888"
const edgeColorHover = "#008cba"
const edgeWidth = 1
*/

const deleteColor = "#ff0000";

// corner config
const cornerRadius = 0;
const cornerRadiusHover = 7;
const cornerColor = "#cccccc";
const cornerColorHover = "#008cba";

/**
 * The View to be used by a Floorplanner to render in/interact with.
 */
export class FloorplannerView {
  /** The canvas element. */
  private canvasElement: HTMLCanvasElement;

  /** The 2D context. */
  private context: CanvasRenderingContext2D | null;

  /** */
  constructor(
    private floorplan: Floorplan,
    private viewmodel: Floorplanner,
    private canvas: string,
  ) {
    this.canvasElement = <HTMLCanvasElement>document.getElementById(canvas);
    this.context = this.canvasElement.getContext("2d");

    var scope = this;
    window.addEventListener("resize", () => {
      scope.handleWindowResize();
    });
    this.handleWindowResize();
  }

  /** */
  public handleWindowResize() {
    var canvasSel = $("#" + this.canvas);
    var parent = canvasSel.parent();
    const ih = parent.innerHeight();
    if (ih !== undefined) {
      canvasSel.height(ih);
      this.canvasElement.height = ih;
    }
    const iw = parent.innerWidth();
    if (iw !== undefined) {
      canvasSel.width(iw);
      this.canvasElement.width = iw;
    }
    this.draw();
  }

  /** */
  public draw() {
    if (this.context) {
      this.context.clearRect(
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height,
      );
    }

    this.drawGrid();

    this.floorplan.getRooms().forEach((room) => {
      this.drawRoom(room);
    });

    if (this.viewmodel.lastActiveWall) {
      this.drawWallHalo(this.viewmodel.lastActiveWall);
    }

    this.floorplan.getWalls().forEach((wall) => {
      this.drawWall(wall);
    });

    this.floorplan.getCorners().forEach((corner) => {
      this.drawCorner(corner);
    });

    if (this.viewmodel.mode == FloorplannerMode.DRAW) {
      this.drawTarget(this.viewmodel.target.x, this.viewmodel.target.y);
    }

    this.floorplan.getWalls().forEach((wall) => {
      this.drawWallLabel(wall);
    });

    const drawChecks = false;
    if (drawChecks) {
      this.drawViewChecks();
    }
  }

  private drawWorldStar(world: THREE.Vector2, radius: number, color: string) {
    const NPTS = 8;
    for (let i = 0; i < NPTS; i++) {
      const angle = (Math.PI * i) / NPTS;
      const delta = new THREE.Vector2(
        Math.cos(angle),
        Math.sin(angle),
      ).multiplyScalar(radius);
      const startWorld = new THREE.Vector2().addVectors(world, delta);
      const endWorld = new THREE.Vector2().subVectors(world, delta);
      const startCanvas = this.viewmodel.worldToCanvas(startWorld);
      const endCanvas = this.viewmodel.worldToCanvas(endWorld);
      this.drawLine(
        startCanvas.x,
        startCanvas.y,
        endCanvas.x,
        endCanvas.y,
        2,
        color,
      );
    }
  }
  private drawViewChecks() {
    this.drawWorldStar(new THREE.Vector2(0, 0), 50, "green");
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    this.drawWorldStar(
      this.viewmodel.canvasToWorld(new THREE.Vector2(0, 0)),
      50,
      "red",
    );
    this.drawWorldStar(
      this.viewmodel.canvasToWorld(new THREE.Vector2(width, 0)),
      50,
      "yello",
    );
    this.drawWorldStar(
      this.viewmodel.canvasToWorld(new THREE.Vector2(0, height)),
      50,
      "orange",
    );
    this.drawWorldStar(
      this.viewmodel.canvasToWorld(new THREE.Vector2(width, height)),
      50,
      "gray",
    );
  }

  /** */
  private drawWall(wall: Wall) {
    const hover = wall === this.viewmodel.activeWall;
    let color = wallColorDefault;
    if (wall.wallType == WallType.Railing) {
      color = wallColorRailing;
    }
    if (hover && this.viewmodel.mode == FloorplannerMode.DELETE) {
      color = deleteColor;
    } else if (hover) {
      color = wallColorHover;
    }
    const start = this.viewmodel.worldToCanvas(wall.start);
    const end = this.viewmodel.worldToCanvas(wall.end);
    this.drawLine(
      start.x,
      start.y,
      end.x,
      end.y,
      hover ? wallWidthHover : wallWidth,
      color,
    );
  }
  private drawWallHalo(wall: Wall) {
    const start = this.viewmodel.worldToCanvas(wall.start);
    const end = this.viewmodel.worldToCanvas(wall.end);
    const ctx = this.context;
    if (ctx) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.lineWidth = wallWidth * 3;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "gray";
      ctx.stroke();
      ctx.restore();
    }
  }

  /** */
  private drawWallLabel(wall: Wall) {
    var pos = wall.center();
    var length = wall.length();
    if (length < 60) {
      // dont draw labels on walls this short
      return;
    }
    if (this.context) {
      this.context.font = "normal 12px Arial";
      this.context.fillStyle = "#000000";
      this.context.textBaseline = "middle";
      this.context.textAlign = "center";
      this.context.strokeStyle = "#ffffff";
      this.context.lineWidth = 4;

      const screenPos = this.viewmodel.worldToCanvas(pos);
      this.context.strokeText(
        Dimensioning.cmToMeasure(length),
        screenPos.x,
        screenPos.y,
      );
      this.context.fillText(
        Dimensioning.cmToMeasure(length),
        screenPos.x,
        screenPos.y,
      );
    }
  }

  /** */

  /** */
  private drawRoom(room: Room) {
    this.drawPolygon(room.corners, true, roomColor);
  }

  /** */
  private drawCorner(corner: Corner) {
    var hover = corner === this.viewmodel.activeCorner;
    var color = cornerColor;
    if (hover && this.viewmodel.mode == FloorplannerMode.DELETE) {
      color = deleteColor;
    } else if (hover) {
      color = cornerColorHover;
    }
    const screenCorner = this.viewmodel.worldToCanvas(corner);
    this.drawCircle(
      screenCorner.x,
      screenCorner.y,
      hover ? cornerRadiusHover : cornerRadius,
      color,
    );
  }

  /** */
  private drawTarget(x: number, y: number) {
    const screenPos = this.viewmodel.worldToCanvas({ x, y });
    this.drawCircle(
      screenPos.x,
      screenPos.y,
      cornerRadiusHover,
      cornerColorHover,
    );
    if (this.viewmodel.lastNode) {
      const lastNodePos = this.viewmodel.worldToCanvas(this.viewmodel.lastNode);
      this.drawLine(
        lastNodePos.x,
        lastNodePos.y,
        screenPos.x,
        screenPos.y,
        wallWidthHover,
        wallColorHover,
      );
    }
  }

  /** Draws line in canvas coords*/
  private drawLine(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number,
    color: string,
  ) {
    // width is an integer
    // color is a hex string, i.e. #ff0000
    if (this.context) {
      this.context.beginPath();
      this.context.moveTo(startX, startY);
      this.context.lineTo(endX, endY);
      this.context.lineWidth = width;
      this.context.strokeStyle = color;
      this.context.stroke();
    }
  }

  /** */
  private drawPolygon(
    corners: Point[],
    fill: boolean,
    fillColor: string | null,
    stroke?: boolean,
    strokeColor?: string,
    strokeWidth?: number,
  ) {
    // fillColor is a hex string, i.e. #ff0000
    fill = fill || false;
    stroke = stroke || false;
    const cornerPosArr = corners.map((corner) =>
      this.viewmodel.worldToCanvas(corner),
    );
    if (this.context) {
      this.context.beginPath();
      this.context.moveTo(cornerPosArr[0].x, cornerPosArr[0].y);
      for (var i = 1; i < cornerPosArr.length; i++) {
        this.context.lineTo(cornerPosArr[i].x, cornerPosArr[i].y);
      }
      this.context.closePath();
      if (fill && fillColor !== null) {
        this.context.fillStyle = fillColor;
        this.context.fill();
      }
      if (stroke && strokeWidth !== undefined && strokeColor !== undefined) {
        this.context.lineWidth = strokeWidth;
        this.context.strokeStyle = strokeColor;
        this.context.stroke();
      }
    }
  }

  /** */
  private drawCircle(
    centerX: number,
    centerY: number,
    radius: number,
    fillColor: string,
  ) {
    if (this.context) {
      this.context.beginPath();
      this.context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
      this.context.fillStyle = fillColor;
      this.context.fill();
    }
  }

  private calcGrid(start: number, end: number, interval: number): number[] {
    const ifirst = Math.floor(start / interval);
    const ilast = Math.ceil(end / interval);
    const result = new Array<number>();
    for (let i = ifirst; i <= ilast; i++) {
      result.push(i * interval);
    }
    return result;
  }

  /** */
  private drawGrid() {
    const gridSpacing = 12 / 0.3048; // cm per foot
    //const gridSpacing = 49.3;
    //console.log(gridSpacing);
    const bounds = this.canvasElement.getBoundingClientRect();
    const ul = this.viewmodel.canvasToWorld({ x: 0, y: 0 });
    const lr = this.viewmodel.canvasToWorld({
      x: bounds.width,
      y: bounds.height,
    });
    const gridX = this.calcGrid(ul.x, lr.x, gridSpacing);
    const gridY = this.calcGrid(ul.y, lr.y, gridSpacing);
    //console.log("ul, lr, gridX:", ul, lr, gridX);
    gridX.forEach((x) => {
      const p = this.viewmodel.worldToCanvas({ x, y: 0 });
      this.drawLine(p.x, 0, p.x, bounds.height, gridWidth, gridColor);
    });
    gridY.forEach((y) => {
      const p = this.viewmodel.worldToCanvas({ x: 0, y });
      this.drawLine(0, p.y, bounds.width, p.y, gridWidth, gridColor);
    });
  }
}
