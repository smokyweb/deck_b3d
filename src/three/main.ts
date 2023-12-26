
import * as THREE from 'three';
import { Controller } from './controller';
import { Floorplan } from './floorplan';
import { Lights } from './lights';
import { Skybox } from './skybox';
import { Controls } from './controls';
import { HUD } from './hud';
import { Scene } from '../model/scene';
import { Model } from '../model/model';

export class Main {
  private options: any = {
    resize: true,
    pushHref: false,
    spin: true,
    spinSpeed: .00002,
    clickPan: true,
    canMoveFixedItems: false
  }


  private scene: Scene;

  private element: JQuery<HTMLElement>;
  private domElement: HTMLElement;

  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  public controls: Controls;
  // apparently superfluous
  //private canvas: Three.Canvas;
  private controller: Controller;
  private floorplan: Floorplan;

  private needsUpdate: boolean = false;

  private lastRender = Date.now();
  private mouseOver: boolean = false;
  private hasClicked: boolean = false;

  private hud: HUD;

  // FIXME:  These aren't properly initialized
  public heightMargin: number = 10;
  public widthMargin: number = 10;
  private elementHeight: number = 10;
  private elementWidth: number = 10;

  public itemSelectedCallbacks = $.Callbacks(); // item
  public itemUnselectedCallbacks = $.Callbacks();

  public wallClicked = $.Callbacks(); // wall
  public floorClicked = $.Callbacks(); // floor
  public nothingClicked = $.Callbacks();

  constructor(private model: Model, element: string, private canvasElement: string, opts: any) {
    this.element = $(element);
    // override with manually set options
    for (var opt in this.options) {
      if (this.options.hasOwnProperty(opt) && opts.hasOwnProperty(opt)) {
        this.options[opt] = opts[opt]
      }
    }
    THREE.ImageUtils.crossOrigin = "";

    {
      const e = this.element.get(0);
      if (!(e instanceof HTMLElement)) {
        throw Error(`Three.Main element '${element}' is not an HTMLElement`);
      }
      this.domElement = e;
    }
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true // required to support .toDataURL()
    });
    this.renderer.autoClear = false,
    this.renderer.shadowMap.enabled = true;
    // FIXME: not in three.js 81
    //this.renderer.shadowMapSoft = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = model.scene;
    var skybox = new Skybox(this.scene);

    this.controls = new Controls(this.camera, this.domElement);

    this.hud = new HUD(this);

    this.domElement.appendChild(this.renderer.domElement);

    this.controller = new Controller(
      this, model, this.camera, this.renderer.domElement, this.controls, this.hud);

    // handle window resizing
    this.updateWindowSize();
    if (this.options.resize) {
      $(window).resize(() => this.updateWindowSize());
    }

    // setup camera nicely
    this.centerCamera();
    model.floorplan.fireOnUpdatedRooms(() => this.centerCamera());

    var lights = new Lights(this.scene, this.model.floorplan);

    this.floorplan = new Floorplan(this.scene,
      this.model.floorplan, this.controls);

    this.animate();

    this.element.mouseenter(() => { this.mouseOver = true; });
    this.element.mouseleave(() => { this.mouseOver = false; });
    this.element.click(() => { this.hasClicked = true;});

    //canvas = new ThreeCanvas(canvasElement, this);
  }

  private spin() {
    if (this.options.spin && !this.mouseOver && !this.hasClicked) {
      var theta = 2 * Math.PI * this.options.spinSpeed * (Date.now() - this.lastRender);
      this.controls.rotateLeft(theta);
      this.controls.update()
    }
  }

  private dataUrl() {
    var dataUrl = this.renderer.domElement.toDataURL("image/png");
    return dataUrl;
  }

  public stopSpin() {
    this.hasClicked = true;
  }

  private getModel() {
    return this.model;
  }

  private getScene() {
    return this.scene;
  }

  public getController() {
    return this.controller;
  }

  private getCamera() {
    return this.camera;
  }

  private shouldRender() {
    // Do we need to draw a new frame
    if (this.controls.needsUpdate || this.controller.needsUpdate || this.needsUpdate || this.model.scene.needsUpdate) {
      this.controls.needsUpdate = false;
      this.controller.needsUpdate = false;
      this.needsUpdate = false;
      this.model.scene.needsUpdate = false;
      return true;
    } else {
      return false;
    }
  }

  private nrenders: number = 0;
  private render() {
    if (this.nrenders < 10) {
      //console.log("Three.Main.render() scene=", this.scene, " camera=", this.camera);
    }
    this.nrenders++;
    this.spin();
    if (this.shouldRender()) {
      this.renderer.clear();
      this.renderer.render(this.scene.getScene(), this.camera);
      this.renderer.clearDepth();
      this.renderer.render(this.hud.getScene(), this.camera);
    }
    this.lastRender = Date.now();
  };

  private animate() {
    var delay = 50;
    setTimeout(() => {
      requestAnimationFrame(() => this.animate());
    }, delay);
    this.render();
  };

  public setCursorStyle(cursorStyle: string) {
    this.domElement.style.cursor = cursorStyle;
  };

  public updateWindowSize() {
    this.heightMargin = this.domElement.offsetTop;
    this.widthMargin = this.domElement.offsetLeft;

    this.elementWidth = this.domElement.clientWidth;
    if (this.options.resize) {
      this.elementHeight = window.innerHeight - this.heightMargin;
    } else {
      this.elementHeight = this.domElement.clientHeight;
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
    var yOffset = 150.0;

    var pan = this.model.floorplan.getCenter();
    pan.y = yOffset;

    this.controls.target = pan;

    var distance = this.model.floorplan.getSize().z * 1.5;

    var offset = pan.clone().add(
      new THREE.Vector3(0, distance, distance));
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

    vec2.x = (vector.x * widthHalf) + widthHalf;
    vec2.y = - (vector.y * heightHalf) + heightHalf;

    if (!ignoreMargin) {
      vec2.x += this.widthMargin;
      vec2.y += this.heightMargin;
    }

    return vec2;
  }
}
