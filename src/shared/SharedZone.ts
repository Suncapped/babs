import type { SharedBlueprintWithComps, WobId, blueprint_id } from './SharedWob'
import { Blueprint, SharedWob, type Rotation } from './SharedWob'
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
	// ^ Storing 12-bit locid and 4-bit rotation in a grid.  (position is the x,z of the grid)
	locidToBlueprint :Record<number, Blueprint> = []
	bpidToLocid :Record<string, number> = {}

	getWob(x :number, z :number) :SharedWob|null {
		const idAndRot = this.wobIdRotGrid[x +(z *250)]
		const locid = idAndRot >>> 4
		const r = (idAndRot << (16 + 12)) >>> (16 + 12) as Rotation

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
	setWob(x :number, z :number, blueprint_id :string|0, rotation :Rotation = undefined) {
		const isLocidBeingRemoved = !blueprint_id
		let wob = this.getWob(x, z)

		if(isLocidBeingRemoved) {
			this.wobIdRotGrid[x +(z *250)] = 0
			if(wob) { // Is null on server
				this.removeWobGraphicAt(wob.x, wob.z)
			}
			return [0, 0, wob?.x | x, wob?.z | z]
		}

		// Otherwise, we are setting or updating locid in grid

		const locid = this.bpidToLocid[blueprint_id]
		const blueprint = this.locidToBlueprint[locid]
		if(!blueprint) {
			console.warn('No blueprint found @3! For:', locid)
			return null
		}

		if(wob) { // Updating an existing one
			this.removeWobGraphicAt(wob.x, wob.z) // Remove old graphic
		}
		else { // Unset spot && we are setting
		}
		wob = new SharedWob(this.id, x, z, 0, blueprint)

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

		this.wobIdRotGrid[x +(z *250)] = idAndRot

		// Return locations array of newly added wob
		const byte1 = idAndRot >>> 8
		const byte2 = (idAndRot << 24) >>> 24
		return [byte1, byte2, wob.x, wob.z]

	}
	removeWobGraphicAt(x :number, z :number) {
		// console.warn('Wrong removeWobGraphicAt() is being run!') // No, it's not actually wrong; server does this, it's intended to do nothing on server.
		// To be overridden
	}

	applyLocationsToGrid(locations :Uint8Array, returnWobs :boolean = false) :Array<SharedWob> {
		if(!locations || !locations.length) {
			// console.log('applyLocations: no locations!')
			return [] // locations are not set for this zone (empty zone)
		}

		let wobs = []

		for(let i=0; i<locations.length; i+=4){
			const left = (locations[i+0] << 8)
			const right = locations[i+1]
			const locidrot = left +right
			const x = locations[i+2]
			const z = locations[i+3]
			const locid = locidrot >>> 4
			// ^ Note, also used in 'getSharedWobsBasedOnLocations'
			// Also used in Expressa!

			const oldIdAndRot = this.wobIdRotGrid[x +(z *250)]
			const oldLocid = oldIdAndRot >>> 4

			const isLocidBeingRemoved = locid === 0
			const isLocidbeingUpdated = oldLocid !== 0 && oldLocid !== locid
			if(isLocidBeingRemoved) {
				const oldbp = this.locidToBlueprint[oldLocid]
				if(!oldbp) {
					console.warn('No blueprint found @2!', locid)
					continue
				}
				this.removeWobGraphicAt(x, z)
				this.wobIdRotGrid[x +(z *250)] = 0
			}
			else {
				if(isLocidbeingUpdated) {
					const oldbp = this.locidToBlueprint[oldLocid]
					if(!oldbp) {
						console.warn('No blueprint found @4!', locid)
						continue
					}
					this.removeWobGraphicAt(x, z)
				}
				this.wobIdRotGrid[x +(z *250)] = locidrot
				if(returnWobs) {
					// Note, also used in 'getSharedWobsBasedOnLocations':
					const r = (locidrot << (16 + 12)) >>> (16 + 12) as Rotation
					const bp = this.locidToBlueprint[locid]
					if(!bp) {
						// console.warn('No blueprint found @5!', locid) // todo improve so this still warns?  Was spamming on asset/bp mismatch or something.
						continue
					}
					wobs.push(new SharedWob(this.id, x, z, r, bp))
				}
			}

		}
		return wobs
	}
	getSharedWobsBasedOnLocations() {
		const locations = this.getLocationsFromGrid()
		let fwobs :SharedWob[] = []
		for(let i=0; i<locations.length; i+=4){
			const left = (locations[i+0] << 8)
			const right = locations[i+1]
			const locidrot = left +right
			const x = locations[i+2]
			const z = locations[i+3]
			const locid = locidrot >>> 4

			// Extracted from above 'applyLocationsToGrid'
			const r = (locidrot << (16 + 12)) >>> (16 + 12) as Rotation
			const bp = this.locidToBlueprint[locid]
			if(!bp) {
				console.warn('No blueprint found @6!', locid)
				continue
			}
			fwobs.push(new SharedWob(this.id, x, z, r, bp))
		}
		return fwobs
	}

	applyBlueprints(blueprints :Map<blueprint_id, SharedBlueprintWithComps>) {
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

	
	getLocationsFromGrid(){
		let countValid = 0
		const locs = []
		for(let x=0; x<250; x++) {
			for(let z=0; z<250; z++) {
				const idAndRot = this.wobIdRotGrid[x +(z *250)]
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

	getZonesAround(zones :Array<SharedZone>, includeThisZone :'includeThisZone' = 'includeThisZone') {
		const zonesAround = zones.filter(zone => {
			return (includeThisZone && zone.x==this.x && zone.z==this.z)
			// Clockwise starting at 12 (ie forward ie positivex):
			|| zone.x==this.x +1 && zone.z==this.z +0
			|| zone.x==this.x +1 && zone.z==this.z +1
			|| zone.x==this.x +0 && zone.z==this.z +1
			|| zone.x==this.x -1 && zone.z==this.z +1
			|| zone.x==this.x -1 && zone.z==this.z +0
			|| zone.x==this.x -1 && zone.z==this.z -1
			|| zone.x==this.x -0 && zone.z==this.z -1
			|| zone.x==this.x +1 && zone.z==this.z -1

		})
		// log('zonesAround', Zone.loadedZones.length, this.x, ',', this.z, ': ', zonesAround.map(z=>`${z.x},${z.z}`))
		return zonesAround
	}


}




