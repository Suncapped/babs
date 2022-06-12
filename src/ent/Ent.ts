
import { type Babs } from '@/Babs'
import { log } from '@/Utils'
export class Ent {
	id :number
	babs :Babs
	constructor(id :number, babs :Babs) {
		this.id = id
		this.babs = babs
		this.babs.ents.set(id, this)
	}

}


