import { SharedBlueprint, type SharedBluestClasses } from './SharedWob'
import type { SharedZone } from './SharedZone'

export class Fentity { // (grid eg wob, or integer eg player)
	id :number
	idzone :number
	gridIndex :number
}

export class Fecs {

	constructor(
		private base: { zones :Map<number, SharedZone> }, // Proxima or Babs, which contains .zones
	) {
	}

	// Hmm well practically, we're going to want to get some comp info when they click or move a 'map'.
	// TODO: I could make entids start at 1,000,000 so that I could use gridIndex() as an integer entid for grid entities!  Rather than zone/x/z/bpid.

	// getEntityComponentData<K extends keyof SharedBluestClasses>(
	// 	entity: Fentity, // (grid eg wob, or integer eg player)
	// 	key: K, // eg 'wayfind' or 'visible'
	// ): SharedBluestClasses[K] | null {
	// 	const zone = this.base.zones.get(entity.idzone)

	// 	// See if it's in bluestatics
	// 	const blueStatic = zone.bluestatics.get(key)
	// 	const doesEntityHaveBluestatic = blueStatic?.entityIds.has(entity.id)
	// 	if (doesEntityHaveBluestatic) {
	// 		return blueStatic.data as SharedBluestClasses[K]
	// 	}

	// 	// No bluestatic data, so look for components with data
	// 	const componentEntities = zone.components.get(key)
	// 	const entityComponentData = componentEntities?.get(entity.id)
	// 	if (entityComponentData) {
	// 		return entityComponentData as SharedBluestClasses[K]
	// 	}

	// 	return null
	// }
	
	// Why not just merge zone.bluestatics into zone.components?
	// My choice is to either keep bluestatics separate and separate them here, or to merge them and then treat them the same here.
	// In zone.components, a component is a map of entity.id -> componentData.
	// In zone.bluestatics, the bluestatic has a list of ids (entityIds) as well as a data object they all share.
	// So they need to be separated somewhere, because their access is deliberately different for efficiency of bluestatics.  Might as well be here in Fecs!
	// The abstraction will exist at Fentity.


}