import * as THREE from "three";
import { Controller } from "./controller";
import { Floorplan } from "./floorplan";
import { Lights } from "./lights";
import { Controls } from "./controls";
import { HUD } from "./hud";
import { Scene } from "../model/scene";
import { Model } from "../model/model";
import { Utils } from "../core/utils";
import { Skybox } from "./skybox";

export class Main {
  private options: any = {
    resize: true,
    pushHref: false,
    spin: true,
    spinSpeed: 0.00002,
    clickPan: true,
    canMoveFixedItems: false,
  };

  private scene: Scene;

  private element: HTMLElement;

  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  public controls: Controls;
  // apparently superfluous
  //private canvas: Three.Canvas;
  private controller: Controller;
  // FIXME: extinguish this eldrich horror of a member variable
  // @ts-ignore: don't want to figure this out right now
  private floorplan: Floorplan;

  private needsUpdate: boolean = false;

  private lastRender = Date.now();
  private mouseOver: boolean = false;
  private hasClicked: boolean = false;

  private hud: HUD;

  public heightMargin: number;
  public widthMargin: number;
  private elementHeight: number;
  private elementWidth: number;

  public itemSelectedCallbacks = $.Callbacks(); // item
  public itemUnselectedCallbacks = $.Callbacks();

  public wallClicked = $.Callbacks(); // wall
  public floorClicked = $.Callbacks(); // floor
  public nothingClicked = $.Callbacks();

  private renderCount: number = 0;
  private animationFrameCount: number = 0;

  constructor(
    private model: Model,
    elementSelector: string,
    _canvasElement: string,
    opts: any
  ) {
    const element = $(elementSelector).get(0);
    if (element instanceof HTMLElement) {
      this.element = element;
    } else {
      throw Error(`Couldn't find element ${elementSelector}`);
    }
    // override with manually set options
    for (var opt in this.options) {
      if (this.options.hasOwnProperty(opt) && opts.hasOwnProperty(opt)) {
        this.options[opt] = opts[opt];
      }
    }
    THREE.ImageUtils.crossOrigin = "";

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true, // required to support .toDataURL()
    });
    (this.renderer.autoClear = false), (this.renderer.shadowMap.enabled = true);
    // FIXME: not in three.js 81
    //this.renderer.shadowMapSoft = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = model.scene;
    new Skybox(this.scene);

    this.controls = new Controls(this.camera, this.element);

    this.hud = new HUD(this);

    this.element.appendChild(this.renderer.domElement);

    this.controller = new Controller(
      this,
      model,
      this.camera,
      this.renderer.domElement,
      this.controls,
      this.hud
    );

    // tsc wants to see these members initialized here in
    // the constructor.  They are unconditionally set in
    // this.updateWindowSize().
    this.heightMargin = this.widthMargin = 10; 
    this.elementHeight = this.elementWidth = 10;
    this.updateWindowSize();
    // handle window resizing
    if (this.options.resize) {
      window.addEventListener("resize", (_event: Event) =>
        this.updateWindowSize()
      );
    }

    // setup camera nicely
    this.centerCamera();
    model.floorplan.fireOnUpdatedRooms(() => this.centerCamera());

    new Lights(this.scene, this.model.floorplan);

    this.floorplan = new Floorplan(this.scene, this.model.floorplan);

    this.animate();

    this.element.addEventListener("mouseenter", (_event: Event) => {
      this.mouseOver = true;
    });
    this.element.addEventListener("mouseleave", (_event: Event) => {
      this.mouseOver = false;
    });
    this.element.addEventListener("click", (_event: MouseEvent) => {
      this.hasClicked = true;
    });

    //canvas = new ThreeCanvas(canvasElement, this);

    setInterval(() => console.log(`rendercount=${this.renderCount}`), 5*1000);
    setInterval(() => {
      if (this.animationFrameCount > 0) {
        const pct = this.renderCount / this.animationFrameCount * 100;
        const pct_str = pct.toFixed(2);
        console.log(`animationFrameCount=${this.animationFrameCount}, renders=${pct_str}%`);
      }
    }, 60*1000);
  }

  private spin() {
    if (this.options.spin && !this.mouseOver && !this.hasClicked) {
      var theta =
        2 * Math.PI * this.options.spinSpeed * (Date.now() - this.lastRender);
      this.controls.rotateLeft(theta);
      this.controls.update();
    }
  }

  public stopSpin() {
    this.hasClicked = true;
  }

  public getController() {
    return this.controller;
  }

  private shouldRender() {
    // Do we need to draw a new frame
    if (
      this.controls.needsUpdate ||
      this.controller.needsUpdate ||
      this.needsUpdate ||
      this.model.scene.needsUpdate
    ) {
      this.controls.needsUpdate = false;
      this.controller.needsUpdate = false;
      this.needsUpdate = false;
      this.model.scene.needsUpdate = false;
      return true;
    } else {
      return false;
    }
  }

  private render() {
    this.animationFrameCount++;
    this.spin();
    if (this.shouldRender()) {
      this.renderer.clear();
      this.renderer.render(this.scene.getScene(), this.camera);
      this.renderer.clearDepth();
      this.renderCount++;
      this.renderer.render(this.hud.getScene(), this.camera);
      const chatter = false;
      if (chatter) {
        console.log(
          `renderer.info.memory.textures: ${this.renderer.info.memory.textures}`
        );
      }
    }
    this.lastRender = Date.now();
  }

  // so we're not creating unnecessary objects in background
  private animateCallback = this.animate.bind(this);

  private animate() {
    this.render();
    requestAnimationFrame(this.animateCallback);
  }

  public setCursorStyle(cursorStyle: string) {
    this.element.style.cursor = cursorStyle;
  }

  public updateWindowSize() {
    this.heightMargin = this.element.offsetTop;
    this.widthMargin = this.element.offsetLeft;

    this.elementWidth = this.element.clientWidth;
    if (this.options.resize) {
      this.elementHeight = window.innerHeight - this.heightMargin;
    } else {
      this.elementHeight = this.element.clientHeight;
    }

    this.camera.aspect = this.elementWidth / this.elementHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.elementWidth, this.elementHeight);
    this.needsUpdate = true;
  }
  public setNeedsUpdate() {
    this.needsUpdate = true;
  }

  public centerCamera() {
    var yOffset = 75; // how far in cm above floor level camera target should be

    const pan2 = this.model.floorplan.getCenter2();
    const pan = Utils.deflatten(pan2, yOffset);

    this.controls.target = pan;

    var distance = this.model.floorplan.getSize2().y * 1.5;

    var offset = pan.clone().add(new THREE.Vector3(0, distance, distance));
    //this.controls.setOffset(offset);
    this.camera.position.copy(offset);

    this.controls.update();
  }

  // projects the object's center point into x,y screen coords
  // x,y are relative to top left corner of viewer
  projectVector(vec3: THREE.Vector3, ignoreMargin?: boolean) {
    ignoreMargin = ignoreMargin || false;

    var widthHalf = this.elementWidth / 2;
    var heightHalf = this.elementHeight / 2;

    var vector = new THREE.Vector3();
    vector.copy(vec3);
    vector.project(this.camera);

    var vec2 = new THREE.Vector2();

    vec2.x = vector.x * widthHalf + widthHalf;
    vec2.y = -(vector.y * heightHalf) + heightHalf;

    if (!ignoreMargin) {
      vec2.x += this.widthMargin;
      vec2.y += this.heightMargin;
    }

    return vec2;
  }
}
