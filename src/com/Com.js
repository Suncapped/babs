
export class Com {
	babs
	idEnt
	constructor(babs, idEnt, comClass) {
		this.babs = babs
		this.idEnt = idEnt
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
