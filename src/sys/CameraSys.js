import { log } from './../Utils'
import * as THREE from 'three'
import { Vector3 } from 'three'
import { Quaternion } from 'three'

// Taken and inspired from https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js

export class CameraSys {
	static DefaultOffsetHeight = 32

	constructor(camera, targetController) {
		this.camera = camera
		this._target = targetController

		this.offsetHeight = CameraSys.DefaultOffsetHeight

		this._currentPosition = new Vector3()
		this._currentLookat = new Vector3()
	}

	_CalculateIdealOffset() {
		const idealOffset = new Vector3(-4, this.offsetHeight, -75) 
		// const idealOffset = new Vector3(-4, this.offsetHeight /3, -3) // put lower and nearer for testing

		idealOffset.applyAxisAngle(new Vector3(0,-1,0), this._target.getHeadRotationX())
		idealOffset.applyQuaternion(this._target.Rotation)
		idealOffset.add(this._target.Position)
		return idealOffset
	}

	_CalculateIdealLookat() {
		const idealLookat = new Vector3(0, 10, 50)

		idealLookat.applyAxisAngle(new Vector3(0,-1,0), this._target.getHeadRotationX())
		idealLookat.applyQuaternion(this._target.Rotation)

		// let pos = this._target.Position.clone()
		// pos.setY(pos.y + 40)
		// hmm, can't get it right now

		idealLookat.add(this._target.Position)
		return idealLookat
	}

	update(dt) {
		const idealOffset = this._CalculateIdealOffset()
		const idealLookat = this._CalculateIdealLookat()

		// const t = 0.05
		// const t = 4.0 * dt
		// const followSpeed = 1.5 // 0.98 - 2? // 0.93 // 2 // 1
		// const t = followSpeed - Math.pow(0.001, dt)

		// this._currentPosition.lerp(idealOffset, t)
		// this._currentLookat.lerp(idealLookat, t)
		// this.camera.position.copy(this._currentPosition)
		// this.camera.lookAt(this._currentLookat)
		this.camera.position.copy(idealOffset)
		this.camera.lookAt(idealLookat)
	}
}
