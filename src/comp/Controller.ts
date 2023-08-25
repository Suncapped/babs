import { log } from '@/Utils'
import { MathUtils, Quaternion, Raycaster, Scene, Vector3, AnimationMixer, Matrix4, Object3D } from 'three'
import { Comp } from '@/comp/Comp'
import { WorldSys } from '@/sys/WorldSys'
import { DanceState, RunState, BackwardState, WalkState, IdleState, JumpState } from './ControllerState'
import { Zone } from '@/ent/Zone'
import { YardCoord } from './Coord'
import { Player } from '@/ent/Player'
import type { Babs } from '@/Babs'
import type { PlayerArrive } from '@/shared/consts'
import { Wob, type FeObject3D } from '@/ent/Wob'
import type { SharedWob } from '@/shared/SharedWob'
import { LoaderSys } from '@/sys/LoaderSys'

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

	constructor(arrival :PlayerArrive, babs :Babs) {
		super(arrival.id, Controller, babs)
	}

	static Create(arrival :PlayerArrive, babs :Babs, object3d :FeObject3D) {
		return new Controller(arrival, babs).init(arrival, object3d)
	}

	raycaster
	gDestination :Vector3
	hover = 0
	groundDistance = 0
	isSelf :boolean = false

	target :FeObject3D

	arrival :PlayerArrive
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


	async init(arrival :PlayerArrive, object3d :Object3D) {
		log.info('Controller.init()', arrival)
		this.arrival = arrival
		this.isSelf = this.idEnt === this.babs.idSelf

		this.target = object3d
		this.target.zone = this.babs.ents.get(this.arrival.idzone) as Zone

		// log.info('controller got', this.arrival.idzone, this.target.zone)

		this._stateMachine = new CharacterFSM(
			new BasicCharacterControllerProxy(this._animations)
		)

		this.idealTargetQuaternion = this.target.quaternion.clone()

		this._mixer = new AnimationMixer(this.target)
		const animList = LoaderSys.KidAnimList
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
		this.target.position.add(this.target.zone.ground.position)

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
		log.info('setDestination changed', this.gDestination, movestate, this.isSelf)
		this.run = movestate === 'run'
		this._stateMachine.setState(movestate)
		


		// const player = this.babs.ents.get(this.idEnt)
		if(this.isSelf) {
			const movestateSend = Object.entries(Controller.MOVESTATE).find(([str, num]) => str.toLowerCase() === movestate)[1]
			
			// New destination!
			// As soon as dest is next square (for the first time), send ENTERZONE

			const targetYardCoord = YardCoord.Create({
				...this.gDestination, 
				zone: this.babs.worldSys.currentGround.zone,
			})

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
				move: { // This counts as a 'zonein' on the server when enterzone_id is included
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

	jump(height :number) {
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
		this._stateMachine.update(dt)

		// overview: Figure out the direction of dest, accumulate velocity in that direction, then move player at velocity.  Then handle Y (height)

		// First handle rotations
		// Note that rotation does not dictate movement direction.  Only this.gDestination does.
		// this._currentPosition.lerp(idealOffset, t)
		// this._currentLookat.lerp(idealLookat, t)
		// this._camera.position.copy(this._currentPosition)
		// this._camera.lookAt(this._currentLookat)
		// this.target.quaternion.slerp(this.idealTargetQuaternion, dt)
		this.target.quaternion.copy(this.idealTargetQuaternion)

		// Now movement physics
		// Women runners do about 10 ft/s over 4 mi, so should be made to do 1ft/100ms, 4ft/400ms

		const frameDecceleration = new Vector3(
			this.velocity.x * this._decceleration.x,
			0,
			this.velocity.z * this._decceleration.z
		)
		frameDecceleration.multiplyScalar(dt)
		frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(Math.abs(frameDecceleration.z), Math.abs(this.velocity.z))
		frameDecceleration.x = Math.sign(frameDecceleration.x) * Math.min(Math.abs(frameDecceleration.x), Math.abs(this.velocity.x))

		this.velocity.add(frameDecceleration)

		const acc = this.acceleration.clone()
		if (this.run) {
			acc.multiplyScalar(2.0)
		}

		// Move toward destination
		// This just gets a destination in engine coords (but assumes gdest is in-zone!):
		let eDest = this.gDestination.clone().multiplyScalar(4).addScalar(4/2)
		if(!this.isSelf) {
			eDest.add(this.target.zone.ground.position)
		}

		// This gets the difference between the edest and the player's current position:
		const eDistance = eDest.clone().sub(this.target.position) // Distance from CENTER

		// Destination is far away from current location, due to eg frame drops (tab-in/out etc)
		const zDeltaFar = Math.abs(this.gPrevDestination?.z -this.gDestination.z) > 2
		const xDeltaFar = Math.abs(this.gPrevDestination?.x -this.gDestination.x) > 2

		// Move velocity toward the distance delta.  
		const isFar = (zDeltaFar || xDeltaFar)
		if(isFar) {
			if(zDeltaFar) {
				this.velocity.z = 0
				this.target.position.setZ(eDest.z)
			}
			if(xDeltaFar) {
				this.velocity.x = 0
				this.target.position.setX(eDest.x)
			}
		}
		else { // Not far
			const zNearCenter = Math.abs(eDistance.z) < 1
			const zPositiveDistance = eDistance.z > 0
			const zNegativeDistance = eDistance.z < 0
			if (zNearCenter) {
				// But if there is little distance, just move player to center of square and set velocity 0.
				this.velocity.z = 0
				this.target.position.setZ(eDest.z)
			}
			else if (zPositiveDistance) {
				this.velocity.z += acc.z * dt
			}
			else if (zNegativeDistance) {
				this.velocity.z -= acc.z * dt
			}

			const xNearCenter = Math.abs(eDistance.x) < 1
			const xPositiveDistance = eDistance.x > 0
			const xNegativeDistance = eDistance.x < 0
			if (xNearCenter) {
				// But if there is little distance, just move player to center of square and set velocity 0.
				this.velocity.x = 0
				this.target.position.setX(eDest.x)
			}
			else if (xPositiveDistance) {
				this.velocity.x += acc.x * dt
			}
			else if (xNegativeDistance) {
				this.velocity.x -= acc.x * dt
			}
		}
		
		this.hover = 0
		const wobAtDest = this.target.zone.getWob(this.gDestination.x, this.gDestination.z)
		const platform = wobAtDest?.comps?.platform
		if(platform) {
			this.hover = platform.yOffsetFeet
		}

		const isNoVelocity = Math.round(this.velocity.z) == 0 && Math.round(this.velocity.x) == 0
		if(isNoVelocity) {
			if(this._stateMachine._currentState != 'idle') {
				this._stateMachine.setState('idle')
			}
		}

		// if(platform) {  // Buggy; starts to accellerate next frame I think, so shivers, especially on afk
		// 	this.velocity.z = 0
		// 	this.target.position.setZ(eDest.z +platform.zOffsetFeet)
		// }

		if(this.groundDistance == 0 || Math.round(this.groundDistance -this.hover) == 0) {
			this.velocity.y = 0
		} 
		else {
			const gravityFtS = 32 *10 // Why does it feel off without *10?

			if(!this.selfZoningWait) { // No gravity while walking between zones waiting for zonein
				this.velocity.y -= gravityFtS*dt
			}
		}

		const forward = new Vector3(1, 1, 1)

		// Sideeways needs doing for strafe
		// const sideways = new THREE.Vector3(1, 0, 0)
		// sideways.applyQuaternion(this.idealTargetQuaternion)
		// sideways.normalize()
		// sideways.multiplyScalar(velocity.x * dt)
		// forward.multiplyScalar(velocity.z * dt)
		
		// This just creates a velocity vector (forward left in for sideways movement)
		forward.multiply(this.velocity.clone().multiplyScalar(dt))

		// This modifies the target position, adding in the velocity momentum.
		this.target.position.add(forward)
		// this.target.position.add(sideways)

		if (this._mixer) {
			this._mixer.update(dt)
		}

		// Ground stickiness/gravity
		// Setup
		// const zone = this.target.zone
		// log('this.target', this.target)
		const ground = this.isSelf ? this.babs.worldSys.currentGround : this.target.zone.ground // zonetodo this null!

		// Note that raycaster uses global coords

		// const playerWorldPos = ground.localToWorld(this.target.position)
		this.raycaster.ray.origin.copy(this.target.position)
		this.raycaster.ray.origin.setY(WorldSys.ZoneTerrainMax.y) // Use min from below?  No, backfaces not set to intersect!
		
		if(ground && this.raycaster) {
			const groundIntersect = this.raycaster.intersectObject(ground, false)
			const worldGroundHeight = groundIntersect?.[0]?.point

			if(worldGroundHeight && (worldGroundHeight.y > this.target?.position?.y || this.hover)) {
				// Keep above ground
				this.groundDistance = 1

				this.target.position.setY(worldGroundHeight.y +this.hover)
				// const playerLocalPos = this.target.position.clone()
				// const playerGlobalPos = ground.localToWorld(playerLocalPos)
				// const oldy = playerWorldPos.y
				// playerWorldPos.setY(worldGroundHeight.y +this.hover)
				// const updatedPlayerLocal = ground.worldToLocal(playerWorldPos)
				// this.target.position.copy(updatedPlayerLocal)

				// Wait...the local and the world Y are the same, LOL!  Only x/z are not.

				// If on ground, y velocity stops // ?
				// if(!isSelf) {
					
				// }
			}
			if(!groundIntersect.length) {
				this.velocity.y = 6 // Makes you float upward because floating up is more fun than falling down :)
			}
			else {
				this.groundDistance = this.target.position.y - worldGroundHeight.y // Used for jump
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

	async zoneIn(player :Player, enterZone :Zone, exitZone :Zone|null) {
		log.info('zonein player zone', player.id, enterZone.id, )
		log.info('this.gDestination', this.gDestination)

		this.target.position.setY(0) // works since it will pop up back up to the ground
		this.target.zone = enterZone

		// Calculate the zones we're exiting and the zones we're entering
		const oldZonesNear = exitZone?.getZonesAround(Zone.loadedZones, 1) || [] // You're not always exiting a zone (eg on initial load)
		const newZonesNear = enterZone.getZonesAround(Zone.loadedZones, 1)
		const removedZonesNearby = oldZonesNear.filter(zone => !newZonesNear.includes(zone))
		const addedZonesNearby = newZonesNear.filter(zone => !oldZonesNear.includes(zone))

		const oldZonesFar = exitZone?.getZonesAround(Zone.loadedZones, 22) || []
		const newZonesFar = enterZone.getZonesAround(Zone.loadedZones, 22)
		const removedZonesFar = oldZonesFar.filter(zone => !newZonesFar.includes(zone))
		const addedZonesFar = newZonesFar.filter(zone => !oldZonesFar.includes(zone))

		// console.log('addedZonesFar', Zone.loadedZones, addedZonesFar.map(z => z.id).sort((a,b) => a-b), addedZonesNearby.map(z => z.id).sort((a,b) => a-b))

		log.info('zonediff', removedZonesNearby, addedZonesNearby, removedZonesFar, addedZonesFar)

		if(this.isSelf) {
			this.babs.worldSys.currentGround = enterZone.ground



			for(const removedZone of removedZonesNearby) {
				const removedFwobs = removedZone.getSharedWobsBasedOnLocations()
				log.info('exited zone: detailed wobs to remove', removedZone.id, removedFwobs.length)
				for(const zoneFwob of removedFwobs) { // First remove existing detailed graphics
					removedZone.removeWobGraphic(zoneFwob)
				}
				removedZone.coordToInstanceIndex = {} // In future, need similar for farCoordToInstanceIndex?
			}
			
			// Pull detailed wobs for entered zones, so we can load them.  
			// This could later be moved to preload on approaching zone border, rathern than during zonein.

			const pullWobsData = async () => {
				let detailedWobsToAdd :SharedWob[] = []
				let farWobsToAdd :SharedWob[] = []

				// Here we actually fetch() the near wobs, but the far wobs have been prefetched (dekazones etc)

				const fetches = []
				for(let zone of addedZonesNearby) {
					zone.locationData = fetch(`${this.babs.urlFiles}/zone/${zone.id}/locations.bin`)
					fetches.push(zone.locationData)
				}

				await Promise.all(fetches)

				for(let zone of addedZonesNearby) {
					const fet4 = await zone.locationData
					const data4 = await fet4.blob()
					if (data4.size == 2) {  // hax on size (for `{}`)
						zone.locationData = new Uint8Array()
					}
					else {
						const buff4 = await data4.arrayBuffer()
						zone.locationData = new Uint8Array(buff4)
					}
				}

				for(let zone of addedZonesNearby) {
					const fWobs = zone.applyLocationsToGrid(zone.locationData, true)
					detailedWobsToAdd.push(...fWobs)
				}

				// Far wobs, using prefetched data
				await LoaderSys.CachedDekafarwobsFiles // Make sure prefetch is finished!
				for(let zone of addedZonesFar) {
					// Data was prefetched, so just access it in zone.farLocationData
					const fWobs = zone.applyLocationsToGrid(zone.farLocationData, true, 'doNotApplyActually')
					farWobsToAdd.push(...fWobs)
				}

				return [detailedWobsToAdd, farWobsToAdd]

			}
			// console.time('LoadingTiming')
			const [detailedWobsToAdd, farWobsToAdd] = await pullWobsData()
			// console.timeLog('LoadingTiming')

			// const zoneFwobs = addedZone.getSharedWobsBasedOnLocations() // This is how to get wobs if doing separately from load above.
			log.info('entered zones: detailed wobs to add', detailedWobsToAdd.length)
			await Wob.LoadInstancedWobs(detailedWobsToAdd, this.babs, false) // Then add real ones


			// console.timeLog('LoadingTiming')
			
			log.info('farwobs to add', farWobsToAdd.length)
			await Wob.LoadInstancedWobs(farWobsToAdd, this.babs, false, 'asFarWobs') // Far ones :p


			// console.timeEnd('LoadingTiming')
			
			// Everything was already shifted around us locally, when we gDestination across the line!
			this.selfZoningWait = false

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

