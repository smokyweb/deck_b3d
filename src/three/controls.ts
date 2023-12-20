/**
This file is a modified version of THREE.OrbitControls
Contributors:
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */

/// <reference path="../../lib/jquery.d.ts" />
import * as THREE from 'three';

const EPS = 0.000001;
// The four arrow keys
enum Keys { 
  LEFT = 37, 
  UP = 38, 
  RIGHT = 39, 
  BOTTOM = 40 
};

enum STATE { 
  NONE = -1, 
  ROTATE = 0, 
  DOLLY = 1, 
  PAN = 2, 
  TOUCH_ROTATE = 3, 
  TOUCH_DOLLY = 4, 
  TOUCH_PAN = 5
};

export class Controls {
  // Set to false to disable this control
  private enabled: Boolean = true;
  // "target" sets the location of focus, where the control orbits around
  // and where it pans with respect to.
  public target: THREE.Vector3 = new THREE.Vector3();
  // center is old, deprecated; use "target" instead
  private center: THREE.Vector3 = this.target;
  // This option actually enables dollying in and out; left as "zoom" for
  // backwards compatibility
  private noZoom: Boolean = false;
  private zoomSpeed: number = 1.0;
  // Limits to how far you can dolly in and out
  private minDistance: number = 0;
  private maxDistance: number = 1500; //Infinity;
  // Set to true to disable this control
  private noRotate: Boolean = false;
  private rotateSpeed: number = 1.0;

  // Set to true to disable this control
  private noPan: Boolean = false;
  private keyPanSpeed: number = 40.0;	// pixels moved per arrow key push
  // Set to true to automatically rotate around the target
  private autoRotate: Boolean = false;
  private autoRotateSpeed: number = 2.0; // 30 seconds per round when fps is 60

  // How far you can orbit vertically, upper and lower limits.
  // Range is 0 to Math.PI radians.
  private minPolarAngle: number = 0; // radians
  private maxPolarAngle: number = Math.PI / 2; // radians

  // Set to true to disable use of the keys
  private noKeys: Boolean = false;


  public cameraMovedCallbacks = $.Callbacks();

  public needsUpdate: Boolean = true;

  private rotateStart: THREE.Vector2 = new THREE.Vector2();
  private rotateEnd: THREE.Vector2 = new THREE.Vector2();
  private rotateDelta: THREE.Vector2 = new THREE.Vector2();

  private panStart: THREE.Vector2 = new THREE.Vector2();
  private panEnd: THREE.Vector2 = new THREE.Vector2();
  private panDelta: THREE.Vector2 = new THREE.Vector2();

  private dollyStart: THREE.Vector2 = new THREE.Vector2();
  private dollyEnd: THREE.Vector2 = new THREE.Vector2();
  private dollyDelta: THREE.Vector2 = new THREE.Vector2();

  private phiDelta: number = 0;
  private thetaDelta: number = 0;
  private scale: number = 1;
  private pan: THREE.Vector3 = new THREE.Vector3();

  private state: STATE = STATE.NONE;
  private domElement: HTMLElement;

  private onMouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);
  private onMouseUpHandler = (event: MouseEvent) => this.onMouseUp();

  constructor(public object: THREE.Camera, domElement?: HTMLElement | Document) {

    this.object = object;
    if (domElement === document || domElement == undefined) {
      this.domElement = document.body;
    } else if (domElement instanceof HTMLElement) {
      this.domElement = domElement;
    } else {
      throw Error("domElement was instanceOf Document but !== document?");
    }

    this.domElement.addEventListener('contextmenu', (event) => { event.preventDefault(); }, false);
    this.domElement.addEventListener('mousedown', (event: MouseEvent) => this.onMouseDown(event), false);
    // FIXME: Add support for scroll and scrollend events
    this.domElement.addEventListener('wheel', (event: WheelEvent) => this.onMouseWheel(event), false);
    this.domElement.addEventListener('touchstart', (event: TouchEvent) => this.touchstart(event), false);
    this.domElement.addEventListener('touchend', (event: TouchEvent) => this.touchend(event), false);
    this.domElement.addEventListener('touchmove', (event: TouchEvent) => this.touchmove(event), false);

    window.addEventListener('keydown', (event: KeyboardEvent) => this.onKeyDown(event), false);
  }

  private controlsActive(): Boolean {
    return (this.state === STATE.NONE);
  }

  private setPan(vec3: THREE.Vector3) {
    this.pan = vec3;
  }

  private panTo(vec3: THREE.Vector3) {
    var newTarget = new THREE.Vector3(vec3.x, this.target.y, vec3.z);
    var delta = this.target.clone().sub(newTarget);
    this.pan.sub(delta);
    this.update();
  }

  public rotateLeft(angle?: number) {
    if (angle === undefined) {
      angle = this.getAutoRotationAngle();
    }
    this.thetaDelta -= angle;
  }

  private rotateUp(angle?: number) {
    if (angle === undefined) {
      angle = this.getAutoRotationAngle();
    }
    this.phiDelta -= angle;
  }

  // pass in distance in world space to move left
  private panLeft(distance: number) {

    var panOffset = new THREE.Vector3();
    var te = this.object.matrix.elements;
    // get X column of matrix
    panOffset.set(te[0], 0, te[2]);
    panOffset.normalize();

    panOffset.multiplyScalar(-distance);

    this.pan.add(panOffset);
  }

  // pass in distance in world space to move up
  private panUp(distance: number) {

    var panOffset = new THREE.Vector3();
    var te = this.object.matrix.elements;
    // get Y column of matrix
    panOffset.set(te[4], 0, te[6]);
    panOffset.normalize();
    panOffset.multiplyScalar(distance);

    this.pan.add(panOffset);
  };

  // main entry point; pass in Vector2 of change desired in pixel space,
  // right and down are positive
  private doPan(delta: THREE.Vector2) {


    if (this.object instanceof THREE.PerspectiveCamera) {

      // perspective
      var position = this.object.position;
      var offset = position.clone().sub(this.target);
      var targetDistance = offset.length();

      // half of the fov is center to top of screen
      targetDistance *= Math.tan((this.object.fov / 2) * Math.PI / 180.0);
      // we actually don't use screenWidth, since perspective camera is fixed to screen height
      this.panLeft(2 * delta.x * targetDistance / this.domElement.clientHeight);
      this.panUp(2 * delta.y * targetDistance / this.domElement.clientHeight);
    } else if (this.object instanceof THREE.OrthographicCamera) {

      // orthographic
      this.panLeft(delta.x * (this.object.right - this.object.left) / this.domElement.clientWidth);
      this.panUp(delta.y * (this.object.top - this.object.bottom) / this.domElement.clientHeight);
    } else {

      // camera neither orthographic or perspective - warn user
      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
    }

    this.update()
  };

  private panXY(x: number, y: number) {
    this.doPan(new THREE.Vector2(x, y));
  }

  private dollyOut(dollyScale?: number) {
    if (dollyScale === undefined) {
      dollyScale = this.getZoomScale();
    }

    this.scale /= dollyScale;
    console.log("dollyOut, new scale is ", this.scale);
  }

  private dollyIn(dollyScale?: number) {
    if (dollyScale === undefined) {
      dollyScale = this.getZoomScale();
    }

    this.scale *= dollyScale;
    console.log("dollyIn, new scale is ", this.scale);
  }

  public update() {
    var position = this.object.position;
    var offset = position.clone().sub(this.target);

    // angle from z-axis around y-axis
    var theta = Math.atan2(offset.x, offset.z);

    // angle from y-axis
    var phi = Math.atan2(Math.sqrt(offset.x * offset.x + offset.z * offset.z), offset.y);

    if (this.autoRotate) {
      this.rotateLeft(this.getAutoRotationAngle());
    }

    theta += this.thetaDelta;
    phi += this.phiDelta;

    // restrict phi to be between desired limits
    phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, phi));

    // restrict phi to be betwee EPS and PI-EPS
    phi = Math.max(EPS, Math.min(Math.PI - EPS, phi));

    var radius = offset.length() * this.scale;

    // restrict radius to be between desired limits
    radius = Math.max(this.minDistance, Math.min(this.maxDistance, radius));

    // move target to panned location
    this.target.add(this.pan);

    offset.x = radius * Math.sin(phi) * Math.sin(theta);
    offset.y = radius * Math.cos(phi);
    offset.z = radius * Math.sin(phi) * Math.cos(theta);

    position.copy(this.target).add(offset);

    this.object.lookAt(this.target);

    this.thetaDelta = 0;
    this.phiDelta = 0;
    this.scale = 1;
    this.pan.set(0, 0, 0);

    this.cameraMovedCallbacks.fire();
    this.needsUpdate = true;
  }

  private getAutoRotationAngle(): number {
    return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
  }

  private getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed);
  }

  // FIXME: event should have a type
  // FIXME: Handle multiple button presses
  private onMouseDown(event: MouseEvent) {

    if (this.enabled === false) { return; }
    event.preventDefault();

    if (event.button === 0) {
      if (this.noRotate === true) { return; }

      this.state = STATE.ROTATE;

      this.rotateStart.set(event.clientX, event.clientY);

    } else if (event.button === 1) {
      if (this.noZoom === true) { return; }

      this.state = STATE.DOLLY;

      this.dollyStart.set(event.clientX, event.clientY);

    } else if (event.button === 2) {
      if (this.noPan === true) { return; }

      this.state = STATE.PAN;

      this.panStart.set(event.clientX, event.clientY);
    }

    // FIXME: Yet another crime against humanity.  This doesn't work when multiple
    //        mouse buttons arre pressed.  Event listeners should not be added and
    //        removed willy-nilly.  Event listeners need ot be bound, but bind does
    //        not work idepotently, and thus returns a new incomparable object every time.
    // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
    this.domElement.addEventListener('mousemove', this.onMouseMoveHandler, false);
    this.domElement.addEventListener('mouseup', this.onMouseUpHandler, false);
  }

  // FIXME:  event needs a type
  private onMouseMove(event: any) {

    if (this.enabled === false) return;

    event.preventDefault();

    if (this.state === STATE.ROTATE) {

      if (this.noRotate === true) return;

      this.rotateEnd.set(event.clientX, event.clientY);
      this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);

      // rotating across whole screen goes 360 degrees around
      this.rotateLeft(2 * Math.PI * this.rotateDelta.x / this.domElement.clientWidth * this.rotateSpeed);
      // rotating up and down along whole screen attempts to go 360, but limited to 180
      this.rotateUp(2 * Math.PI * this.rotateDelta.y / this.domElement.clientHeight * this.rotateSpeed);

      this.rotateStart.copy(this.rotateEnd);

    } else if (this.state === STATE.DOLLY) {

      if (this.noZoom === true) return;

      this.dollyEnd.set(event.clientX, event.clientY);
      this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

      if (this.dollyDelta.y > 0) {

        this.dollyIn();

      } else {

        this.dollyOut();

      }

      this.dollyStart.copy(this.dollyEnd);

    } else if (this.state === STATE.PAN) {

      if (this.noPan === true) return;

      this.panEnd.set(event.clientX, event.clientY);
      this.panDelta.subVectors(this.panEnd, this.panStart);

      this.doPan(this.panDelta);

      this.panStart.copy(this.panEnd);
    }

    // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
    this.update();
  }

  private onMouseUp( /* event */) {
    if (this.enabled === false) return;

    // FIXME: Yet another crime against humanity.  This doesn't work when multiple
    //        mouse buttons arre pressed.  Event listeners should not be added and
    //        removed willy-nilly.  Event listeners need ot be bound, but bind does
    //        not work idepotently, and thus returns a new incomparable object every time.
    // Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
    this.domElement.removeEventListener('mousemove', this.onMouseMoveHandler, false);
    this.domElement.removeEventListener('mouseup', this.onMouseUpHandler, false);

    this.state = STATE.NONE;
  }

  // FIXME: event needs a type
  private onMouseWheel(event: WheelEvent) {
    if (this.enabled === false || this.noZoom === true) return;

    // negative zooms out, positive zooms in
    // left (-x) zooms out and right (+x) zooms in
    // up (-y, left-handed coordinates) zooms in and down (+y) zooms out

    console.log("controls.onMouseWheel", event);
    const delta = event.deltaX - event.deltaY + event.deltaZ;

    if (delta < 0) {
      this.dollyOut();
    } else {
      this.dollyIn();
    }
    this.update();
  }

  private onKeyDown(event: KeyboardEvent) {

    if (this.enabled === false) { return; }
    if (this.noKeys === true) { return; }
    if (this.noPan === true) { return; }

    switch (event.keyCode) {

      case Keys.UP:
        this.doPan(new THREE.Vector2(0, this.keyPanSpeed));
        break;
      case Keys.BOTTOM:
        this.doPan(new THREE.Vector2(0, -this.keyPanSpeed));
        break;
      case Keys.LEFT:
        this.doPan(new THREE.Vector2(this.keyPanSpeed, 0));
        break;
      case Keys.RIGHT:
        this.doPan(new THREE.Vector2(-this.keyPanSpeed, 0));
        break;
    }

  }

  private touchstart(event: TouchEvent) {

    if (this.enabled === false) { return; }

    switch (event.touches.length) {

      case 1:	// one-fingered touch: rotate
        if (this.noRotate === true) { return; }

        this.state = STATE.TOUCH_ROTATE;

        this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
        break;

      case 2:	// two-fingered touch: dolly
        if (this.noZoom === true) { return; }

        this.state = STATE.TOUCH_DOLLY;

        var dx = event.touches[0].pageX - event.touches[1].pageX;
        var dy = event.touches[0].pageY - event.touches[1].pageY;
        var distance = Math.sqrt(dx * dx + dy * dy);
        this.dollyStart.set(0, distance);
        break;

      case 3: // three-fingered touch: pan
        if (this.noPan === true) { return; }

        this.state = STATE.TOUCH_PAN;

        this.panStart.set(event.touches[0].pageX, event.touches[0].pageY);
        break;

      default:
        this.state = STATE.NONE;

    }
  }

  // FIXME: Handle mulitple touches somehow
  private touchmove(event: TouchEvent) {

    if (this.enabled === false) { return; }

    event.preventDefault();
    event.stopPropagation();

    switch (event.touches.length) {

      case 1: // one-fingered touch: rotate
        if (this.noRotate === true) { return; }
        if (this.state !== STATE.TOUCH_ROTATE) { return; }

        this.rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
        this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);

        // rotating across whole screen goes 360 degrees around
        this.rotateLeft(2 * Math.PI * this.rotateDelta.x / this.domElement.clientWidth * this.rotateSpeed);
        // rotating up and down along whole screen attempts to go 360, but limited to 180
        this.rotateUp(2 * Math.PI * this.rotateDelta.y / this.domElement.clientHeight * this.rotateSpeed);

        this.rotateStart.copy(this.rotateEnd);
        break;

      case 2: // two-fingered touch: dolly
        if (this.noZoom === true) { return; }
        if (this.state !== STATE.TOUCH_DOLLY) { return; }

        var dx = event.touches[0].pageX - event.touches[1].pageX;
        var dy = event.touches[0].pageY - event.touches[1].pageY;
        var distance = Math.sqrt(dx * dx + dy * dy);

        this.dollyEnd.set(0, distance);
        this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

        if (this.dollyDelta.y > 0) {
          this.dollyOut();
        } else {
          this.dollyIn();
        }

        this.dollyStart.copy(this.dollyEnd);
        break;

      case 3: // three-fingered touch: pan
        if (this.noPan === true) { return; }
        if (this.state !== STATE.TOUCH_PAN) { return; }

        this.panEnd.set(event.touches[0].pageX, event.touches[0].pageY);
        this.panDelta.subVectors(this.panEnd, this.panStart);

        this.doPan(this.panDelta);

        this.panStart.copy(this.panEnd);
        break;

      default:
        this.state = STATE.NONE;
    }
  }

  private touchend(event: TouchEvent) {
    if (this.enabled === false) {
      return;
    }
    this.state = STATE.NONE;
  }
}
