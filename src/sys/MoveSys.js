import { Vector2, Vector3 } from "three"
import { SocketSys } from "./SocketSys"
import { EventSys } from "./EventSys"
import { log } from './../Utils'


export class MoveSys {

	static loadSelfData
	static self
	static selfGridPos

	static scene

	static Start(scene) {
		this.scene = scene
		EventSys.Subscribe(this)
	}
	static Event(type, data) {
		if(type == 'load-self') {
			MoveSys.loadSelfData = data
		}
		if(type == 'self-loaded') {
			this.self = data
			
			log.info('self-loaded moves pself to', this.loadSelfData.x, this.loadSelfData.z)
			const yBoost = 10 // todo use ray to terrain
			this.self.position.set(this.loadSelfData.x *4, yBoost, this.loadSelfData.z *4)
			this.selfGridPos = this.CalcGridPos(new Vector3(this.self.position.x, yBoost, this.self.position.z))
		}
	}

	static Update(dt, camera, scene) {
		if(this.selfGridPos) { // It's been init
			const gridPos = this.CalcGridPos(this.self.position)
			if(!gridPos.equals(this.selfGridPos)) { // Player has moved on grid!
				SocketSys.Send({
					move: {
						x: gridPos.x,
						z: gridPos.z,
					}
				})
				this.selfGridPos = gridPos
			}
		}
	}

	static CalcGridPos(worldPosition) {
		return new Vector3(Math.floor(worldPosition.x / 4), null, Math.floor(worldPosition.z / 4))
	}


}