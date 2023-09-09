import { Babs } from '@/Babs'
import type { WobId } from '@/shared/SharedWob'
import { log } from '../Utils'

export class Comp {
	babs :Babs
	idEnt :number|WobId
	constructor(idEnt, comClass, babs :Babs) {
		this.idEnt = idEnt
		this.babs = babs
		const babsCompCategory = this.babs.compcats.get(comClass.name)
		
		if(!babsCompCategory) { // Create if needed!
			this.babs.compcats.set(comClass.name, [this])
		}
		else {
			babsCompCategory.push(this)
		}
	}

}
