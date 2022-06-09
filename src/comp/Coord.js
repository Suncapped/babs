
import * as Utils from '../Utils'
import { Ent } from './Ent'

export class Coord extends Comp {
	constructor(id, babs) {
		super(id, babs)
	}
	static async Create(zone, babs){
		const context = new Zone(zone.id, babs)
		return context.init(zone)
	}


	ground // ground 3d object (often used for vRayGroundHeight)
	x
	z
	
	async init(data) { // This patterns allows an async new, using `this`
		this.x = data.x
		this.z = data.z
	}



	vRayGroundHeight(xGridLocal, zGridLocal) { // Return engine height
		const targetZone = this.babs.ents.get(idzone)
		if(!targetZone) {
			log('no targetZone', idzone, targetZone)
		}

		let zoneDelta = new Vector3(targetZone.x -this.currentGround.zone.x, 0, targetZone.z -this.currentGround.zone.z)
		zoneDelta.multiply(new Vector3(1000, 1, 1000))

		if(from == 'wobplace') {
			log('targetZone', targetZone, zoneDelta, gx, gz)
		}

		const raycaster = new Raycaster(
			new Vector3(gx *4 +2 +zoneDelta.x, WorldSys.ZoneTerrainMax.y, gz*4 +2 +zoneDelta.z), // +2 makes it center of grid instead of corner
			new Vector3( 0, -1, 0 ), 
			0, WorldSys.ZoneTerrainMax.y
		)

		const ground = targetZone.ground
		const [intersect] = raycaster.intersectObject(ground, true)
		if(!intersect) {
			// log('vRayGroundHeight: no ground intersect!', intersect, raycaster, gx, gz, ground)
		}
		let result = intersect?.point
		log('result', result)
		// result.sub(zoneDelta) // ok...

		return result
	}



}