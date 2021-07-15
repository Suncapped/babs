import { Vector2, Vector3 } from "three"
import { SocketSys } from "./SocketSys"
import { EventSys } from "./EventSys"


export class MoveSys {

	static pself
	static pselfServerUpdateLoc = false
	static pselfGridLoc

	static Start() {
		EventSys.Subscribe(MoveSys)
	}
	static Event(type, data) {
		if(type == 'load-self') {
			MoveSys.pself = data
			MoveSys.pselfServerUpdateLoc = true
		}
	}

	static Update(dt, camera, scene) {

		if(this.pselfServerUpdateLoc) {
			this.pselfServerUpdateLoc = false
			console.log('pselfServerUpdateLoc', this.pself.x, this.pself.z)
			const player = scene.children.find(o=>o.name=='player')
			
			const yBoost = 50 // todo
			// player.position.set(this.pself.x *4, camera.position.y +yBoost, this.pself.z *4)
			this.pselfGridLoc = new Vector3(this.pself.x, null, this.pself.z)
		}

		if(this.pselfGridLoc) {
			const calcGridLoc = new Vector3(Math.floor(camera.position.x / 4), null, Math.floor(camera.position.z / 4))
			if(!calcGridLoc.equals(this.pselfGridLoc)) { // Player has moved on grid!
				SocketSys.Send({
					move: {
						x: calcGridLoc.x,
						z: calcGridLoc.z,
					}
				})
				this.pselfGridLoc = calcGridLoc
			}
		}


	}


}