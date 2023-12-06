module BP3D.Core {
  /** Collection of utility functions.

    The original author does not explicitly specify whether a right-handed or 
    left-handed coordinate system are assumed.  The implementations of these
    functions, however, make it clear that a left-handed coordinate system
    is probably what was intended.

  */
  export type Point = { x: number, y: number };
  export type Intersection = {
    distance: number,
    point: THREE.Vector3,
    object: THREE.Object3D
  };

  export class Utils {
    /** Determines the distance of a point from a line.
     * @param x Point's x coordinate.
     * @param y Point's y coordinate.
     * @param x1 Line-Point 1's x coordinate.
     * @param y1 Line-Point 1's y coordinate.
     * @param x2 Line-Point 2's x coordinate.
     * @param y2 Line-Point 2's y coordinate.
     * @returns The distance.
     */
    public static pointDistanceFromLine(
      x: number,
      y: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ): number {
      var tPoint = Utils.closestPointOnLine(x, y, x1, y1, x2, y2);
      var tDx = x - tPoint.x;
      var tDy = y - tPoint.y;
      return Math.sqrt(tDx * tDx + tDy * tDy);
    }

    /** 
      Finds the point on a line segment closest to a given point.
      i.e. it will return one of the endoints or a point in the middle
      of the segment.

     * @param x Point's x coordinate.
     * @param y Point's y coordinate.
     * @param x1 Line-Point 1's x coordinate.
     * @param y1 Line-Point 1's y coordinate.
     * @param x2 Line-Point 2's x coordinate.
     * @param y2 Line-Point 2's y coordinate.
     * @returns The point.
     */
    static closestPointOnLine(
      x: number,
      y: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ): { x: number; y: number } {
      // Inspired by: http://stackoverflow.com/a/6853926
      var tA = x - x1;
      var tB = y - y1;
      var tC = x2 - x1;
      var tD = y2 - y1;

      var tDot = tA * tC + tB * tD;
      var tLenSq = tC * tC + tD * tD;
      var tParam = tDot / tLenSq;

      var tXx, tYy;

      if (tParam < 0 || (x1 == x2 && y1 == y2)) {
        tXx = x1;
        tYy = y1;
      } else if (tParam > 1) {
        tXx = x2;
        tYy = y2;
      } else {
        tXx = x1 + tParam * tC;
        tYy = y1 + tParam * tD;
      }

      return {
        x: tXx,
        y: tYy,
      };
    }

    /** Gets the distance between two points.
     * @param x1 X part of first point.
     * @param y1 Y part of first point.
     * @param x2 X part of second point.
     * @param y2 Y part of second point.
     * @returns The distance.
     */
    static distance(x1: number, y1: number, x2: number, y2: number): number {
      let dx = x2 - x1;
      let dy = y2 - y1;
      return Math.sqrt(dx*dx + dy*dy);
    }

    /**  sort of gets the angle between 0,0 -> x1,y1 and 0,0 -> x2,y2 (-pi to pi)
         assuming a left-handed coordinate system
     * @returns The signed angle, -pi to pi.
     */
    static angle(x1: number, y1: number, x2: number, y2: number): number {
      // v1 = (x1,y1), v2 = (x2,y2), theta is CCW angle from v1 to v2 at Origin
      // equivalent to |v1||v2| cos(theta)
      var tDot = x1 * x2 + y1 * y2;
      // equivalent to |v1||v2| sin(theta)
      var tDet = x1 * y2 - y1 * x2;
      // negative because left-handed coordinate system
      var tAngle = -Math.atan2(tDet, tDot);
      return tAngle;
    }

    /** Same as the "angle" function but result range is 0 to 2pi  */
    static angle2pi(x1: number, y1: number, x2: number, y2: number) {
      var tTheta = Utils.angle(x1, y1, x2, y2);
      if (tTheta < 0) {
        tTheta += 2 * Math.PI;
      }
      return tTheta;
    }

    /** Checks if an array of points is clockwise.
     * @param points Is array of points with x,y attributes

      This assumes the points are in a left-handed coordinate system.
     * @returns True if clockwise.
     */
    static isClockwise(points: Point[]): boolean {
      // determine CW/CCW, based on:
      // http://stackoverflow.com/questions/1165647
      let sum = 0;
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const inext = (i+1) % points.length;
        const p2 = points[inext];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
      }
      return sum >= 0;
    }

    /** Creates a Guid.
     * @returns A new Guid.
     */
    static guid(): /* () => */ string {
      var tS4 = function () {
        return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
      };

      return (
        tS4() +
        tS4() +
        "-" +
        tS4() +
        "-" +
        tS4() +
        "-" +
        tS4() +
        "-" +
        tS4() +
        tS4() +
        tS4()
      );
    }

    /** both arguments are arrays of corners with x,y attributes

      This does not actually calculate if two polygons intersect.  Instead it
      finds if any of their edges obviously overlap.  If one polygon is entirely located
      within the other, this will return false.

      If a vertex of one lies on the edge of another, the behavior is undefined.

    */
    static polygonPolygonIntersect(firstCorners: Point[], secondCorners: Point[]): boolean {
      for (var tI = 0; tI < firstCorners.length; tI++) {
        var tFirstCorner = firstCorners[tI],
          tSecondCorner;

        if (tI == firstCorners.length - 1) {
          tSecondCorner = firstCorners[0];
        } else {
          tSecondCorner = firstCorners[tI + 1];
        }

        if (
          Utils.linePolygonIntersect(
            tFirstCorner.x,
            tFirstCorner.y,
            tSecondCorner.x,
            tSecondCorner.y,
            secondCorners
          )
        ) {
          return true;
        }
      }
      return false;
    }

    /** Corners is an array of points with x,y attributes.
        Checks line-line intersection between the given line and all edges of
        the polygon.  If the line lies entirely within the polygon, no intersection.
        If an endpoint of a line lies on the other's edge, undefined behavior.

    */
    static linePolygonIntersect(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      corners: Point[]
    ): boolean {
      for (var tI = 0; tI < corners.length; tI++) {
        var tFirstCorner = corners[tI],
          tSecondCorner;
        if (tI == corners.length - 1) {
          tSecondCorner = corners[0];
        } else {
          tSecondCorner = corners[tI + 1];
        }

        if (
          Utils.lineLineIntersect(
            x1,
            y1,
            x2,
            y2,
            tFirstCorner.x,
            tFirstCorner.y,
            tSecondCorner.x,
            tSecondCorner.y
          )
        ) {
          return true;
        }
      }
      return false;
    }

    /**
     If two line segments obviously cross, returns true.
     if One endpoint lies on the other segment, undefined behavior.
      */
    static lineLineIntersect(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      x4: number,
      y4: number
    ): boolean {
      /* the intent is that it figures out if p1, p2, p3 go CCW.
         Everything else assumes a left-handed coordinate system.
         But this calculation is based on a right-handed coordinate system.

         But the way this function is used (in lineLineIntersect), 
         it can return the opposite of the intended value and the overall function
         still works without obvious fault.
       */
      function tCCW(p1: Point, p2: Point, p3: Point) {
        var tA = p1.x,
          tB = p1.y,
          tC = p2.x,
          tD = p2.y,
          tE = p3.x,
          tF = p3.y;
        return (tF - tB) * (tC - tA) > (tD - tB) * (tE - tA);
        /* let y3 = p3.y - p1.y, x3 = p3.x - p1.x, 
               y2 = p2.y -  p1.y, x2 = p2.x - p1.x,

            y3 * x2 > y2 * x3

            This is equivalent to 

            det [ x2 y2 ] > 0
                [ x3 y3 ]

            So it's calculating the cross product of p1-> p2 with p2->p3 in
            right handed coordinates.  But everything else in this file 
            assumes left-handed coordinates, so there is an error.

        */
               
      }

      var tP1 = { x: x1, y: y1 },
        tP2 = { x: x2, y: y2 },
        tP3 = { x: x3, y: y3 },
        tP4 = { x: x4, y: y4 };
      // This appears to work in obvious cases.  Not sure if sound.
      return (
        tCCW(tP1, tP3, tP4) != tCCW(tP2, tP3, tP4) &&
        tCCW(tP1, tP2, tP3) != tCCW(tP1, tP2, tP4)
      );
    }

    /**
      Assumes even-odd winding rule.

      Also, if the raycasting passes exactly through a vertex of the polygon, 
      behavior is undefined.

     @param corners Is an array of points with x,y attributes
      @param startX X start coord for raycast
      @param startY Y start coord for raycast
    */
    static pointInPolygon(
      x: number,
      y: number,
      corners: Point[],
      startX?: number,
      startY?: number
    ): boolean {
      startX = startX || 0;
      startY = startY || 0;

      //ensure that point(startX, startY) is outside the polygon consists of corners
      var tMinX = 0,
        tMinY = 0;

      if (startX === undefined || startY === undefined) {
        for (var tI = 0; tI < corners.length; tI++) {
          tMinX = Math.min(tMinX, corners[tI].x);
          tMinY = Math.min(tMinX, corners[tI].y);
        }
        startX = tMinX - 10;
        startY = tMinY - 10;
      }

      var tIntersects = 0;
      for (var tI = 0; tI < corners.length; tI++) {
        var tFirstCorner = corners[tI],
          tSecondCorner;
        if (tI == corners.length - 1) {
          tSecondCorner = corners[0];
        } else {
          tSecondCorner = corners[tI + 1];
        }

        if (
          Utils.lineLineIntersect(
            startX,
            startY,
            x,
            y,
            tFirstCorner.x,
            tFirstCorner.y,
            tSecondCorner.x,
            tSecondCorner.y
          )
        ) {
          tIntersects++;
        }
      }
      // odd intersections means the point is in the polygon
      return tIntersects % 2 == 1;
    }

    /** Checks if all corners of insideCorners are inside the polygon described by outsideCorners */
    static polygonInsidePolygon(
      insideCorners: Point[],
      outsideCorners: Point[],
      startX: number,
      startY: number
    ): boolean {
      startX = startX || 0;
      startY = startY || 0;

      for (var tI = 0; tI < insideCorners.length; tI++) {
        if (
          !Utils.pointInPolygon(
            insideCorners[tI].x,
            insideCorners[tI].y,
            outsideCorners,
            startX,
            startY
          )
        ) {
          return false;
        }
      }
      return true;
    }

    /** Checks if any corners of firstCorners is inside the polygon described by secondCorners

    If raycasting passes through a vertex of the outside polygon, behavior is undefined
    If outside polygon contains (startx, starty), behavior is undefined.

    */
    static polygonOutsidePolygon(
      insideCorners: Point[],
      outsideCorners: Point[],
      startX: number,
      startY: number
    ): boolean {
      startX = startX || 0;
      startY = startY || 0;

      for (var tI = 0; tI < insideCorners.length; tI++) {
        if (
          Utils.pointInPolygon(
            insideCorners[tI].x,
            insideCorners[tI].y,
            outsideCorners,
            startX,
            startY
          )
        ) {
          return false;
        }
      }
      return true;
    }

    // arrays

    static forEach<T>(array: T[], action: (arg: T) => any) {
      for (var tI = 0; tI < array.length; tI++) {
        action(array[tI]);
      }
    }

    static forEachIndexed<T>(array: T[], action: (idx: number, arg: T) => any) {
      for (var tI = 0; tI < array.length; tI++) {
        action(tI, array[tI]);
      }
    }

    static map<T, U>(array: T[], func: (arg: T) => U): U[] {
      var tResult: U[] = [];
      array.forEach((element) => {
        tResult.push(func(element));
      });
      return tResult;
    }

    /** Like 'filter', except the sense of the predicate is reversed and
        the name is stupid.  The original array is not modified so nothing
        is actually removed.
        This function creates a new array with all the elements that are not
        matched by the predicate.
    */
    static removeIf<T>(array: T[], func: (arg: T) => boolean): T[] {
      var tResult: T[] = [];
      array.forEach((element) => {
        if (!func(element)) {
          tResult.push(element);
        }
      });
      return tResult;
    }

    /** Shift the items in an array by shift (positive integer) */
    static cycle<T>(arr: T[], shift: number): T[] {
      var tReturn: T[] = arr.slice(0);
      if (tReturn.length > 0) {
        for (var tI = 0; tI < shift; tI++) {
          // ! is safe because we know length is >0
          var tmp: T = tReturn.shift()!;
          tReturn.push(tmp);
        }
      }
      return tReturn;
    }

    /** Returns in the unique elemnts in arr */
    static unique<T>(arr: T[], hashFunc: (arg: T) => PropertyKey): T[] {
      var tResults = [];
      var tMap: any = {};
      for (var tI = 0; tI < arr.length; tI++) {
        const pk = hashFunc(arr[tI]);
        if (!tMap.hasOwnProperty(pk)) {
          tResults.push(arr[tI]);
          tMap[pk] = true;
        }
      }
      return tResults;
    }

    /** Remove value from array, if it is present */
    static removeValue<T>(array: T[], value: object) {
      for (var tI = array.length - 1; tI >= 0; tI--) {
        if (array[tI] === value) {
          array.splice(tI, 1);
        }
      }
    }

    /** Checks if value is in array */
    static hasValue = function<T>(array: T[], value: T): boolean {
      for (var tI = 0; tI < array.length; tI++) {
        if (array[tI] === value) {
          return true;
        }
      }
      return false;
    };

    /** Subtracts the elements in subArray from array */
    static subtract<T>(array: T[], subArray: T[]) {
      return Utils.removeIf(array, function (el) {
        return Utils.hasValue(subArray, el);
      });
    }
  }
}
