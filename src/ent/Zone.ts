
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
		const wob = super.getWob(x, z)
		if(!wob) return null
		return new Wob(this.babs, this.id, wob.x, wob.z, wob.r, new Blueprint(wob.blueprint_id, wob.locid, wob.name, wob.glb))
	}

	override removeWobGraphic(x :number, z :number, blueprint_id :string) {
		const existingWob = this.getWob(x, z)
		if(existingWob) {
			const instanced = Wob.InstancedMeshes.get(blueprint_id)
			const zone = this.babs.ents.get(existingWob.idzone) as Zone
			const iindex = zone.coordToInstanceIndex[existingWob.x +','+existingWob.z]

			// Remove attachments
			const flameComps = this.babs.compcats.get(Flame.name) as Flame[] // todo abstract this .get so that I don't have to remember to use Flame.name instead of 'Flame' - because build changes name to _Flame, while it stays Flame on local dev.
			// log('flameComps', flameComps, this.babs.compcats)
			const flame = flameComps.find(fc => {
				return (fc.idEnt as WobId).idzone === existingWob.id().idzone
					&& (fc.idEnt as WobId).x === existingWob.id().x
					&& (fc.idEnt as WobId).z === existingWob.id().z
					&& (fc.idEnt as WobId).blueprint_id === existingWob.id().blueprint_id
			})
			log.info('flame to remove', flame)
			if(flame) {
				this.babs.group.remove(flame.fire)
			}

			// Remove one by swapping the last item into this place, then decrease instanced count by 1
			let swap :Matrix4 = new Matrix4()
			instanced.getMatrixAt(instanced.count -1, swap)
			instanced.setMatrixAt(iindex, swap)
			instanced.count = instanced.count -1
			zone.coordToInstanceIndex[existingWob.x +','+ existingWob.z] = null

			instanced.instanceMatrix.needsUpdate = true


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



}