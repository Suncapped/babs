import { type UintRange } from './TypeUtils'
import { SharedCompGenerated, type SharedCompPlatform, type SharedCompEdible } from './SharedComps'

export class Blueprint {
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

export type Rotation = UintRange<0, 4>
export type PlayerRotation = UintRange<0, 8>
export type YardRange = UintRange<0, 250>
export class SharedWob extends Blueprint {
	static ROTATION_ANGLE_MAP_4 = { // For wobs, not controller!
		0: 0,
		1: 90,
		2: 180,
		3: 270,
	}

	constructor(
		public idzone :number,
		public x :number,
		public z :number,
		public r :Rotation,
		bp :Blueprint,
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
}