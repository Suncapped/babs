import { Vector2 } from "three"
import { Vector3 } from "three"
import { ECS } from "./ECS"
import { Socket } from "./Socket"
import { babsSocket } from "./stores"


export class MoveSystem {
	// This class will manipulate entities that have Player components. 
	// It will do things such as update their Location components based on network input.

	static instance

	pself
	pselfServerUpdateLoc = false
	pselfGridLoc

	static Create() {
		MoveSystem.instance = new MoveSystem
		return MoveSystem.instance
	}
	init() {
		return MoveSystem.instance
	}

	static evtSelfAdded(playerSelf) {
		MoveSystem.instance.pself = playerSelf
		MoveSystem.instance.pselfServerUpdateLoc = true
	}

	update(dt, camera, socket) {
		// if(!this.playerSelf) { // Watch for self
		// 	this.playerSelf = ECS.GetComsAll('player')?.find(p => p.self === true)
		// }
		// else {
		// 	const selfLoc = ECS.GetCom(this.playerSelf.idEnt, 'location')
		// 	if(!this.playerSelfLocation){ // We know self, watch for changes
		// 		this.playerSelfLocation = ECS.GetCom(this.playerSelf.idEnt, 'location')
		// 	}
		// }
		// console.log(camera.position.x, camera.position.z)

		if(this.pselfServerUpdateLoc) {
			const yBoost = 100 // todo
			this.pselfServerUpdateLoc = false
			console.log(this.pself.x, this.pself.z)
			camera.position.set(this.pself.x *4, camera.position.y +yBoost, this.pself.z *4)
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