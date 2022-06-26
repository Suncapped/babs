import { Babs } from '@/Babs'
import { log } from '../Utils'

export class Comp {
	babs :Babs
	idEnt :number
	constructor(idEnt, comClass, babs) {
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
