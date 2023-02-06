import { log } from './../Utils'
import * as THREE from 'three'
import { Group, MathUtils, Object3D, PerspectiveCamera, Vector3 } from 'three'
import { Quaternion } from 'three'
import { Babs } from '@/Babs'

import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { Controller } from '@/comp/Controller'


// Influenced by https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js

export class CameraSys {
	static DefaultOffsetHeight = 15

	_target
	offsetHeight
	gh
	idealOffset
	_currentPosition
	_currentLookat
	cameraGroup :Group
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
		
		this.cameraGroup.position.set(12, 8, 12)

		// log('cameraGroup', this.cameraGroup)
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

		idealLookat.add(this._target.Position)
		return idealLookat
	}

	vrSetupDone = false
	xrCam
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

		// this.camera.lookAt(idealLookat)
		// this.camera.position.copy(this.idealOffset) // But, cannot move camera in VR
		this.cameraGroup.position.copy(this.idealOffset)


		this.camera.lookAt(idealLookat)
		// this.cameraGroup.lookAt(idealLookat) // Not needed; let VR handle its own rotation
		
		// this.cameraGroup.matrixWorldNeedsUpdate = true
		// this.camera.matrixWorldNeedsUpdate = true
		this.cameraGroup.updateMatrixWorld()

		if(this.babs.renderSys.isVrSupported) {

			if(this.vrSetupDone === false) {
				this.vrSetupDone = true

				const renderer = this.babs.renderSys.renderer
				this.xrCam = renderer.xr.getCamera()?.cameras[0]
				if(this.xrCam) {
	
					// const renderer = this.babs.renderSys.renderer
					// // console.log(xrCam)
					// // this.babs.renderSys.isVrSupported = false
	
					// const frame = renderer.xr.getFrame();
					// const refSpace = renderer.xr.getReferenceSpace();
					// const views = frame.getViewerPose(refSpace).views;
					// let pos = views[0].transform.position;
					// // const c = renderer.xr.getCamera().cameras[0].position;
					
	
				
					// renderer.xr.getCamera().cameras[0].position.x = pos.x +this.camera.position.x +10000
					// renderer.xr.getCamera().cameras[0].position.y = pos.y +this.camera.position.y +10000
					// renderer.xr.getCamera().cameras[0].position.z = pos.z +this.camera.position.z +10000
					// renderer.render(this.babs.scene, renderer.xr.getCamera().cameras[0]);
	
					// Temporary hack to offset everything to where the camera seems to start.
					this.babs.group.children.forEach(child => {
						child.position.add(new Vector3(-100, -8360, -500))
					})
	
	
					// Controllers
					// Get the 1st controller
					const [ct0, ct1] = [renderer.xr.getController(0), renderer.xr.getController(1)]
					console.log('controllers', ct0, ct1)
					const [ctGrip0, ctGrip1] = [renderer.xr.getControllerGrip(0), renderer.xr.getControllerGrip(1)]
					console.log('grips', ctGrip0, ctGrip1)
	
	
					const controllerModelFactory = new XRControllerModelFactory()
	
					const model0 = controllerModelFactory.createControllerModel( ctGrip0 )
					ctGrip0.add( model0 )
					// this.babs.group.add( ctGrip0 )
					this.cameraGroup.add(ct0)
					this.cameraGroup.add(ctGrip0)

					
					const model1 = controllerModelFactory.createControllerModel( ctGrip1 )
					ctGrip1.add( model1 )
					this.babs.group.add( ctGrip1 )

	
				}
			}
		
			// VR every frame
			
		}

	}
}
