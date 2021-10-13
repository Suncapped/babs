import * as THREE from 'three'
import { EventSys } from '../sys/EventSys'
import { LoaderSys } from '../sys/LoaderSys'
import { log } from '../Utils'
import { Raycaster } from 'three'
import { Vector3 } from 'three'
import { Com } from './Com'
import { SocketSys } from '../sys/SocketSys'
import { InputSys } from '../sys/InputSys'

import  { State, DanceState, RunState, BackwardState, WalkState, IdleState, JumpState } from './ControllerState'

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

	raycaster
	gDestination
	

	constructor(arrival, bSelf, entPlayer, babs) {
		super(babs, entPlayer.id, Controller)
		log.info('Controller arrival', bSelf, entPlayer.id)
		this.arrival = arrival
		this.scene = babs.scene
		this.bSelf = bSelf

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

		// EventSys.Subscribe(this)
		// Loading...


	}

	async init() {
		const fbx = await LoaderSys.LoadRig(this.arrival.char.gender)
		this.scene.add(fbx)
		
		this.target = fbx
		this.idealTargetQuaternion = fbx.quaternion.clone()
		
		this._mixer = new THREE.AnimationMixer(this.target)

		const animList = ['run', 'backward', 'walk', 'idle', 'dance']

		await Promise.all(animList.map(async animName => {
			const anim = await LoaderSys.LoadAnim(this.arrival.char.gender, animName)
			const clip = anim.animations[0]
			const action = this._mixer.clipAction(clip)

			this._animations[animName] = {
				clip: clip,
				action: action,
			}
		}));

		this._stateMachine.SetState('idle')


		this.raycaster = await new Raycaster( new Vector3(), new Vector3( 0, -1, 0 ), 0, this.vTerrainMax.y )
		log('controller init done, move player to', this.arrival.x, this.arrival.z, this.target)
		this.gDestination = new Vector3(this.arrival.x, 0, this.arrival.z)
		this.target.position.copy(this.gDestination.clone().multiplyScalar(4).addScalar(4/2))
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

		// if (!this.modelHead) return new THREE.Quaternion() 
		
		// const q = new THREE.Quaternion()
		// this.modelHead.getWorldQuaternion(q)

		// return q
	}

	// Women runners do about 10 ft/s over 4 mi, so 1ft/100ms, 4ft/400ms
	setDestination(gVector3, movestate) {
		if(gVector3.equals(this.gDestination)) {
			return
		}
		
		this.gDestination = gVector3.clone()
		log('setDestination changed', this.gDestination, movestate)
		this.run = movestate === 'run'
		this._stateMachine.SetState(movestate)

		SocketSys.Send({ // todo, only for local player
			move: {
				x: this.gDestination.x,
				z: this.gDestination.z,
				movestate: Object.entries(Controller.MOVESTATE).find(([str, num]) => str.toLowerCase() === movestate)[1]
			}
		})
	}

	setRotation(_R) {
		// this.target.quaternion.copy(_R)
		this.idealTargetQuaternion = _R
	}

	jump(height) {
		log('j', this.groundDistance, this.velocity.y)
		if(this.groundDistance < 10 && this.velocity.y >= -10) { // Allow multi jump but not too high, and not while falling
			this.velocity.y += height*(1000/200) // $4ft, 200ms (5 times per second)
			this.groundDistance = this.groundDistance || 1 // Get off the ground at least
		}
		// if(this._stateMachine._currentState != 'jump') {
		// 	this._stateMachine.SetState('jump')
		// } // todo add this anim and get this state working?  also dance?
	}

	update(dt) {
		if (!this._stateMachine._currentState) {
			return
		}

		this._stateMachine.Update(dt, this._input)

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

		// log('v', velocity.y, this.target.position.y, frameDecceleration.y)
		

		velocity.add(frameDecceleration)

		const controlObject = this.target
		// const _Q = new THREE.Quaternion()
		// const _A = new THREE.Vector3()
		// const _R = controlObject.quaternion.clone()

		const acc = this.acceleration.clone()
		if (this.run) {
			acc.multiplyScalar(2.0)
		}

		// if (this._stateMachine._currentState.Name == 'dance') {
		// 	acc.multiplyScalar(0.0)
		// }

		// Move toward destination
		if(this.gDestination) {
			const tDestination = this.gDestination.clone().multiplyScalar(4).addScalar(4/2)
			// log('tDestination', tDestination)
			const tDestDiff = tDestination.clone().sub(controlObject.position) // Distance from CENTER

			// if(tDestDiff.x !== 0 || tDestDiff.z !== 0) {
				// TODOO
				// log('controlObject.position, this.gDestination', controlObject.position, this.gDestination)
				// log('tDestination, tDestDiff', tDestination, tDestDiff)
			// }

			if (Math.abs(tDestDiff.z) < 1) {
				velocity.z = 0
				controlObject.position.setZ(tDestination.z)
			}
			else if (tDestDiff.z > 0) {
				velocity.z += acc.z * dt
			}
			else if (tDestDiff.z < 0) {
				velocity.z -= acc.z * dt
			}

			if (Math.abs(tDestDiff.x) < 1) {
				velocity.x = 0
				controlObject.position.setX(tDestination.x)
			}
			else if (tDestDiff.x > 0) {
				velocity.x += acc.x * dt
			}
			else if (tDestDiff.x < 0) {
				velocity.x -= acc.x * dt
			}

			// log('vel', velocity.x, velocity.z)
			if(Math.round(velocity.z) == 0 && Math.round(velocity.x) == 0) {
				if(this._stateMachine._currentState != 'idle') {
					this._stateMachine.SetState('idle')
					log('IDLE')
				}
			}
		}

		if(this.groundDistance == 0) {
			velocity.y = 0
		} 
		else {
			const gravityFtS = 32
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

		// const oldPosition = new THREE.Vector3()
		// oldPosition.copy(controlObject.position)

		// I need to fix forward so that it's player-forward instead of world-forward, maybe?
		const forward = new THREE.Vector3(1, 1, 1)
		// forward.applyQuaternion(this.idealTargetQuaternion) // This was making rotation absolute; impossible to walk -z or -x
		// forward.normalize()

		// const sideways = new THREE.Vector3(1, 0, 0)
		// sideways.applyQuaternion(this.idealTargetQuaternion)
		// sideways.normalize()

		// sideways.multiplyScalar(velocity.x * dt)
		// forward.multiplyScalar(velocity.z * dt)
		forward.multiply(velocity.clone().multiplyScalar(dt))

		// log('forward', forward)

		controlObject.position.add(forward)
		// controlObject.position.add(sideways)

		

		controlObject.position.clamp(
			this.vTerrainMin,
			this.vTerrainMax,
		)

		if (this._mixer) {
			this._mixer.update(dt)
		}

		if(this.gDestination) { // It's been init

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
		

		// Lerp rotation from input
		// this._currentPosition.lerp(idealOffset, t)
		// this._currentLookat.lerp(idealLookat, t)
		// this._camera.position.copy(this._currentPosition)
		// this._camera.lookAt(this._currentLookat)
		// controlObject.quaternion.slerp(this.idealTargetQuaternion, dt)
		controlObject.quaternion.copy(this.idealTargetQuaternion)

		window.document.getElementById('log').innerText = `${Math.round(this.target.position.x)}, ${Math.round(this.target.position.y)}, ${Math.round(this.target.position.z)}`


		this.modelHead = this.modelHead || this.target.getObjectByName( 'Neck_M' )
		this.modelHead.setRotationFromAxisAngle(new Vector3(-1,0,0), this.headRotationX/2)
		this.modelNeck = this.modelNeck || this.target.getObjectByName( 'Head_M' )
		this.modelNeck.setRotationFromAxisAngle(new Vector3(-1,0,0), this.headRotationX/2)
		
	}

	// postUpdate() {
	// 	this.modelHead = this.modelHead || this.target.getObjectByName( 'Neck_M' )
	// 	this.modelHead.setRotationFromAxisAngle(new Vector3(-1,0,0), this.headRotationX)
	// }

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

