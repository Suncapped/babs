
import { YardCoord } from '@/comp/Coord'
import { WorldSys } from '@/sys/WorldSys'

import { BufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, PlaneGeometry, PositionalAudio, Raycaster, Triangle, Vector2, Vector3 } from 'three'
import { Ent } from './Ent'
import { Babs } from '@/Babs'
import { Wob } from './Wob'
import { Flame } from '@/comp/Flame'
import { SharedWob, Blueprint } from '@/shared/SharedWob'
import { SharedZone } from '@/shared/SharedZone'
import * as Utils from '@/Utils'
import type { InstancedWobs } from './InstancedWobs'


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

		// Remove/unload sound
		// Find sound in this.babs.group based on name string
		let childSoundHolder = this.babs.group.children.find((child) => child.name === 'positionalsound-'+deletingWob.idString())
		// if(deletingWob.blueprint_id === 'campfire') {
		// 	console.warn('campfire removal', 'positionalsound-'+deletingWob.idString(), childSoundHolder, this.babs.group.children.map(c => c.name))
		// }
		if(childSoundHolder?.children?.length) {
			childSoundHolder.children.forEach((child) => {
				if(child instanceof PositionalAudio) { // It should be, but this helps assert the type
					child.stop()
					child.disconnect()
					child = null
				}
			})
			this.babs.group.remove(childSoundHolder)
			childSoundHolder.children = []
			childSoundHolder = null
		}
		
		
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






}