import { type UintRange } from './TypeUtils'

/*
// Request zones individually
zonewobs(0,0): {
	updated_at: 12341234
	blueprints: [
		...
		4000: {	
			bpid: tree
			...
		}
		4001: {	
			bpid: rock
			name: gray rocks
			glb: rock-pile.glb
			...
		}
	]
	locations: [
		Byte[
			4000+0, 222, 222,
			4001+3, 232, 128, 
			4001+2, 121, 176,
		] // height 0
		//Byte[250, 222, 222, 251, 232, 128] // height 1
		//Byte[] // height 2
	]
}
bbid = zoneid_height_bpid ?maybe
*/


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
const byte2 = (idAndRot << 24) >> 24 // 99
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
const id = idAndRot2 >> 4
const r = (idAndRot2 << (16 + 12)) >>> (16 + 12)
const x = locations[2] // 8 bits
const z = locations[3] // 8 bits
console.log(id, r, x, z)
*/

export class Blueprint {
	constructor(
		public blueprint_id :string,
		public locid :number,
		public name? :string,
		public glb? :string,
	){}
}

export type Rotation = UintRange<0, 4>
export class FastWob extends Blueprint {
	constructor(
		public x :number,
		public z :number,
		public r :Rotation,
		bp :Blueprint,
	){
		super(bp.blueprint_id, bp.locid, bp.name, bp.glb)
	}
}

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

	getWob(x :number, z :number) :FastWob|null {
		const idAndRot = this.wobIdRotGrid[x +(z *250)] // this.wobIdRotGrid.get(x, z) was ndarray
		const locid = idAndRot >> 4
		const r = (idAndRot << (16 + 12)) >>> (16 + 12) as Rotation

		if(locid === 0) {
			// It's empty / unset!
			return null
		}

		const blueprint = this.locidToBlueprint[locid]
		return new FastWob(x, z, r, blueprint)
	}
	setWob(x :number, z :number, blueprint_id :string|0, rotation :Rotation = undefined) {
		let wob = this.getWob(x, z)

		if(!wob) { // Spot is unset.  Create a new one, depending.
			if(blueprint_id === 0) {
				// We're unsetting; and since this spot is already unset, do nothing!
				return
			}
			// We are setting on an unset spot: So create a new wob there
			const locid = this.bpidToLocid[blueprint_id]
			const bp = new Blueprint(blueprint_id, locid)
			wob = new FastWob(x, z, 0, bp)
		}

		const locidBeingRemoved = !blueprint_id
		if(locidBeingRemoved) {
			wob.locid = 0
		}
		else { // being set
			wob.locid = this.bpidToLocid[blueprint_id]
		}

		const isRotationBeingSet = rotation !== undefined
		if(isRotationBeingSet) {
			wob.r = rotation
		}

		// Recombine them
		const idShifted = wob.locid << 4
		const rotShifted = wob.r << 0
		const idAndRot = idShifted +rotShifted

		this.wobIdRotGrid[x +(z *250)] = idAndRot
	}

	applyLocationsToGrid(locations :Uint8Array, returnWobs :boolean = false) :Array<FastWob>|undefined {
		if(!locations) {
			// console.log('applyLocations: no locations!')
			return undefined // locations are not set for this zone (empty zone)
		}

		let wobs = undefined
		if(returnWobs) wobs = []// = new Array<FastWob>(locations.length /4)

		for(let i=0; i<locations.length; i+=4){
			const x = locations[i+0]
			const z = locations[i+1]
			const left = (locations[i+2] << 8)
			const right = locations[i+3]
			const locidrot = left +right
			this.wobIdRotGrid[x +(z *250)] = locidrot

			if(returnWobs) {
				const locid = locidrot >> 4
				const r = (locidrot << (16 + 12)) >>> (16 + 12) as Rotation

				const bpid = this.locidToBlueprint[locid].blueprint_id
				wobs.push(new FastWob(x, z, r, new Blueprint(bpid, locid)))
			}
		}
		return wobs
	}

	applyBlueprints(blueprints :Array<string|number>) { // [bpid, locid, ..., ...]
		for(let i=0; i<blueprints.length; i+=2) {
			const bpid = blueprints[i+0] as string
			const locid = blueprints[i+1] as number

			const blueprint = new Blueprint(bpid, locid)
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
					const byte2 = (idAndRot << 24) >> 24
					locs.push([x, z, byte1, byte2])
					countValid++
				}
			}
		}
		return new Uint8Array(locs.flat())
	}

}




