import * as THREE from 'three'

// Taken and inspired from https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js

export class CameraSys {
	constructor(camera, target) {
		this._camera = camera
		this._target = target

		this._currentPosition = new THREE.Vector3()
		this._currentLookat = new THREE.Vector3()
	}

	_CalculateIdealOffset() {
		const idealOffset = new THREE.Vector3(-4, 12, -36) // camera.set
		idealOffset.applyQuaternion(this._target.Rotation)
		idealOffset.add(this._target.Position)
		return idealOffset
	}

	_CalculateIdealLookat() {
		const idealLookat = new THREE.Vector3(0, 10, 50)
		idealLookat.applyQuaternion(this._target.Rotation)
		idealLookat.add(this._target.Position)
		return idealLookat
	}

	update(dt) {
		const idealOffset = this._CalculateIdealOffset()
		const idealLookat = this._CalculateIdealLookat()

		// const t = 0.05
		// const t = 4.0 * dt
		const t = 1.0 - Math.pow(0.001, dt)

		this._currentPosition.lerp(idealOffset, t)
		this._currentLookat.lerp(idealLookat, t)

		this._camera.position.copy(this._currentPosition)
		this._camera.lookAt(this._currentLookat)
	}
}
