import { SharedBlueprint, SharedWob, type SharedBluestClasses } from './SharedWob'
import type { SharedZone } from './SharedZone'



export type GridEntity = {
	idzone: number
	x: number
	z: number
	blueprint_id: string
}
export type IntegerEntity = {
	idzone: number
	id: number
	type: string
}

export class SharedFentity { // (grid eg wob, or integer eg player)
	static base: { zones: Map<number, SharedZone> }

	// I have made ent ids (dbid) start at 1,000,000 (way over 62,500 so that I can use gridIndex as an integer entid for grid entities (250x250)!  Rather than zone/x/z/bpid.
	id :number // Can be an integer id (dbid).  Or can be a gridindex (x,z) to be handled per-zone
	idzone :number
	type :string

	constructor(source :(GridEntity | IntegerEntity)) {
		this.id = 'id' in source ? source.id : source.x + source.z * 250
		this.idzone = source.idzone
		this.type = 'blueprint_id' in source ? source.blueprint_id : source.type
	}

	addComponent(componentKey :string, specificData :any) {
		const isIndex = this.id <= 1_000_000
		if(!isIndex) console.error('SharedFentity.addComponent called with a non index!  We are not ready!')

		const fullData = {
			idzone: this.idzone, 
			x: this.id % 250,
			z: Math.floor(this.id / 250),
			blueprint_id: this.type,
			...specificData, // Component data beyond identifying data
		}

		// Update local components
		const zone = SharedFentity.base.zones.get(this.idzone)
		const component = zone.components.get(componentKey) || new Map()
		component.set(this.id, fullData)
		zone.components.set(componentKey, component)
	}
	getComponent(key :string) {
		const zone = SharedFentity.base.zones.get(this.idzone)
		const componentData = zone.components.get(key).get(this.id)
		return componentData || null
	}
	updateComponent() {
		// TODO
	}
	removeComponent() {
		// TODO
	}

	getBluestatic(key :string) {
		const zone = SharedFentity.base.zones.get(this.idzone)
		const blueStatic = zone.bluestatics.get(key)
		const doesEntityHaveBluestatic = blueStatic?.entityIds.has(this.id)
		return doesEntityHaveBluestatic ? blueStatic[this.type] : null
	}
}

export class SharedFecs<Z extends SharedZone, BC extends SharedBluestClasses> {

	constructor(
		protected base: { zones: Map<number, Z> }, // Proxima or Babs, which contains .zones
	) {
		SharedFentity.base = this.base
	}

}