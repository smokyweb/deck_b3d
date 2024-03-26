import { Blueprint3d } from "./blueprint3d";
import { FloorplannerMode } from "./floorplanner/floorplanner_view";
import { Floorplanner } from "./floorplanner/floorplanner";
import { Item } from "./items/item";
import { Main as ThreeMain } from "./three/main";
import { Room } from "./model/room";
import { Wall } from "./model/wall";
import { Controls as OrbitControls } from "./three/controls";

/*
 * Camera Buttons
 */

function sel(selector: string): HTMLElement {
  const elems: NodeList = document.querySelectorAll(selector);
  if (!elems || elems.length < 1) {
    throw Error(`Can't find selector "${selector}"`);
  }
  if (elems.length > 1) {
    throw Error(`Found too many elements for selector "${selector}"`);
  }
  const elem = elems[0];
  if (elem instanceof HTMLElement) {
    return elem;
  } else {
    throw Error(`Selector "${selector}" does not find HTMLElement`);
  }
}
function selAll(selector: string): NodeList {
  const elems: NodeList = document.querySelectorAll(selector);
  if (!elems) {
    throw Error(`Can't find selector "${selector}"`);
  }
  return elems;
}
class CameraButtons {
  private orbitControls: OrbitControls;
  private three: ThreeMain;

  private panSpeed = 30;
  private directions = {
    UP: 1,
    DOWN: 2,
    LEFT: 3,
    RIGHT: 4,
  };

  constructor(private blueprint3d: Blueprint3d) {
    this.orbitControls = this.blueprint3d.three.controls;
    this.three = this.blueprint3d.three;
    // Camera controls
    sel("#zoom-in").addEventListener("click", (e: MouseEvent) =>
      this.zoomIn(e)
    );
    sel("#zoom-out").addEventListener("click", (e: MouseEvent) =>
      this.zoomOut(e)
    );
    sel("#zoom-in").addEventListener("dblclick", (e: MouseEvent) =>
      this.preventDefault(e)
    );
    sel("#zoom-out").addEventListener("dblclick", (e: MouseEvent) =>
      this.preventDefault(e)
    );

    sel("#reset-view").addEventListener("click", (_e: MouseEvent) =>
      this.three.centerCamera()
    );

    sel("#move-left").addEventListener("click", (_e: MouseEvent) =>
      this.pan(this.directions.LEFT)
    );
    sel("#move-right").addEventListener("click", (_e: MouseEvent) =>
      this.pan(this.directions.RIGHT)
    );
    sel("#move-up").addEventListener("click", (_e: MouseEvent) =>
      this.pan(this.directions.UP)
    );
    sel("#move-down").addEventListener("click", (_e: MouseEvent) =>
      this.pan(this.directions.DOWN)
    );

    sel("#move-left").addEventListener("dblclick", (e: MouseEvent) =>
      this.preventDefault(e)
    );
    sel("#move-right").addEventListener("dblclick", (e: MouseEvent) =>
      this.preventDefault(e)
    );
    sel("#move-up").addEventListener("dblclick", (e: MouseEvent) =>
      this.preventDefault(e)
    );
    sel("#move-down").addEventListener("dblclick", (e: MouseEvent) =>
      this.preventDefault(e)
    );
  }

  private preventDefault(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  private pan(direction: number) {
    switch (direction) {
      case this.directions.UP:
        this.orbitControls.panXY(0, this.panSpeed);
        break;
      case this.directions.DOWN:
        this.orbitControls.panXY(0, -this.panSpeed);
        break;
      case this.directions.LEFT:
        this.orbitControls.panXY(this.panSpeed, 0);
        break;
      case this.directions.RIGHT:
        this.orbitControls.panXY(-this.panSpeed, 0);
        break;
    }
  }

  private zoomIn(e: MouseEvent) {
    e.preventDefault();
    this.orbitControls.dollyIn(1.1);
    this.orbitControls.update();
  }

  private zoomOut(e: MouseEvent) {
    e.preventDefault();
    this.orbitControls.dollyOut(1.1);
    this.orbitControls.update();
  }
}

/*
 * Context menu for selected item
 */

class ContextMenu {
  private selectedItem: Item | null = null;
  private three: ThreeMain;

  constructor(private blueprint3d: Blueprint3d) {
    sel("#context-menu-delete").addEventListener(
      "click",
      (_event: MouseEvent) => {
        this.selectedItem?.remove();
      }
    );
    this.three = this.blueprint3d.three;
    this.three.itemSelectedCallbacks.add((item: Item) =>
      this.itemSelected(item)
    );
    this.three.itemUnselectedCallbacks.add(() => this.itemUnselected());

    this.initResize();

    sel("#fixed").addEventListener("click", (e: MouseEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement) {
        const checked: boolean = target.checked;
        this.selectedItem?.setFixed(checked);
      }
    });
  }

  private cmToIn(cm: number) {
    return cm / 2.54;
  }

  private inToCm(inches: number) {
    return inches * 2.54;
  }

  private itemSelected(item: Item) {
    this.selectedItem = item;

    if (item.metadata.itemName) {
      $("#context-menu-name").text(item.metadata.itemName);
    }
    function cmToIn(cm: number): number {
      return cm / 2.54;
    }

    function setupField(selector: string, resizable: boolean, cm: number) {
      const jq = $(selector);
      const elem = jq.get(0);
      if (elem instanceof HTMLInputElement) {
        elem.disabled = !resizable;
      }
      jq.val(cmToIn(cm).toFixed(0));
    }

    setupField("#item-width", item.resizable, this.selectedItem.getWidth());
    $("#item-width").val(this.cmToIn(this.selectedItem.getWidth()).toFixed(0));
    setupField("#item-height", item.resizable, this.selectedItem.getHeight());
    $("#item-height").val(
      this.cmToIn(this.selectedItem.getHeight()).toFixed(0)
    );
    setupField("#item-depth", item.resizable, this.selectedItem.getDepth());
    $("#item-depth").val(this.cmToIn(this.selectedItem.getDepth()).toFixed(0));

    $("#context-menu").show();

    $("#fixed").prop("checked", item.fixed);
  }

  private resize() {
    function makeNum(s: any): number | null {
      if (s === null || typeof s === "undefined") {
        return null;
      }
      const n = Number(s);
      if (isNaN(n)) {
        return null;
      } else {
        return n;
      }
    }
    const h = makeNum($("#item-height")?.val());
    const w = makeNum($("#item-width")?.val());
    const d = makeNum($("#item-depth")?.val());
    if (h !== null && w !== null && d !== null) {
      this.selectedItem?.resize(this.inToCm(h), this.inToCm(w), this.inToCm(d));
    }
  }

  private initResize() {
    sel("#item-height").addEventListener("change", () => this.resize());
    sel("#item-width").addEventListener("change", () => this.resize());
    sel("#item-depth").addEventListener("change", () => this.resize());
  }

  private itemUnselected() {
    this.selectedItem = null;
    $("#context-menu").hide();
  }
}

/*
 * Loading modal for items
 */

class ModalEffects {
  private itemsLoading = 0;

  private update() {
    if (this.itemsLoading > 0) {
      $("#loading-modal").show();
    } else {
      $("#loading-modal").hide();
    }
  }

  constructor(blueprint3d: Blueprint3d) {
    blueprint3d.model.scene.itemLoadingCallbacks.add(() => {
      this.itemsLoading += 1;
      this.update();
    });

    blueprint3d.model.scene.itemLoadedCallbacks.add(() => {
      this.itemsLoading -= 1;
      this.update();
    });

    this.update();
  }
}

/*
 * Side menu
 */

type TabState = { div: JQuery; tab: string };
type TabName = "FLOORPLAN" | "SHOP" | "DESIGN";

class SideMenu {
  private static readonly ACTIVE_CLASS = "active";

  private tabs: Record<TabName, string> = {
    FLOORPLAN: "#floorplan_tab",
    SHOP: "#items_tab",
    DESIGN: "#design_tab",
  };

  public stateChangeCallbacks = $.Callbacks();

  private states: Record<TabName, TabState> = {
    DESIGN: {
      div: $("#viewer"),
      tab: this.tabs.DESIGN,
    },
    FLOORPLAN: {
      div: $("#floorplanner"),
      tab: this.tabs.FLOORPLAN,
    },
    SHOP: {
      div: $("#add-items"),
      tab: this.tabs.SHOP,
    },
  };

  // sidebar state
  private currentState: TabState = this.states.FLOORPLAN;

  constructor(
    private blueprint3d: Blueprint3d,
    private floorplanControls: ViewerFloorplanner,
    _modalEffects: ModalEffects
  ) {
    for (const [name, elem] of Object.entries(this.tabs)) {
      // console.log(`adding click response for ${name}`);
      sel(elem).addEventListener("click", this.tabClicked(name as TabName));
    }

    sel("#update-floorplan").addEventListener("click", (_event: MouseEvent) =>
      this.floorplanUpdate()
    );

    this.initLeftMenu();

    this.blueprint3d.three.updateWindowSize();
    this.handleWindowResize();

    this.initItems();

    this.setCurrentState(this.states.DESIGN);
    // console.log("this.tabs: ", this.tabs);
    // console.log("this.states: ", this.states);
  }

  private floorplanUpdate() {
    this.setCurrentState(this.states.DESIGN);
  }

  private tabClicked(name: TabName) {
    return (_event: MouseEvent) => {
      // console.log(`tabClicked(${name})`);
      // Stop three from spinning
      this.blueprint3d.three.stopSpin();

      // Selected a new tab
      this.setCurrentState(this.states[name]);
      /*
      // FIXME: delete this
      for (var key in this.states) {
        var state = this.states[key];
        if (state.tab == tab) {
          setCurrentState(state);
          break;
        }
      }*/
    };
  }

  private setCurrentState(newState: TabState) {
    if (this.currentState === newState) {
      return;
    }

    // show the right tab as active
    if (this.currentState.tab !== newState.tab) {
      if (this.currentState.tab != null) {
        sel(this.currentState.tab).classList.remove(SideMenu.ACTIVE_CLASS);
      }
      if (newState.tab != null) {
        sel(newState.tab).classList.add(SideMenu.ACTIVE_CLASS);
      }
    }

    // set item unselected
    this.blueprint3d.three.getController().setSelectedObject(null);

    // show and hide the right divs
    this.currentState.div.hide();
    newState.div.show();

    // custom actions
    if (newState === this.states.FLOORPLAN) {
      this.floorplanControls.updateFloorplanView();
      this.floorplanControls.handleWindowResize();
    }

    if (this.currentState === this.states.FLOORPLAN) {
      this.blueprint3d.model.floorplan.update();
    }

    if (newState === this.states.DESIGN) {
      this.blueprint3d.three.updateWindowSize();
    }

    // set new state
    this.handleWindowResize();
    this.currentState = newState;

    this.stateChangeCallbacks.fire(newState);
  }

  private initLeftMenu() {
    window.addEventListener("resize", () => this.handleWindowResize());
    this.handleWindowResize();
  }

  private handleWindowResize() {
    $(".sidebar").height(window.innerHeight);
    $("#add-items").height(window.innerHeight);
  }

  // TODO: this doesn't really belong here
  private initItems() {
    const objscope = this;
    function addItemHandler(this: HTMLInputElement, _event: Event) {
      var modelUrl: string | null = this.getAttribute("model-url");
      var itemType: number = parseInt(
        this.getAttribute("model-type") || "-999"
      );
      if (typeof modelUrl === "undefined" || typeof itemType === "undefined") {
        throw Error(
          "Item metadata is bad for url=${modelUrl} type=${itemType}"
        );
      }
      const modelName = this.getAttribute("model-name") || "#MISSING";
      if (typeof modelName === "undefined") {
        throw Error("modelNname is not defined");
      }

      if (modelUrl !== null && itemType != -999 && modelName != "#MISSING") {
        var metadata = {
          itemName: modelName,
          resizable: true,
          modelUrl: modelUrl,
          itemType: itemType,
        };
        objscope.blueprint3d.model.scene.addItem(itemType, modelUrl, metadata);
        objscope.setCurrentState(objscope.states.DESIGN);
      } else {
      }
    }
    const addItemButtons = sel("#add-items").querySelectorAll(".add-item");
    addItemButtons.forEach((e: Element) =>
      e.addEventListener("mousedown", addItemHandler)
    );
  }
}

/*
 * Change floor and wall textures
 */

class TextureSelector {
  private three;
  // FIXME: Make sure this is unnecessary
  // private isAdmin = isAdmin;

  private currentTarget: Wall | Room | null = null;

  private initTextureSelectors() {
    const objscope = this;
    selAll(".texture-select-thumbnail").forEach((elem) =>
      elem.addEventListener("click", (event: Event) => {
        if (elem instanceof HTMLElement) {
          var textureUrl = elem.getAttribute("texture-url");
          var textureStretch = elem.getAttribute("texture-stretch") == "true";
          var textureScale = parseInt(
            elem.getAttribute("texture-scale") || "1"
          );
          const t = objscope.currentTarget;
          /* FIXME: this is just an edge thing, right? */
          if (t instanceof Room && textureUrl) {
            t.setTexture(textureUrl, textureStretch, textureScale);
          }
          event.preventDefault();
        }
      })
    );
  }

  constructor(blueprint3d: Blueprint3d, sideMenu: SideMenu) {
    this.three = blueprint3d.three;
    this.three.wallClicked.add((wall: Wall) => this.wallClicked(wall));
    this.three.floorClicked.add((room: Room) => this.floorClicked(room));
    this.three.itemSelectedCallbacks.add(() => this.reset());
    this.three.nothingClicked.add(() => this.reset());
    sideMenu.stateChangeCallbacks.add(() => this.reset());
    this.initTextureSelectors();
  }

  private wallClicked(wall: Wall) {
    this.currentTarget = wall;
    $("#floorTexturesDiv").hide();
    $("#wallTextures").show();
  }

  private floorClicked(room: Room) {
    this.currentTarget = room;
    $("#wallTextures").hide();
    $("#floorTexturesDiv").show();
  }

  private reset() {
    $("#wallTextures").hide();
    $("#floorTexturesDiv").hide();
  }
}

/*
 * Floorplanner controls
 */

class ViewerFloorplanner {
  private canvasWrapper = "#floorplanner";

  // buttons
  private move = sel("#move");
  private remove = sel("#delete");
  private draw = sel("#draw");
  private addPostBtn = sel("#addPost");
  private deletePostBtn = sel("#deletePost");

  private activeStyles: string[] = ["btn-primary", "disabled"];

  private floorplanner: Floorplanner;

  constructor(private blueprint3d: Blueprint3d) {
    if (!this.blueprint3d.floorplanner) {
      throw Error(
        "ViewerFloorplanner: floorplanner is not there but I need it."
      );
    }
    this.floorplanner = this.blueprint3d.floorplanner;
    // mode buttons
    window.addEventListener("resize", () => this.handleWindowResize());
    this.handleWindowResize();
    this.floorplanner.modeResetCallbacks.add((mode: FloorplannerMode) => {
      //console.log("floorplanner mode reset, " + mode.toString());
      this.makeInactive(this.draw);
      this.makeInactive(this.remove);
      this.makeInactive(this.move);
      this.makeInactive(this.addPostBtn);
      this.makeInactive(this.deletePostBtn);

      if (mode == FloorplannerMode.MOVE) {
        this.makeActive(this.move);
      } else if (mode == FloorplannerMode.DRAW) {
        this.makeActive(this.draw);
      } else if (mode == FloorplannerMode.DELETE) {
        this.makeActive(this.remove);
      } else if (mode == FloorplannerMode.ADDPOST) {
        this.makeActive(this.addPostBtn);
      } else if (mode == FloorplannerMode.DELETEPOST) {
        this.makeActive(this.deletePostBtn);
      }

      if (mode == FloorplannerMode.DRAW) {
        $("#draw-walls-hint").show();
        this.handleWindowResize();
      } else {
        $("#draw-walls-hint").hide();
      }
    });

    this.move.addEventListener("click", (_e: MouseEvent) => {
      this.floorplanner.setMode(FloorplannerMode.MOVE);
    });

    this.draw.addEventListener("click", (_e: MouseEvent) => {
      this.floorplanner.setMode(FloorplannerMode.DRAW);
    });

    this.remove.addEventListener("click", () => {
      this.floorplanner.setMode(FloorplannerMode.DELETE);
    });
    this.addPostBtn.addEventListener("click", () => {
      this.floorplanner.setMode(FloorplannerMode.ADDPOST);
    });
    this.deletePostBtn.addEventListener("click", () => {
      this.floorplanner.setMode(FloorplannerMode.DELETEPOST);
    });
    //console.log("setting up reset-view");
    sel("#reset-view-floorplan").addEventListener(
      "click",
      (_event: MouseEvent) => {
        //console.log('resetting view');
        this.floorplanner.reset();
      }
    );
    //console.log("set up reset-view");
  }
  private makeActive(elem: HTMLElement) {
    DOMTokenList.prototype.add.apply(elem.classList, this.activeStyles);
  }
  private makeInactive(elem: HTMLElement) {
    DOMTokenList.prototype.remove.apply(elem.classList, this.activeStyles);
  }

  public updateFloorplanView() {
    this.floorplanner.reset();
  }

  public handleWindowResize() {
    //$(this.canvasWrapper).height(window.innerHeight - $(this.canvasWrapper).offset().top);
    const cw: JQuery | null = $(this.canvasWrapper);
    const off = cw?.offset();
    if (cw && off) {
      cw.height(window.innerHeight - off.top);
    }
    this.floorplanner.resizeView();
  }
}

class MainControls {
  private newDesign() {
    this.blueprint3d.model.loadSerialized(
      '{"floorplan":{"corners":{"f90da5e3-9e0e-eba7-173d-eb0b071e838e":{"x":204.85099999999989,"y":289.052},"da026c08-d76a-a944-8e7b-096b752da9ed":{"x":672.2109999999999,"y":289.052},"4e3d65cb-54c0-0681-28bf-bddcc7bdb571":{"x":672.2109999999999,"y":-178.308},"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2":{"x":204.85099999999989,"y":-178.308}},"walls":[{"corner1":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","corner2":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","corner2":"da026c08-d76a-a944-8e7b-096b752da9ed","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"da026c08-d76a-a944-8e7b-096b752da9ed","corner2":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","corner2":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}}],"wallTextures":[],"floorTextures":{},"newFloorTextures":{}},"items":[]}'
    );
  }

  private loadDesign() {
    const files: FileList | null = ($("#loadFile")?.get(0) as HTMLInputElement)
      ?.files;
    const reader = new FileReader();
    reader.onload = (_event: ProgressEvent) => {
      var data = reader.result as string; // readAsText() sticks a string in here
      this.blueprint3d.model.loadSerialized(data);
    };
    if (files) {
      reader.readAsText(files[0]);
    }
  }

  private saveDesign() {
    var data = this.blueprint3d.model.exportSerialized();
    var a = window.document.createElement("a");
    var blob = new Blob([data], { type: "text" });
    a.href = window.URL.createObjectURL(blob);
    a.download = "design.blueprint3d";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    this.uploadFile(blob);
  }

  private uploadFile(blobFile: Blob) {
    // Create a new FormData object
    var formData = new FormData();

    // Append the blob file to the FormData object
    formData.append("file", blobFile, "design.blueprint3d");

    // Create a new XMLHttpRequest object
    var xhr = new XMLHttpRequest();

    // Configure the request
    xhr.open("POST", "https://cotyapp.betaplanets.com/upload.php"); // Replace '/upload-url' with the actual server-side endpoint for file upload

    // Set the onload and onerror event handlers
    xhr.onload = () => {
      // Request completed successfully
      if (xhr.status === 200) {
        console.log("File uploaded successfully.");
      } else {
        console.error("File upload failed. Error code: " + xhr.status);
      }
    };

    xhr.onerror = () => {
      console.error("An error occurred during the file upload.");
    };

    // Send the request with the FormData object as the data payload
    xhr.send(formData);
  }

  constructor(private blueprint3d: Blueprint3d) {
    sel("#new").addEventListener("click", () => this.newDesign());
    sel("#loadFile").addEventListener("change", () => this.loadDesign());
    sel("#saveFile").addEventListener("click", (_e: MouseEvent) =>
      this.saveDesign()
    );
  }
}

/*
 * Initialize!
 */

//console.log("example.ts setting up ready hook");

window.addEventListener("load", function () {
  console.log("example.ts ready entry");
  // main setup
  var opts = {
    floorplannerElement: "floorplanner-canvas",
    threeElement: "#viewer",
    threeCanvasElement: "three-canvas",
    textureDir: "models/textures/",
    widget: false,
  };
  const blueprint3d = new Blueprint3d(opts);

  const modalEffects = new ModalEffects(blueprint3d);
  const viewerFloorplanner = new ViewerFloorplanner(blueprint3d);
  new ContextMenu(blueprint3d);
  const sideMenu = new SideMenu(blueprint3d, viewerFloorplanner, modalEffects);
  new TextureSelector(blueprint3d, sideMenu);
  new CameraButtons(blueprint3d);
  new MainControls(blueprint3d);

  // This serialization format needs work
  // Load a simple rectangle room
  // console.log("loading rectangle room");
  blueprint3d.model.loadSerialized(
    '{"floorplan":{"corners":{"f90da5e3-9e0e-eba7-173d-eb0b071e838e":{"x":204.85099999999989,"y":289.052},"da026c08-d76a-a944-8e7b-096b752da9ed":{"x":672.2109999999999,"y":289.052},"4e3d65cb-54c0-0681-28bf-bddcc7bdb571":{"x":672.2109999999999,"y":-178.308},"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2":{"x":204.85099999999989,"y":-178.308}},"walls":[{"corner1":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","corner2":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","corner2":"da026c08-d76a-a944-8e7b-096b752da9ed","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"da026c08-d76a-a944-8e7b-096b752da9ed","corner2":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","corner2":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}}],"wallTextures":[],"floorTextures":{},"newFloorTextures":{}},"items":[]}'
  );
  // console.log("example.ts ready exit");
});
