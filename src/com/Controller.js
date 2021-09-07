import * as THREE from 'three'
import { EventSys } from '../sys/EventSys'
import { LoaderSys } from '../sys/LoaderSys'
import { log } from '../Utils'
import { Raycaster } from 'three'
import { Vector3 } from 'three'
import { Com } from './Com'
import { SocketSys } from '../sys/SocketSys'
import { InputSys } from '../sys/InputSys'

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

	_targetGridPos
	raycaster

	bSelf

	constructor(arrival, bSelf, idEnt, babs) {
		super(babs, idEnt, Controller)
		log.info('Controller arrival', bSelf, idEnt)
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
		
		this._target = fbx
		this._mixer = new THREE.AnimationMixer(this._target)

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
		log('controller init done, move player to', this.arrival.x, this.arrival.z, this._target)
		this._target.position.set(this.arrival.x *4, 0, this.arrival.z *4)
		this._targetGridPos = Controller.GridposFromWorldpos(new Vector3(this._target.position.x, 0, this._target.position.z))
	}

	get Position() {
		return this._position
	}

	get Rotation() {
		if (!this._target) {
			return new THREE.Quaternion()
		}
		return this._target.quaternion
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

		const controlObject = this._target
		const _Q = new THREE.Quaternion()
		const _A = new THREE.Vector3()
		const _R = controlObject.quaternion.clone()

		const acc = this._acceleration.clone()
		if (!this._input._keys.shift) {
			acc.multiplyScalar(2.0)
		}

		if (this._stateMachine._currentState.Name == 'dance') {
			acc.multiplyScalar(0.0)
		}

		if (this._input._keys.forward) {
			velocity.z += acc.z * dt
		}
		if (this._input._keys.backward) {
			velocity.z -= acc.z * dt
		}
		if (this._input._keys.left) {
			_A.set(0, 1, 0)
			_Q.setFromAxisAngle(_A, 4.0 * Math.PI * dt * this._acceleration.y)
			_R.multiply(_Q)
		}
		if (this._input._keys.right) {
			_A.set(0, 1, 0)
			_Q.setFromAxisAngle(_A, 4.0 * -Math.PI * dt * this._acceleration.y)
			_R.multiply(_Q)
		}

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
		if(this._targetGridPos) { // It's been init
			const gridPos = Controller.GridposFromWorldpos(this._target.position)
			if(!gridPos.equals(this._targetGridPos)) { // Player has moved on grid!
				SocketSys.Send({
					move: {
						x: gridPos.x,
						z: gridPos.z,
						movestate: this.MOVESTATE.Run
					}
				})
				this._targetGridPos = gridPos
			}


			// Keep above ground
			// log('self', this._target.position)
			this.raycaster.ray.origin.copy(this._target.position)
			this.raycaster.ray.origin.setY(this.maxTerrainHeight) // Use min from below?  No, backfaces not set to intersect!
			const ground = this.scene.children.find(o=>o.name=='ground')
			if(ground && this.raycaster) {
				const groundIntersect = this.raycaster.intersectObject(ground, true)
				// log('groundIntersect', groundIntersect, ground)
				const groundHeightY = groundIntersect?.[0]?.point.y
				if(groundHeightY != this._target.position.y) {
					this._target.position.setY(groundHeightY) // Import is bottom-origin!
				}
	
			}

		}

	}


	static GridposFromWorldpos(worldPosition) {
		return new Vector3(Math.floor(worldPosition.x / 4), null, Math.floor(worldPosition.z / 4))
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


class State {
	constructor(parent) {
		this._parent = parent
	}

	Enter() { }
	Exit() { }
	Update() { }
}


class DanceState extends State {
	constructor(parent) {
		super(parent)

		this._FinishedCallback = () => {
			this._Finished()
		}
	}

	get Name() {
		return 'dance'
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['dance'].action
		const mixer = curAction.getMixer()
		mixer.addEventListener('finished', this._FinishedCallback)

		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action

			curAction.reset()
			curAction.setLoop(THREE.LoopOnce, 1)
			curAction.clampWhenFinished = true
			curAction.crossFadeFrom(prevAction, 0.2, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	_Finished() {
		this._Cleanup()
		this._parent.SetState('idle')
	}

	_Cleanup() {
		const action = this._parent._proxy._animations['dance'].action

		action.getMixer().removeEventListener('finished', this._CleanupCallback)
	}

	Exit() {
		this._Cleanup()
	}

	Update(_) {
	}
}



class RunState extends State {
	constructor(parent) {
		super(parent)
	}

	get Name() {
		return 'run'
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['run'].action
		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action

			curAction.enabled = true

			if (prevState.Name == 'walk') {
				const ratio = curAction.getClip().duration / prevAction.getClip().duration
				curAction.time = prevAction.time * ratio
			} else {
				curAction.time = 0.0
				curAction.setEffectiveTimeScale(1.0)
				curAction.setEffectiveWeight(1.0)
			}

			curAction.crossFadeFrom(prevAction, 0.5, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	Exit() {
	}

	Update(timeElapsed, input) {
		if (input._keys.forward || input._keys.backward) {
			if (input._keys.shift) {
				this._parent.SetState('walk')
			}
			return
		}

		this._parent.SetState('idle')
	}
}

class BackwardState extends State {
	constructor(parent) {
		super(parent)
	}

	get Name() {
		return 'backward'
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['backward'].action
		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action

			curAction.enabled = true

			if (prevState.Name == 'run') {
				const ratio = curAction.getClip().duration / prevAction.getClip().duration
				curAction.time = prevAction.time * ratio
			} else {
				curAction.time = 0.0
				curAction.setEffectiveTimeScale(-1.0)
				curAction.setEffectiveWeight(1.0)
			}

			curAction.crossFadeFrom(prevAction, 0.5, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	Exit() {
	}

	Update(timeElapsed, input) {
		if(input._keys.backward) {
			return
		}
		else if (input._keys.forward) {
			if (input._keys.shift) {
				this._parent.SetState('walk')
			} else {
				this._parent.SetState('run')
			}
		}
		else {
			this._parent.SetState('idle')
		}
	}
}


class WalkState extends State {
	constructor(parent) {
		super(parent)
	}

	get Name() {
		return 'walk'
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['walk'].action
		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action

			curAction.enabled = true

			if (prevState.Name == 'run') {
				const ratio = curAction.getClip().duration / prevAction.getClip().duration
				curAction.time = prevAction.time * ratio
			} else {
				curAction.time = 0.0
				curAction.setEffectiveTimeScale(1.0)
				curAction.setEffectiveWeight(1.0)
			}

			curAction.crossFadeFrom(prevAction, 0.5, true)
			curAction.play()
		} else {
			curAction.play()
		}
	}

	Exit() {
	}

	Update(timeElapsed, input) {
		if (input._keys.forward || input._keys.backward) {
			if (!input._keys.shift) {
				this._parent.SetState('run')
			}
			return
		}

		this._parent.SetState('idle')
	}
}


class IdleState extends State {
	constructor(parent) {
		super(parent)
	}

	get Name() {
		return 'idle'
	}

	Enter(prevState) {
		const idleAction = this._parent._proxy._animations['idle'].action
		log.info('idleenter', prevState, idleAction)


		const mixer = idleAction.getMixer()
		mixer.addEventListener('finished', (stuff) => {
			log.info('finished?', stuff)
		})

		idleAction.getClip().duration = 5 // via diagnose below

		if (prevState) {
			const prevAction = this._parent._proxy._animations[prevState.Name].action
			idleAction.time = 0.0
			idleAction.enabled = true


			// // Diagnose and find bad track 
			// const clip = idleAction.getClip()
			// let count = 0
			// clip.tracks.map(track => {
			// 	log.info('track', count)
			// 	count++
			// 	const maxValueObject = track.times.filter(time => {
			// 		return time > 8 // Too long for this anim
			// 	})
			// 	log.info('max', maxValueObject)
			// })
			// log.info('duration', idleAction.getClip().duration)
			// idleAction.getClip().resetDuration()
			// log.info('after', idleAction.getClip().duration)

			idleAction.setEffectiveTimeScale(1.0)
			idleAction.setEffectiveWeight(1.0)
			idleAction.crossFadeFrom(prevAction, 0.5, true)
			idleAction.play()
		} else {
			idleAction.play()
		}
	}

	Exit() {
	}

	Update(_, input) {
		// log.info('idleup', _)
		if (input._keys.forward) {
			this._parent.SetState('run')
		} else if (input._keys.backward) {
			this._parent.SetState('backward')
		} else if (input._keys.space) {
			this._parent.SetState('dance')
		} else {
			return
		}
	}
}
