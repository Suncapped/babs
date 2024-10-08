abstract class SharedBluest {
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


export class SharedBluestEdible extends SharedBluest {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}
}

export class SharedBluestGenerated extends SharedBluest {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}
}

export class SharedBluestPlatform extends SharedBluest {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}

	xOffsetFeet :number
	yOffsetFeet :number
	zOffsetFeet :number
}

export class SharedBluestAudible extends SharedBluest {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}

	soundDistanceFeet :number
	soundOnApproach :string
	soundContinuousLoop :string
	soundOnInteract :string
}

export class SharedBluestVisible extends SharedBluest {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}

	farMesh :string
}

export class SharedBluestObstructive extends SharedBluest {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}
	staminaToPass :number
}

export class SharedBluestWeighty extends SharedBluest {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}
	strengthToLift :number
}

export class SharedBluestDurable extends SharedBluest {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}
	destroyedOneTimeOutOf :number
}

export class SharedBluestLocomoted extends SharedBluest {
	constructor(values = {}) {
		super(values)
		Object.assign(this, values)
	}

	mphSpeed :string
}

// edible: SharedBluestPlatform,
// firestarter: SharedBluestPlatform,
// generated: SharedBluestPlatform,
// healing: SharedBluestPlatform,
// platform: SharedBluestPlatform,
// scented: SharedBluestPlatform,
// symbiote: SharedBluestPlatform,
// touched: SharedBluestPlatform,
// audible: SharedBluestAudible,
// obstructive: SharedBluestObstructive,
// weighty: SharedBluestWeighty,
// durable: SharedBluestDurable,

