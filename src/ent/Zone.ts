
import { YardCoord } from '@/comp/Coord'
import { WorldSys } from '@/sys/WorldSys'

import { BufferAttribute, Color, InstancedMesh, MathUtils, Matrix4, Mesh, Object3D, PlaneGeometry, PositionalAudio, Raycaster, Triangle, Vector2, Vector3 } from 'three'
import { Ent } from './Ent'
import { Babs } from '@/Babs'
import { Wob } from './Wob'
import { Flame } from '@/comp/Flame'
import { SharedWob, Blueprint } from '@/shared/SharedWob'
import { SharedZone } from '@/shared/SharedZone'
import * as Utils from '@/Utils'
import type { InstancedWobs } from './InstancedWobs'
import { Audible } from '@/comp/Audible'
import type { Player } from './Player'
import { LoaderSys } from '@/sys/LoaderSys'
import type { SendFootstepsCounts } from '@/shared/consts'


export class Zone extends SharedZone {

	static loadedZones :Zone[] = []

	constructor(
		public babs :Babs,
		public id :number,
		public x :number,
		public z :number,
		public y :number,
		public yscale :number,
		public elevations :Uint8Array,
		public landcovers :Uint8Array,
	) {
		super(id, x, z, y, yscale, elevations, landcovers)
		this.babs.ents.set(id, this)
	}

	elevationData // Injected later
	landcoverData // Injected later
	locationData // Injected later
	farLocationData // Injected later

	geometry :PlaneGeometry
	ground :Mesh // ground 3d Mesh

	colorsCopy :Float32Array

	key() {
		return `${this.x},${this.z}`
	}

	override removeWobGraphicAt(x :number, z :number) {
		const existingWob = this.getWob(x, z)
		// Problem was: It's still getting this from location data array.  For frontend, we want to be able to pass in a wob.  Thus we split off removeWobGraphic()
		// console.log('existing', existingWob)
		return this.removeWobGraphic(existingWob)

	}
	removeWobGraphic(deletingWob :SharedWob, overrideNameAndBlueprint :string|false = false, recalculateIndexKey = true) { // Don't recalculateIndexKey for large (eg zone-wide) removals, it's quite slow
		const originalName = deletingWob.name
		const originalBlueprintId = deletingWob.blueprint_id
		if(overrideNameAndBlueprint) {
			deletingWob.name = overrideNameAndBlueprint
			deletingWob.blueprint_id = overrideNameAndBlueprint
		} // These get un-mutated below

		if(!deletingWob.blueprint_id) {
			console.warn('deletingWob does not have a blueprint_id:', deletingWob)
		}

		const feim = Wob.InstancedWobs.get(deletingWob.blueprint_id)
		if(!feim) {
			console.warn('no matching instanced to:', deletingWob.blueprint_id)
		}
		const deletingWobZone = this.babs.ents.get(deletingWob.idzone) as Zone

		// Remove attachments
		Flame.Delete(deletingWob, this.babs)
		Audible.Delete(deletingWob, this.babs)
		
		// We are going to copy the source (last item) to the target (item being deleted).  Then cleanup of references.
		// Source is the last item in the instance index.
		// const sourceIndex = instancedMesh.count -1
		const sourceIndex = feim.getLoadedCount() -1
		// Target is the item being deleted.
		const targetIndex = deletingWobZone.coordToInstanceIndex[deletingWob.x+','+deletingWob.z] 
		// May also need for farCoordToInstanceIndex?  Once we allow removal via zoning/updates

		// console.log('--------- deletingWobXZ, sourceIndex, targetIndex', deletingWob.name, 'at', deletingWobZone.id+':['+deletingWob.x+','+deletingWob.z+']', 'will', sourceIndex+' ==> '+ targetIndex, deletingWobZone.coordToInstanceIndex)

		Zone.swapWobsAtIndexes(sourceIndex, targetIndex, feim, 'delete')
		// instancedMesh.count = instancedMesh.count -1
		feim.decreaseLoadedCount()
		feim.instancedMesh.instanceMatrix.needsUpdate = true 
		if(deletingWob.blueprint_id !== feim.blueprint_id) {
			console.warn('deletingWob.blueprint_id mismatch with instancedMesh.name', deletingWob.blueprint_id, feim.blueprint_id)
		}
		// Wob.InstancedMeshes.set(deletingWob.blueprint_id, instancedMesh)

		// Don't mutate these
		if(overrideNameAndBlueprint) {
			deletingWob.name = originalName
			deletingWob.blueprint_id = originalBlueprintId
		}
	}

	static swapWobsAtIndexes(sourceIndex :number, targetIndex :number, feim :InstancedWobs, doDeleteSource :'delete' = null) {
		if(sourceIndex === targetIndex) { // No change
			// return // No, because 'doDeleteSource' may still need to run
		}
		const sourceMatrix = new Matrix4(); feim.instancedMesh.getMatrixAt(sourceIndex, sourceMatrix)
		const targetMatrix = new Matrix4(); feim.instancedMesh.getMatrixAt(targetIndex, targetMatrix)

		const showSwapLogs = false

		// Get source and target wobs from instanceIndexToWob
		const sourceWobAnyZone = feim.instanceIndexToWob.get(sourceIndex)
		const targetWobAnyZone = feim.instanceIndexToWob.get(targetIndex)
		if(showSwapLogs) console.log(`instanceIndexToWob.get: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}' get ${sourceIndex} result: ${sourceWobAnyZone.name}`)
		if(showSwapLogs) console.log(`instanceIndexToWob.get: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}' get ${targetIndex} result: ${targetWobAnyZone.name}`)

		// Copy into target from source matrix, and vice versa
		feim.instancedMesh.setMatrixAt(sourceIndex, targetMatrix)
		feim.instancedMesh.setMatrixAt(targetIndex, sourceMatrix)

		// Update coordToInstanceIndex for the source and target wobs
		if(!feim.asFarWobs) {
			sourceWobAnyZone.zone.coordToInstanceIndex[sourceWobAnyZone.x+','+sourceWobAnyZone.z] = targetIndex
			targetWobAnyZone.zone.coordToInstanceIndex[targetWobAnyZone.x+','+targetWobAnyZone.z] = sourceIndex
			if(showSwapLogs) console.log(`anyzone.coordToInstanceIndex: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}' set ${sourceWobAnyZone.zone.id}:[${sourceWobAnyZone.x},${sourceWobAnyZone.z}] = ${targetIndex}`)
			if(showSwapLogs) console.log(`anyzone.coordToInstanceIndex: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}' set ${targetWobAnyZone.zone.id}:[${targetWobAnyZone.x},${targetWobAnyZone.z}] = ${sourceIndex}`)
		}
		else {
			sourceWobAnyZone.zone.farCoordToInstanceIndex[sourceWobAnyZone.x+','+sourceWobAnyZone.z] = targetIndex
			targetWobAnyZone.zone.farCoordToInstanceIndex[targetWobAnyZone.x+','+targetWobAnyZone.z] = sourceIndex
			if(showSwapLogs) console.log(`anyzone.farCoordToInstanceIndex: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}' set ${sourceWobAnyZone.zone.id}:[${sourceWobAnyZone.x},${sourceWobAnyZone.z}] = ${targetIndex}`)
			if(showSwapLogs) console.log(`anyzone.farCoordToInstanceIndex: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}' set ${targetWobAnyZone.zone.id}:[${targetWobAnyZone.x},${targetWobAnyZone.z}] = ${sourceIndex}`)
		}

		// Update instanceIndexToWob
		feim.instanceIndexToWob.set(sourceIndex, targetWobAnyZone)
		feim.instanceIndexToWob.set(targetIndex, sourceWobAnyZone)		
		if(showSwapLogs) console.log(`instancedMesh.instanceIndexToWob.set: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}'.set(${sourceIndex}, `, targetWobAnyZone, ')')
		if(showSwapLogs) console.log(`instancedMesh.instanceIndexToWob.set: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}'.set(${targetIndex}, `, sourceWobAnyZone, ')')

		if(doDeleteSource) {
			feim.instanceIndexToWob.delete(sourceIndex)
			if(showSwapLogs) console.log(`doDeleteSource: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}' delete ${sourceIndex} `)

			// delete sourceWobAnyZone.zone.coordToInstanceIndex[targetWobAnyZone.x+','+targetWobAnyZone.z]
			if(!feim.asFarWobs) {
				targetWobAnyZone.zone.coordToInstanceIndex[targetWobAnyZone.x+','+targetWobAnyZone.z] = null
				if(showSwapLogs) console.log(`doDeleteSource: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}' for ${targetWobAnyZone.name} set coordToInstanceIndex[${targetWobAnyZone.x},${targetWobAnyZone.z}] = null`)
			}
			else {
				targetWobAnyZone.zone.farCoordToInstanceIndex[targetWobAnyZone.x+','+targetWobAnyZone.z] = null
				if(showSwapLogs) console.log(`doDeleteSource: '${sourceWobAnyZone.name}/${targetWobAnyZone.name}' for ${targetWobAnyZone.name} set farCoordToInstanceIndex[${targetWobAnyZone.x},${targetWobAnyZone.z}] = null`)
			}

			// // "Remove" source matrix by reducing instanced count
			// // Now done outside of the swap function
			// instancedMesh.count = instancedMesh.count -1
			// instancedMesh.instanceMatrix.needsUpdate = true 
		}

		feim.babs.ents.set(sourceWobAnyZone.zone.id, sourceWobAnyZone.zone) // todo optimize, necessary?
		feim.babs.ents.set(targetWobAnyZone.zone.id, targetWobAnyZone.zone)

	}

	coordToInstanceIndex :Record<string, number> = {}
	farCoordToInstanceIndex :Record<string, number> = {}

	engineHeightAt(coord :YardCoord, innerPositionNorm :'corner'|'center'|Vector3 = 'center') :number { // Get height, of corner|center|[0-1,0-1] position
		// Fetch from actual ground mesh vertices!

		const verticesRef = (coord.zone.geometry.getAttribute('position') as BufferAttribute).array
		const nCoordsComponents = 3 // x,y,z

		const centerPointInPlot = WorldSys.ZONE_DATUM_SIZE /WorldSys.Yard

		const index00 = Utils.coordToIndex(Math.floor((coord.x +0) /centerPointInPlot), Math.floor((coord.z +0) /centerPointInPlot), WorldSys.ZONE_ARR_SIDE_LEN, nCoordsComponents)
		const height00 = verticesRef[index00 +1]  // +1 is to get y

		const index10 = Utils.coordToIndex(Math.floor((coord.x +centerPointInPlot) /centerPointInPlot), Math.floor((coord.z +0) /centerPointInPlot), WorldSys.ZONE_ARR_SIDE_LEN, nCoordsComponents)
		const height10 = verticesRef[index10 +1]

		const index01 = Utils.coordToIndex(Math.floor((coord.x +0) /centerPointInPlot), Math.floor((coord.z +centerPointInPlot) /centerPointInPlot), WorldSys.ZONE_ARR_SIDE_LEN, nCoordsComponents)
		const height01 = verticesRef[index01 +1]

		const index11 = Utils.coordToIndex(Math.floor((coord.x +centerPointInPlot) /centerPointInPlot), Math.floor((coord.z +centerPointInPlot) /centerPointInPlot), WorldSys.ZONE_ARR_SIDE_LEN, nCoordsComponents)
		const height11 = verticesRef[index11 +1]

		/* 
		// First attempt was:
		const avg = (height00 +height01 +height10 +height11) /4
		console.log('engineHeightAt internal', height00, height01, height10, height11, avg)
		return avg
		// But ^that average is the center of the 40x40 piece, NOT the center of a 4x4 tile.

		// Next attempt was naive proportions:
		const towardX = (coord.x % 5) +(doCenter ? 0.5 : 0)
		const towardZ = (coord.z % 5) +(doCenter ? 0.5 : 0)
		const xHeightDiff = height10 -height00
		const zHeightDiff = height11 -height01
		// ^ Bug: Only compares diff of 2 vertices. 
		// Might need real math here?  Because as X increases it can increase the influence of Z height changes.
		const weightedX = (xHeightDiff *(towardX /5))
		const weightedZ = (zHeightDiff *(towardZ /5))
		const finalHeight = height00 +(weightedX +weightedZ)
		return finalHeight
		
		// Final, working attempt: Barycentric Coordinates https://codeplea.com/triangular-interpolation
		// Built-in is: https://threejs.org/docs/#api/en/math/Triangle .getBarycoord()

		// Naively, we will need to determine whether this point is in the first-half triangle, or the second triangle.
		// ↑ [\ ]
		// x [ \]
		//   z →
		*/

		const xPiece = Math.floor(coord.x /centerPointInPlot) *centerPointInPlot
		const zPiece = Math.floor(coord.z /centerPointInPlot) *centerPointInPlot
		let xInnerCoord = coord.x -xPiece
		let zInnerCoord = coord.z -zPiece

		const isFirstHalf = xInnerCoord +zInnerCoord < WorldSys.Yard

		let triangle
		if(isFirstHalf){ // First triangle (less than halfway across, diagonally)
			triangle = new Triangle(
				new Vector3(0, 	0, 0), // z0, x0
				new Vector3(0 +centerPointInPlot, 0, 0), // x1
				new Vector3(0, 	0, 0 +centerPointInPlot), // z1
			)
		}
		else { // Second triangle (more than halfway across)
			triangle = new Triangle(
				new Vector3(0, 		0, 0 +centerPointInPlot), // z1
				new Vector3(0 +centerPointInPlot, 	0, 0	), // x1
				new Vector3(0 +centerPointInPlot, 	0, 0 +centerPointInPlot), // z1, x1
			)
		}

		let innerPosition :Vector3
		if(innerPositionNorm === 'corner') innerPosition = new Vector3(0, 0, 0)
		else if(innerPositionNorm === 'center') innerPosition = new Vector3(0.5, 0, 0.5)
		else innerPosition = innerPositionNorm

		let baryOut = new Vector3()
		triangle.getBarycoord(new Vector3(xInnerCoord +innerPosition.x, 0, zInnerCoord +innerPosition.z), baryOut)

		let combinedWeights :number
		if(isFirstHalf) {
			combinedWeights = (height00 *baryOut.x) +(height10 *baryOut.y) +(height01 *baryOut.z)
		}
		else {
			combinedWeights = (height01 *baryOut.x) +(height10 *baryOut.y) +(height11 *baryOut.z)
		}
		return combinedWeights
	}

	// calcElevationAtIndex(index :number) {
	// 	return (this.elevationData[index] *this.yscale) +this.y
	// }
	
	// Let's use engineHeightAt instead, it's much more efficient!
	// rayHeightAt(coord :Vector3|YardCoord) :Vector3 { 
	// 	let offset = new Vector3()
	// 	if(coord instanceof YardCoord) {
	// 		coord = coord.toEngineCoordCentered()
	// 	}

	// 	const raycaster = new Raycaster(
	// 		new Vector3(coord.x +offset.x, WorldSys.ZoneTerrainMax.y, coord.z +offset.z), // +2 makes it center of grid instead of corner
	// 		new Vector3( 0, -1, 0 ), 
	// 		0, WorldSys.ZoneTerrainMax.y *2
	// 	)

	// 	let [intersect] = raycaster.intersectObject(this.ground, true)
	// 	if(!intersect) {
	// 		console.debug('rayHeightAt: no ground intersect!', coord, raycaster)
	// 		intersect = {
	// 			point: new Vector3(0,0,0),
	// 			distance: null,
	// 			object: null,
	// 		}
	// 	}
	// 	let result = intersect?.point

	// 	return result
	// }

	static CalcZoningDiff(enterZone :Zone, exitZone :Zone|null) :[Zone[], Zone[], Zone[], Zone[]] {
		// Calculate the zones we're exiting and the zones we're entering
		const oldZonesNear = exitZone?.getZonesAround(Zone.loadedZones, 1) || [] // You're not always exiting a zone (eg on initial load)
		const newZonesNear = enterZone.getZonesAround(Zone.loadedZones, 1)
		const removedZonesNearby = oldZonesNear.filter(zone => !newZonesNear.includes(zone))
		const addedZonesNearby = newZonesNear.filter(zone => !oldZonesNear.includes(zone))

		const oldZonesFar = exitZone?.getZonesAround(Zone.loadedZones, 22) || []
		const newZonesFar = enterZone.getZonesAround(Zone.loadedZones, 22)
		const removedZonesFar = oldZonesFar.filter(zone => !newZonesFar.includes(zone))
		const addedZonesFar = newZonesFar.filter(zone => !oldZonesFar.includes(zone))
		// console.log('addedZonesFar', Zone.loadedZones, addedZonesFar.map(z => z.id).sort((a,b) => a-b), addedZonesNearby.map(z => z.id).sort((a,b) => a-b))
		console.debug('zonediff', removedZonesNearby, addedZonesNearby, removedZonesFar, addedZonesFar)

		return [removedZonesNearby, addedZonesNearby, removedZonesFar, addedZonesFar]
	}

	static async LoadZoneWobs(enterZone :Zone, exitZone :Zone|null) { // Used to be zoneIn()
		// console.log('LoadZoneWobs')
		console.debug('LoadZoneWobs zonein zone', enterZone.id, )
		
		const [removedZonesNearby, addedZonesNearby, removedZonesFar, addedZonesFar] = Zone.CalcZoningDiff(enterZone, exitZone)
		
		// enterZone.babs.worldSys.currentGround = enterZone.ground // Now happens before network

		// Removed; wob removal from exiting zones happens on setDestination(), before here.
		
		// Pull detailed wobs for entered zones, so we can load them.  
		// This could later be moved to preload on approaching zone border, rathern than during zonein.

		const pullWobsData = async () => {
			let detailedWobsToAdd :SharedWob[] = []
			let farWobsToAdd :SharedWob[] = []

			// Here we actually fetch() the near wobs, but the far wobs have been prefetched (dekazones etc)

			const fetches = []
			for(let zone of addedZonesNearby) {
				zone.locationData = fetch(`${enterZone.babs.urlFiles}/zone/${zone.id}/locations.bin`)
				fetches.push(zone.locationData)
			}

			await Promise.all(fetches)

			for(let zone of addedZonesNearby) {
				const fet4 = await zone.locationData
				const data4 = await fet4.blob()
				if (data4.size == 2) {  // hax on size (for `{}`)
					zone.locationData = new Uint8Array()
				}
				else {
					const buff4 = await data4.arrayBuffer()
					zone.locationData = new Uint8Array(buff4)
				}
			}

			for(let zone of addedZonesNearby) {
				const fWobs = zone.applyLocationsToGrid(zone.locationData, true)
				detailedWobsToAdd.push(...fWobs)
			}

			// Far wobs, using prefetched data
			await LoaderSys.CachedDekafarwobsFiles // Make sure prefetch is finished!
			for(let zone of addedZonesFar) {
				// Data was prefetched, so just access it in zone.farLocationData
				const fWobs = zone.applyLocationsToGrid(zone.farLocationData, true, 'doNotApplyActually')
				farWobsToAdd.push(...fWobs)
			}

			// return [detailedWobsToAdd, farWobsToAdd] // These loads don't [later: didn't] need to await for zonein to complete~!
			console.debug('entered zones: detailed wobs to add', detailedWobsToAdd.length)
			await Wob.LoadInstancedWobs(detailedWobsToAdd, enterZone.babs, false) 
			await Wob.LoadInstancedWobs(farWobsToAdd, enterZone.babs, false, 'asFarWobs') // Far ones :p

			/* todo zoning
				We may need to do something with zoneIn to return it to not-awaited, 
					or preloading assets so there's no network request, 
					or queuing up network/player commands until wobs are all loaded.
				Maybe after rolling zones.
			*/

		}
		// const [detailedWobsToAdd, farWobsToAdd] = await pullWobsData()
		await pullWobsData()

	}

	plotcountsSaved :Record<string, number> = {} // For saving incoming data
	static async LoadZoneFootsteps(enterZone :Zone, exitZone :Zone|null) { // Used to be zoneIn()
		console.debug('LoadZoneFootsteps zonein zone', enterZone.id)
		const [removedZonesNearby, addedZonesNearby, removedZonesFar, addedZonesFar] = Zone.CalcZoningDiff(enterZone, exitZone)
		const pullFootstepsData = async () => {
			const zoneFootstepsCounts :Promise<Response>[] = []
			for(let zone of addedZonesNearby) {
				zoneFootstepsCounts.push(fetch(`${enterZone.babs.urlFiles}/zone/${zone.id}/footsteps.json`))
			}
			await Promise.all(zoneFootstepsCounts)

			for(const response of zoneFootstepsCounts) {
				const footstepsCounts = (await (await response).json() as SendFootstepsCounts).footstepscounts
				if(footstepsCounts) {
					// console.log('footstepsCounts', footstepsCounts)
					const zone = enterZone.babs.ents.get(footstepsCounts.idzone) as Zone
					zone.colorFootsteps(footstepsCounts.plotcounts)
				}
			}
		}
		await pullFootstepsData()
	}
	colorFootsteps(plotcountsUpdates :SendFootstepsCounts['footstepscounts']['plotcounts']) {
		// Make the vertex colors more brown the higher the number is per plotcount
		const brownColor = new Color(0.5, 0.3, 0.1)

		for(let [plot, count] of Object.entries(plotcountsUpdates)) {
			this.plotcountsSaved[plot] = count // Save incoming data
			// Set one color at Plot x, z to combine with brown in proportion to percentage
			const xPlot = parseInt(plot.split(',')[0])
			const zPlot = parseInt(plot.split(',')[1])

			const maxBrownFootsteps = 100
			count =  Math.min(100, count) // Cap at 100
			const brownPercentage = count / maxBrownFootsteps

			const colorsRef = this.ground.geometry.getAttribute('color').array as Float32Array
			// Because vertex colors don't color the center but the zeropoint, we expand this to the full square.
			// Nevermind; instead of coloring the ones around it, I will up the count on the ones around it.
			for (let i = 0; i <= 0; i++) {
				for (let j = 0; j <= 0; j++) {
					const xPos = xPlot +i
					const zPos = zPlot +j
					const colorsIndexOfGridPoint = Utils.coordToIndex(xPos, zPos, WorldSys.ZONE_ARR_SIDE_LEN, 3)
					colorsRef[colorsIndexOfGridPoint + 0] = MathUtils.lerp(this.colorsCopy[colorsIndexOfGridPoint + 0], brownColor.r, brownPercentage)
					colorsRef[colorsIndexOfGridPoint + 1] = MathUtils.lerp(this.colorsCopy[colorsIndexOfGridPoint + 1], brownColor.g, brownPercentage)
					colorsRef[colorsIndexOfGridPoint + 2] = MathUtils.lerp(this.colorsCopy[colorsIndexOfGridPoint + 2], brownColor.b, brownPercentage)

					// todo: If the range is outside of this zone's edges, apply it to the next zone up or down?
				}
			}

			// console.log('colorFootsteps setting:' + xPlot + ',' + zPlot + ' to ' + count)
		}

		// Indicate updates are needed
		this.ground.geometry.attributes.color.needsUpdate = true
	}


}