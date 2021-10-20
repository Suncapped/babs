import * as THREE from 'three'
import { EventSys } from '../sys/EventSys'
import { LoaderSys } from '../sys/LoaderSys'
import { log } from '../Utils'
import { Euler, MathUtils, Raycaster } from 'three'
import { Vector3 } from 'three'
import { Com } from './Com'
import { SocketSys } from '../sys/SocketSys'

import  { State, DanceState, RunState, BackwardState, WalkState, IdleState, JumpState } from './ControllerState'
import { Matrix4 } from 'three'

// Taken and inspired from https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js

class BasicCharacterControllerProxy {
	constructor(animations) {
		this._animations = animations
	}

	get animations() {
		return this._animations
	}
}

export class Controller extends Com {
	static name = 'controller'

	static MOVESTATE = {
		Idle: 0,
		Run: 1,
		Walk: 2,
		Jump: 3,
		Dodge: 4,
		Rotate: 5,
		Emote: 6,
	}
	static JUMP_HEIGHT = 3
	static ROTATION_ANGLE_MAP = {
		0: 45,
		1: 90,
		2: 135,
		3: -180,
		4: -135,
		5: -90,
		6: -45,
		7: 0,
	}

	raycaster
	gDestination

	constructor(arrival, fbx, babs) {
		super(arrival.id, Controller, babs)
		log.info('new Controller()', arrival)
		this.arrival = arrival
		this.scene = babs.scene

		this.vTerrainMin = new THREE.Vector3(0,0,0)
		this.vTerrainMax = new THREE.Vector3(1000,10_000,1000)
		this._decceleration = new THREE.Vector3(-5.0, 0, -5.0) // friction, basically
		this.acceleration = new THREE.Vector3(100, 0, 100)
		this.rotationSpeed = 1
		this.velocity = new THREE.Vector3(0, 0, 0)
		this.groundDistance = 0
		this.run = false

		this._animations = {}
		this._stateMachine = new CharacterFSM(
			new BasicCharacterControllerProxy(this._animations)
		)

		// Init
		this.target = fbx
		this.idealTargetQuaternion = fbx.quaternion.clone()
		this._mixer = new THREE.AnimationMixer(this.target)
		
		const animList = ['run', 'backward', 'walk', 'idle', 'dance']
		Promise.all(animList.map(async animName => {
			const anim = await this.babs.loaderSys.LoadAnim(this.arrival.char.gender, animName)
			const clip = anim.animations[0]
			const action = this._mixer.clipAction(clip)

			this._animations[animName] = {
				clip: clip,
				action: action,
			}
		})).then(() => {
			this._stateMachine.SetState('idle')
		})

		// const animList = ['run', 'backward', 'walk', 'idle', 'dance']
		// animList.map(animName => {
		// 	LoaderSys.LoadAnim(this.arrival.char.gender, animName).then(animResult => {
		// 		const clip = animResult.animations[0]
		// 		// log('animResult', animResult)
		// 		this._animations[animName] = {
		// 			clip: clip,
		// 			action: this._mixer.clipAction(clip),
		// 		}
		// 	})
		// })


		

		this.raycaster = new Raycaster( new Vector3(), new Vector3( 0, -1, 0 ), 0, this.vTerrainMax.y )

		log.info('controller init done, move player to', this.arrival.x, this.arrival.z, this.target)
		this.gDestination = new Vector3(this.arrival.x, 0, this.arrival.z)
		this.target.position.copy(this.gDestination.clone().multiplyScalar(4).addScalar(4/2))
		this.target.visible = true
	}

	get Position() {
		return this.target?.position || new Vector3()
	}

	get Rotation() {
		if (!this.target) return new THREE.Quaternion() 
		return this.target.quaternion
	}

	modelHead
	modelNeck
	headRotationX = 0
	setHeadRotationX(eulerX) {
		this.headRotationX = eulerX
		// log(this.modelHead.rotation)
	}

	getHeadRotationX() {
		return this.headRotationX
	}

	// Women runners do about 10 ft/s over 4 mi, so 1ft/100ms, 4ft/400ms
	setDestination(gVector3, movestate) {
		// This takes a grid destination, which we'll be moved toward in update()
		if(gVector3.equals(this.gDestination)) {
			return
		}
		
		this.gDestination = gVector3.clone()
		log.info('setDestination changed', this.gDestination, movestate)
		this.run = movestate === 'run'
		this._stateMachine.SetState(movestate)

		// const player = this.babs.ents.get(this.idEnt)
		if(this.idEnt === this.babs.idSelf) {
			SocketSys.Send({
				move: {
					movestate: Object.entries(Controller.MOVESTATE).find(([str, num]) => str.toLowerCase() === movestate)[1],
					a: this.gDestination.x,
					b: this.gDestination.z,
				}
			})
		}
	}

	setRotation(_R) {
		this.idealTargetQuaternion = _R

		// Need to immediately update this because Input will call setRotation and then immediately check this.target.matrix for choosing direction vector!
		this.target.quaternion.copy(this.idealTargetQuaternion)

		// What if when I turn, I have it snap me to grid center?
		// That would avoid being off-center when turning during movement
		const gCurrentPosition = this.target.position.clone().multiplyScalar(1/4).floor()
		const eCurrentPosition = gCurrentPosition.clone().multiplyScalar(4).addScalar(2)
		eCurrentPosition.setY(this.target.position.y)
		this.target.position.copy(eCurrentPosition)
		
		// Now, let's translate velocity instead of zeroing it out, so they continue moving the same speed, but in the new direction.
		let tempMatrix = new Matrix4().makeRotationFromQuaternion(this.idealTargetQuaternion)
		let vector = new Vector3().setFromMatrixColumn( tempMatrix, 0 )  // get X column of matrix
		vector.negate()
		vector.crossVectors( this.target.up, vector )
		vector.round()

		const topVelocity = Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.z))
		vector.multiplyScalar(topVelocity)
		vector.setY(this.velocity.y)
		this.velocity.copy(vector)

		if(this.idEnt === this.babs.idSelf) {
			// Send turn amount to other players

			// const euler = new Euler().setFromQuaternion(this.target.quaternion)
			// const vector = euler.toVector3()
			// function radiansToDegrees(radians){
			// 	return radians * 180 / Math.PI
			// }
			// const angle = radiansToDegrees(Math.atan2(vector.z, vector.x))

			// const radians = rotation.y > 0 ? rotation.y : (2 * Math.PI) + rotation.y
			// const degrees = MathUtils.radToDeg(radians)

			// var dir = new Vector3(-this.target.position.x, 0, -this.target.position.z).normalize()
			
			// let matrixtest = new Matrix4().makeRotationFromQuaternion(this.idealTargetQuaternion)
			// let vectortest = new Vector3().setFromMatrixColumn( matrixtest, 1 )  // get X column of matrix
			
			var dir = new Vector3(1,0,1)
			dir.applyQuaternion(this.idealTargetQuaternion)		
			var theta = Math.atan2(dir.x, dir.z)
			const angle = MathUtils.radToDeg(theta)
			const round = Math.round(angle)
			log('angle', dir, theta, round)
			// ROTATION_ANGLE_MAP
			// Not sure what I'm doing here...but mapping what I've got
			const found = Object.entries(Controller.ROTATION_ANGLE_MAP).find(item => item[1] == round) || [180] // -180 can be 180...
			const rotationWord = parseInt(found[0])
			log('word', rotationWord)

			SocketSys.Send({
				move: {
					movestate: Controller.MOVESTATE.Rotate,
					a: rotationWord,
					b: 0,
				}
			})
		}

	}

	jump(height) {
		log.info('jump!', this.groundDistance, this.velocity.y)
		if(this.groundDistance < 10 && this.velocity.y >= -10) { // Allow multi jump but not too high, and not while falling
			this.velocity.y += height*(1000/200) *4 // $4ft, 200ms (5 times per second) // 4 made up to match *10 gravity...
			this.groundDistance = this.groundDistance || 1 // Get off the ground at least
		}
		// todo add this anim and get this state working?  also dance?
		// if(this._stateMachine._currentState != 'jump') {
		// 	this._stateMachine.SetState('jump')
		// } 
		if(this.idEnt === this.babs.idSelf) {
			SocketSys.Send({
				move: {
					movestate: Controller.MOVESTATE.Jump,
					a: 0,
					b: 0,
				}
			})
		}
	}

	update(dt) {
		if (!this._stateMachine._currentState) {
			return
		}
		// if(!this.velocity.equals(new Vector3(0,0,0))) {
		// 	log.info('Controller: update(), velocity:', this.velocity)
		// }

		this._stateMachine.Update(dt, this._input)

		const controlObject = this.target


		// First handle rotations
		// Note that rotation does not dictate movement direction.  Only this.gDestination does.
		// this._currentPosition.lerp(idealOffset, t)
		// this._currentLookat.lerp(idealLookat, t)
		// this._camera.position.copy(this._currentPosition)
		// this._camera.lookAt(this._currentLookat)
		// controlObject.quaternion.slerp(this.idealTargetQuaternion, dt)
		// log(controlObject.rotation.x, controlObject.rotation.y, controlObject.rotation.z)
		controlObject.quaternion.copy(this.idealTargetQuaternion)

		// Now movement physics
		const velocity = this.velocity
		const frameDecceleration = new THREE.Vector3(
			velocity.x * this._decceleration.x,
			0,
			velocity.z * this._decceleration.z
		)
		frameDecceleration.multiplyScalar(dt)
		frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(Math.abs(frameDecceleration.z), Math.abs(velocity.z))
		frameDecceleration.x = Math.sign(frameDecceleration.x) * Math.min(Math.abs(frameDecceleration.x), Math.abs(velocity.x))
		// frameDecceleration.y = Math.sign(frameDecceleration.y) * Math.min(Math.abs(frameDecceleration.y), Math.abs(velocity.y))

		velocity.add(frameDecceleration)

		const acc = this.acceleration.clone()
		if (this.run) {
			acc.multiplyScalar(2.0)
		}

		// Move toward destination
		if(this.gDestination) {
			const eDest = this.gDestination.clone().multiplyScalar(4).addScalar(4/2)
			// log('tDestination', tDestination)
			const eDiff = eDest.clone().sub(controlObject.position) // Distance from CENTER

			if (Math.abs(eDiff.z) < 1) {
				velocity.z = 0
				controlObject.position.setZ(eDest.z)
			}
			else if (eDiff.z > 0) {
				log.info('Controller: update(), addZ based on', eDiff)
				velocity.z += acc.z * dt
			}
			else if (eDiff.z < 0) {
				velocity.z -= acc.z * dt
			}

			if (Math.abs(eDiff.x) < 1) {
				velocity.x = 0
				controlObject.position.setX(eDest.x)
			}
			else if (eDiff.x > 0) {
				log.info('Controller: update(), addX based on', eDiff)
				velocity.x += acc.x * dt
			}
			else if (eDiff.x < 0) {
				velocity.x -= acc.x * dt
			}

			if(!velocity.equals(new Vector3())) {
				log.info('vel', velocity)
			}

			if(Math.round(velocity.z) == 0 && Math.round(velocity.x) == 0) {
				if(this._stateMachine._currentState != 'idle') {
					this._stateMachine.SetState('idle')
				}
			}

		}

		if(this.groundDistance == 0) {
			velocity.y = 0
		} 
		else {
			const gravityFtS = 32 *10 // Why does it feel off without *10?
			velocity.y -= gravityFtS*dt
		}

		// if (this._input._keys.left) {
		// 	_A.set(0, 1, 0)
		// 	_Q.setFromAxisAngle(_A, 4.0 * Math.PI * dt * this._acceleration.y)
		// 	_R.multiply(_Q)
		// }
		// if (this._input._keys.right) {
		// 	_A.set(0, 1, 0)
		// 	_Q.setFromAxisAngle(_A, 4.0 * -Math.PI * dt * this._acceleration.y)
		// 	_R.multiply(_Q)
		// }
		// controlObject.quaternion.copy(_R)

		// I need to fix forward so that it's player-forward instead of world-forward, maybe?
		const forward = new THREE.Vector3(1, 1, 1)
		// forward.applyQuaternion(this.idealTargetQuaternion) // This was making rotation absolute; impossible to walk -z or -x
		// forward.normalize()

		// Sideeways needs doing for strafe
		// const sideways = new THREE.Vector3(1, 0, 0)
		// sideways.applyQuaternion(this.idealTargetQuaternion)
		// sideways.normalize()

		// sideways.multiplyScalar(velocity.x * dt)
		// forward.multiplyScalar(velocity.z * dt)
		forward.multiply(velocity.clone().multiplyScalar(dt))

		controlObject.position.add(forward)
		// controlObject.position.add(sideways)

		controlObject.position.clamp(
			this.vTerrainMin,
			this.vTerrainMax,
		)

		if (this._mixer) {
			this._mixer.update(dt)
		}

		// Keep above ground
		this.raycaster.ray.origin.copy(controlObject.position)
		this.raycaster.ray.origin.setY(this.vTerrainMax.y) // Use min from below?  No, backfaces not set to intersect!
		const ground = this.scene.children.find(o=>o.name=='ground')
		if(ground && this.raycaster) {
			const groundIntersect = this.raycaster.intersectObject(ground, true)
			// log('groundIntersect', groundIntersect, ground)
			const groundHeightY = groundIntersect?.[0]?.point.y
			if(groundHeightY > controlObject.position.y) {
				this.groundDistance = true
				controlObject.position.setY(groundHeightY) // Import is bottom-origin!
				// If on ground, y velocity stops
			}
			this.groundDistance = controlObject.position.y - groundHeightY // Used for jump
		}
		
		if(this.headRotationX) {
			this.modelHead = this.modelHead || this.target.getObjectByName( 'Neck_M' )
			this.modelHead.setRotationFromAxisAngle(new Vector3(-1,0,0), this.headRotationX/2)
			this.modelNeck = this.modelNeck || this.target.getObjectByName( 'Head_M' )
			this.modelNeck.setRotationFromAxisAngle(new Vector3(-1,0,0), this.headRotationX/2)
		}

		
	}

}


class FiniteStateMachine {
	constructor() {
		this._states = {}
		this._currentState = null
	}

	_AddState(name, type) {
		this._states[name] = type
	}

	SetState(name) {
		const prevState = this._currentState

		if (prevState) {
			if (prevState.Name == name) {
				return
			}
			prevState.Exit()
		}

		const state = new this._states[name](this)

		this._currentState = state
		state.Enter(prevState)
	}

	Update(timeElapsed, input) {
		if (this._currentState) {
			this._currentState.Update(timeElapsed, input)
		}
	}
}


class CharacterFSM extends FiniteStateMachine {
	constructor(proxy) {
		super()
		this._proxy = proxy
		this._Init()
	}

	_Init() {
		this._AddState('idle', IdleState)
		this._AddState('run', RunState)
		this._AddState('backward', BackwardState)
		this._AddState('walk', WalkState)
		this._AddState('jump', JumpState)
		this._AddState('dance', DanceState)
	}
}

