
import { EngineCoord, YardCoord } from '@/comp/Coord'
import { WorldSys } from '@/sys/WorldSys'
import { log } from '@/Utils'
import { Raycaster, Vector3 } from 'three'
import { Ent } from './Ent'


export class Zone extends Ent {
	static async Create(zone, babs){
		return new Zone(zone.id, babs).init(zone)
	}

	ground // ground 3d Mesh
	x
	z

	async init(zone) { // This patterns allows an async new, using `this`
		this.x = zone.x
		this.z = zone.z
		return this
	}


	calcHeightAt(coord :EngineCoord|YardCoord) :EngineCoord {
		// let zoneDelta = new Vector3(this.x -this.babs.worldSys.currentGround.zone.x, 0, this.z -this.babs.worldSys.currentGround.zone.z)
		// zoneDelta.multiply(new Vector3(1000, 1, 1000))
		if(coord instanceof YardCoord) {
			log('YardCoord inside')
			coord = coord.toEngineCoordCentered()
		}

		const offset = new Vector3(this.ground.position.x, this.ground.position.z)
		log('ground', this.ground)

		const raycaster = new Raycaster(
			new Vector3(coord.x +offset.x, WorldSys.ZoneTerrainMax.y, coord.z +offset.z), // +2 makes it center of grid instead of corner
			new Vector3( 0, -1, 0 ), 
			0, WorldSys.ZoneTerrainMax.y
		)

		let [intersect] = raycaster.intersectObject(this.ground, true)
		if(!intersect) {
			log('calcHeightAt: no ground intersect!', coord, raycaster)
			intersect = {
				point: new Vector3(0,0,0),
				distance: null,
				object: null,
			}
		}
		let result = intersect?.point
		// log('intersect', result)

		return EngineCoord.Create(result)
	}



}