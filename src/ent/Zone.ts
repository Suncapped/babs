
import { YardCoord } from '@/comp/Coord'
import { WorldSys } from '@/sys/WorldSys'

import { BufferAttribute, Color, InstancedMesh, MathUtils, Matrix4, Mesh, Object3D, PlaneGeometry, PositionalAudio, Raycaster, Triangle, Vector2, Vector3 } from 'three'
import { Ent } from './Ent'
import { Babs } from '@/Babs'
import { Wob } from './Wob'
import { Fire } from '@/comp/Fire'
import { SharedWob, SharedBlueprint, type blueprint_id, type SharedBlueprintWithBluests, type SharedBluestClasses } from '@/shared/SharedWob'
import { SharedZone, type SharedBluestatic } from '@/shared/SharedZone'
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
		super(babs, id, x, z, y, yscale, elevations, landcovers)
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

	locidToBlueprint :Record<number, SharedBlueprint> = []
	bluestatics :Map<keyof SharedBluestClasses, SharedBluestatic<keyof SharedBluestClasses>> = new Map()
	
	applyBlueprints(blueprints: Map<blueprint_id, SharedBlueprintWithBluests>) {
		// console.log('applyBlueprints', blueprints)
		for(const blueprintsWithBluests of blueprints.values()) {
			const blueprint = new SharedBlueprint(
				blueprintsWithBluests.blueprint_id,
				blueprintsWithBluests.locid, 
				blueprintsWithBluests.bluests,
			)
			this.locidToBlueprint[blueprint.locid] = blueprint
			this.bpidToLocid[blueprint.blueprint_id] = blueprint.locid

			// for(const bluestKey in blueprint.bluests) {
			// 	if (blueprint.bluests.hasOwnProperty(bluestKey)) {
			// 		this.allBluestaticsBlueprintsData.set(bluestKey, blueprint.bluests[bluestKey])
			// 	}
			// }
			// Moved out to babs rather than per zone
		}
	}

	removeWobGraphicAt(x :number, z :number, isFarWobs :boolean) {
		const existingWob = this.getWob(x, z, isFarWobs ? 'far' : 'near')
		// Problem was: It's still getting this from location data array.  For frontend, we want to be able to pass in a wob.  Thus we split off removeWobGraphic()
		// console.log('removeWobGraphicAt existingWob', existingWob)
		return this.removeWobGraphic(existingWob, isFarWobs)
	}
	removeWobGraphic(deletingWob :SharedWob, isFarWobs = false) { // Don't recalculateIndexKey for large (eg zone-wide) removals, it's quite slow
		// console.log('removeWobGraphic', deletingWob, isFarWobs ? 'isFarWobs' : 'isNearWobs')

		if(!deletingWob.blueprint_id) {
			console.warn('deletingWob does not have a blueprint_id:', deletingWob)
		}

		// Get either the nearwobs feim or the farwobs feim
		const feim = isFarWobs ? Wob.InstancedWobs.get(deletingWob.bluests?.visible?.farMesh) : Wob.InstancedWobs.get(deletingWob.blueprint_id)
		if(!feim) {
			if(!isFarWobs) console.warn('no matching instanced or farmesh to:', deletingWob.blueprint_id)
			// So this is overkill, because it attempts to remove from farwobs even if it's not a farwob.  But it can't hurt?  So leaving it for now.
			return
		}
		const deletingWobZone = this.babs.ents.get(deletingWob.idzone) as Zone

		// Remove attachments
		Fire.Delete(deletingWob, this.babs, isFarWobs)
		Audible.Delete(deletingWob, this.babs)
		
		// We are going to copy the source (last item) to the target (item being deleted).  Then cleanup of references.
		// Source is the last item in the instance index.
		const sourceIndex = feim.getLoadedCount() -1
		// Target is the item being deleted.
		const targetIndex = isFarWobs
			? deletingWobZone.farCoordToInstanceIndex[deletingWob.x+','+deletingWob.z]
			: deletingWobZone.coordToInstanceIndex[deletingWob.x+','+deletingWob.z] 
		// May also need for farCoordToInstanceIndex?  Once we allow removal via zoning/updates
		// Hey, that time is now!  (1 year later)

		Zone.swapWobsAtIndexes(sourceIndex, targetIndex, feim, 'delete')
		// instancedMesh.count = instancedMesh.count -1
		feim.decreaseLoadedCount()

		// Also unset the highlight color on the swapped index
		feim.instancedMesh.setColorAt(targetIndex, new Color(1, 1, 1))
		feim.instancedMesh.instanceColor.needsUpdate = true
		feim.instancedMesh.instanceMatrix.needsUpdate = true 
	}

	static swapWobsAtIndexes(sourceIndex :number, targetIndex :number, feim :InstancedWobs, doDeleteSource :'delete' = null) {
		const showSwapLogs = false
		if(sourceIndex === targetIndex) { // No change
			// return // No, because 'doDeleteSource' may still need to run
			if(showSwapLogs) console.log('swapWobsAtIndexes: sourceIndex === targetIndex, no change')
		}
		const sourceMatrix = new Matrix4(); feim.instancedMesh.getMatrixAt(sourceIndex, sourceMatrix)
		const targetMatrix = new Matrix4(); feim.instancedMesh.getMatrixAt(targetIndex, targetMatrix)

		if(showSwapLogs) {
			console.log('swapWobsAtIndexes', sourceIndex, targetIndex, feim, doDeleteSource)
		}

		// Get source and target wobs from instanceIndexToWob
		const sourceWobAnyZone = feim.instanceIndexToWob.get(sourceIndex)
		const targetWobAnyZone = feim.instanceIndexToWob.get(targetIndex)
		if(showSwapLogs) console.log(sourceWobAnyZone, targetWobAnyZone)
		
		// Catch unexpected errors early
		if(!sourceWobAnyZone) console.warn('swapWobsAtIndexes: sourceWobAnyZone is null', sourceIndex, targetIndex, feim, doDeleteSource)
		if(!targetWobAnyZone) console.warn('swapWobsAtIndexes: targetWobAnyZone is null', sourceIndex, targetIndex, feim, doDeleteSource)
		if(!sourceWobAnyZone || !targetWobAnyZone) return // Skip this one, I suppose


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

		const isProduction = window.FeIsProd
		if(isProduction && !coord.zone) { // Only catch on production; on dev, we WANT the crash so we're forced to see the error.
			// Throw an error and trace
			console.error('engineHeightAt: coord.zone is null!', coord)
			console.trace()
			return 0

			// This happened that coord.zone was null, and I'm not sure how!
			/*
				Zone.ts:197 Uncaught TypeError: Cannot read properties of null (reading 'geometry')
				at Zone.engineHeightAt (Zone.ts:197:35)
				at Controller.update (Controller.ts:538:50)
				at Babs.update (Babs.ts:207:9)
				at Babs.ts:180:11
				at onAnimationFrame (three.module.js:29614:36)
				at onAnimationFrame (three.module.js:13488:3)
			*/
		}

		const verticesRef = (coord.zone.geometry.getAttribute('position') as BufferAttribute).array
		const nCoordsCount = 3 // x,y,z

		const centerPointInPlot = WorldSys.ZONE_DATUM_SIZE /WorldSys.Yard

		const index00 = Utils.coordToIndex(Math.floor((coord.x +0) /centerPointInPlot), Math.floor((coord.z +0) /centerPointInPlot), WorldSys.ZONE_ARR_SIDE_LEN, nCoordsCount)
		const height00 = verticesRef[index00 +1]  // +1 is to get y

		const index10 = Utils.coordToIndex(Math.floor((coord.x +centerPointInPlot) /centerPointInPlot), Math.floor((coord.z +0) /centerPointInPlot), WorldSys.ZONE_ARR_SIDE_LEN, nCoordsCount)
		const height10 = verticesRef[index10 +1]

		const index01 = Utils.coordToIndex(Math.floor((coord.x +0) /centerPointInPlot), Math.floor((coord.z +centerPointInPlot) /centerPointInPlot), WorldSys.ZONE_ARR_SIDE_LEN, nCoordsCount)
		const height01 = verticesRef[index01 +1]

		const index11 = Utils.coordToIndex(Math.floor((coord.x +centerPointInPlot) /centerPointInPlot), Math.floor((coord.z +centerPointInPlot) /centerPointInPlot), WorldSys.ZONE_ARR_SIDE_LEN, nCoordsCount)
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

	engineNormalAt(coord: YardCoord): Vector3 {
		// Fetch from actual ground mesh vertices

		const verticesRef = (coord.zone.geometry.getAttribute('position') as BufferAttribute).array
		const nCoordsCount = 3 // x, y, z

		// Calculate the size of one grid cell in your terrain
		const gridCellSize = WorldSys.ZONE_DATUM_SIZE / WorldSys.Yard

		// Calculate the grid indices
		const xIndex = Math.floor(coord.x / gridCellSize)
		const zIndex = Math.floor(coord.z / gridCellSize)

		// Ensure indices are within bounds
		const maxIndex = WorldSys.ZONE_ARR_SIDE_LEN - 1
		const xClamped = Math.min(xIndex, maxIndex - 1)
		const zClamped = Math.min(zIndex, maxIndex - 1)

		// Helper function to get the height at a grid point
		const getHeight = (xi: number, zi: number): number => {
			const index = Utils.coordToIndex(xi, zi, WorldSys.ZONE_ARR_SIDE_LEN, nCoordsCount)
			return verticesRef[index + 1] // +1 to get the y aspect
		}

		// Get the heights at the four corners of the cell
		const height00 = getHeight(xClamped, zClamped)
		const height10 = getHeight(xClamped + 1, zClamped)
		const height01 = getHeight(xClamped, zClamped + 1)
		const height11 = getHeight(xClamped + 1, zClamped + 1)

		// Positions of the grid points
		const x0 = xClamped * gridCellSize
		const z0 = zClamped * gridCellSize
		const x1 = (xClamped + 1) * gridCellSize
		const z1 = (zClamped + 1) * gridCellSize

		// Determine the point's position within the cell
		const xLocal = coord.x - x0
		const zLocal = coord.z - z0

		// Determine which triangle the point is in
		const isFirstTriangle = xLocal + zLocal < gridCellSize

		// Define the vertices of the triangle
		let vertexA: Vector3, vertexB: Vector3, vertexC: Vector3

		if (isFirstTriangle) {
			// Lower-left triangle
			vertexA = new Vector3(x0, height00, z0)
			vertexB = new Vector3(x1, height10, z0)
			vertexC = new Vector3(x0, height01, z1)
		} else {
			// Upper-right triangle
			vertexA = new Vector3(x1, height10, z0)
			vertexB = new Vector3(x1, height11, z1)
			vertexC = new Vector3(x0, height01, z1)
		}

		// **Adjust the vertex order to ensure the normal points upwards**
		// Swap vertexB and vertexC
		[vertexB, vertexC] = [vertexC, vertexB]

		// Compute the normal of the triangle
		const triangle = new Triangle(vertexA, vertexB, vertexC)
		const normal = new Vector3()
		triangle.getNormal(normal)

		// Normalize the normal vector
		normal.normalize()

		// If necessary, flip the normal
		if (normal.y < 0) {
			// normal.negate();
		}

		return normal
	}

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
		// console.log('LoadZoneWobs zonein zone', enterZone.id, )
		
		const [removedZonesNearby, addedZonesNearby, removedZonesFar, addedZonesFar] = Zone.CalcZoningDiff(enterZone, exitZone)
		
		// enterZone.babs.worldSys.currentGround = enterZone.ground // Now happens before network

		// Removed; wob removal from exiting zones happens on setDestination, before here.
		
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
				const fWobs = zone.applyLocationsToGrid(zone.locationData, { returnWobs: true, doApply: true, isFarWobs: false })
				detailedWobsToAdd.push(...fWobs)
			}

			// Far wobs, using prefetched data
			await LoaderSys.CachedDekafarwobsFiles // Make sure prefetch is finished!
			for(let zone of addedZonesFar) {
				// Data was prefetched, so just access it in zone.farLocationData
				const fWobs = zone.applyLocationsToGrid(zone.farLocationData, { returnWobs: true, doApply: true, isFarWobs: true })
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
	static async LoadZoneFootsteps(enterZone :Zone, exitZone :Zone|null) {
		console.debug('LoadZoneFootsteps zonein zone', enterZone.id)
		const [removedZonesNearby, addedZonesNearby, removedZonesFar, addedZonesFar] = Zone.CalcZoningDiff(enterZone, exitZone)
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