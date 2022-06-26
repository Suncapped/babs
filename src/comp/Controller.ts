import { log } from '@/Utils'
import { MathUtils, Quaternion, Raycaster, Scene, Vector3, AnimationMixer, Matrix4 } from 'three'
import { Comp } from '@/comp/Comp'
import { WorldSys } from '@/sys/WorldSys'
import { DanceState, RunState, BackwardState, WalkState, IdleState, JumpState } from './ControllerState'
import { WobAtPosition } from '@/Utils'
import { Zone } from '@/ent/Zone'
import { YardCoord } from './Coord'
import { Player } from '@/ent/Player'

// Begun from MIT licensed https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js

class BasicCharacterControllerProxy {
	_animations
	constructor(animations) {
		this._animations = animations
	}

	get animations() {
		return this._animations
	}
}

export class Controller extends Comp {
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
	static sizeScaleDown = 0.80

	constructor(arrival, babs) {
		super(arrival.id, Controller, babs)
	}

	static Create(arrival, babs, scene :Scene) {
		return new Controller(arrival, babs).init(arrival, scene)
	}

	raycaster
	gDestination :Vector3
	hover = 0
	groundDistance :number|boolean = 0
	isSelf :boolean = false

	target :Scene & {zone? :Zone}

	arrival
	vTerrainMin = new Vector3(0, 0, 0)
	vTerrainMax = new Vector3(1000,10_000,1000)
	_decceleration = new Vector3(-5.0, 0, -5.0) // friction, basically
	acceleration = new Vector3(100 *Controller.sizeScaleDown, 0, 100 *Controller.sizeScaleDown)
	velocity = new Vector3(0, 0, 0)
	rotationSpeed = 1
	run = false
	idealTargetQuaternion


	_animations = new Array<{
		clip :any,
		action :any,
	}>()
	_mixer :AnimationMixer
	
	_stateMachine :CharacterFSM


	async init(arrival, scene :Scene) {
		log.info('Controller.init()', arrival)
		this.arrival = arrival
		this.isSelf = this.idEnt === this.babs.idSelf

		this.target = scene
		this.target.zone = this.babs.ents.get(this.arrival.idzone) as Zone

		this._stateMachine = new CharacterFSM(
			new BasicCharacterControllerProxy(this._animations)
		)

		this.idealTargetQuaternion = this.target.quaternion.clone()

		this._mixer = new AnimationMixer(this.target)
		const animList = ['idle', 'run', 'walk']
		await Promise.all(animList.map(async animName => {
			const anim = await this.babs.loaderSys.loadAnim(this.arrival.char.gender, animName)
			const clip = anim.animations[0]
			const action = this._mixer.clipAction(clip)

			this._animations[animName] = {
				clip: clip,
				action: action,
			}
		}))

		this._stateMachine.setState('idle')

		// Finally show the character
		this.target.visible = true

		// Raycast for ground snapping
		this.raycaster = new Raycaster( new Vector3(), new Vector3( 0, -1, 0 ), 0, WorldSys.ZoneTerrainMax.y )

		// Set position warped
		log.info('controller init done, warp player to', this.arrival.x, this.arrival.z, this.target)
		this.gDestination = new Vector3(this.arrival.x, 0, this.arrival.z)
		this.target.position.copy(this.gDestination.clone().multiplyScalar(4).addScalar(4/2))

		// Set rotation
		const degrees = Controller.ROTATION_ANGLE_MAP[this.arrival.r] -45 // Why -45?  Who knows! :p
		const quat = new Quaternion()
		quat.setFromAxisAngle(new Vector3(0,1,0), MathUtils.degToRad(degrees))
		this.setRotation(quat)

		return this
	}

	get Position() {
		return this.target?.position || new Vector3()
	}

	get Rotation() {
		if (!this.target) return new Quaternion() 
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

	selfZoningWait = false // Only applies to self!
	setDestination(gVector3, movestate) {
		// This takes a grid destination, which we'll be moved toward in update()
		if(gVector3.equals(this.gDestination)) return // Do not process if unchanged
		if(this.selfZoningWait) return // Do not process during zoning

		this.gDestination = gVector3.clone()
		log('setDestination changed', this.gDestination, movestate, this.isSelf)
		this.run = movestate === 'run'
		this._stateMachine.setState(movestate)
		


		// const player = this.babs.ents.get(this.idEnt)
		if(this.isSelf) {
			const movestateSend = Object.entries(Controller.MOVESTATE).find(([str, num]) => str.toLowerCase() === movestate)[1]
			
			// New destination!
			// As soon as dest is next square (for the first time), send ENTERZONE

			log('gdest', this.gDestination)
			const targetYardCoord = YardCoord.Create({
				...this.gDestination, 
				zone: this.babs.worldSys.currentGround.zone,
			})
			log('gdest TYC', targetYardCoord)

			let enterzone_id :number = undefined
			const isOutsideOfZone = this.gDestination.x < 0 || this.gDestination.z < 0 ||
									this.gDestination.x > 249 || this.gDestination.z > 249
			if(isOutsideOfZone){
				log.info('isOutsideOfZone', isOutsideOfZone)
				enterzone_id = targetYardCoord.zone.id
				this.selfZoningWait = true

				this.gDestination.x = targetYardCoord.x
				this.gDestination.z = targetYardCoord.z

				const zonetarget = targetYardCoord.zone
				const zonecurrent = this.babs.worldSys.currentGround.zone
				const zoneDiff = new Vector3(zonetarget.x -zonecurrent.x, 0, zonetarget.z -zonecurrent.z)

				this.babs.worldSys.shiftEverything(-zoneDiff.x *1000, -zoneDiff.z*1000)
			}

			this.babs.socketSys.send({
				move: {
					movestate: movestateSend,
					a: this.gDestination.x,
					b: this.gDestination.z,
					enterzone_id,
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

		if(this.isSelf) {
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
			
			let dir = new Vector3(1,0,1)
			dir.applyQuaternion(this.idealTargetQuaternion)		
			let theta = Math.atan2(dir.x, dir.z)
			const angle = MathUtils.radToDeg(theta)
			const round = Math.round(angle)
			// log('angle', dir, theta, round)

			// Not sure what I'm doing here...but mapping what I've got
			// -180 can be 180, so that's item 3...
			const found = Object.entries(Controller.ROTATION_ANGLE_MAP).find(item => item[1] == round) || [3]

			const rotationWord = parseInt(`${found[0]}`)
			this.babs.socketSys.send({
				move: {
					movestate: Controller.MOVESTATE.Rotate,
					a: rotationWord,
					b: 0,
				}
			})
		}

	}

	jump(height) {
		log('jump!', this.groundDistance, this.velocity.y)
		if(this.groundDistance < 10 && this.velocity.y >= -10) { // Allow multi jump but not too high, and not while falling
			this.velocity.y += height*(1000/200) *4 // $4ft, 200ms (5 times per second) // 4 made up to match *10 gravity...
			this.groundDistance = this.groundDistance || 1 // Get off the ground at least
		}
		// todo add this anim and get this state working?  also dance?
		// if(this._stateMachine._currentState != 'jump') {
		// 	this._stateMachine.setState('jump')
		// } 
		if(this.isSelf) {
			this.babs.socketSys.send({
				move: {
					movestate: Controller.MOVESTATE.Jump,
					a: 0,
					b: 0,
				}
			})
		}
	}

	gPrevDestination // aka origin
	update(dt) {

		if (!this._stateMachine?._currentState) {
			return
		}

		// Handle if frames dropped / tabout return / etc; if not close enough to destination,
		//   warp them to the previous position so they'll be able to reach it during next updates.
		// const eDest = gVector3.clone().multiplyScalar(4).addScalar(4/2)
		// const eDiff = eDest.clone().sub(this.target.position) // Distance from CENTER
		// const farAway = Math.abs(eDiff.x) > 2 *4 || Math.abs(eDiff.z) > 2 *4
		// if(farAway) {
		// 	const eWarpTarget = this.gDestination.clone().multiplyScalar(4).addScalar(4/2)
		// 	log('warping', eDiff.z, eWarpTarget.z, this.target)
		// 	this.target.position.copy(eWarpTarget)
		// }
		/*
		This sort of worked in setDestination (awkwardly), but still doesn't fix when you tab back in after they stopped moving; 
		since it's not receiving calls here, it doesn't warp.  Warp into update and save last position?
		What if instead of setting destinations, I set current+direction?  Because that's what's really happening.
		I mean, destination really just is current+direction.  You could get current by negating dest direction.
		That's hard to reason about, though.
		Anyway, overall I need to either: 
		  1) When dt doesn't work, manually make things skip forward.  Relies on measurement to detect large dt.
		  2) or Make all updates absolute rather than relative.  Seems best.
		  3) Manually detect a tab-in and do manually catch up (warp etc).  Seems buggy, not load compatible.
		#2 is the proper way.  In this case, what we'd want is...
		Right now it gets dest, determines direction from that, normalizes to 1, then moves one.
		We could say, if you're more than 1 away from dest (#1 measurement), then warp you to one away.
		Or, set dest, and raise velocity to reach it - but causes velocity problems.
		Or, take dest and reverse it to ...but that still requires determineing >1 (#1).
		So how about we call movement a special (messed up lol) case and do #1.  But do it in update with an oldDest.

		// doing this below during velocity sets 

		*/



		this._stateMachine.update(dt)

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
		// Women runners do about 10 ft/s over 4 mi, so should be made to do 1ft/100ms, 4ft/400ms

		const velocity = this.velocity

		const frameDecceleration = new Vector3(
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
			const eDiff = eDest.clone().sub(controlObject.position) // Distance from CENTER

			// Far away due to frame drops (tab-in/out etc)
			const zFar = Math.abs(this.gPrevDestination?.z -this.gDestination.z) > 2
			const xFar = Math.abs(this.gPrevDestination?.x -this.gDestination.x) > 2
			if(zFar) {
				velocity.z = 0
				controlObject.position.setZ(eDest.z)
			}
			if(xFar) {
				velocity.x = 0
				controlObject.position.setX(eDest.x)
			}
			if(!xFar && !zFar) {

				if (Math.abs(eDiff.z) < 1) {
					// If within tile, center it.  If far away (back from tabout), also warp and center.
					velocity.z = 0
					controlObject.position.setZ(eDest.z)
				}
				else if (eDiff.z > 0) {
					// log.info('Controller: update(), addZ based on', eDiff)
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
					// log.info('Controller: update(), addX based on', eDiff)
					velocity.x += acc.x * dt
				}
				else if (eDiff.x < 0) {
					velocity.x -= acc.x * dt
				}

			}
			
			this.hover = 0
			if(Math.round(velocity.z) == 0 && Math.round(velocity.x) == 0) {
				if(this._stateMachine._currentState != 'idle') {
					this._stateMachine.setState('idle')

					const wobAtDest = WobAtPosition(this.babs.ents, this.gDestination.x, this.gDestination.z)
					if(wobAtDest?.name == 'hot spring') {
						this.hover = -3
					}
					if(wobAtDest?.name == 'flat rock') {
						this.hover = 0.8
					}
					if(wobAtDest?.name == 'ladder') {
						this.hover = 7
					}
				}
			}

		}

		if(this.groundDistance == 0) {
			velocity.y = 0
		} 
		else {
			const gravityFtS = 32 *10 // Why does it feel off without *10?

			if(!this.selfZoningWait) { // No gravity while walking between zones waiting for zonein
				velocity.y -= gravityFtS*dt
			}
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

		const forward = new Vector3(1, 1, 1)
		// What if I change forward to include distance to destination, rather than just toward it?
		// Hard, because velocity is used for movement.
		// Another simpler approach is, if they're more than 1 block away from destination 
		//   (due to frames skipped from tabbing out), snap them there.
		// Hmm I probably need something generally, where if dt is large, stuff gets skipped.
		// In this case though, network sent a ton of setDestination, it's just only the last one is being run.
		// dt isn't necessarily very large, could just have missed 1 frame; can't easily detect with dt.
		// Could detect by multiple setDestinations stacking up.  
		// Perhaps let them queue then pop, (but that breaks InputSys many-sets?)
		// Well if setD is run many times before an update, update should warp to 2nd latest then velocity move?
		// (this is kind of a problem of, multiple inputs between single frame; not handling dt correctly)
		// Like, shouldn't dt take care of this?  
		// The reason it doesn't is dt is used for velocity, so it's relative :/ Also then forward normalized.
		// So without changing THAT, we need a way to know to warp.
		// Perhaps when destination is more than one away.  Should work up to like half server framerate tiles/sec?
		// So let's see how far we are from desintation.



		// Sideeways needs doing for strafe
		// const sideways = new THREE.Vector3(1, 0, 0)
		// sideways.applyQuaternion(this.idealTargetQuaternion)
		// sideways.normalize()

		// sideways.multiplyScalar(velocity.x * dt)
		// forward.multiplyScalar(velocity.z * dt)
		forward.multiply(velocity.clone().multiplyScalar(dt))

		controlObject.position.add(forward)
		// controlObject.position.add(sideways)

		// controlObject.position.clamp(
		// 	WorldSys.ZoneTerrainMin,
		// 	WorldSys.ZoneTerrainMax,
		// )

		if (this._mixer) {
			this._mixer.update(dt)
		}

		// Ground stickiness/gravity
		// Setup
		// const zone = this.target.zone
		const ground = this.isSelf ? this.babs.worldSys.currentGround : null // zonetodo this null!

		// Note that raycaster uses global coords

		// const playerWorldPos = ground.localToWorld(controlObject.position)
		this.raycaster.ray.origin.copy(controlObject.position)
		this.raycaster.ray.origin.setY(WorldSys.ZoneTerrainMax.y) // Use min from below?  No, backfaces not set to intersect!
		
		if(ground && this.raycaster) {
			const groundIntersect = this.raycaster.intersectObject(ground, false)
			const worldGroundHeight = groundIntersect?.[0]?.point

			if(worldGroundHeight?.y > controlObject?.position?.y || this.hover) {
				// Keep above ground
				this.groundDistance = true

				controlObject.position.setY(worldGroundHeight.y +this.hover)
				// const playerLocalPos = controlObject.position.clone()
				// const playerGlobalPos = ground.localToWorld(playerLocalPos)
				// const oldy = playerWorldPos.y
				// playerWorldPos.setY(worldGroundHeight.y +this.hover)
				// const updatedPlayerLocal = ground.worldToLocal(playerWorldPos)
				// controlObject.position.copy(updatedPlayerLocal)

				// Wait...the local and the world Y are the same, LOL!  Only x/z are not.

				// If on ground, y velocity stops // ?
				// if(!isSelf) {
					
				// }
			}
			if(!groundIntersect.length) {
				velocity.y = 6 // Makes you float upward because floating up is more fun than falling down :)
			}
			else {
				this.groundDistance = controlObject.position.y - worldGroundHeight.y // Used for jump
			}
		}
		
		if(this.headRotationX) {
			// this.modelHead ||= this.target.getObjectByName( 'Head_M' )
			// this.modelHead.setRotationFromAxisAngle(new Vector3(0,-1,0), this.headRotationX/2) // Broken with gltf for some reason?
			this.modelNeck ||= this.target.getObjectByName( 'Neck_M' )
			this.modelNeck.setRotationFromAxisAngle(new Vector3(0,-1,0), this.headRotationX*0.75)
		}


		if(!this.gPrevDestination?.equals(this.gDestination)) {
			this.gPrevDestination = this.gDestination.clone() // Save previous destination (if it's not the same)
		}

		
	}

	zoneIn(player :Player, zone :Zone) {
		log('zonein', player.id, zone.id, this.babs.worldSys.currentGround, zone.ground)
		log('this.gDestination', this.gDestination)

		const yardCoord = YardCoord.Create({x: this.gDestination.x, z: this.gDestination.z, zone})
		const engCoord = zone.calcHeightAt(yardCoord)

		// this.target.position.y = engCoord.y

		if(this.isSelf) { // Self
			this.babs.worldSys.currentGround = zone.ground

			// Everything was already shifted around us locally, when we gDestination across the line!
			this.selfZoningWait = false

			this.target.position.setY(8362) // works since it will pop up back up to the ground
		}
		else { // Others
			// Translate other players to a new zone

			// player.controller.target
			// this.target.position.add(new Vector3(1000, 0, 0))

			
		}


	}

}


class FiniteStateMachine {
	_states
	_currentState
	constructor() {
		this._states = {}
		this._currentState = null
	}

	addState(name, type) {
		this._states[name] = type
	}

	setState(name) {
		const prevState = this._currentState

		if (prevState) {
			if (prevState.name == name) {
				return
			}
			prevState.exit()
		}

		const state = new this._states[name](this)

		this._currentState = state
		state.enter(prevState)
	}

	update(timeElapsed) {
		if (this._currentState) {
			this._currentState.update(timeElapsed)
		}
	}
}


class CharacterFSM extends FiniteStateMachine {
	_proxy
	constructor(proxy) {
		super()
		this._proxy = proxy

		this.addState('idle', IdleState)
		this.addState('run', RunState)
		this.addState('backward', BackwardState)
		this.addState('walk', WalkState)
		this.addState('jump', JumpState)
		this.addState('dance', DanceState)
	}

}

