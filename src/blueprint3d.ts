import { Model } from "./model/model";
import { Main as ThreeMain } from "./three/main";
import { Floorplanner } from "./floorplanner/floorplanner";

/** Startup options. */
export interface Options {
  /** */
  widget?: boolean;

  /** */
  threeElement: string;

  /** */
  threeCanvasElement: string;

  /** */
  floorplannerElement?: string;

  /** The texture directory. */
  textureDir: string;
}

/** Blueprint3D core application. */
export class Blueprint3d {
  public model: Model;

  public three: ThreeMain;

  public floorplanner: Floorplanner | null = null;

  /** Creates an instance.
   * @param options The initialization options.
   */
  constructor(options: Options) {
    this.model = new Model(options.textureDir);
    this.three = new ThreeMain(
      this.model,
      options.threeElement,
      options.threeCanvasElement,
      {}
    );

    if (options.floorplannerElement === undefined) {
      throw Error(
        "can't construct Blueprint3d because no options.floorplannerElement"
      );
    }
    if (!options.widget) {
      this.floorplanner = new Floorplanner(
        options.floorplannerElement,
        this.model.floorplan
      );
    } else {
      this.three.getController().enabled = false;
    }
  }
}
