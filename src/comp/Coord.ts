
import * as Utils from '@/Utils'
import { Comp } from '@/comp/Comp'
import { Ent } from '@/ent/Ent'

export class Coord extends Comp {
	// This patterns allows: const coord = await Coord.Create()
	constructor(ent, babs) {
		super(ent.id, Coord, babs)
	}
	static async Create(ent, babs) {
		const coord = new Coord(ent, babs)
		return coord.init(ent)
	}

	x
	y
	z
	
	async init(ent) { 
		this.x = ent.x
		this.y = ent.y
		this.z = ent.z
		return this
	}

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
		Engine float res
			EngineCoord (x: 957.2881665267777, z:0.1555015151515)
		Yard 4ft res (1000/250)
			YardCoord{centered:true} (x: 249, z:0)
		Piece 40ft res (1000/40)
			PieceCoord (x:20, z:0)
		Zone 1000ft res
			ZoneCoord (x:1, z:0)
	*/






}