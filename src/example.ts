
import { Blueprint3d, Options } from './blueprint3d';
import { floorplannerMode } from './floorplanner/floorplanner_view';
import { Floorplanner } from './floorplanner/floorplanner';
import { Item } from './items/item';
import { Main as ThreeMain } from './three/main';
import { HalfEdge } from './model/half_edge';
import { Room } from './model/room';
import { Controls as OrbitControls } from './three/controls';

/*
 * Camera Buttons
 */

class CameraButtons {

  private orbitControls: OrbitControls;
  private three: ThreeMain;

  private panSpeed = 30;
  private directions = {
    UP: 1,
    DOWN: 2,
    LEFT: 3,
    RIGHT: 4
  }

  constructor(private blueprint3d: Blueprint3d) {
    this.orbitControls = this.blueprint3d.three.controls;
    this.three = this.blueprint3d.three;
    // Camera controls
    $("#zoom-in").click((e: MouseEvent) => this.zoomIn(e));
    $("#zoom-out").click((e: MouseEvent) => this.zoomOut(e));  
    $("#zoom-in").dblclick((e: MouseEvent) => this.preventDefault(e));
    $("#zoom-out").dblclick((e: MouseEvent) => this.preventDefault(e));

    $("#reset-view").click((e: MouseEvent) => this.three.centerCamera())

    $("#move-left").click((e: MouseEvent) => this.pan(this.directions.LEFT));
    $("#move-right").click((e: MouseEvent) => this.pan(this.directions.RIGHT));
    $("#move-up").click((e: MouseEvent) => this.pan(this.directions.UP));
    $("#move-down").click((e: MouseEvent) => this.pan(this.directions.DOWN));

    $("#move-left").dblclick((e: MouseEvent) => this.preventDefault(e));
    $("#move-right").dblclick((e: MouseEvent) => this.preventDefault(e));
    $("#move-up").dblclick((e: MouseEvent) => this.preventDefault(e));
    $("#move-down").dblclick((e: MouseEvent) => this.preventDefault(e));
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
    e.preventDefault;
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
    $("#context-menu-delete").click((event: MouseEvent) => {
        this.selectedItem?.remove();
    });
    this.three = this.blueprint3d.three;
    this.three.itemSelectedCallbacks.add((item: Item) => this.itemSelected(item));
    this.three.itemUnselectedCallbacks.add(() => this.itemUnselected());

    this.initResize();

    const cmscope = this;
    $("#fixed").click(function(e: MouseEvent) {
      const target = e.target;
      if (target instanceof HTMLInputElement) {
        const checked: boolean = target.checked;
        cmscope.selectedItem?.setFixed(checked);
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

    $("#item-width").val(this.cmToIn(this.selectedItem.getWidth()).toFixed(0));
    $("#item-height").val(this.cmToIn(this.selectedItem.getHeight()).toFixed(0));
    $("#item-depth").val(this.cmToIn(this.selectedItem.getDepth()).toFixed(0));

    $("#context-menu").show();

    $("#fixed").prop('checked', item.fixed);
  }

  private resize() {
    function makeNum(s: any): number | null {
      if (s === null || typeof s === 'undefined') {
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
      this.selectedItem?.resize(
        this.inToCm(h),
        this.inToCm(w),
        this.inToCm(d)
      );
    }
  }

  private initResize() {
    $("#item-height").change(() => this.resize());
    $("#item-width").change(() => this.resize());
    $("#item-depth").change(() => this.resize());
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

  constructor(private blueprint3d: Blueprint3d) {
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

type TabState = {div: JQuery, tab: JQuery};
type TabName = "FLOORPLAN" | "SHOP" | "DESIGN";

class SideMenu {
  private static readonly ACTIVE_CLASS = "active";


  private tabs: Record<TabName, JQuery> = {
    "FLOORPLAN": $("#floorplan_tab"),
    "SHOP": $("#items_tab"),
    "DESIGN": $("#design_tab")
  };

  public stateChangeCallbacks = $.Callbacks();


  private states: Record<TabName, TabState> = {
    "DESIGN": {
      "div" : $("#viewer"),
      "tab" : this.tabs.DESIGN
    },
    "FLOORPLAN": {
      "div" : $("#floorplanner"),
      "tab" : this.tabs.FLOORPLAN
    },
    "SHOP": {
      "div" : $("#add-items"),
      "tab" : this.tabs.SHOP
    }
  };

  // sidebar state
  private currentState: TabState = this.states.FLOORPLAN;

  constructor(private blueprint3d: Blueprint3d, private floorplanControls: ViewerFloorplanner, private modalEffects: ModalEffects) {
    for (const [name, elem] of Object.entries(this.tabs)) {
      console.log(`adding click respone for ${name}`);
      elem.click(this.tabClicked(name as TabName));
    }

    $("#update-floorplan").click((event: MouseEvent) => this.floorplanUpdate());

    this.initLeftMenu();

    this.blueprint3d.three.updateWindowSize();
    this.handleWindowResize();

    this.initItems();

    this.setCurrentState(this.states.DESIGN);
    console.log("this.tabs: ", this.tabs);
    console.log("this.states: ", this.states);
  }

  private floorplanUpdate() {
    this.setCurrentState(this.states.DESIGN);
  }

  private tabClicked(name: TabName) {
    return ((event: MouseEvent) => {
      console.log(`tabClicked(${name})`);
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
    });
  }
  
  private setCurrentState(newState: TabState) {

    if (this.currentState === newState) {
      return;
    }

    // show the right tab as active
    if (this.currentState.tab !== newState.tab) {
      if (this.currentState.tab != null) {
        this.currentState.tab.removeClass(SideMenu.ACTIVE_CLASS);          
      }
      if (newState.tab != null) {
        newState.tab.addClass(SideMenu.ACTIVE_CLASS);
      }
    }

    // set item unselected
    this.blueprint3d.three.getController().setSelectedObject(null);

    // show and hide the right divs
    this.currentState.div.hide()
    newState.div.show()

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
    $( window ).resize( () => this.handleWindowResize() );
    this.handleWindowResize();
  }

  private handleWindowResize() {
    $(".sidebar").height(window.innerHeight);
    $("#add-items").height(window.innerHeight);

  };

  // TODO: this doesn't really belong here
  private initItems() {
    const objscope = this;
    $("#add-items").find(".add-item").mousedown(function (event: JQueryMouseEventObject) {
      const eltscope = this as Element;
      var modelUrl: string = String($(eltscope).attr("model-url"));
      var itemType: number = parseInt(String($(eltscope).attr("model-type")));
      if (typeof modelUrl === "undefined" || typeof itemType === "undefined") {
        throw Error("Item metadata is bad for url=${modelUrl} type=${itemType}");
      }
      var metadata = {
        itemName: $(eltscope).attr("model-name"),
        resizable: true,
        modelUrl: modelUrl,
        itemType: itemType
      }

      objscope.blueprint3d.model.scene.addItem(itemType, modelUrl, metadata);
      objscope.setCurrentState(objscope.states.DESIGN);
    });
  }

}

/*
 * Change floor and wall textures
 */

class TextureSelector {

  private three;
  // FIXME: Make sure this is unnecessary
  // private isAdmin = isAdmin;

  private currentTarget: HalfEdge | Room | null = null;

  private initTextureSelectors() {
    const objscope = this;
    $(".texture-select-thumbnail").click(function (event: JQueryMouseEventObject) {
      const eltscope = this as Element;
      var textureUrl = $(eltscope).attr("texture-url");
      var textureStretch = ($(eltscope).attr("texture-stretch") == "true");
      var textureScale = parseInt($(eltscope).attr("texture-scale") || "1");
      const t = objscope.currentTarget;
      if (t && textureUrl) { 
        t.setTexture(textureUrl, textureStretch, textureScale);
      }
      event.preventDefault();
    });
  }

  constructor (private blueprint3d: Blueprint3d, private sideMenu: SideMenu) {
    this.three = blueprint3d.three;
    this.three.wallClicked.add((halfedge: HalfEdge) => this.wallClicked(halfedge));
    this.three.floorClicked.add((room: Room) => this.floorClicked(room));
    this.three.itemSelectedCallbacks.add(() => this.reset());
    this.three.nothingClicked.add(() => this.reset());
    sideMenu.stateChangeCallbacks.add(() => this.reset());
    this.initTextureSelectors();
  }

  private wallClicked(halfEdge: HalfEdge) {
    this.currentTarget = halfEdge;
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

  private canvasWrapper = '#floorplanner';

  // buttons
  private move = '#move';
  private remove = '#delete';
  private draw = '#draw';

  private activeStlye = 'btn-primary disabled';

  private floorplanner: Floorplanner;


  constructor(private blueprint3d: Blueprint3d) {

    if (!this.blueprint3d.floorplanner) {
      throw Error("ViewerFloorplanner: floorplanner is not there but I need it.");
    }
    this.floorplanner = this.blueprint3d.floorplanner;
    // mode buttons
    $( window ).resize(() => this.handleWindowResize() );
    this.handleWindowResize();
    this.floorplanner.modeResetCallbacks.add((mode: floorplannerMode) => {
      $(this.draw).removeClass(this.activeStlye);
      $(this.remove).removeClass(this.activeStlye);
      $(this.move).removeClass(this.activeStlye);
      if (mode == floorplannerMode.MOVE) {
          $(this.move).addClass(this.activeStlye);
      } else if (mode == floorplannerMode.DRAW) {
          $(this.draw).addClass(this.activeStlye);
      } else if (mode == floorplannerMode.DELETE) {
          $(this.remove).addClass(this.activeStlye);
      }

      if (mode == floorplannerMode.DRAW) {
        $("#draw-walls-hint").show();
        this.handleWindowResize();
      } else {
        $("#draw-walls-hint").hide();
      }
    });

    $(this.move).click(() => {
      this.floorplanner.setMode(floorplannerMode.MOVE);
    });

    $(this.draw).click(() => {
      this.floorplanner.setMode(floorplannerMode.DRAW);
    });

    $(this.remove).click(() => {
      this.floorplanner.setMode(floorplannerMode.DELETE);
    });
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
  };

}; 

class MainControls {

  private newDesign() {
    this.blueprint3d.model.loadSerialized('{"floorplan":{"corners":{"f90da5e3-9e0e-eba7-173d-eb0b071e838e":{"x":204.85099999999989,"y":289.052},"da026c08-d76a-a944-8e7b-096b752da9ed":{"x":672.2109999999999,"y":289.052},"4e3d65cb-54c0-0681-28bf-bddcc7bdb571":{"x":672.2109999999999,"y":-178.308},"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2":{"x":204.85099999999989,"y":-178.308}},"walls":[{"corner1":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","corner2":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","corner2":"da026c08-d76a-a944-8e7b-096b752da9ed","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"da026c08-d76a-a944-8e7b-096b752da9ed","corner2":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","corner2":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}}],"wallTextures":[],"floorTextures":{},"newFloorTextures":{}},"items":[]}');
  }

  private loadDesign() {
    const files: FileList | null = ($("#loadFile")?.get(0) as HTMLInputElement)?.files;
    const reader  = new FileReader();
    reader.onload = (event: ProgressEvent) => { 
        var data = reader.result as string; // readAsText() sticks a string in here
        this.blueprint3d.model.loadSerialized(data);
    }
    if (files) {
      reader.readAsText(files[0]);
    }
  }

  private saveDesign() {
    var data = this.blueprint3d.model.exportSerialized();
    var a = window.document.createElement('a');
    var blob = new Blob([data], {type : 'text'});
    a.href = window.URL.createObjectURL(blob);
    a.download = 'design.blueprint3d';
    document.body.appendChild(a)
    a.click();
    document.body.removeChild(a);

    this.uploadFile(blob);
  }


  private uploadFile(blobFile: Blob) {
    // Create a new FormData object
    var formData = new FormData();
  
    // Append the blob file to the FormData object
    formData.append('file', blobFile, 'design.blueprint3d');
  
    // Create a new XMLHttpRequest object
    var xhr = new XMLHttpRequest();
  
    // Configure the request
    xhr.open('POST', 'https://cotyapp.betaplanets.com/upload.php'); // Replace '/upload-url' with the actual server-side endpoint for file upload
  
    // Set the onload and onerror event handlers
    xhr.onload = () => {
      // Request completed successfully
      if (xhr.status === 200) {
        console.log('File uploaded successfully.');
      } else {
        console.error('File upload failed. Error code: ' + xhr.status);
      }
    };
  
    xhr.onerror = () => {
      console.error('An error occurred during the file upload.');
    };
  
    // Send the request with the FormData object as the data payload
    xhr.send(formData);
  }
  

  constructor(private blueprint3d: Blueprint3d) {
    $("#new").click(() => this.newDesign());
    $("#loadFile").change(() => this.loadDesign());
    $("#saveFile").click(() => this.saveDesign());
  }

}

/*
 * Initialize!
 */

console.log("example.ts setting upready hook");

$(document).ready(function() {

  console.log("example.ts ready entry");
  // main setup
  var opts = {
    floorplannerElement: 'floorplanner-canvas',
    threeElement: '#viewer',
    threeCanvasElement: 'three-canvas',
    textureDir: "models/textures/",
    widget: false
  }
  var blueprint3d = new Blueprint3d(opts);

  var modalEffects = new ModalEffects(blueprint3d);
  var viewerFloorplanner = new ViewerFloorplanner(blueprint3d);
  var contextMenu = new ContextMenu(blueprint3d);
  var sideMenu = new SideMenu(blueprint3d, viewerFloorplanner, modalEffects);
  var textureSelector = new TextureSelector(blueprint3d, sideMenu);        
  var cameraButtons = new CameraButtons(blueprint3d);
  var mainControls = new MainControls(blueprint3d);

  // This serialization format needs work
  // Load a simple rectangle room
  console.log('loading rectangle room');
  blueprint3d.model.loadSerialized('{"floorplan":{"corners":{"f90da5e3-9e0e-eba7-173d-eb0b071e838e":{"x":204.85099999999989,"y":289.052},"da026c08-d76a-a944-8e7b-096b752da9ed":{"x":672.2109999999999,"y":289.052},"4e3d65cb-54c0-0681-28bf-bddcc7bdb571":{"x":672.2109999999999,"y":-178.308},"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2":{"x":204.85099999999989,"y":-178.308}},"walls":[{"corner1":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","corner2":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","corner2":"da026c08-d76a-a944-8e7b-096b752da9ed","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"da026c08-d76a-a944-8e7b-096b752da9ed","corner2":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}},{"corner1":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","corner2":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":false,"scale":300}}],"wallTextures":[],"floorTextures":{},"newFloorTextures":{}},"items":[]}');
  console.log("example.ts ready exit");
}
);
