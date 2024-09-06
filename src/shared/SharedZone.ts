import { Blueprint, SharedWob, type RotationCardinal, type blueprint_id, type SharedBlueprintWithComps } from './SharedWob'
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

interface Bluestatic {
	gridIndices: Set<number> // Index into wobIdRotGrid for each wob with this bluestatic
	// and blueprint static data for that specific blueprint
}

interface ApplyLocationsOptions {
	returnWobs :boolean
	doApply :boolean
	isFarWobs?: boolean
}
type FarOrNear = 'far' | 'near'
export class SharedZone {	
	constructor(
		public id :number,
		public x :number,
		public z :number,
		public y :number,
		public yscale :number,
		public elevations :Uint8Array,
		public landcovers :Uint8Array,
	) {

	}
	wobIdRotGrid = new Uint16Array(250*250).fill(0)
	farWobIdRotGrid = new Uint16Array(250*250).fill(0)
	// ^ Storing 12-bit locid and 4-bit rotation in a grid.  (position is the x,z of the grid)
	locidToBlueprint :Record<number, Blueprint> = []
	bpidToLocid :Record<string, number> = {}
	bluestaticWobs :Map<string, Bluestatic> = new Map()

	getWob(x :number, z :number, farOrNear :FarOrNear = 'near') :SharedWob|null {
		const index = x +(z *250)
		const idAndRot = farOrNear === 'near' ? this.wobIdRotGrid[index] : this.farWobIdRotGrid[index]
		const locid = idAndRot >>> 4
		const r = (idAndRot << (16 + 12)) >>> (16 + 12) as RotationCardinal

		if(locid === 0) {
			// It's empty or unset!
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
	setWob(x :number, z :number, blueprint_id :string|0, rotation :RotationCardinal = undefined) { // NOTE, currently not used on client, and doesn't support near vs far
		const isLocidBeingRemoved = !blueprint_id
		let wob = this.getWob(x, z, 'near')

		const index = x +(z *250)

		const locid = this.bpidToLocid[blueprint_id]
		const bp = this.locidToBlueprint[locid]
		if(!bp) {
			console.warn('No blueprint found @3! For:', locid)
			return null
		}

		if(!this.bluestaticWobs.has(bp.blueprint_id)) this.bluestaticWobs.set(bp.blueprint_id, {gridIndices: new Set<number>()}) // Init if empty

		if(isLocidBeingRemoved) {
			if(wob) { // Is null on server
				this.removeWobGraphicAt(wob.x, wob.z, false) // no far support
			}
			this.wobIdRotGrid[index] = 0 // no far support
			this.bluestaticWobs.get(bp.blueprint_id).gridIndices.delete(index) // Remove this index

			return [0, 0, wob?.x | x, wob?.z | z]
		}
		// Otherwise, we are setting or updating locid in grid

		if(wob) { // Updating an existing one
			this.removeWobGraphicAt(wob.x, wob.z, false) // no far support
		}
		else { // Unset spot && we are setting
		}
		wob = new SharedWob(this.id, x, z, 0, bp)

		wob.blueprint_id = blueprint_id
		wob.locid = this.bpidToLocid[blueprint_id]

		const isRotationBeingSet = rotation !== undefined
		if(isRotationBeingSet) {
			wob.r = rotation
		}

		// Recombine them
		const idShifted = wob.locid << 4
		const rotShifted = wob.r << 0
		const idAndRot = idShifted +rotShifted
		// console.log('idAndRot', idShifted, rotShifted, idAndRot)

		this.wobIdRotGrid[index] = idAndRot // no far support
		this.bluestaticWobs.get(bp.blueprint_id).gridIndices.add(index) // Add this index

		// Return locations array of newly added wob
		const byte1 = idAndRot >>> 8
		const byte2 = (idAndRot << 24) >>> 24
		return [byte1, byte2, wob.x, wob.z]

	}
	removeWobGraphicAt(x :number, z :number, isFarWobs :boolean) {
		// To be overridden
		// console.warn('Wrong removeWobGraphicAt() is being run!') // No, it's not actually wrong; server does this, it's intended to do nothing on server.
		// Meh, server will run it sometimes.
	}

	applyLocationsToGrid(locations :Uint8Array, options :ApplyLocationsOptions) :Array<SharedWob> {
		if(!options.isFarWobs) options.isFarWobs = false // Default to near for the sake of server use

		if(!locations || !locations.length) {
			// console.log('applyLocations: no locations!')
			return [] // locations are not set for this zone (empty zone)
		}

		let wobs = []

		let locidsOfBlueprintsNotFound = {}

		this.bluestaticWobs.clear()

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


					const bp = this.locidToBlueprint[locid]
					const comps = bp?.comps
					if(!this.bluestaticWobs.has(bp.blueprint_id)) this.bluestaticWobs.set(bp.blueprint_id, {gridIndices: new Set<number>()}) // Init if empty
					this.bluestaticWobs.get(bp.blueprint_id).gridIndices.add(index) // Add this index
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

	applyBlueprints(blueprints :Map<blueprint_id, SharedBlueprintWithComps>) {
		// console.log('applyBlueprints', blueprints)
		for(const blueprintsWithComps of blueprints.values()) {
			const blueprint = new Blueprint(
				blueprintsWithComps.blueprint_id,
				blueprintsWithComps.locid, 
				blueprintsWithComps.comps,
			)
			this.locidToBlueprint[blueprint.locid] = blueprint
			this.bpidToLocid[blueprint.blueprint_id] = blueprint.locid
		}
	}

	
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

}




