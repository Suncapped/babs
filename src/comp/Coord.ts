
import { log } from '@/Utils'
import { Comp } from '@/comp/Comp'
import { type Ent } from '@/ent/Ent'
import { type Babs } from '@/Babs'
import { RedIntegerFormat, Vector2, Vector3 } from 'three'
import { type UintRange } from '@/TypeUtils'
import { Zone } from '@/ent/Zone'

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
type CoordAndZone = {x :number, z :number, zone: Zone} // Used for Create()s

// Specific Coord Classes:


type YardRange = UintRange<0, 250>
export class YardCoord extends Coord {
	static PER_ZONE = 250
	static Create(coord :CoordAndZone) { // Can be like a wob with xz, or just an object with them eg {x:,z:}
		// This will replace worldSys.zoneAndPosFromCurrent()
		// Zone, like in EngineCoord.toYardCoord() is a perspective zone from player?
		const crossCoord = crosszoneCoord(coord, YardCoord.PER_ZONE)
		return new YardCoord().init(crossCoord.x as YardRange, crossCoord.z as YardRange, crossCoord.zone)
	}

	x :YardRange
	z :YardRange
	zone :Zone
	init(x: YardRange, z :YardRange, zone :Zone) {
		if(x < 0 || x >= 250 || z < 0 || z >= 250) {
			console.error('Invalid YardCoord: ', x, z, zone)
			return undefined
		}
		this.x = x
		this.z = z
		this.zone = zone
		return this
	}

	toEngineCoord() {
		/* Its engine coordinate is not: this.zone.x *1000 +this.x *4
		Because that is just its theoretical coordinate if the player were at 0,0.
		Rather, its engine coordinate would be relative. ?? maybe?
		*/
		// Bottom line, zone engine coords are player-relative.  Since the zones get moved around the player.
		// Maybe I need an intermediary, like to get a WorldGridCoord.  

		// Let's try just calcing player relative:
		// this.zone.babs.worldSys.currentGround <- position of this will ALWAYS be 0,0,0
		// But its .zone.x will be correct!
		// also note above that this.zone.ground <- position of this will always be relative to currentGround?
		
		// const zoneTheoreticalX = this.zone.x *1000
		// const zoneGroundX = this.zone.ground.position.x
		// const zoneGroundZ = this.zone.ground.position.z
		// log('zonx', 
		// 	this.x + ','+this.z, 
		// 	this.zone.x + ','+this.zone.z, 
		// 	this.zone.ground.position.x + ','+this.zone.ground.position.z, 
		// 	this.zone.babs.worldSys.currentGround.position.x+','+this.zone.babs.worldSys.currentGround.position.z,
		// )

		// So the engine X of this coord's stuff is just objectively +zoneActualX
		// So then why is it putting things one-zone-over way forward?  
		// Well, for one thing, next-zone stuff ALREADY translated?

		// const shiftiness = this.zone.babs.worldSys.shiftiness
		// shiftiness not needed; it's built into this.zone.ground.position
		return EngineCoord.Create(new Vector3(
			(this.zone.ground.position.x) +this.x *4, 
			0, 
			(this.zone.ground.position.z) +this.z *4
		))
	}
	toEngineCoordCentered() {
		return EngineCoord.Create(new Vector3(
			(this.zone.ground.position.x) +this.x *4 +2, 
			0, 
			(this.zone.ground.position.z) +this.z *4 +2,
		))
	}
}

// type PieceRange = UintRange<0, 25>
// export class PieceCoord extends Coord {
// 	static Create(x :PieceRange, z :PieceRange) {
// 		return new PieceCoord().init(x, z)
// 	}

// 	x :PieceRange
// 	z :PieceRange
// 	init(x: PieceRange, z :PieceRange) {
// 		this.x = x
// 		this.z = z
// 		return this
// 	}
// }
export class ZoneCoord extends Coord {
	static Create(coord :CoordAndZone) { // Can be like a wob with xz, or just an object with them eg {x:,z:}
		if(!Number.isInteger(coord.x) || !Number.isInteger(coord.z)) {
			console.error('Invalid ZoneCoord: ', coord.x, coord.z)
			return undefined
		}
		return new ZoneCoord().init(coord.x, coord.z, coord.zone)
	}

	x :number
	z :number
	zone :Zone
	init(x: number, z :number, zone :Zone) {
		this.x = x
		this.z = z
		this.zone = zone
		return this
	}

	toEngineCoord() {
		return EngineCoord.Create(new Vector3(this.x *1000, 0, this.z *1000))
	}
}


export class EngineCoord extends Coord {
	// This patterns allows: const coord = await Coord.Create()
	static Create(input: Vector3) {
		if(input instanceof Vector3) {
			return new EngineCoord().init(input)
		}
		// else if(input instanceof YardCoord) {
		// 	return input.toEngineCoord()
		// }
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
	toYardCoord(fromPerspectiveOf :Zone) :YardCoord { // zonetodo
		// I could ray down and find which zone that way?
		// But zone should also be derivable from playeroffset with zone.xz *1000
		// Though playeroffset would be zero in a future unending terrain.
		// It would be more like playerCenter, which for my purposes is 0,0?
		// What about just passing in zone, from context?
		// There is no zone in context of a ray.  So how about passing in...wait...the ground itself?! lol
		// So I could get the zone, but how does that help me? 
		// 	For groundclick it does I guess.  I can take zone offsets and get remainder.
		//	But for objects...well yeah.  
		// But why even do this?  Click enginecoord, convert to yard, then back to engine for display?
		// I guess because the original enginecoord is not grid-aware.
		// Ohhh and we need elevation.  (But...wouldn't that be on the click ray?)
		// Is this all for zone.calcHeightAt()??? lol
		// Hmm also for getting the sub-zone landcover


		// eg: x: 1017.9435729436972
		// /4 =254.25, floor() = 254

		// log('toYardCoord', fromPerspectiveOf.id, fromPerspectiveOf.x, this.x)

		
		return YardCoord.Create({
			x: Math.floor((this.x) /4), 
			z: Math.floor((this.z) /4),
			zone: fromPerspectiveOf,
		})


		// So, to get playeroffset, 
	}
}

function crosszoneCoord(startingCoord :CoordAndZone, perZone :number) :CoordAndZone {
	const babs = startingCoord.zone.babs

	// First find what zone this original coord is coming from

	// Delta of current zone we need to reach target zone
	const deltaZoneX = Math.floor(startingCoord.x /perZone)
	const deltaZoneZ = Math.floor(startingCoord.z /perZone)

	// Now add delta to starting zone to get the absolute target zone
	const absTargetZoneCoord = {
		x: startingCoord.zone.x +deltaZoneX,
		z: startingCoord.zone.z +deltaZoneZ,
		zone: null, // Not yet known, find it next
	}
	// // See if that zone is different from this zone
	// if(startingZone.x === absTargetZoneCoord.x && startingZone.z === absTargetZoneCoord.z){
	// 	// return coord // zonetodo optimize, Return original coord? or earlier, above?
	// }
	// Find target zone's id
	for(const [id, zone] of babs.ents) {
		if(zone instanceof Zone && zone.x === absTargetZoneCoord.x && zone.z === absTargetZoneCoord.z) {
			// log('hhhhhmph', startingCoord.x, deltaZoneX, startingCoord.zone.x, absTargetZoneCoord.x, zone)
			absTargetZoneCoord.zone = zone
			break
		}
	}
	if(!absTargetZoneCoord.zone) {
		log('crosszoneCoord: No target zone at', absTargetZoneCoord, 'for startingCoord', startingCoord)
	}
	else {
		// log('FOUND ZONE?!?!', startingCoord, absTargetZoneCoord.zone)
	}

	// Find remainder/overflow YardCoord (YardCoord within the potentially new zone)
	const remainderYards = {
		x: startingCoord.x %perZone,
		z: startingCoord.z %perZone,
		zone: absTargetZoneCoord.zone,
	}
	// Loop back from max on negative (balances modulus which handles positive)
	if(remainderYards.x < 0) remainderYards.x += perZone
	if(remainderYards.z < 0) remainderYards.z += perZone

	// Now, do we need to translate this to player's zone?  I mean, why?  If we're using absolute zone coords, it should be fine!
	
	return remainderYards // contains idzone
}