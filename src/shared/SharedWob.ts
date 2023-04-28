import { UintRange } from "./TypeUtils"

export class Blueprint {
	constructor(
		public blueprint_id :string,
		public locid :number,
		public name? :string,
		public glb? :string,
	){
		if(!name) this.name = blueprint_id // Default name to bpid
	}
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
export class SharedWob extends Blueprint {
	constructor(
		public idzone :number,
		public x :number,
		public z :number,
		public r :Rotation,
		bp :Blueprint,
	){
		super(bp.blueprint_id, bp.locid, bp.name, bp.glb)
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