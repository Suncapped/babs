import { SharedBlueprint, SharedWob, type SharedBluestClasses } from './SharedWob'
import type { SharedZone } from './SharedZone'

type GridEntity = {
	idzone: number
	x: number
	z: number
	blueprint_id: string
}
type IntegerEntity = {
	idzone: number
	id: number
	type: string
}

export class Fentity { // (grid eg wob, or integer eg player)
	// I have made ent ids (dbid) start at 1,000,000 (way over 62,500 so that I can use gridIndex as an integer entid for grid entities (250x250)!  Rather than zone/x/z/bpid.
	id :number // Can be an integer id (dbid).  Or can be a gridindex (x,z) to be handled per-zone
	idzone :number
	type :string

	constructor(source :(GridEntity | IntegerEntity)) {
		this.id = 'id' in source ? source.id : source.x + source.z * 250
		this.idzone = source.idzone
		this.type = 'blueprint_id' in source ? source.blueprint_id : source.type
	}
}

export class Fecs<Z extends SharedZone, BC extends SharedBluestClasses> {

	constructor(
		private base: { zones: Map<number, Z> }, // Proxima or Babs, which contains .zones
	) {
	}

	// Hmm well practically, we're going to want to get some comp info when they click or move a 'map'.

	getEntityComponentData<K extends keyof BC>(
		entity: Fentity, // (grid eg wob, or integer eg player)
		key: K, // eg 'wayfind' or 'visible'
	): BC[K] | null {

		console.log('getEntityComponentData(', key, ',', entity, ')')
		const zone = this.base.zones.get(entity.idzone)

		// See if it's in bluestatics
		const blueStatic = zone.bluestatics.get(key)
		const doesEntityHaveBluestatic = blueStatic?.entityIds.has(entity.id)
		// console.log('blueStatic', blueStatic)
		// console.log('doesEntityHaveBluestatic', doesEntityHaveBluestatic)
		if (doesEntityHaveBluestatic) {
			return blueStatic[entity.type] as BC[K]
		}

		// // No bluestatic data, so look for components with data TODO
		// const componentEntities = zone.components.get(key)
		// const entityComponentData = componentEntities?.get(entity.id)
		// if (entityComponentData) {
		// 	return entityComponentData as BC[K]
		// }

		return null
	}
	
	// Why not just merge zone.bluestatics into zone.components?
	// My choice is to either keep bluestatics separate and separate them here, or to merge them and then treat them the same here.
	// In zone.components, a component is a map of entity.id -> componentData.
	// In zone.bluestatics, the bluestatic has a list of ids (entityIds) as well as a data object they all share.
	// So they need to be separated somewhere, because their access is deliberately different for efficiency of bluestatics.  Might as well be here in Fecs!
	// The abstraction will exist at Fentity.


}