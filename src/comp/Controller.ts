
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
import { ZONE } from '@/shared/SharedZone'

class BasicCharacterControllerProxy {
	_animations
	constructor(animations) {
		this._animations = animations
	}

	get animations() {
		return this._animations
	}
}

export type MovestateNames = keyof typeof Controller.MovestateNameId

export class Controller extends Comp {
	static MovestateNameId = {
		idle: 0,
		run: 1,
		walk: 2,
		jump: 3,
		dodge: 4,
		rotate: 5,
		emote: 6,
	}
	static MovestateIdName = Object.entries(Controller.MovestateNameId).reduce((acc, [name, id]) => {
		acc[id] = name
		return acc
	})
	static JUMP_HEIGHT = 3
	static ROTATION_ANGLE_MAP = { // For controller, not wobs!
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
	selfFollowTargetId :number

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
		console.debug('Controller.init()', arrival)
		this.arrival = arrival
		this.isSelf = this.idEnt === this.babs.idSelf

		this.playerRig = playerRig
		this.playerRig.zone = this.babs.ents.get(this.arrival.idzone) as Zone

		// console.debug('controller got', this.arrival.idzone, this.playerRig.zone)

		this._stateMachine = new CharacterFSM(
			new BasicCharacterControllerProxy(this._animations)
		)

		this.idealTargetQuaternion = this.playerRig.quaternion.clone()

		this._mixer = new AnimationMixer(this.playerRig)
		const animList = LoaderSys.KidAnimList
		await Promise.all(animList.map(async animName => {
			const anim = await this.babs.loaderSys.loadAnim(this.arrival.char.gender, animName)
			// console.log('controller init anim', animName, anim.animations)
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
		console.debug('controller init done, warp player to', this.arrival.x, this.arrival.z, this.playerRig)
		this.gDestination = new Vector3(this.arrival.x, 0, this.arrival.z)
		this.playerRig.position.copy(this.gDestination.clone().multiplyScalar(4).addScalar(4/2))

		// if(!this.isSelf) { // Todo shiftiness, reinstate this conditional once we move to relative zones :)
		this.playerRig.position.add(this.playerRig.zone.ground.position)
		// }

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
		// console.log(this.modelHead.rotation)
	}

	getHeadRotationX() {
		return this.headRotationX
	}

	selfWaitZoningExitZone :Zone
	setDestination(gDestVector3 :Vector3, movestateName :MovestateNames) {
		// This takes a grid destination, which we'll be moved toward in update()
		if(gDestVector3.equals(this.gDestination)) return // Do not process if unchanged

		const isOutsideOfZone = gDestVector3.x < 0 || gDestVector3.z < 0 || gDestVector3.x > WorldSys.ZONE_MOVEMENT_EXTENT || gDestVector3.z > WorldSys.ZONE_MOVEMENT_EXTENT

		// if(!isOutsideOfZone) {
			// Update color based on footsteps
			// Note; this actually fails at zone border, something about it setting before zoning happens; it sets on old zone, not new one.  But it doesn't really matter, as long as the incoming server footsteps data is set correct (no idea hehe)
			const player = this.babs.ents.get(this.idEnt as number) as Player
			const zone = player.controller.playerRig.zone
			// Get existing plot count for this point and add to it
			const xPlotOld = Math.floor((this.gDestination.x *WorldSys.Yard) /WorldSys.ZONE_DATUM_SIZE)
			const zPlotOld = Math.floor((this.gDestination.z *WorldSys.Yard) /WorldSys.ZONE_DATUM_SIZE)
			const xPlotNew = Math.floor((gDestVector3.x *WorldSys.Yard) /WorldSys.ZONE_DATUM_SIZE)
			const zPlotNew = Math.floor((gDestVector3.z *WorldSys.Yard) /WorldSys.ZONE_DATUM_SIZE)
			if(xPlotOld !== xPlotNew || zPlotOld !== zPlotNew) {
				// console.log('plot updating', xPlotOld, zPlotOld, xPlotNew, zPlotNew)
				const plotcounts :Record<string, number> = {
					[`${xPlotNew},${zPlotNew}`]: (zone.plotcountsSaved[`${xPlotNew},${zPlotNew}`] || 0) +1,
				}
				zone.colorFootsteps(plotcounts)
				// console.log('controller coloring footsteps', plotcounts)
			}
		// }

		this.babs.renderSys.calcPositionChanged = true

		const gDestOld = this.gDestination.clone()
		this.gDestination = gDestVector3.clone()
		// console.debug('setDestination changing', this.gDestination, movestate, this.isSelf)

		// const player = this.babs.ents.get(this.idEnt)
		if(this.isSelf) {
			const targetYardCoord = YardCoord.Create({
				...this.gDestination, 
				zone: this.babs.worldSys.currentGround.zone,
			})

			// Determine if player has the stamina to enter the wob if one is there
			const wobAtDest = this.playerRig.zone.getWob(targetYardCoord.x, targetYardCoord.z)
			
			const obstructiveStamRequired = wobAtDest?.bluests?.obstructive?.staminaToPass
			if(obstructiveStamRequired) {
				// console.log(obstructiveStamRequired)
				const playerStamina = 10 // todo
				const hasEnoughStamina = playerStamina >= obstructiveStamRequired
				if(!hasEnoughStamina) {
					// // Stop movement, similar to zoning below
					// this.gDestination = gDestOld
					// this._stateMachine.setState('idle')
					// return 

					// Instead, let's just slow them down
					// const slowDown = 0.1
					this.velocity.x = 0
					this.velocity.z = 0
				}
			}

			// Determine if it's edible, and if so, 'use' it automatically
			const edible = wobAtDest?.bluests?.edible
			const isMovingFast = this.babs.inputSys.runmult > 1 // Only eat if not already boosted
			if(edible && !isMovingFast) {
				// console.log('edible', edible)
				// this.babs.uiSys.aboveHeadChat(player.id, `~ you ate ${wobAtDest.blueprint_id} ~`)
				this.babs.socketSys.send({
					action: {
						verb: 'used',
						noun: wobAtDest.idObj(),
					}
				})
			}

			let enterzone_id :number = undefined
			if(isOutsideOfZone){
				// console.log('targetYardCoord.zone', targetYardCoord.zone)
				const nextZoneExists = targetYardCoord.zone // I can stop us from running off the edge here!
				if(this.selfWaitZoningExitZone || !nextZoneExists) {
					// Do not initiate shift/zoning while already zoning.
					// Do not even update this.gDestination; reset it to to old.
					this.gDestination = gDestOld
					this._stateMachine.setState('idle')
					return 
				}

				// Zone exists, let's go there!
				this.gDestination.x = targetYardCoord.x
				this.gDestination.z = targetYardCoord.z

				const exitZone = this.playerRig.zone
				const enterZone = targetYardCoord.zone
				enterzone_id = enterZone.id
				const vZoneDiff = new Vector3(enterZone.x -exitZone.x, 0, enterZone.z -exitZone.z)

				const oldZonesNear = exitZone?.getZonesAround(Zone.loadedZones, 1) || [] // You're not always exiting a zone (eg on initial load)
				const newZonesNear = enterZone.getZonesAround(Zone.loadedZones, 1)
				const removedZonesNearby = oldZonesNear.filter(zn => !newZonesNear.includes(zn))
				const addedZonesNearby = newZonesNear.filter(zn => !oldZonesNear.includes(zn))

				console.log(`Zoning ${exitZone.id} (${exitZone.x},${exitZone.z}) -> ${enterZone.id} (${enterZone.x},${enterZone.z})`)

				this.selfWaitZoningExitZone = exitZone
				this.playerRig.zone = enterZone
				this.babs.worldSys.currentGround = enterZone.ground
				console.debug('setDestination', this.playerRig, this.babs.worldSys.currentGround)

				// 1. Player has been moved.  1b. Remove wobs from exit zones.  2. **Shift all existing wobs relative to delta.**  3. ShiftEverything().  4. Then load new wobs (network return), which will load relative.

				// Remove and decrease count for exiting zones
				for(const removedZone of removedZonesNearby) {
					const removedFwobs = removedZone.getSharedWobsBasedOnLocations('near')
					console.debug('exited zone: detailed wobs to remove', removedZone.id, removedFwobs.length)
					for(const zoneFwob of removedFwobs) { // First remove existing detailed graphics
						removedZone.removeWobGraphic(zoneFwob, false)
					}
					removedZone.coordToInstanceIndex = {} // In future, need similar for farCoordToInstanceIndex?
				}

				let totalCount = 0
				// console.time('Shift remaining instance items')
				{ // Shift all existing wobs relative to delta.
					Wob.InstancedWobs.forEach(instancedWobs => {
						const instanceMatrix = instancedWobs.instancedMesh.instanceMatrix
						for(let i=0, lc=instancedWobs.getLoadedCount(); i<lc; i++) { // Replicated in calcNearbyWobs()
							instanceMatrix.array[i*16 +12] += -vZoneDiff.x *WorldSys.ZONE_LENGTH_FEET
							instanceMatrix.array[i*16 +14] += -vZoneDiff.z *WorldSys.ZONE_LENGTH_FEET
							totalCount++
						}

						instanceMatrix.needsUpdate = true
					})
				}
				// console.timeEnd('Shift remaining instance items') // 2.3ms on desktop - not too bad!
				console.debug('shift total count', totalCount)

				this.babs.worldSys.shiftEverything(-vZoneDiff.x *WorldSys.ZONE_LENGTH_FEET, -vZoneDiff.z *WorldSys.ZONE_LENGTH_FEET)

				// this.playerRig.updateMatrixWorld(true)
				// this.playerRig.updateMatrix()

				// zonetarget.geometry.computeBoundingSphere()
				// zonetarget.ground.updateMatrixWorld(true)
				// zonetarget.ground.updateMatrix()
				
				// Seems this is all that's necessary for zoning:
				exitZone.geometry.computeBoundingSphere()
				exitZone.ground.updateMatrixWorld(true)
				exitZone.ground.updateMatrix()
			}

			const movestateId = Controller.MovestateNameId[movestateName] || 0
			
			this.babs.socketSys.send({
				move: { // This counts as a 'zonein' on the server when enterzone_id is included
					movestate: movestateId,
					a: this.gDestination.x,
					b: this.gDestination.z,
					enterzone_id,
				}
			})


		}

		
		this.run = movestateName === 'run'
		this._stateMachine.setState(movestateName)
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
			// console.log('angle', dir, theta, round)

			// Not sure what I'm doing here...but mapping what I've got
			// -180 can be 180, so that's item 3...
			const found = Object.entries(Controller.ROTATION_ANGLE_MAP).find(item => item[1] == round) || [3]

			const rotationWord = parseInt(`${found[0]}`)
			this.babs.socketSys.send({
				move: {
					movestate: Controller.MovestateNameId.rotate,
					a: rotationWord,
					b: 0,
				}
			})
		}

	}

	jump(height :number) {
		// console.log('jump', this.groundDistance, this.hover, this.velocity.y)
		if(this.groundDistance < 6 && this.velocity.y >= -10) { // Allow multi jump but not too high, and not while falling
			// console.log('jumping!', this.groundDistance, this.hover, this.velocity.y, height)
			this.velocity.y += height*(1000/200) *4 // $4ft, 200ms (5 times per second) // 4 made up to match *10 gravity...
			this.groundDistance = (this.groundDistance || 1) +this.hover // Get off the ground at least
		}
		// todo add this anim and get this state working?  also dance?
		// if(this._stateMachine._currentState != 'jump') {
		// 	this._stateMachine.setState('jump')
		// } 
		if(this.isSelf) {
			this.babs.socketSys.send({
				move: {
					movestate: Controller.MovestateNameId.jump,
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
			acc.multiplyScalar(2.0 *this.babs.inputSys.runmult)
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
		// if(isFar) { // Doesnt work with wayfind
		// 	if(zDeltaFar) {
		// 		this.velocity.z = 0
		// 		this.playerRig.position.setZ(eDest.z)
		// 	}
		// 	if(xDeltaFar) {
		// 		this.velocity.x = 0
		// 		this.playerRig.position.setX(eDest.x)
		// 	}
		// }
		// else 

		// Speed up if far away; so when other moves fast or are behind, they can catch up to their real dest
		let speedBoost = 1
		const boostAtDist = 20
		if(!this.isSelf && (eDistance.x > boostAtDist || eDistance.z > boostAtDist || eDistance.x < -boostAtDist || eDistance.z < -boostAtDist)) {
			// Other player looks far away; speed them up?  todo test with wayfind
			speedBoost = 4
		}

		// Find if getting close to wayfinding destination
		if(this.babs.inputSys.playerSelf.selfWayfinding) {
			const linearDistance = Math.sqrt(eDistance.x**2 + eDistance.z**2)
			// console.log('linearDistance', linearDistance)
			if(linearDistance < ZONE.Yard *2) {
				// Get the next point so we can smoothly head that way
				// console.log('Sending wayfound')
				this.babs.socketSys.send({
					wayfound: true,
				})
			}
		}

		{ // Not far
			const zNearCenter = Math.abs(eDistance.z) < 1
			const zPositiveDistance = eDistance.z > 0
			const zNegativeDistance = eDistance.z < 0
			if (zNearCenter) {
				// But if there is little distance, just move player to center of square and set velocity 0.
				this.velocity.z = 0
				this.playerRig.position.setZ(eDest.z)
			}
			else if (zPositiveDistance) {
				this.velocity.z += acc.z * dt *speedBoost
			}
			else if (zNegativeDistance) {
				this.velocity.z -= acc.z * dt *speedBoost
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
				this.velocity.x += acc.x * dt *speedBoost
			}
			else if (xNegativeDistance) {
				this.velocity.x -= acc.x * dt *speedBoost
			}

		}
		
		this.hover = 0
		const wobAtDest = this.playerRig.zone.getWob(this.gDestination.x, this.gDestination.z)
		const platform = wobAtDest?.bluests?.platform
		if(platform) {
			this.hover = platform.yOffsetFeet
		}

		const isNoVelocity = Math.round(this.velocity.z) == 0 && Math.round(this.velocity.x) == 0
		if(isNoVelocity) { // You're standing still (eg you've arrived)
			// console.log('isNoVelocity', isNoVelocity)
			if(this._stateMachine._currentState.name != 'idle') {
				this._stateMachine.setState('idle')
			}
		}

		const zeroGroundDistance = this.groundDistance == 0
		const zeroGroundDistanceWithHover = Math.abs(this.groundDistance -this.hover) < 0.1
		if(zeroGroundDistance || zeroGroundDistanceWithHover) {
			this.velocity.y = 0
		} 
		// else {
		// Always falling, for jump
		const gravityFtS = 32 *5 // Why does it feel off at *1?
		if(!this.selfWaitZoningExitZone) { // No gravity while walking between zones waiting for zonein
			this.velocity.y -= gravityFtS*dt
		}
		// }

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

		// Set player height based on ground height
		if(this.playerRig?.zone) { // They're loaded // playerRig gets set well before LoadZoneWobs, so it's current (ie doesn't wait for network)
			const yardCoord = YardCoord.Create(this.playerRig)
			const normalizedPositionWithinTile = new Vector3(yardCoord.subtileRemainder.x / WorldSys.Yard, 0, yardCoord.subtileRemainder.z / WorldSys.Yard)
			const worldGroundHeight = this.playerRig.zone.engineHeightAt(yardCoord, normalizedPositionWithinTile)
			
			// Keep above ground
			if(worldGroundHeight +this.hover > this.playerRig.position.y) {
				this.groundDistance = 1 -this.hover
				this.playerRig.position.setY(worldGroundHeight +this.hover)
			}
			
			this.groundDistance = this.playerRig.position.y - worldGroundHeight // Used for jump / falling
		}

		if(this.headRotationX) {
			// this.modelHead ||= this.playerRig.getObjectByName( 'Head_M' )
			// this.modelHead.setRotationFromAxisAngle(new Vector3(0,-1,0), this.headRotationX/2) // Broken with gltf for some reason?
			
			// console.log(this.playerRig)
			this.modelNeck ||= this.playerRig.getObjectByName( 'spine006' ) // vashria note that '.' was removed by export/import; gun lady was 'Head_M'
			this.modelNeck.setRotationFromAxisAngle(new Vector3(0,-1,0), this.headRotationX*0.75)
		}


		if(!this.gPrevDestination?.equals(this.gDestination)) {
			this.gPrevDestination = this.gDestination.clone() // Save previous destination (if it's not the same)
		}
	}


}

