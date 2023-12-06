import { log } from '@/Utils'
import { MathUtils, Quaternion, Raycaster, Scene, Vector3, AnimationMixer, Matrix4, Object3D } from 'three'
import { Comp } from '@/comp/Comp'
import { WorldSys } from '@/sys/WorldSys'
import { DanceState, RunState, BackwardState, WalkState, IdleState, JumpState, State, CharacterFSM } from './ControllerState'
import { Zone } from '@/ent/Zone'
import { YardCoord } from './Coord'
import { Player } from '@/ent/Player'
import type { Babs } from '@/Babs'
import type { PlayerArrive } from '@/shared/consts'
import { Wob, type FeObject3D } from '@/ent/Wob'
import type { SharedWob } from '@/shared/SharedWob'
import { LoaderSys } from '@/sys/LoaderSys'

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

	static Create(arrival :PlayerArrive, babs :Babs, playerRig :FeObject3D) {
		return new Controller(arrival, babs).init(arrival, playerRig)
	}

	raycaster :Raycaster
	gDestination :Vector3
	hover = 0
	groundDistance = 0
	isSelf :boolean = false

	playerRig :FeObject3D

	arrival :PlayerArrive
	// vTerrainMin = new Vector3(0, 0, 0)
	// vTerrainMax = new Vector3(1000,10_000,1000)
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


	async init(arrival :PlayerArrive, playerRig :Object3D) {
		log.info('Controller.init()', arrival)
		this.arrival = arrival
		this.isSelf = this.idEnt === this.babs.idSelf

		this.playerRig = playerRig
		this.playerRig.zone = this.babs.ents.get(this.arrival.idzone) as Zone

		// log.info('controller got', this.arrival.idzone, this.playerRig.zone)

		this._stateMachine = new CharacterFSM(
			new BasicCharacterControllerProxy(this._animations)
		)

		this.idealTargetQuaternion = this.playerRig.quaternion.clone()

		this._mixer = new AnimationMixer(this.playerRig)
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
		this.playerRig.visible = true

		// Raycast for ground snapping
		this.raycaster = new Raycaster( new Vector3(), new Vector3( 0, -1, 0 ), 0, WorldSys.ZoneTerrainMax.y *2 )

		// Set position warped
		log.info('controller init done, warp player to', this.arrival.x, this.arrival.z, this.playerRig)
		this.gDestination = new Vector3(this.arrival.x, 0, this.arrival.z)
		this.playerRig.position.copy(this.gDestination.clone().multiplyScalar(4).addScalar(4/2))
		this.playerRig.position.add(this.playerRig.zone.ground.position)

		// Set rotation
		const degrees = Controller.ROTATION_ANGLE_MAP[this.arrival.r] -45 // Why -45?  Who knows! :p
		const quat = new Quaternion()
		quat.setFromAxisAngle(new Vector3(0,1,0), MathUtils.degToRad(degrees))
		this.setRotation(quat)

		return this
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

	selfWaitZoningExitZone :Zone
	setDestination(gDestVector3, movestate) {
		// This takes a grid destination, which we'll be moved toward in update()
		if(gDestVector3.equals(this.gDestination)) return // Do not process if unchanged

		const gDestOld = this.gDestination.clone()
		this.gDestination = gDestVector3.clone()
		// log.info('setDestination changing', this.gDestination, movestate, this.isSelf)
		
		const isOutsideOfZone = gDestVector3.x < 0 || gDestVector3.z < 0 ||
		gDestVector3.x > 249 || gDestVector3.z > 249

		// const player = this.babs.ents.get(this.idEnt)
		if(this.isSelf) {
			const movestateSend = Object.entries(Controller.MOVESTATE).find(([str, num]) => str.toLowerCase() === movestate)[1]

			let enterzone_id :number = undefined
			if(isOutsideOfZone){

				const targetYardCoord = YardCoord.Create({
					...this.gDestination, 
					zone: this.babs.worldSys.currentGround.zone,
				})
				// console.log('targetYardCoord.zone', targetYardCoord.zone)

				const nextZoneExists = targetYardCoord.zone // I can stop us from running off the edge here!
				if(this.selfWaitZoningExitZone || !nextZoneExists) { // TODO 
					// Do not initiate shift/zoning while already zoning.
					// Do not even update this.gDestination; reset it to to old.
					this.gDestination = gDestOld
					this._stateMachine.setState('idle')
					return 
				}

				// Zone exists, let's go there!

				enterzone_id = targetYardCoord.zone.id

				this.gDestination.x = targetYardCoord.x
				this.gDestination.z = targetYardCoord.z

				const zonecurrent = this.playerRig.zone
				const zonetarget = targetYardCoord.zone
				const zoneDiff = new Vector3(zonetarget.x -zonecurrent.x, 0, zonetarget.z -zonecurrent.z)

				log('Initiating Zoning', zonecurrent.id, '->', zonetarget.id)

				this.selfWaitZoningExitZone = zonecurrent
				this.playerRig.zone = zonetarget
				this.babs.worldSys.currentGround = zonetarget.ground
				log.info('setDestination', this.playerRig, this.babs.worldSys.currentGround)

				this.babs.worldSys.shiftEverything(-zoneDiff.x *1000, -zoneDiff.z *1000)

				// this.playerRig.updateMatrixWorld(true)
				// this.playerRig.updateMatrix()

				// zonetarget.geometry.computeBoundingSphere()
				// zonetarget.ground.updateMatrixWorld(true)
				// zonetarget.ground.updateMatrix()
				
				// Seems this is all that's necessary for zoning:
				zonecurrent.geometry.computeBoundingSphere()
				zonecurrent.ground.updateMatrixWorld(true)
				zonecurrent.ground.updateMatrix()
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

		
		this.run = movestate === 'run'
		this._stateMachine.setState(movestate)
	}

	setRotation(_R) {
		this.idealTargetQuaternion = _R

		// Need to immediately update this because Input will call setRotation and then immediately check this.playerRig.matrix for choosing direction vector!
		this.playerRig.quaternion.copy(this.idealTargetQuaternion)

		// What if when I turn, I have it snap me to grid center?
		// That would avoid being off-center when turning during movement
		const gCurrentPosition = this.playerRig.position.clone().multiplyScalar(1/4).floor()
		const eCurrentPosition = gCurrentPosition.clone().multiplyScalar(4).addScalar(2)
		eCurrentPosition.setY(this.playerRig.position.y)
		this.playerRig.position.copy(eCurrentPosition)
		
		// Now, let's translate velocity instead of zeroing it out, so they continue moving the same speed, but in the new direction.
		let tempMatrix = new Matrix4().makeRotationFromQuaternion(this.idealTargetQuaternion)
		let vector = new Vector3().setFromMatrixColumn( tempMatrix, 0 )  // get X column of matrix
		vector.negate()
		vector.crossVectors( this.playerRig.up, vector )
		vector.round()

		const topVelocity = Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.z))
		vector.multiplyScalar(topVelocity)
		vector.setY(this.velocity.y)
		this.velocity.copy(vector)

		if(this.isSelf) {
			// Send turn amount to other players

			// const euler = new Euler().setFromQuaternion(this.playerRig.quaternion)
			// const vector = euler.toVector3()
			// function radiansToDegrees(radians){
			// 	return radians * 180 / Math.PI
			// }
			// const angle = radiansToDegrees(Math.atan2(vector.z, vector.x))

			// const radians = rotation.y > 0 ? rotation.y : (2 * Math.PI) + rotation.y
			// const degrees = MathUtils.radToDeg(radians)

			// var dir = new Vector3(-this.playerRig.position.x, 0, -this.playerRig.position.z).normalize()
			
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
		// this.playerRig.quaternion.slerp(this.idealTargetQuaternion, dt)
		this.playerRig.quaternion.copy(this.idealTargetQuaternion)

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
			acc.multiplyScalar(12.0)
		}

		// Move toward destination
		// This just gets a destination in engine coords (but assumes gdest is in-zone!):
		let eDest = this.gDestination.clone().multiplyScalar(4).addScalar(4/2)
		if(!this.isSelf) {
			eDest.add(this.playerRig.zone.ground.position)
		}

		// This gets the difference between the edest and the player's current position:
		const eDistance = eDest.clone().sub(this.playerRig.position) // Distance from CENTER

		// Destination is far away from current location, due to eg frame drops (tab-in/out etc)
		const zDeltaFar = Math.abs(this.gPrevDestination?.z -this.gDestination.z) > 2
		const xDeltaFar = Math.abs(this.gPrevDestination?.x -this.gDestination.x) > 2
		// console.log('FARRRRR', zDeltaFar, xDeltaFar)

		// Move velocity toward the distance delta.  
		const isFar = (zDeltaFar || xDeltaFar) && !this.selfWaitZoningExitZone
		if(isFar) {
			if(zDeltaFar) {
				this.velocity.z = 0
				this.playerRig.position.setZ(eDest.z)
			}
			if(xDeltaFar) {
				this.velocity.x = 0
				this.playerRig.position.setX(eDest.x)
			}
		}
		else { // Not far
			const zNearCenter = Math.abs(eDistance.z) < 1
			const zPositiveDistance = eDistance.z > 0
			const zNegativeDistance = eDistance.z < 0
			if (zNearCenter) {
				// But if there is little distance, just move player to center of square and set velocity 0.
				this.velocity.z = 0
				this.playerRig.position.setZ(eDest.z)
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
				this.playerRig.position.setX(eDest.x)
			}
			else if (xPositiveDistance) {
				this.velocity.x += acc.x * dt
			}
			else if (xNegativeDistance) {
				this.velocity.x -= acc.x * dt
			}
		}
		
		this.hover = 0
		const wobAtDest = this.playerRig.zone.getWob(this.gDestination.x, this.gDestination.z)
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
		// 	this.playerRig.position.setZ(eDest.z +platform.zOffsetFeet)
		// }

		if(this.groundDistance == 0 || Math.round(this.groundDistance -this.hover) == 0) {
			this.velocity.y = 0
		} 
		else {
			const gravityFtS = 32 *10 // Why does it feel off without *10?

			if(!this.selfWaitZoningExitZone) { // No gravity while walking between zones waiting for zonein
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

		// This modifies the playerRig position, adding in the velocity momentum.
		this.playerRig.position.add(forward)
		// this.playerRig.position.add(sideways)

		if (this._mixer) {
			this._mixer.update(dt) // Optimziation would be to prevent movement while they're away and/or hide characters.
		}

		this.setPlayerGroundY()
		
		if(this.headRotationX) {
			// this.modelHead ||= this.playerRig.getObjectByName( 'Head_M' )
			// this.modelHead.setRotationFromAxisAngle(new Vector3(0,-1,0), this.headRotationX/2) // Broken with gltf for some reason?
			this.modelNeck ||= this.playerRig.getObjectByName( 'Neck_M' )
			this.modelNeck.setRotationFromAxisAngle(new Vector3(0,-1,0), this.headRotationX*0.75)
		}


		if(!this.gPrevDestination?.equals(this.gDestination)) {
			this.gPrevDestination = this.gDestination.clone() // Save previous destination (if it's not the same)
		}
	}

	setPlayerGroundY() {
		const zone = this.playerRig?.zone // This gets set well before zoneIn(), so it's current (ie doesn't wait for network)

		if(zone){// && this.raycaster) {
			const yardCoord = YardCoord.Create(this.playerRig)
			const worldGroundHeight = zone.engineHeightAt(yardCoord)

			if(worldGroundHeight > this.playerRig.position.y || this.hover) {
				// Keep above ground
				this.groundDistance = 1
				this.playerRig.position.setY(worldGroundHeight +this.hover)
			}
			this.groundDistance = this.playerRig.position.y - worldGroundHeight // Used for jump
			return worldGroundHeight
		}
		return null
	}

	async zoneIn(player :Player, enterZone :Zone, exitZone :Zone|null) {
		// console.log('zonein()')
		log.info('zonein player zone', player.id, enterZone.id, )
		log.info('this.gDestination', this.gDestination)

		this.playerRig.zone = enterZone // This re-applies to self, but for others, this is the only place it's set

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
			// this.babs.worldSys.currentGround = enterZone.ground // Now happens before network

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

				// return [detailedWobsToAdd, farWobsToAdd]
				// These loads don't need to await for zonein to complete~!
				log.info('entered zones: detailed wobs to add', detailedWobsToAdd.length)
				await Wob.LoadInstancedWobs(detailedWobsToAdd, this.babs, false) // Then add real ones
				log.info('farwobs to add', farWobsToAdd.length)
				await Wob.LoadInstancedWobs(farWobsToAdd, this.babs, false, 'asFarWobs') // Far ones :p
				log.info('done adding LoadInstancedWobs')

				
				player.controller.selfWaitZoningExitZone = null

			}
			// const [detailedWobsToAdd, farWobsToAdd] = await pullWobsData()
			await pullWobsData()

		}
		else { // Others
			// Translate other players to a new zone

			
		}

	}

}

