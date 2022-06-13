
import { EngineCoord, YardCoord } from '@/comp/Coord'
import { WorldSys } from '@/sys/WorldSys'
import { log } from '@/Utils'
import { Mesh, Raycaster, Vector3 } from 'three'
import { Ent } from './Ent'


export class Zone extends Ent {
	static Create(zonedata, babs){
		return new Zone(zonedata.id, babs).init(zonedata)
	}


	x
	z
	y
	yscale

	elevationData // Injected by SocketSys
	landcoverData // Injected by SocketSys

	geometry
	ground :Mesh // ground 3d Mesh
	
	init(zonedata) { // This patterns allows an async new, using `this`
		this.x = zonedata.x
		this.z = zonedata.z
		this.y = zonedata.y
		this.yscale = zonedata.yscale
		return this
	}


	calcHeightAt(coord :EngineCoord|YardCoord) :EngineCoord {
		let offset = new Vector3()
		if(coord instanceof YardCoord) {
			log('wobSaid YardCoord inside', coord)
			coord = coord.toEngineCoordCentered()
			log('wobSaid YardCoord inside AFTER', coord)
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

		return EngineCoord.Create(result)
	}



}