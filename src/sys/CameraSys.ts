import { log } from './../Utils'
import * as THREE from 'three'
import { MathUtils, Vector3 } from 'three'
import { Quaternion } from 'three'
import { Babs } from '@/Babs'

// Taken and inspired from https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js

export class CameraSys {
	static DefaultOffsetHeight = 15

	_target
	offsetHeight
	gh
	idealOffset
	_currentPosition
	_currentLookat
	constructor(public camera, targetController, public babs :Babs) {
		this._target = targetController

		this.offsetHeight = CameraSys.DefaultOffsetHeight
		this.gh = null
		this.idealOffset = null

		this._currentPosition = new Vector3()
		this._currentLookat = new Vector3()
	}

	_CalculateIdealOffset() {
		const minDistance = -15
		const maxDistance = -30
		const limitDistance = 100

		// const distanceLerp = MathUtils.lerp(minDistance, maxDistance, Math.max(this.offsetHeight, limitDistance)/limitDistance)

		let offsetDist = -40//this.offsetHeight
		if (this.offsetHeight < 30) {
			offsetDist = -40 + (30 - this.offsetHeight)
		}
		// let mat = this._target.target.children[0]?.children[1]?.material
		if (this.offsetHeight < 4) {
			// if(mat) mat.opacity = 0.2
			this._target.target.visible = false
			this._target.target.children.find(c => c.name == 'player_bbox').clickable = false
		}
		else {
			this._target.target.visible = true
			this._target.target.children.find(c => c.name == 'player_bbox').clickable = true
		}
		this.offsetHeight = Math.max(this.offsetHeight, -5) // Don't go too far below ground
		offsetDist = Math.min(offsetDist, 0) // Never go positive and flip camera

		this.idealOffset = new Vector3(-0, this.offsetHeight, offsetDist)// -(this.offsetHeight*2))//-(this.offsetHeight*2))//-75) 

		this.idealOffset.applyAxisAngle(new Vector3(0, -1, 0), this._target.getHeadRotationX())
		this.idealOffset.applyQuaternion(this._target.Rotation)
		this.idealOffset.add(this._target.Position)
		// this.idealOffset.add(new Vector3(40, 0, 40))

		// this.gh = this.babs.worldSys.vRayGroundHeight(
		// 	Math.round(this.idealOffset.x / 4),
		// 	Math.round(this.idealOffset.z / 4),
		// 	this.babs.worldSys.currentGround.zone.id,
		// )
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

		idealLookat.applyAxisAngle(new Vector3(0, -1, 0), this._target.getHeadRotationX())
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

		if(this.babs.renderSys.isVr) {
			const xrCam = this.babs.renderSys.renderer.xr.getCamera()?.cameras[0]
			if(xrCam) {

				// const renderer = this.babs.renderSys.renderer
				// // console.log(xrCam)
				// // this.babs.renderSys.isVr = false

				// const frame = renderer.xr.getFrame();
				// const refSpace = renderer.xr.getReferenceSpace();
				// const views = frame.getViewerPose(refSpace).views;
				// let pos = views[0].transform.position;
				// // const c = renderer.xr.getCamera().cameras[0].position;
				

			
				// renderer.xr.getCamera().cameras[0].position.x = pos.x +this.camera.position.x +10000
				// renderer.xr.getCamera().cameras[0].position.y = pos.y +this.camera.position.y +10000
				// renderer.xr.getCamera().cameras[0].position.z = pos.z +this.camera.position.z +10000
				// renderer.render(this.babs.scene, renderer.xr.getCamera().cameras[0]);

				this.babs.scene.children.forEach(child => {
					child.position.add(new Vector3(-100, -8360, -500))
					this.babs.renderSys.isVr = false

				})

			}
		}


		this.camera.lookAt(idealLookat)
	}
}
