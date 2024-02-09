
import { Floorplan } from './floorplan';
import { Scene } from './scene';
/** 
 * A Model connects a Floorplan and a Scene. 
 */
export class Model {

  /** */
  public floorplan: Floorplan;

  /** */
  public scene: Scene;

  /** */
  private roomLoadingCallbacks = $.Callbacks();

  /** */
  private roomLoadedCallbacks = $.Callbacks();

  /** Constructs a new model.
   * @param textureDir The directory containing the textures.
   */
  constructor(textureDir: string) {
    this.floorplan = new Floorplan();
    this.scene = new Scene(this, textureDir);
  }

  public loadSerialized(json: string) {
    // TODO: better documentation on serialization format.
    // TODO: a much better serialization format.
    this.roomLoadingCallbacks.fire();

    var data = JSON.parse(json)
    this.newRoom(
      data.floorplan,
      data.items
    );

    this.roomLoadedCallbacks.fire();
  }

  public exportSerialized(): string {
    const items_arr = this.scene.getItems().map((item) => ({
      item_name: item.metadata.itemName,
      item_type: item.metadata.itemType,
      model_url: item.metadata.modelUrl,
      xpos: item.threeObj.position.x,
      ypos: item.threeObj.position.y,
      zpos: item.threeObj.position.z,
      rotation: item.threeObj.rotation.y,
      scale_x: item.threeObj.scale.x,
      scale_y: item.threeObj.scale.y,
      scale_z: item.threeObj.scale.z,
      fixed: item.fixed
    })); 

    var room = {
      floorplan: (this.floorplan.saveFloorplan()),
      items: items_arr
    };

    return JSON.stringify(room);
  }

  // floorplan and items are parsed json from save file.
  private newRoom(floorplan: any, items: any[]) {
    this.scene.clearItems();
    this.floorplan.loadFloorplan(floorplan);
    items.forEach((item: any) => {
      var position = new THREE.Vector3(
        item.xpos, item.ypos, item.zpos);
      var metadata = {
        itemName: item.item_name,
        resizable: item.resizable,
        itemType: item.item_type,
        modelUrl: item.model_url
      };
      var scale = new THREE.Vector3(
        item.scale_x,
        item.scale_y,
        item.scale_z
      );
      this.scene.addItem(
        item.item_type,
        item.model_url,
        metadata,
        position,
        item.rotation,
        scale,
        item.fixed);
    });
  }
}
