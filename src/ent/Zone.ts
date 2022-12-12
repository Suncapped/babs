
import { YardCoord } from '@/comp/Coord'
import { Blueprint, SharedZone } from '@/shared/SharedZone'
import { WorldSys } from '@/sys/WorldSys'
import { log } from '@/Utils'
import { Matrix4, Mesh, Raycaster, Vector3 } from 'three'
import { Ent } from './Ent'
import { Babs } from '@/Babs'
import { Wob } from './Wob'
import { Flame } from '@/comp/Flame'
import type { WobId } from '@/shared/consts'


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
				this.babs.scene.remove(flame.fire)
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