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

type ComponentGenericKeys = 'id' | 'idzone' | 'x' | 'z' | 'type' | 'blueprint_id'
type NoComponentGenericKeys = {
  [K in ComponentGenericKeys]?: never
}
export type ComponentCustomKeys = NoComponentGenericKeys & Record<string, any>

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

	addComponent(componentKey :string, customData :ComponentCustomKeys) {
		if(!this.idIsIndex()) return

		const fullData = {
			idzone: this.idzone, 
			x: this.id % 250,
			z: Math.floor(this.id / 250),
			blueprint_id: this.type,
			...customData, // Component data beyond identifying data
		}

		// Update local components
		const zone = SharedFentity.base.zones.get(this.idzone)
		let component = zone.components.get(componentKey)
		if (!component) { // Doesn't exist yet, so create it
			component = new Map()
			zone.components.set(componentKey, component)
		}
		component.set(this.id, fullData)
		// No top Map set necessary because it's a reference
	}
	getComponent(key :string) {
		if(!this.idIsIndex()) return
		const zone = SharedFentity.base.zones.get(this.idzone)
		const componentData = zone.components.get(key).get(this.id)
		return componentData || null
	}
	updateComponent(componentKey :string, customDataOverride :ComponentCustomKeys) {
		if(!this.idIsIndex()) return
		const zone = SharedFentity.base.zones.get(this.idzone)
		const component = zone.components.get(componentKey)
		const oldData = component.get(this.id)
		const updatedCustomData = {
			...oldData,
			...customDataOverride,
		}

		// Also need to handle update of key (ie x,z) if it's a grid entity
		// Actually, no.  This function doesn't handle the moving of the entity itself.  That will be something else.
		// Note that generic component data shouldn't be being set here.

		component.set(this.id, updatedCustomData)
		// No top Map set necessary because it's a reference
	}
	removeComponent(componentKey :string) {
		if(!this.idIsIndex()) return
		const zone = SharedFentity.base.zones.get(this.idzone)
		const component = zone.components.get(componentKey)
		component.delete(this.id)
		// No top Map set necessary because it's a reference
	}

	getBluestatic(key :string) {
		if(!this.idIsIndex()) return
		const zone = SharedFentity.base.zones.get(this.idzone)
		const blueStatic = zone.bluestatics.get(key)
		const doesEntityHaveBluestatic = blueStatic?.entityIds.has(this.id)
		return doesEntityHaveBluestatic ? blueStatic[this.type] : null
	}

	private idIsIndex() {
		if(this.id > 1_000_000) {
			console.error('SharedFecs called with an id that is not an index!  We are not ready!')
			return false
		}
		else return true
	}
}

export class SharedFecs<Z extends SharedZone, BC extends SharedBluestClasses> {

	constructor(
		protected base: { zones: Map<number, Z> }, // Proxima or Babs, which contains .zones
	) {
		SharedFentity.base = this.base
	}

}