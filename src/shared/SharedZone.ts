import { isActualWater, StringifyLandcover, typedKeys, coordToIndex } from './consts'
import { SharedFentity, type ComponentCustomKeys } from './SharedFecs'
import { SharedBlueprint, SharedWob, type RotationCardinal, type blueprint_id, type SharedBlueprintWithBluests, type SharedBluestClasses } from './SharedWob'
import { type UintRange } from './TypeUtils'

/*

We're going to jam wob bpid and rotation into 2 bytes together.
bpid will be able to go up to 4096, and rotation up to 16 (actually leaving us 2 extra bits to play with).

// Babs constructs and send, then Proxima receives and stores:
const startId = 4006
const startRot = 3
const startX = 222
const startZ = 223
this.babs.socketSys.send({
	action: {
		verb: 'rotated',
		noun: wob.id,
		data: {
			rotation: 3,
		},
	}
})

// Proxima moves this into a Uint8 array
const idShifted = startId << 4 // 64096
const rotShifted = startRot << 0 // 3
const idAndRot = idShifted +rotShifted // 64099
const byte1 = idAndRot >>> 8 // 250
// In JS you are dealing with 32 bit numbers by default?
const byte2 = (idAndRot << 24) >>> 24 // 99
console.log(byte1, byte2)

// Proxima sends update of rotation to everyone
// Put into int8 array for sending
let locations = new Uint8Array(4)
locations[0] = byte1 // 250
locations[1] = byte2 // 99
locations[2] = startX
locations[3] = startZ

// Babs receives wob updates in Uint8 array
// Converts that into reasonable numbers
const left = (locations[0] << 8) // 64000
const right = locations[1] // 99
const idAndRot2 = left +right // 64099
const id = idAndRot2 >>> 4
const r = (idAndRot2 << (16 + 12)) >>> (16 + 12)
const x = locations[2] // 8 bits
const z = locations[3] // 8 bits
console.log(id, r, x, z)
*/

export class ZONE {
    public static ZONE_LENGTH_FEET = 1000
    public static ZONE_DATUM_SIZE = 20//40
    public static ZONE_DATUMS = ZONE.ZONE_LENGTH_FEET/ZONE.ZONE_DATUM_SIZE // 50
    public static ZONE_ARR_SIDE_LEN = ZONE.ZONE_DATUMS +1 // For 40ft was 26; now for 20ft it's 51.
	public static ZONE_MOVEMENT_EXTENT = 249
    
	static Yard = 4
	static Plot = ZONE.Yard *5 // 20 ft; 5 tiles
	static Acre = ZONE.Plot *10 // 200 ft; 50 tiles, 10 plots

    static YardsPerPlot = ZONE.Plot / ZONE.Yard // 5
}

export type SharedBluestatic<T extends keyof SharedBluestClasses> = {
	entityIds: Set<number> // Index into wobIdRotGrid for each wob with this bluestatic
	// and one of the SharedBluestClasses
	data: SharedBluestClasses[T]
}

interface ApplyLocationsOptions {
	returnWobs :boolean
	doApply :boolean
	isFarWobs?: boolean
}
type FarOrNear = 'far' | 'near'
export abstract class SharedZone {	
	constructor(
		private base: { allBluestaticsBlueprintsData :Map<any, any> }, // Proxima or Babs, which contains .allBluestaticsBlueprintsData
		public id :number,
		public x :number,
		public z :number,
		public y :number,
		public yscale :number,
		public elevations :Uint8Array,
		public landcovers :Uint8Array,
	) {

	}
	wobIdRotGrid = new Uint16Array(250*250).fill(0) // NOTE!  When setting this, also call this.setLocationsAreDirty()
	farWobIdRotGrid = new Uint16Array(250*250).fill(0) // NOTE!  When setting this, also call this.setLocationsAreDirty()
	// ^ Storing 12-bit locid and 4-bit rotation in a grid.  (position is the x,z of the grid)
	abstract locidToBlueprint :Record<number, SharedBlueprint>
	bpidToLocid :Record<string, number> = {}
	abstract bluestatics :Map<any, any>
	abstract components :Map<any, any>
	// abstract components :Map<any, any>
	// Should I replace locidToBlueprint and/or bpidToLocid with the new entity gets/sets?
	// No, because those are not related.  Those are for translating eg 'brick oven'->115 and back.  They're not involved in positioning at all.
	// In theory they could be moved out of zone to global, though in the future we might want zone-specific locids.

	getWob(x :number, z :number, farOrNear :FarOrNear = 'near') :SharedWob|null {
		const index = x +(z *250)
		const idAndRot = farOrNear === 'near' ? this.wobIdRotGrid[index] : this.farWobIdRotGrid[index]
		const locid = idAndRot >>> 4
		const r = (idAndRot << (16 + 12)) >>> (16 + 12) as RotationCardinal

		if(locid === 0) {
			// It's empty or unset!  This can happen when seeing if there's a wob at a location, for example.  If there's no wob.
			// console.log('noloc')
			return null
		}

		const blueprint = this.locidToBlueprint[locid]
		if(!blueprint) {
			console.warn('No blueprint found @1! For:', locid)
			return null
		}
		return new SharedWob(this.id, x, z, r, blueprint)
	}
	
	abstract removeWobGraphicAt(x :number, z :number, isFarWobs :boolean) :void

	applyLocationsToGrid(locations :Uint8Array, options :ApplyLocationsOptions) :Array<SharedWob> {
		// console.log('----------------- applyLocationsToGrid')
		if(!options.isFarWobs) options.isFarWobs = false // Default to near for the sake of server use

		// Initialize bluestaticWobs
		// this.bluestaticWobs.clear() // No, because applyLocationsToGrid can be partial, not a full reinit
		// Note that bluestatics only need to be set once, since they don't change.  Thus they are here but not in setWob.
		/* allBluestaicsBlueprintsData is like:
			'weighty': {
				'map': {
					strengthToLift: 1,
				},
				'water': {
					strengthToLift: 200,
				}
			} 
		*/

		/*
		bluestatics.set('weighty', {
			componentBlueprints.set('map', {
				data: {
					strengthToLift: 1,
				}
				entityIds: [12,15],
			})
		}

		*/
		// for(const [bluestKey, bluestValue] of this.base.allBluestaticsBlueprintsData.entries()) {
		// 	if(!this.bluestatics.has(bluestKey)) { // Init it if it doesn't have it already
		// 		const componentBlueprints = new Map()
		// 		for(const [blueprint_id, blueprintData] of bluestValue.entries()) {
		// 			componentBlueprints.set(blueprint_id, {
		// 				entityIds: new Set<number>(),
		// 				data: blueprintData
		// 			})
		// 		}
		// 		this.bluestatics.set(bluestKey, componentBlueprints)
		// 	}
		// }
		// console.log('this.bluestatics', this.bluestatics)
		
		/*
		Or what if we did:
		bluestatics.set('weighty', {
			entityIds: [12,15], // Are these ALL weighty, or just ones with same data?
			'map': {
				strengthToLift: 1,
			},
			'water': {
				strengthToLift: 200,
			}
		})
		*/
		for(const [bluestKey, bluestValue] of this.base.allBluestaticsBlueprintsData.entries()) {
			if(!this.bluestatics.has(bluestKey)) { // Init it if it doesn't have it already
				const data = {
					entityIds: new Set<number>(),
				}
				for(const [blueprint_id, blueprintData] of bluestValue.entries()) {
					data[blueprint_id] = blueprintData
				}
				this.bluestatics.set(bluestKey, data)
				
				// if(bluestKey === 'weighty') console.log('bluestKey', bluestKey, data) // console shows 81 counts correctly
			}
		}
		// console.log('this.bluestatics', this.bluestatics)
		/*
		And for components?
		components.set('wayfind', {
			componentEntities.set(1122, { // Unique per entity
				waypoints[], 
				...etc
			})
		})
		*/


		if(!locations || !locations.length) {
			// console.log('applyLocations: no locations!') // This happens naturally when a zone is empty eg on dev
			return [] // locations are not set for this zone (empty zone)
		}

		let wobs = []

		let locidsOfBlueprintsNotFound = {}

		for(let i=0; i<locations.length; i+=4){
			const left = ((locations[i+0] & 0xFF) << 8) >>> 8
			const right = locations[i+1] & 0xFF
			const locidrot = (left << 8) + right
			const x = locations[i+2]
			const z = locations[i+3]
			const locid = locidrot >>> 4
			// ^ Note, also used in 'getSharedWobsBasedOnLocations'
			// Also used in Expressa!

			const index = x +(z *250)

			const oldIdAndRot = options.isFarWobs ? this.farWobIdRotGrid[index] : this.wobIdRotGrid[index]
			const oldLocid = oldIdAndRot >>> 4

			const isLocidBeingRemoved = locid === 0
			const isLocidbeingUpdated = oldLocid !== 0 && oldLocid !== locid
			if(isLocidBeingRemoved) {
				const oldbp = this.locidToBlueprint[oldLocid]
				if(!oldbp) {
					if(!options.isFarWobs) console.warn('No blueprint found @2!', locid, oldLocid)
					// Can commonly happen when a farwob is removed that wasn't stored here
					continue
				}
				this.removeWobGraphicAt(x, z, options.isFarWobs)
				if(options.doApply) {
					if(options.isFarWobs) this.farWobIdRotGrid[index] = 0
					else this.wobIdRotGrid[index] = 0
					this.setLocationsAreDirty()

					// Update bluestaticWobs with removed wob
					typedKeys(oldbp?.bluests).forEach((bluestKey) => {
						// console.log('applyLocationsToGrid removing bluestKey', bluestKey, index)
						this.bluestatics.get(bluestKey).entityIds.delete(index) // Remove this index
					})
				}
			}
			else {
				if(isLocidbeingUpdated) {
					const oldbp = this.locidToBlueprint[oldLocid]
					if(!oldbp) {
						console.warn('No blueprint found @4!', locid)
						continue
					}
					this.removeWobGraphicAt(x, z, options.isFarWobs)
				}
				// And/or is being added for the first time
				if(options.doApply) {
					if(options.isFarWobs) this.farWobIdRotGrid[index] = locidrot
					else this.wobIdRotGrid[index] = locidrot
					this.setLocationsAreDirty()

					// Update bluestaticWobs with added wobs
					const bp = this.locidToBlueprint[locid]
					typedKeys(bp?.bluests).forEach((bluestKey) => {
						this.bluestatics.get(bluestKey).entityIds.add(index) // Add this index
					})
				}
				if(options.returnWobs) {
					// Note, also used in 'getSharedWobsBasedOnLocations':
					const r = (locidrot << (16 + 12)) >>> (16 + 12) as RotationCardinal
					const bp = this.locidToBlueprint[locid]
					if(!bp) {
						locidsOfBlueprintsNotFound[locid] = locid
						continue
					}
					wobs.push(new SharedWob(this.id, x, z, r, bp))
				}
			}

		}

		const keys = Object.keys(locidsOfBlueprintsNotFound)
		if(keys.length) console.warn('No blueprint found @5!  bpid[]:', keys.join(','))

		// if(this.x === 0 && this.z === 0) console.log('this.bluestaticWobs', this.bluestaticWobs)

		return wobs
	}
	getSharedWobsBasedOnLocations(farOrNear :FarOrNear = 'near') {
		let locidsOfBlueprintsNotFound = {}

		const locations = this.getLocationsFromGrid(farOrNear)
		let fwobs :SharedWob[] = []
		for(let i=0; i<locations.length; i+=4){
			const left = ((locations[i+0] & 0xFF) << 8) >>> 8
			const right = locations[i+1] & 0xFF
			const locidrot = (left << 8) + right
			const x = locations[i+2]
			const z = locations[i+3]
			const locid = locidrot >>> 4

			// Extracted from above 'applyLocationsToGrid'
			const r = (locidrot << (16 + 12)) >>> (16 + 12) as RotationCardinal
			const bp = this.locidToBlueprint[locid]
			if(!bp) {
				// console.warn('No blueprint found @6!', locid)
				locidsOfBlueprintsNotFound[locid] = locid
				continue
			}
			fwobs.push(new SharedWob(this.id, x, z, r, bp))
		}

		const keys = Object.keys(locidsOfBlueprintsNotFound)
		if(keys.length) console.warn('No blueprint found @6!  bpid[]:', keys.join(','))

		return fwobs
	}

	abstract applyBlueprints(blueprints :Map<blueprint_id, any>) :void
	
	/*
	getLocationsFromGrid(farOrNear :FarOrNear = 'near'){
		let countValid = 0
		const locs = []
		for(let x=0; x<250; x++) {
			for(let z=0; z<250; z++) {
				const index = x +(z *250)
				const idAndRot = farOrNear === 'near' ? this.wobIdRotGrid[index] : this.farWobIdRotGrid[index]
				if(idAndRot) {
					const byte1 = idAndRot >>> 8
					const byte2 = (idAndRot << 24) >>> 24
					locs.push([byte1, byte2, x, z])
					countValid++
				}
			}
		}
		return new Uint8Array(locs.flat())
	}
	*/
	cachedLocations :Uint8Array = new Uint8Array(250 * 250 * 4) // Preallocate a flat array (4 bytes per valid entry)
	cachedLocationsLength = 0
	isCachedLocationsDirty = true
	isCachedLocationsPersisted = true
	setLocationsAreDirty() {
		this.isCachedLocationsDirty = true
		this.isCachedLocationsPersisted = false  // So we know to persist it later
	}
	getLocationsFromGrid(farOrNear: FarOrNear = 'near') {
		if(this.isCachedLocationsDirty) {
			// console.log('recalcing locations for', this.id)
			const locs = new Uint8Array(250 * 250 * 4)
			let locIndex = 0
			const wobGrid = farOrNear === 'near' ? this.wobIdRotGrid : this.farWobIdRotGrid
			
			let index = 0;  // This will track x + (z * 250)
			for (let z = 0; z < 250; z++) {
				for (let x = 0; x < 250; x++, index++) {
					const idAndRot = wobGrid[index]
					if (idAndRot) {
						locs[locIndex++] = idAndRot >>> 8         // byte1 (ID part)
						locs[locIndex++] = (idAndRot & 0xFF)      // byte2 (Rot part)
						locs[locIndex++] = x                      // x position
						locs[locIndex++] = z                      // z position
					}
				}
			}

			this.cachedLocations = locs
			this.cachedLocationsLength = locIndex
			this.isCachedLocationsDirty = false
		}
		
		return this.cachedLocations.subarray(0, this.cachedLocationsLength)
	}

	calcElevationAtIndex(index :number) { // todo move to proxima exclusive?
		return (this.elevations[index] *this.yscale) +this.y
	}

	getZonesAround<T extends SharedZone>(fromZonePool :Array<T>, outFromThis :number = 1, includeThisZone :'includeThisZone' = 'includeThisZone') :Array<T> {
		const zonesAround: Array<T> = []

		outer: for (const zone of fromZonePool) {
			if (includeThisZone && zone.x === this.x && zone.z === this.z) {
				zonesAround.push(zone)
				continue
			}

			for (let dx = -outFromThis; dx <= outFromThis; dx++) {
				for (let dz = -outFromThis; dz <= outFromThis; dz++) {
					if (Math.abs(zone.x - this.x) <= outFromThis && Math.abs(zone.z - this.z) <= outFromThis) {
						zonesAround.push(zone)
						continue outer
					}
				}
			}
		}

		return zonesAround
	}

	getLandcoverAt(x :number, z :number) {
		const xPlot = Math.floor(x / (ZONE.Plot/ZONE.Yard))
		const zPlot = Math.floor(z / (ZONE.Plot/ZONE.Yard))
		const plotIndex = coordToIndex(xPlot, zPlot, ZONE.ZONE_ARR_SIDE_LEN)
		const landcoverCode = this.landcovers[plotIndex]

		const isLandcoverWater = isActualWater(landcoverCode) // It's a water spot (not a shore etc)

		return {landcoverCode: landcoverCode, landcoverString: StringifyLandcover[landcoverCode], isLandcoverWater: isLandcoverWater}
	}

}




