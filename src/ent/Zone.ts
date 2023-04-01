
import { YardCoord } from '@/comp/Coord'
import { Blueprint, FastWob, SharedZone } from '@/shared/SharedZone'
import { WorldSys } from '@/sys/WorldSys'
import { log } from '@/Utils'
import { Matrix4, Mesh, Raycaster, Triangle, Vector3 } from 'three'
import { Ent } from './Ent'
import { Babs } from '@/Babs'
import { Wob } from './Wob'
import { Flame } from '@/comp/Flame'
import type { WobId } from '@/shared/consts'
import * as Utils from '@/Utils'


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

	elevationData // Injected by SocketSys
	landcoverData // Injected by SocketSys
	locationData // Injected by SocketSys

	geometry
	ground :Mesh // ground 3d Mesh

	getWob(x :number, z :number) :Wob|null { // Mainly to include babs reference
		const fwob = super.getWob(x, z)
		if(!fwob) return null
		return new Wob(this.babs, this.id, fwob.x, fwob.z, fwob.r, new Blueprint(fwob.blueprint_id, fwob.locid, fwob.name, fwob.glb))
	}

	getFastWob(x :number, z :number) :FastWob|null { // Should refactor this since super.gotWob returns a fastwob and that naming is confusing.
		return super.getWob(x, z)
	}

	override removeWobGraphicAt(x :number, z :number) {
		const existingWob = this.getFastWob(x, z)
		// Problem was: It's still getting this from location data array.  For frontend, we want to be able to pass in a wob.  Thus we split off removeWobGraphic()
		return this.removeWobGraphic(existingWob)

	}
	removeWobGraphic(existingWob :FastWob, overrideNameAndBlueprint? :string) {
		const originalName = existingWob.name
		const originalBlueprintId = existingWob.blueprint_id
		if(overrideNameAndBlueprint) {
			existingWob.name = overrideNameAndBlueprint
			existingWob.blueprint_id = overrideNameAndBlueprint
		} // These get un-mutated below

		if(!existingWob.blueprint_id) {
			console.warn('existingWob does not have a blueprint_id:', existingWob)
		}

		const instanced = Wob.InstancedMeshes.get(existingWob.blueprint_id)
		if(!instanced) {
			console.warn('no matching instanced to:', existingWob.blueprint_id)
		}
		const zone = this.babs.ents.get(existingWob.idzone) as Zone

		// Remove attachments
		const flameComps = this.babs.compcats.get(Flame.name) as Flame[] // todo abstract this .get so that I don't have to remember to use Flame.name instead of 'Flame' - because build changes name to _Flame, while it stays Flame on local dev.
		// log('flameComps', flameComps, this.babs.compcats)
		const flame = flameComps.find(fc => {
			return (fc.idEnt as WobId).idzone === existingWob.id().idzone
				&& (fc.idEnt as WobId).x === existingWob.id().x
				&& (fc.idEnt as WobId).z === existingWob.id().z
				&& (fc.idEnt as WobId).blueprint_id === existingWob.id().blueprint_id
		})
		if(flame) {
			const oldlen = Flame.wantsLight.length
			// log('flame to remove', flame, Flame.wantsLight.length)
			Flame.wantsLight = Flame.wantsLight.filter(f => {
				// console.log('fl', f.uuid, flame.fire.uuid)
				return f.uuid !== flame.fire.uuid
			})
			this.babs.group.remove(flame.fire)

			flame.fire.geometry.dispose()
			flame.fire.visible = false
			if(Array.isArray(flame.fire.material)) {
				flame.fire.material[0].dispose()
				flame.fire.material[0].visible = false
			}
			else {
				flame.fire.material.dispose()
				flame.fire.material.visible = false
			}
			
			this.babs.compcats.set(Flame.name, flameComps.filter(f => f.fire.uuid !== flame.fire.uuid)) // This was it.  This was what was needed
		}

		// Remove one by swapping the last item into this place, then decrease instanced count by 1
		const oldIndex = zone.coordToInstanceIndex[existingWob.x +','+existingWob.z]
		let matrixLastItem :Matrix4 = new Matrix4()
		instanced.getMatrixAt(instanced.count -1, matrixLastItem)
		instanced.setMatrixAt(oldIndex, matrixLastItem)

		// Problem: What if iindex IS the last item?  (Hmm maybe ok.) 

		// Try as if: zone.coordToInstanceIndex[movedIndex.x +','+ movedIndex.z] = oldIndex
		// const posOfMovedIndex = new Vector3().setFromMatrixPosition(matrixLastItem)
		// console.log('posOfMovedIndex', posOfMovedIndex)
		// const localPos = posOfMovedIndex.sub(instanced.position)
		// const localPos = instanced.worldToLocal(posOfMovedIndex)
		// console.log('localPos', localPos)
		for(let key in zone.coordToInstanceIndex) { // todo optimize, this is slow.  I'm not even certain it's necessary.
			if(zone.coordToInstanceIndex[key] === instanced.count -1) {
				zone.coordToInstanceIndex[key] = oldIndex
				break
			}
		}
		instanced.count = instanced.count -1
		// Also, don't know if this handles shrink+growth properly?
		zone.coordToInstanceIndex[existingWob.x +','+ existingWob.z] = null
		instanced.instanceMatrix.needsUpdate = true 

		// Don't mutate these
		if(overrideNameAndBlueprint) {
			existingWob.name = originalName
			existingWob.blueprint_id = originalBlueprintId
		}
	}

	coordToInstanceIndex :Record<string, number> = {}
	// setInstanceIndex(x :number, z :number) {
	// 	_coordToInstanceIndex
	// }
	// getInstanceIndex(x :number, z :number) {
		
	// }

	// yardHeightAt(x :number, z :number, zone :Zone) { // Height from original data
	// 	// This isn't great for replacing raycast yet, because it would need similar features to engineHeightAt below.
	// 	const index = Utils.coordToIndex((x /10)>>0, (z /10)>>0, 26, 1) // >>0 is integer division instead of Math.floor()
	// 	const unscaledElev = zone.elevationData[index]
	// 	const scaledElev = unscaledElev * zone.yscale +zone.y
	// 	// console.log('yardHeightAtWob', index, zone.elevationData.length, unscaledElev, scaledElev)
	// 	return scaledElev
	// }
	engineHeightAt(coord :YardCoord, doCenter = true) { // fasttodo // Height of (corner or center) in engine
		// Fetch from actual ground mesh vertices!

		const verticesRef = coord.zone.geometry.getAttribute('position').array
		const nCoordsComponents = 3 // x,y,z

		const ten = 10

		const index00 = Utils.coordToIndex(Math.floor((coord.x +0) /10), Math.floor((coord.z +0) /10), 26, nCoordsComponents)
		const height00 = verticesRef[index00 +1]  // +1 is to get y

		const index10 = Utils.coordToIndex(Math.floor((coord.x +ten) /10), Math.floor((coord.z +0) /10), 26, nCoordsComponents)
		const height10 = verticesRef[index10 +1]

		const index01 = Utils.coordToIndex(Math.floor((coord.x +0) /10), Math.floor((coord.z +ten) /10), 26, nCoordsComponents)
		const height01 = verticesRef[index01 +1]

		const index11 = Utils.coordToIndex(Math.floor((coord.x +ten) /10), Math.floor((coord.z +ten) /10), 26, nCoordsComponents)
		const height11 = verticesRef[index11 +1]

		/* 
		// First attempt was:
		const avg = (height00 +height01 +height10 +height11) /4
		console.log('engineHeightAt internal', height00, height01, height10, height11, avg)
		return avg
		// But ^that average is the center of the 40x40 piece, NOT the center of a 4x4 tile.

		// Next attempt was naive proportions:
		const towardX = (coord.x % 10) +(doCenter ? 0.5 : 0)
		const towardZ = (coord.z % 10) +(doCenter ? 0.5 : 0)
		const xHeightDiff = height10 -height00
		const zHeightDiff = height11 -height01
		// ^ Bug: Only compares diff of 2 vertices. 
		// Might need real math here?  Because as X increases it can increase the influence of Z height changes.
		const weightedX = (xHeightDiff *(towardX /10))
		const weightedZ = (zHeightDiff *(towardZ /10))
		const finalHeight = height00 +(weightedX +weightedZ)
		return finalHeight
		
		// Final, working attempt: Barycentric Coordinates https://codeplea.com/triangular-interpolation
		// Built-in is: https://threejs.org/docs/#api/en/math/Triangle .getBarycoord()

		// Naively, we will need to determine whether this point is in the first-half triangle, or the second triangle.
		// ↑ [\ ]
		// x [ \]
		//   z →
		*/

		const xPiece = Math.floor(coord.x /10) *10
		const zPiece = Math.floor(coord.z /10) *10
		let xInnerCoord = coord.x -xPiece
		let zInnerCoord = coord.z -zPiece

		const isFirstHalf = xInnerCoord +zInnerCoord < 9

		let triangle
		if(isFirstHalf){ // First triangle (less than halfway across, diagonally)
			triangle = new Triangle(
				new Vector3(0, 	0, 0), // z0, x0
				new Vector3(0 +10, 0, 0), // x1
				new Vector3(0, 	0, 0 +10), // z1
			)
		}
		else { // Second triangle (more than halfway across)
			triangle = new Triangle(
				new Vector3(0, 		0, 0 +10), // z1
				new Vector3(0 +10, 	0, 0	), // x1
				new Vector3(0 +10, 	0, 0 +10), // z1, x1
			)
		}

		const halfTileCenter = doCenter ? 0.5 : 0
		let baryOut = new Vector3()
		triangle.getBarycoord(new Vector3(xInnerCoord +halfTileCenter, 0, zInnerCoord +halfTileCenter), baryOut)

		let combinedWeights
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
	
	rayHeightAt(coord :Vector3|YardCoord) :Vector3 {
		let offset = new Vector3()
		if(coord instanceof YardCoord) {
			coord = coord.toEngineCoordCentered()
		}
		else {
			// Offset engine things since they're otherwise not shiftiness-aware?  Not sure
		}
		// offset = new Vector3(this.ground.position.x, 0, this.ground.position.z)

		// log('ground', this.ground)

		const raycaster = new Raycaster(
			new Vector3(coord.x +offset.x, WorldSys.ZoneTerrainMax.y, coord.z +offset.z), // +2 makes it center of grid instead of corner
			new Vector3( 0, -1, 0 ), 
			0, WorldSys.ZoneTerrainMax.y
		)

		let [intersect] = raycaster.intersectObject(this.ground, true)
		if(!intersect) {
			log.info('calcHeightAt: no ground intersect!', coord, raycaster)
			intersect = {
				point: new Vector3(0,0,0),
				distance: null,
				object: null,
			}
		}
		let result = intersect?.point
		// log('intersect', result)

		return result
	}


	getZonesAround(includeThisZone :boolean = true) {
		const zonesAround = Zone.loadedZones.filter(zone => {
			return (includeThisZone && zone.x==this.x && zone.z==this.z)
				// Clockwise starting at 12 (ie forward ie positivex):
				|| zone.x==this.x +1 && zone.z==this.z +0
				|| zone.x==this.x +1 && zone.z==this.z +1
				|| zone.x==this.x +0 && zone.z==this.z +1
				|| zone.x==this.x -1 && zone.z==this.z +1
				|| zone.x==this.x -1 && zone.z==this.z +0
				|| zone.x==this.x -1 && zone.z==this.z -1
				|| zone.x==this.x -0 && zone.z==this.z -1
				|| zone.x==this.x +1 && zone.z==this.z -1

		})
		// log('zonesAround', Zone.loadedZones.length, this.x, ',', this.z, ': ', zonesAround.map(z=>`${z.x},${z.z}`))
		return zonesAround
	}



}