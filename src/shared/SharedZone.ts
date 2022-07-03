

/*
// Request zones individually
zonewobs(0,0): {
	updated_at: 12341234
	locbytes: 1
	blueprints: [
		...
		250: {	
			bpid: tree
			...
		}
		251: {	
			bpid: rock
			name: gray rocks
			glb: rock-pile.glb
			...
		}
	]
	locations: [
		Byte[
			250, 222, 222, // Add r?
			251, 232, 128, 
			251, 121, 176
			id (0-250), x (0-250), z (0-250)
				// Jam rotation into Z!
			250+250+250=750
		] // height 0
		//Byte[250, 222, 222, 251, 232, 128] // height 1
		//Byte[] // height 2
	]
}
bbid = zoneid_height_bpid ?maybe
*/

export class Blueprint {
	bpid :string
	name? :string
	glb? :string
}

export class FastWob extends Blueprint {
	x :number
	z :number
}

export class SharedZone {

	id :number
	x :number
	z :number
	y :number
	yscale :number

	elevations = new Uint8Array(25 * 25)
	getElevation(x, z) { return this.elevations[x +(z *25)] }
	landcovers = new Uint8Array(25 * 25)
	getLandcover(x, z) { return this.landcovers[x +(z *25)] }

	// Could be optimized to 1-byte locids for most zones
	locidToBlueprint :Record<number, Blueprint>
	bpidToLocid :Record<string, number>
	locationToLocid = new Uint16Array(250 * 250).fill(0) // Fill since we overwrite selectively, unlike ele/lc
	getWob(x :number, z :number) :FastWob {
		const locid = this.locationToLocid[x +(z *250)]
		const blueprint = this.locidToBlueprint[locid]
		let wob = new FastWob
		wob = {x, z, ...blueprint}
		return wob
	}
	setWob(x :number, z :number, bpid :string|null) {
		if(bpid === null) {
			this.locationToLocid[x +(z *250)] = 0 // shortcut; just set that spot as empty
		}
		else {
			// Get locid for blueprint and set spot to that
			const locid = this.bpidToLocid[bpid]
			this.locationToLocid[x +(z *250)] = locid
		}
	}

	applyLocations(locations :Uint8Array) {
		let x, z, locid8, locid16, locid
		for(let i=0; i<locations.length; i+=3){
			locid16 = locations[i+0]
			locid8 = locations[i+1]
			locid = (locid16[i] << 8) +locid8[i];
			x = locations[i+2]
			z = locations[i+3]
			this.locationToLocid[x +(z *250)] = locid
		}
	}

	applyBlueprints(blueprints :Array<Blueprint>) {
		for(let locid=0; locid<blueprints.length; locid++) {
			this.locidToBlueprint[locid] = blueprints[locid]
			this.bpidToLocid[blueprints[locid].bpid] = locid
		}
	}

	persistLocations(){

	}
	persistBlueprints(){

	}

}




