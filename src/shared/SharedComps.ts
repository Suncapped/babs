abstract class SharedComp {
	blueprint_id :string

	constructor(values = {}) {
		Object.assign(this, values)
	}

	populateSafeFields(obj) {
		Object.assign(this, {}) // wipe
		if(obj) {
			for(const key in obj) {
				if(Object.hasOwn(this, key)) {
					this[key] = obj[key]
				}
			}
		}
	}
}


export class SharedCompEdible extends SharedComp {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}
}

export class SharedCompGenerated extends SharedComp {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}
}

export class SharedCompPlatform extends SharedComp {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}

	xOffsetFeet :number
	yOffsetFeet :number
	zOffsetFeet :number
}

export class SharedCompAudible extends SharedComp {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}

	soundDistanceFeet :number
	soundOnApproach :string
	soundContinuousLoop :string
	soundOnInteract :string
}

export class SharedCompVisible extends SharedComp {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}

	farMesh :string
}

export class SharedCompImpassable extends SharedComp {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}
	staminaToPass :number
}

export class SharedCompDurable extends SharedComp {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}
	destroyedOneTimeOutOf :number
}

// edible: SharedCompPlatform,
// firestarter: SharedCompPlatform,
// generated: SharedCompPlatform,
// healing: SharedCompPlatform,
// platform: SharedCompPlatform,
// scented: SharedCompPlatform,
// symbiote: SharedCompPlatform,
// touched: SharedCompPlatform,
// audible: SharedCompAudible,
// impassable: SharedCompImpassable,
// durable: SharedCompDurable,

