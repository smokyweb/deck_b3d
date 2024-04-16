
import * as THREE from 'three';

import { LumberYard } from './lumberyard';
import { degToRad } from '../core/utils';

export class StairSpec {
    /** horizontal heel-to-toe size of treads.  Not the displacement.
     *
     * tread horizontal displacement is riseInches / tan(stairAngleDegrees)
     *
     * treads will overhang the one below by 
     * */
    public treadDepthInches: number = 10;
    /** vertical displacement of treads */
    public treadRiseInches: number = 7;
    public horizDisplacementInches(): number {
        return this.treadRiseInches / Math.tan(degToRad(this.stairAngleDegrees)); 
    }
    /** overall angle of stairs */
    public stairAngleDegrees = 32.5;
}

export class StairMaker {

    public constructor(private lumberYard: LumberYard) {
    }

    public renderStairs(_spec: StairSpec): THREE.Group {
        this.lumberYard.makeWoodInches(5,10,10);
        return new THREE.Group();
    }
}
