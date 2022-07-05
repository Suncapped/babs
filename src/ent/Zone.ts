
import { YardCoord } from '@/comp/Coord'
import { SharedZone } from '@/shared/SharedZone'
import { WorldSys } from '@/sys/WorldSys'
import { log } from '@/Utils'
import { Mesh, Raycaster, Vector3 } from 'three'
import { Ent } from './Ent'
import { Babs } from '@/Babs'


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
			log('calcHeightAt: no ground intersect!', coord, raycaster)
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