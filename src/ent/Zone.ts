
import { YardCoord } from '@/comp/Coord'
import { SharedZone } from '@/shared/SharedZone'
import { WorldSys } from '@/sys/WorldSys'
import { log } from '@/Utils'
import { Matrix4, Mesh, Raycaster, Vector3 } from 'three'
import { Ent } from './Ent'
import { Babs } from '@/Babs'
import { Wob } from './Wob'


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
	locationData // Injected by Socke`tSys

	geometry
	ground :Mesh // ground 3d Mesh

	override removeWobGraphic(x :number, z :number, blueprint_id :string) {
		const existingWob = this.getWob(x, z)
		if(existingWob) {
			const instanced = Wob.InstancedMeshes.get(blueprint_id)
			const zone = this.babs.ents.get(existingWob.idzone) as Zone
			const iindex = zone.coordToInstanceIndex[existingWob.x +','+existingWob.z]
			instanced.setMatrixAt(iindex, new Matrix4().setPosition(new Vector3(0,-10000,0))) // todo change from just putting far away, to getting rid of
			// instanced.count = instanced.count -1
			instanced.instanceMatrix.needsUpdate = true

			// if(wobExisting.attachments?.flame){ // fasttodo
			// 	context.babs.scene.remove(wob.attachments.flame.fire)
			// 	delete wob.attachments.flame
			// }
		}
	}

	coordToInstanceIndex :Record<string, number> = {}
	// setInstanceIndex(x :number, z :number) {
	// 	_coordToInstanceIndex
	// }
	// getInstanceIndex(x :number, z :number) {
		
	// }

	elevHeightAt() { // fasttodo

	}
	
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