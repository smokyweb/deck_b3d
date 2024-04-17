
import * as THREE from 'three';

import { LumberYard } from './lumberyard';
import { degToRad } from '../core/utils';


/** ref https://www.familyhandyman.com/project/how-to-build-stairs-deck/
 */
export class StairSpec {
    /** horizontal heel-to-toe size of treads.  Not the displacement.
     *
     * tread horizontal displacement is riseInches / tan(stairAngleDegrees)
     *
     * treads will overhang the one below by 
     * */
    public treadDepthInches: number = 10;
    /** vertical displacement of treads.
    *
    * This is the vertical distance from the top surface of one tread to
    * the top surface of the next tread.  */
    public treadRiseInches: number = 7;
    public horizDisplacementInches(): number {
        return this.treadRiseInches / Math.tan(degToRad(this.stairAngleDegrees)); 
    }
    /** overall angle of stairs */
    public stairAngleDegrees = 32.5;
    /** */
    public numRises: number = 10;
    /** width of stair tread */
    public widthInches: number = 36;
    /** 
     * How far does the tread extend past the nominal width of the stair.
     * 
     * The actual width of the treads is widthInches + 2*sideOverhangInches
     */
    public sideOverhangInches: number = 1;
    public treadStock: string = "2x8";
    public skirtStock: string = "2x12";
    public stringerStock: string = "2x12";
}

export class StairMaker {

    public constructor(private lumberYard: LumberYard) {
    }

    public renderStairs(_spec: StairSpec): THREE.Group {
        this.lumberYard.makeWoodInches(5,10,10);
        return new THREE.Group();
    }
}
