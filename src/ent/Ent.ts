
import { type Babs } from '@/Babs'
import { log } from '@/Utils'
export class Ent {
	id :Number
	babs :Babs
	constructor(id :Number, babs :Babs) {
		this.id = id
		this.babs = babs
		this.babs.ents.set(id, this)
	}

}


