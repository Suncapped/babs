import { log } from './../Utils'
import * as THREE from 'three'
import { MathUtils, Vector3 } from 'three'
import { Quaternion } from 'three'

// Taken and inspired from https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js

export class CameraSys {
	static DefaultOffsetHeight = 10

	constructor(camera, targetController, babs) {
		this.babs = babs
		this.camera = camera
		this._target = targetController

		this.offsetHeight = CameraSys.DefaultOffsetHeight
		this.gh = null
		this.idealOffset = null

		this._currentPosition = new Vector3()
		this._currentLookat = new Vector3()
	}

	_CalculateIdealOffset() {
		const minDistance = -15
		const maxDistance = -45
		const limitDistance = 100
		
		const distanceLerp = MathUtils.lerp(minDistance, maxDistance, Math.max(this.offsetHeight, limitDistance)/limitDistance)
		// log(this.offsetHeight, distanceLerp)
		this.idealOffset = new Vector3(-4, this.offsetHeight, distanceLerp)// -(this.offsetHeight*2))//-(this.offsetHeight*2))//-75) 
		// const idealOffset = new Vector3(-4, this.offsetHeight /3, -3) // put lower and nearer for testing
		
		this.idealOffset.applyAxisAngle(new Vector3(0,-1,0), this._target.getHeadRotationX())
		this.idealOffset.applyQuaternion(this._target.Rotation)
		this.idealOffset.add(this._target.Position)

		this.gh = this.babs.worldSys.vRayGroundHeight(Math.round(this.idealOffset.x/4), Math.round(this.idealOffset.z/4))
		// this.idealOffset.setY(Math.max(this.idealOffset.y, this.gh.y +4)) // todo smooth this
		// if(this.idealOffset.y < this.gh.y +4) {
			// log('less')
			// this.idealOffset.y += 2
			// this.offsetHeight += 2
			// todo do this to prevent clipping, but smooth it?
		// }

		// return idealOffset
	}

	_CalculateIdealLookat() {
		const sideOffset = 0//10
		const idealLookat = new Vector3(sideOffset, 10, 0)

		idealLookat.applyAxisAngle(new Vector3(0,-1,0), this._target.getHeadRotationX())
		idealLookat.applyQuaternion(this._target.Rotation)

		// let pos = this._target.Position.clone()
		// pos.setY(pos.y + 40)
		// hmm, can't get it right now

		idealLookat.add(this._target.Position)
		return idealLookat
	}

	update(dt) {
		// const idealOffset = this._CalculateIdealOffset()
		this._CalculateIdealOffset()
		const idealLookat = this._CalculateIdealLookat()

		// const t = 0.05
		// const t = 4.0 * dt
		// const followSpeed = 1.5 // 0.98 - 2? // 0.93 // 2 // 1
		// const t = followSpeed - Math.pow(0.001, dt)

		// this._currentPosition.lerp(idealOffset, t)
		// this._currentLookat.lerp(idealLookat, t)
		// this.camera.position.copy(this._currentPosition)
		// this.camera.lookAt(this._currentLookat)

		this.camera.position.copy(this.idealOffset)


		this.camera.lookAt(idealLookat)
	}
}
