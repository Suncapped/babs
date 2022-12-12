import { Babs } from '@/Babs'
import type { WobId } from '@/shared/consts'
import { log } from '../Utils'

export class Comp {
	babs :Babs
	idEnt :number|WobId
	constructor(idEnt, comClass, babs :Babs) {
		this.idEnt = idEnt
		this.babs = babs
		const babsCompCategory = this.babs.compcats.get(comClass.name)
		// Create if needed!
		if(babsCompCategory) {
			babsCompCategory.push(this)
		}
		else {
			this.babs.compcats.set(comClass.name, [this])
		}
	}

}
