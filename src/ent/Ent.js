
import { log } from '../Utils'
export class Ent {
	id
	babs
	constructor(id, babs) {
		this.id = id
		this.babs = babs
		this.babs.ents.set(id, this)
	}

}


