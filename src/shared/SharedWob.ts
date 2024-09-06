import { type UintRange } from './TypeUtils'
import { SharedCompGenerated, type SharedCompPlatform, type SharedCompEdible, type SharedCompAudible, SharedCompObstructive, SharedCompDurable, SharedCompVisible, SharedCompWeighty } from './SharedComps'

export class SharedBlueprint {
	constructor(
		public blueprint_id :string,
		public locid :number,
		public comps :SharedCompClasses,
		public name? :string,
		public glb? :string,
	){
		if(!name) this.name = blueprint_id // Default name to bpid
	}
}

export type blueprint_id = string

class SharedCompClasses {
	edible? :SharedCompEdible
	// firestarter? :SharedCompPlatform
	generated? :SharedCompGenerated
	// healing? :SharedCompPlatform
	platform? :SharedCompPlatform
	// scented? :SharedCompPlatform
	// symbiote? :SharedCompPlatform
	// touched? :SharedCompPlatform
	audible? :SharedCompAudible
	obstructive? :SharedCompObstructive
	weighty? :SharedCompWeighty
	durable? :SharedCompDurable
	visible? :SharedCompVisible
}
export type SharedBlueprintWithComps = {
	blueprint_id :string
	locid :number
	comps :SharedCompClasses
}

export type WobId = {
	idzone :number,
	x :number,
	z :number,
	blueprint_id :string,
}

export function isWobId(item :any): item is WobId {
	return (item as WobId).idzone !== undefined
	&& (item as WobId).x !== undefined
	&& (item as WobId).z !== undefined
	&& (item as WobId).blueprint_id !== undefined
}

export function isMatchingWobIds(a: WobId, b: WobId, blueprint_too = false) {
	if(!(a && b)) return false
	return a.idzone === b.idzone
	&& a.x === b.x
	&& a.z === b.z
	&& (!blueprint_too || a.blueprint_id === b.blueprint_id)
}

export type RotationCardinal = 0 | 1 | 2 | 3
export type RotationCardinalDegrees = 0 | 90 | 180 | 270
export type PlayerRotation = UintRange<0, 8>
export type YardRange = UintRange<0, 250>
export class SharedWob extends SharedBlueprint {
	static ROTATION_CARDINAL_TO_DEGREES = { // For wobs, not controller!
		0: 0,
		1: 90,
		2: 180,
		3: 270,
	}
	static ROTATION_ROUNDDEGREES_TO_CARDINAL = {
		0: 0,
		90: 1,
		180: 2,
		270: 3,
	}

	static DegreesToCardinalDegrees = (degrees :number) :RotationCardinalDegrees => {
		// Normalize the angle to be between 0 and 360 degrees
		degrees = (degrees + 360) % 360

		if (degrees <= 45 || degrees > 315) return 0 // Right
		else if (degrees > 45 && degrees <= 135) return 90 // Up
		else if (degrees > 135 && degrees <= 225) return 180 // Left
		else return 270 // Down
	}

	constructor(
		public idzone :number,
		public x :number,
		public z :number,
		public r :RotationCardinal,
		bp :SharedBlueprint,
	){
		super(bp.blueprint_id, bp.locid, bp.comps, bp.name, bp.glb)
	}
	id() :WobId {
		return {
			idzone: this.idzone,
			x: this.x,
			z: this.z,
			blueprint_id: this.blueprint_id,
		}
	}
	idString() {
		return `${this.idzone}:${this.x}:${this.z}:${this.blueprint_id}`
	}
}