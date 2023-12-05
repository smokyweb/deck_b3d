/// <reference path="model/model.ts" />
/// <reference path="floorplanner/floorplanner.ts" />
/// <reference path="three/main.ts" />

module BP3D {
  /** Startup options. */
  export interface Options {
    /** */
    widget?: boolean;

    /** */
    threeElement?: string;

    /** */
    threeCanvasElement? : string;

    /** */
    floorplannerElement?: string;

    /** The texture directory. */
    textureDir: string;
  }

  /** Blueprint3D core application. */
  export class Blueprint3d {
    
    private model: Model.Model;

    private three: any; // Three.Main;

    private floorplanner?: Floorplanner.Floorplanner;

    /** Creates an instance.
     * @param options The initialization options.
     */
    constructor(options: Options) {
      this.model = new Model.Model(options.textureDir);
      // FIXME: "as any" to avoid typescript type error
      this.three = new (Three.Main as any)(this.model, options.threeElement, options.threeCanvasElement, {});

      if (options.floorplannerElement === undefined) {
        throw Error("can't construct Blueprint3d because no options.floorplannerElement");
      }
      if (!options.widget) {
        this.floorplanner = new Floorplanner.Floorplanner(options.floorplannerElement, this.model.floorplan);
      }
      else {
        this.three.getController().enabled = false;
      }
    }
  }
}
