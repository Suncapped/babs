import * as THREE from 'three'
import { EventSys } from '../sys/EventSys'
import { LoaderSys } from '../sys/LoaderSys'
import { log } from '../Utils'
import { Raycaster } from 'three'
import { Vector3 } from 'three'
import { Com } from './Com'
import { SocketSys } from '../sys/SocketSys'
import { InputSys } from '../sys/InputSys'

import  { State, DanceState, RunState, BackwardState, WalkState, IdleState } from './ControllerState'

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

	scene

	// MoveSys
	maxTerrainHeight = 100_000
	MOVESTATE = {
		Idle: 0,
		Run: 1,
		Walk: 2,
		Jump: 3,
		Dodge: 4,
		Rotate: 5,
		Emote: 6,
	}

	raycaster

	bSelf
	gDestination

	constructor(arrival, bSelf, entPlayer, babs) {
		super(babs, entPlayer.id, Controller)
		log.info('Controller arrival', bSelf, entPlayer.id)
		this.arrival = arrival
		this.scene = babs.scene
		this.bSelf = bSelf

		this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0)
		this._acceleration = new THREE.Vector3(1, 0.25, 50.0)
		this._velocity = new THREE.Vector3(0, 0, 0)
		this._position = new THREE.Vector3()

		this._animations = {}
		this._stateMachine = new CharacterFSM(
			new BasicCharacterControllerProxy(this._animations)
		)

		// if(bSelf) {
		// 	this._input = InputSys
		// }

		// EventSys.Subscribe(this)
		// Loading...


	}

	async init() {
		const fbx = await LoaderSys.LoadRig(this.arrival.char.gender)
		this.scene.add(fbx)
		
		this.target = fbx
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


		this.raycaster = await new Raycaster( new Vector3(), new Vector3( 0, -1, 0 ), 0, this.maxTerrainHeight )
		log('controller init done, move player to', this.arrival.x, this.arrival.z, this.target)
		log('gta', new Vector3(this.arrival.x, 0, this.arrival.z))
		this.gDestination = new Vector3(this.arrival.x, 0, this.arrival.z)
		this.target.position.copy(this.gDestination.clone().multiplyScalar(4).addScalar(2/4))
	}

	get Position() {
		return this._position
	}

	get Rotation() {
		if (!this.target) {
			return new THREE.Quaternion()
		}
		return this.target.quaternion
	}

	// Women runners do about 10 ft/s over 4 mi, so 1ft/100ms, 4ft/400ms
	// But that's a little much for this version, let's just give an impulse?
	// Or do I have to work backward from destination?
	// Well, distance to next square will always be 4ft.  
	// How about full speed, then at halfway (cell border) if they're not continuing, it slows?
	setDestination(gVector3) {
		if(gVector3.equals(this.gDestination)) return
		
		this.gDestination = gVector3.clone()

		SocketSys.Send({
			move: {
				x: this.gDestination.x,
				z: this.gDestination.z,
				movestate: this.MOVESTATE.Run
			}
		})

		log('setDestination', this.gDestination)
	}

	update(dt) {
		// log.info(dt)
		if (!this._stateMachine._currentState) {
			return
		}

		this._stateMachine.Update(dt, this._input)

		const velocity = this._velocity
		const frameDecceleration = new THREE.Vector3(
			velocity.x * this._decceleration.x,
			velocity.y * this._decceleration.y,
			velocity.z * this._decceleration.z
		)
		frameDecceleration.multiplyScalar(dt)
		frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
			Math.abs(frameDecceleration.z), Math.abs(velocity.z))

		velocity.add(frameDecceleration)

		const controlObject = this.target
		const _Q = new THREE.Quaternion()
		const _A = new THREE.Vector3()
		const _R = controlObject.quaternion.clone()

		const acc = this._acceleration.clone()
		// if (!this._input._keys.shift) {
		// 	acc.multiplyScalar(2.0)
		// }

		// if (this._stateMachine._currentState.Name == 'dance') {
		// 	acc.multiplyScalar(0.0)
		// }

		if(this.gDestination) {
			const tDestination = this.gDestination.clone().multiplyScalar(4)
			const tDestDiff = tDestination.clone().sub(controlObject.position)
			// log('tDestDiff', tDestDiff, tDestination)
			if (Math.abs(tDestDiff.z) < 0.5) {
				velocity.z = 0
				// controlObject.position.setZ(tDestination.z)
			}
			else if (tDestDiff.z > 0) {
				velocity.z += acc.z * dt
			}
			else if (tDestDiff.z < 0) {
				velocity.z -= acc.z * dt
			}
		}
		// if (this._input._keys.backward) {
		// 	velocity.z -= acc.z * dt
		// }
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

		controlObject.quaternion.copy(_R)

		const oldPosition = new THREE.Vector3()
		oldPosition.copy(controlObject.position)

		const forward = new THREE.Vector3(0, 0, 1)
		forward.applyQuaternion(controlObject.quaternion)
		forward.normalize()

		const sideways = new THREE.Vector3(1, 0, 0)
		sideways.applyQuaternion(controlObject.quaternion)
		sideways.normalize()

		sideways.multiplyScalar(velocity.x * dt)
		forward.multiplyScalar(velocity.z * dt)

		controlObject.position.add(forward)
		controlObject.position.add(sideways)

		controlObject.position.clamp(
			new THREE.Vector3(0,0,0),
			new THREE.Vector3(1000,10_000,1000),
		)


		this._position.copy(controlObject.position)

		if (this._mixer) {
			this._mixer.update(dt)
		}

		
		// MoveSys todo 
		if(this.gDestination) { // It's been init
			// const gridPos = this.target.position.clone().multiplyScalar(1/4).floor()
			// if(!gridPos.equals(this.gDestination)) { // Player has moved on grid!
			// 	SocketSys.Send({
			// 		move: {
			// 			x: gridPos.x,
			// 			z: gridPos.z,
			// 			movestate: this.MOVESTATE.Run
			// 		}
			// 	})
			// 	this.targetGridPos = gridPos
			// }


			// Keep above ground
			// log('self', this.target.position)
			this.raycaster.ray.origin.copy(this.target.position)
			this.raycaster.ray.origin.setY(this.maxTerrainHeight) // Use min from below?  No, backfaces not set to intersect!
			const ground = this.scene.children.find(o=>o.name=='ground')
			if(ground && this.raycaster) {
				const groundIntersect = this.raycaster.intersectObject(ground, true)
				// log('groundIntersect', groundIntersect, ground)
				const groundHeightY = groundIntersect?.[0]?.point.y
				if(groundHeightY != this.target.position.y) {
					this.target.position.setY(groundHeightY) // Import is bottom-origin!
				}
	
			}

		}

		window.document.getElementById('log').innerText = `${Math.round(this.target.position.x)}, ${Math.round(this.target.position.y)}, ${Math.round(this.target.position.z)}`

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
		this._AddState('dance', DanceState)
	}
}

