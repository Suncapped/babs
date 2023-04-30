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

	heightAdjustEngineX :number
	heightAdjustEngineY :number
	heightAdjustEngineZ :number
}

// edible: SharedCompPlatform,
// firestarter: SharedCompPlatform,
// generated: SharedCompPlatform,
// healing: SharedCompPlatform,
// platform: SharedCompPlatform,
// scented: SharedCompPlatform,
// symbiote: SharedCompPlatform,
// touched: SharedCompPlatform,

