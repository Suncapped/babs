
import * as Utils from '@/Utils'
import { Comp } from '@/comp/Comp'
import { type Ent } from '@/ent/Ent'
import { type Babs } from '@/Babs'
import { Vector3 } from 'three'
import { type UintRange } from '@/TypeUtils'

/*
April '22: "Pllllease let's create types for engine vs yard vs piece, so I stop messing it up.  Start on Proxima, piece vs yard.  Maybe this is integrated into types, I dunno.  Or at least declare it, with size limits etc.  Or just named consts."
June '22...

Coordinate transforms/spaces:
	zone-local // Gets local zone coordinate, throws error if out of zone
		coord.local()
	zone-crosszone // Gets coordinates in another zone based on overflowing coordinates in this one
		coord.crosszone() {x: 251, z:0, zone?: zone{x:1, z:0}}
	global-player // Player perspective; accounts for moveEverything status of world
		coord.
	global-absolute // Absolute coordinates from zero point
		coord.global() {}

Coordinate formats:
	Yard 4ft res (1000/250)
		YardCoord{centered:true} (x: 249, z:0)
	Piece 40ft res (1000/40)
		PieceCoord (x:20, z:0)
	Zone 1000ft res
		ZoneCoord (x:1, z:0)
	Engine float res
		EngineCoord (x: 957.2881665267777, z:0.1555015151515)
*/


abstract class Coord {
	// constructor() {}
}

// Specific Coord Classes:

type YardRange = UintRange<0, 250>
export class YardCoord extends Coord {
	static Create(x :number, z :number) {
		if(x < 0 || x >= 250 || z < 0 || z >= 250) {
			console.error('Invalid YardCoord: ', x, z)
			return undefined
		}
		return new YardCoord().init(x as YardRange, z as YardRange)
	}

	x :YardRange
	z :YardRange
	init(x: YardRange, z :YardRange) {
		this.x = x
		this.z = z
		return this
	}

	toEngineCoord() {
		return EngineCoord.Create(new Vector3(this.x *4, 0, this.z *4))
	}
	toEngineCoordCentered() {
		return EngineCoord.Create(new Vector3(this.x *4 +2, 0, this.z *4 +2))
	}
}

type PieceRange = UintRange<0, 25>
export class PieceCoord extends Coord {
	static Create(x :PieceRange, z :PieceRange) {
		return new PieceCoord().init(x, z)
	}

	x :PieceRange
	z :PieceRange
	init(x: PieceRange, z :PieceRange) {
		this.x = x
		this.z = z
		return this
	}
}
export class ZoneCoord extends Coord {
	static Create(x :number, z :number) {
		return new ZoneCoord().init(x, z)
	}

	x :number
	z :number
	init(x :number, z :number) {
		this.x = x
		this.z = z
		return this
	}
}


export class EngineCoord extends Coord {
	// This patterns allows: const coord = await Coord.Create()
	static Create(float: Vector3) {
		return new EngineCoord().init(float)
	}

	x :number
	y :number
	z :number
	init(float :Vector3) { 
		this.x = float.x
		this.y = float.y
		this.z = float.z
		return this
	}

	toVector3() {
		return new Vector3(this.x, this.y, this.z)
	}
	toYardCoord() {
		return YardCoord.Create(Math.floor(this.x /4), Math.floor(this.z /4))
	}
}