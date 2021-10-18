import { log } from "../Utils"

export class Com {
	babs
	idEnt
	constructor(idEnt, comClass, babs) {
		this.idEnt = idEnt
		this.babs = babs
		const babsComCategory = this.babs.comcats.get(comClass.name)
		// Create if needed!
		if(babsComCategory) {
			babsComCategory.push(this)
		}
		else {
			this.babs.comcats.set(comClass.name, [this])
		}
	}

}
