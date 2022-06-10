import { log } from "../Utils"

export class Comp {
	babs
	idEnt
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
