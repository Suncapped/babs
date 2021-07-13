import { Vector2 } from "three"
import { Vector3 } from "three"
import { SocketSys } from "./SocketSys"
import { babsSocket } from "../stores"
import { EventSys } from "./EventSys"


export class MoveSys {
	// This class will manipulate entities that have Player components. 
	// It will do things such as update their Location components based on network input.

	static instance

	pself
	pselfServerUpdateLoc = false
	pselfGridLoc

	static Create() {
		MoveSys.instance = new MoveSys

		EventSys.Subscribe(MoveSys)

		return MoveSys.instance
	}
	init() {
		return MoveSys.instance
	}

	static Event(type, data) {
		if(type == 'load-self') {
			MoveSys.instance.pself = data
			MoveSys.instance.pselfServerUpdateLoc = true
		}
	}

	update(dt, camera, socket, scene) {


		if(this.pselfServerUpdateLoc) {
			this.pselfServerUpdateLoc = false
			const yBoost = 50 // todo
			console.log(this.pself.x, this.pself.z)
			const player = scene.children.find(o=>o.name=='player')

			player.position.set(this.pself.x *4, camera.position.y +yBoost, this.pself.z *4)
			this.pselfGridLoc = new Vector3(this.pself.x, null, this.pself.z)
		}

		if(this.pselfGridLoc) {
			const calcGridLoc = new Vector3(Math.floor(camera.position.x / 4), null, Math.floor(camera.position.z / 4))
			if(!calcGridLoc.equals(this.pselfGridLoc)) { // Player has moved on grid!
				socket.send({
					move: {
						x: calcGridLoc.x,
						z: calcGridLoc.z,
					}
				})
				this.pselfGridLoc = calcGridLoc
			}
		}



		// console.log(Math.floor(camera.position.x / 4))
		


	}


}