import { Group, PerspectiveCamera, Vector3, Object3D, Quaternion, AudioListener } from 'three'
import { Babs } from '@/Babs'

import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'
import { Controller } from '@/comp/Controller'
import type { FeObject3D } from '@/ent/Wob'
import { settings, volumePercent } from '@/stores'

import { get as svelteGet } from 'svelte/store'
import { Audible } from '@/comp/Audible'

const FEET_IN_A_METER = 3.281

export class CameraSys {
	static FT_SCALE = 1
	static VR_SCALE = 1 /FEET_IN_A_METER // Feet to meters
	static CurrentScale = CameraSys.FT_SCALE

	static OffsetHeightLimit = 10000
	
	static DefaultOffsetHeight = 15

	_target :Controller
	offsetHeight
	gh
	idealOffset
	_currentPosition
	_currentLookat
	cameraGroup :Group
	audioListener :AudioListener
	constructor(public camera :PerspectiveCamera, targetController :Controller, public babs :Babs) {
		this._target = targetController

		this.offsetHeight = CameraSys.DefaultOffsetHeight
		this.gh = null
		this.idealOffset = null

		this._currentPosition = new Vector3()
		this._currentLookat = new Vector3()
		
		this.cameraGroup = new Group()
		this.cameraGroup.name = 'cameraGroup'
		this.cameraGroup.add(camera)
		// this.babs.group.add(this.cameraGroup)
	}

	_CalculateIdealOffset() {
		// const minDistance = -15
		// const maxDistance = -30
		// const limitDistance = 100
		// const distanceLerp = MathUtils.lerp(minDistance, maxDistance, Math.max(this.offsetHeight, limitDistance)/limitDistance)

		let offsetDist = -40
		if (this.offsetHeight < 30) { // When near the avatar, distance can change (approaches avatar)
			offsetDist = offsetDist + (30 - this.offsetHeight)
		}
		// let mat = this._target.playerRig.children[0]?.children[1]?.material
		const playerBbox = this._target.playerRig.children.find(c => c.name == 'player_bbox') as FeObject3D
		if (this.offsetHeight < 4) {
			// if(mat) mat.opacity = 0.2
			this._target.playerRig.visible = false
			playerBbox.clickable = false
		}
		else {
			this._target.playerRig.visible = true
			playerBbox.clickable = true
		}

		this.offsetHeight = Math.max(this.offsetHeight, -5) // Don't go too far below ground
		if(this.babs.renderSys.isVrActive) {
			this.offsetHeight = 0
		}

		offsetDist = Math.min(offsetDist, 0) // Never go positive and flip camera
		this.idealOffset = new Vector3(-0, this.offsetHeight, offsetDist).multiplyScalar(CameraSys.CurrentScale)

		this.idealOffset.applyAxisAngle(new Vector3(0, -1, 0), this._target.getHeadRotationX())
		this.idealOffset.applyQuaternion(this._target.playerRig.quaternion)
		// this.idealOffset.add(this._target.playerRig.position)
		this.idealOffset.add(this._target.playerRig.position.clone().multiplyScalar(CameraSys.CurrentScale))

		// return idealOffset
	}

	_CalculateIdealLookat() {
		// const idealLookat = new Vector3(sideOffset, 10, 0)
		
		const idealLookatHeight = new Vector3(0, 10, 0)
		if(this.babs.renderSys.isVrActive) {
			idealLookatHeight.y = 0
		}
		const idealLookat = idealLookatHeight.multiplyScalar(CameraSys.CurrentScale)


		idealLookat.applyAxisAngle(new Vector3(0, -1, 0), this._target.getHeadRotationX())
		idealLookat.applyQuaternion(this._target.playerRig.quaternion)

		// idealLookat.add(this._target.playerRig.position)
		idealLookat.add(this._target.playerRig.position.clone().multiplyScalar(CameraSys.CurrentScale))
		// TODO note: It's possible that all uses of playerRig.position could be similarly off?  Like with direcitonallight/helper.
		
		return idealLookat
	}

	update() {

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

		// this.camera.lookAt(idealLookat)
		// this.camera.position.copy(this.idealOffset) // But, cannot move camera in VR



		// If XR
		if(this.babs.renderSys.isVrActive) {
			const currentRefSpace = this.babs.renderSys.renderer.xr.getReferenceSpace()
			// console.log('currentRefSpace', currentRefSpace, this.babs.renderSys.xrBaseReferenceSpace)

			const offsetPosition = { x: - this.idealOffset.x, y: - this.idealOffset.y, z: - this.idealOffset.z, w: 1 }
			const offsetRotation = new Quaternion()
			const transform = new XRRigidTransform( offsetPosition, offsetRotation )
			const teleportSpaceOffset = this.babs.renderSys.xrBaseReferenceSpace.getOffsetReferenceSpace( transform )
			this.babs.renderSys.renderer.xr.setReferenceSpace( teleportSpaceOffset )

			this.cameraGroup.position.set(0, 0, 0)
			this.cameraGroup.rotation.setFromQuaternion(new Quaternion(0, 0, 0, 1))
			this.cameraGroup.updateMatrixWorld()
		}
		else {
			this.cameraGroup.position.copy(this.idealOffset)
			this.cameraGroup.lookAt(idealLookat) // Not needed?; let VR handle its own rotation?
			// this.cameraGroup.matrixWorldNeedsUpdate = true
			this.cameraGroup.updateMatrixWorld()
		}

	}
}
