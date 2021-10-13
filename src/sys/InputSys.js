import { Camera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from "three"
import { BabsPointerLockControls } from "./BabsPointerLockControls"
import { Gob } from "../ent/Gob"
import { topmenuVisible } from "../stores"
import * as Utils from "../Utils"
import { get as sget } from 'svelte/store'
import { log } from './../Utils'
import { MathUtils } from "three"
import { PlaneGeometry } from "three"
import { MeshBasicMaterial } from "three"
import { Mesh } from "three"
import { DoubleSide } from "three"

// Stateful tracking of inputs
// 0=up(lifted), false=off, 1=down(pressed), true=on, 
const LIFT = 0
const OFF = false
const PRESS = 1
const ON = true

const MOUSE_LEFT_CODE = 0
const MOUSE_RIGHT_CODE = 2

export class InputSys {
    // static bPressingForward = false
    // static bPressingBackward = false
    // static bPressingLeft = false
    // static bPressingRight = false
    // static bCanJump = false
    // static vVelocity = new Vector3()
    // static vAccel = new Vector3()
    // static ftpsSpeed = 500 // Todo scale this here and in tick to ft/s // Is it really "speed"?
    // static ftHeightHead = 6
    
	mouse = {
		left: OFF, 
		right: OFF,
		center: OFF,
		// back: OFF, // Doesn't work on my modified macos external mouse
		// forward: OFF,
		x: OFF, // OFF is offscreen
		z: OFF,
		dx: 0, // Delta since last frame
		dz: 0,
		accumx: 0, // Accumulation of deltas, for angle snapped rotation
		accumz: 0,
		ldouble: false,
		rdouble: false,
	}
	keys = {
		w: OFF,
		a: OFF,
		s: OFF,
		d: OFF,
		up: OFF,
		left: OFF,
		down: OFF,
		right: OFF,
		space: OFF,
		sleft: OFF,
		sright: OFF,
		cleft: OFF,
		cright: OFF,
		aleft: OFF,
		aright: OFF,
		mleft: OFF,
		mright: OFF,
		escape: OFF,
		enter: OFF,
		f: OFF,
	}
	
	// static touchpad = {

	characterControlMode = false


	mouseAccumThreshold = 80

	doubleClickMs = 500

	movelock = false
	runmode = true

	arrowHoldStartTime = false


    constructor(babs, player) {
		this.babs = babs
		this.player = player
        // this.raycaster = await new Raycaster( new Vector3(), new Vector3( 0, - 1, 0 ), 0, 50 )
        // this.controls = new BabsPointerLockControls( camera, document.getElementById('canvas') ) // Replaced with CwameraSys

		// Map JS key codes to my InputSys keys state array
		const inputCodeMap = {
			'ArrowUp': 'up',
			'ArrowLeft': 'left',
			'ArrowDown': 'down',
			'ArrowRight': 'right',
			'Space': 'space',
			'ShiftLeft': 'sleft',
			'ShiftRight': 'sright',
			'ControlLeft': 'cleft',
			'ControlRight': 'cright',
			'AltLeft': 'aleft',
			'AltRight': 'aright',
			'MetaLeft': 'mleft',
			'MetaRight': 'mright',
			'Escape': 'esc',
			'Enter': 'return',
		}
		// Special case: 'KeyW' style letter events
		'abcdefghijklmnopqrstuvwxyz'.split('').forEach(letter => {
			inputCodeMap[`Key${letter.toUpperCase()}`] = letter
		})


        document.addEventListener( 'keydown', async ev => {
			if(this.keys[inputCodeMap[ev.code]] !== ON) {
				// OS-level key repeat keeps sending down events; stop that from turning into presses
				this.keys[inputCodeMap[ev.code]] = PRESS
			}
			
			if(this.characterControlMode) {
				if(this.mouse.right) {
					if(this.keys.space === PRESS) {
						this.player.controller.jump(4)
					}
				}

				if(this.keys.up === PRESS || this.keys.down === PRESS) {
					this.movelock = false
				}

				if(this.keys.left === PRESS || this.keys.right === PRESS) {
					this.arrowHoldStartTime = 0 // Zero will trigger it immediately
				}
			}


			if(this.keys.f === PRESS) {



				let obj = await Gob.Create(`/char/female/F_Bald_mesh_004.fbx`, this.babs.scene, 1)

				// obj.mesh.scale.multiplyScalar(10)
				// obj.mesh.scale.multiplyScalar(1/12) 

				log('obj', obj)


				// obj.mesh.scale.multiplyScalar(0.01 * 3.3)
				// obj.mesh.position.copy(this.player.controller.target.position)
				// obj.mesh.position.y -= this.ftHeightHead

				// Place in front; move forward parallel to the xz-plane, assume camera.up is y-up
				// const distance = 8
				// let _vector = new Vector3()
				// _vector.setFromMatrixColumn( this.player.controller.target.matrix, 0 )  // camera.matrix
				// _vector.crossVectors( this.player.controller.target.up, _vector ) // camera.up
				// obj.mesh.position.addScaledVector( _vector, distance )


				obj.mesh.position.copy(new Vector3(6,0,1))
			}
			
        })

        document.addEventListener( 'keyup', ev => {
			this.keys[inputCodeMap[ev.code]] = LIFT


			if(this.keys.left || this.keys.right) {
				this.arrowHoldStartTime = false
			}

        })

		// document.addEventListener( 'click', mouseOnClick )
        // const mouseOnClick = (ev) => {
		// 	log.info('mouseOnClick', ev.code, ev.button, ev.target.id)
        // }

		document.addEventListener( 'mousemove', ev => { // :MouseEvent
			// log('mousemove', ev.target.id, ev.offsetX, ev.movementX)
			
			// const mouseX = ev.movementX || ev.mozMovementX || ev.webkitMovementX || 0 // This is already a delta
			// const mouseY = ev.movementY || ev.mozMovementY || ev.webkitMovementY || 0

			// Note I get MULTIPLE mousemove calls of this func in between a single update frame!
			// Thus, setting this.mouse.dz =, doesn't work as it loses ones in between frames.
			// Instead, I should either do accumx here, or sum the deltas here instead of add, then wipe them at update.
			// Done.  The implication though is, with devtools open, events come in a lot faster than updates() (RAFs)

			this.mouse.dx += ev.movementX || ev.mozMovementX || ev.webkitMovementX || 0
			this.mouse.dz += ev.movementY || ev.mozMovementY || ev.webkitMovementY || 0

			this.mouse.x = ev.offsetX || ev.mozOffsetX || ev.webkitOffsetX || 0
			this.mouse.z = ev.offsetY || ev.mozOffsetY || ev.webkitOffsetY || 0

        })

        document.addEventListener( 'mousedown', (ev) => {
			log('mouseOnDown', ev.button, ev.target.id)

			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' )){// || (!ev.target.id))) { //  && this.mouse.right
				this.characterControlMode = true

				if(ev.button === MOUSE_LEFT_CODE) {
					this.mouse.left = PRESS

					// Turn off movelock if hitting left (while right) after a delay
					if(this.mouse.right && this.movelock && Date.now() -this.mouse.ldouble > this.doubleClickMs) {
						this.movelock = false
					}

					// Double click
					if(this.mouse.ldouble === false) {
						this.mouse.ldouble = Date.now()
					}
					else if(Date.now() - this.mouse.ldouble <= this.doubleClickMs) {
						if(this.mouse.right) {
							this.movelock = true
						}	
					}

				}

				if(ev.button === MOUSE_RIGHT_CODE) {
					this.mouse.right = PRESS

					if(this.mouse.left && this.movelock) {
						this.movelock = false
					}

					document.getElementById('canvas').requestPointerLock()
					document.getElementById('canvas').style.cursor = 'none'
				}
				if(ev.button == 1) {
					this.mouse.middle = PRESS
					this.runmode = !this.runmode
				}

			}
        })

        document.addEventListener( 'mouseup', (ev) => {
			log.info('mouseOnUp', ev.button, ev.target.id)
			if(ev.button === MOUSE_LEFT_CODE) {
				this.mouse.left = LIFT


			}
			if(ev.button === MOUSE_RIGHT_CODE) {
				this.mouse.right = LIFT

				this.mouse.ldouble = 0

				document.exitPointerLock()
				document.getElementById('canvas').style.cursor = 'auto'
			}
			if(ev.button == 1) {
				this.mouse.middle = LIFT
			}
        })

		topmenuVisible.subscribe(vis => vis ? () => { // Menu becomes visible
			// If menu becomes visible, release mouse
			// this.controls.unlock()


			document.exitPointerLock()
			document.getElementById('canvas').style.cursor = 'auto'
			this.characterControlMode = false
			
		}: () => { // Menu becomes closed
			// Doesn't go back to game mode until they mouse-right-hold
		})

        return this
    }


	displayDestinationMesh
    async update(dt, scene) {
		
		const controlObject = this.player.controller.target

		if(this.characterControlMode) { // Canvas targeted

			// Runs every frame, selecting grid position for setDestination
			if(
				(this.mouse.right && (this.keys.w || this.keys.s || this.mouse.left))
				|| (this.keys.up || this.keys.down)
				|| this.movelock
				) {
				log.info(this.keys.w ? 'w':'-', this.keys.s ? 's':'-')
				
				let vector = new Vector3()
				vector.setFromMatrixColumn( controlObject.matrix, 0 )  // camera.matrix

				// Handle scaled objects
				const reversedScale = 1/controlObject.scale.x
				vector.multiplyScalar(reversedScale) 

				if(this.keys.w || this.keys.up || this.mouse.left || this.keys.s || this.keys.down || this.movelock) {
					vector.crossVectors( controlObject.up, vector ) // camera.up
				}

				// log('vector', vector)

				// Get direction
				vector.round()
				log('vector round', vector)
				// vector.normalize() // Direction 
				// log('normalize', vector)
				if(this.keys.w || this.keys.up || this.mouse.left || this.movelock) vector.negate() // Why is negate needed with controlObject.up?

				// Okay, that was direction.  Now get distance
				// Feels like I should place the character into the middle of the square.
				// So that the character's position that's being compared to 'next square' is in the middle.
				// So; find nearest grid, rounded
				const gCurrentPos = controlObject.position.clone()
				log('gcp', gCurrentPos)
				// gCurrentPos.addScalar(0) // Add a half tile so that forward and backward are equally far apart, because this is from model (model center maybe?)
				// log('gcp addScalar', gCurrentPos)
				gCurrentPos.multiplyScalar(1/4) // to grid
				log('gcp multiplyScalar', gCurrentPos)
				gCurrentPos.subScalar(0.001).round() // Find nearest grid from center of current one; round down from half
				log('gcp round', gCurrentPos)
				// gCurrentPos.floor() // find 1/4 tile you're in
				// log('gcp floor', gCurrentPos)

				gCurrentPos.setY(0)
				const dest = gCurrentPos.clone().add(vector)
				dest.clamp(this.player.controller.vTerrainMin, this.player.controller.vTerrainMax)
				log('dest', dest)

				// Send to controller
				this.player.controller.setDestination(dest, this.runmode ? 'run' : 'walk') // Must round floats

				// Let's show a square in front of the player?  Their destination target square :)
				if(!this.displayDestinationMesh) {
					const geometry = new PlaneGeometry( 4, 4 )
					const material = new MeshBasicMaterial( {color: 0xff0000, side: DoubleSide} )
					geometry.rotateX( - Math.PI / 2 ); // Make the plane horizontal
					this.displayDestinationMesh = new Mesh( geometry, material )
					scene.add( this.displayDestinationMesh )
				}
				this.displayDestinationMesh.position.copy(dest).multiplyScalar(4)
				const easyRaiseAbove = 0.5
				this.displayDestinationMesh.position.add(new Vector3(4/2, this.player.controller.target.position.y + easyRaiseAbove, 4/2))

			}


			// Handle arrow keys turns
			if(this.keys.left || this.keys.right) {
				if(this.arrowHoldStartTime === false || Date.now() -this.arrowHoldStartTime > 500) {
					this.arrowHoldStartTime = Date.now()
					
					// Rotate player
					const _Q = new Quaternion()
					const _A = new Vector3()
					const _R = this.player.controller.idealTargetQuaternion.clone()
		
					// Naive version
					_A.set(0, this.keys.right ? -1 : 1, 0)
					// _Q.setFromAxisAngle(_A, Math.PI * dt * this.player.controller.rotationSpeed)
					_Q.setFromAxisAngle(_A, MathUtils.degToRad(45))
					_R.multiply(_Q)
					this.player.controller.setRotation(_R)


				}
			}


			// Accumulate mouse deltas (for rotation lock) and reset deltas; and prevent vast movements
			// this.mouse.accumx += MathUtils.clamp(this.mouse.dx, -this.mouseAccumThreshold/2, this.mouseAccumThreshold/2)
			// this.mouse.accumz += MathUtils.clamp(this.mouse.dz, -this.mouseAccumThreshold/2, this.mouseAccumThreshold/2)

			const mouseSensitivityPercent = 30 // hmm isn't this the same as just changing this.mouseAccumThreshold?
			this.mouse.accumx += this.mouse.dx *(0.5 * (mouseSensitivityPercent/100)) //(mouseSensitivityPercent * )


		}

		if(!this.mouse.right) {
			this.mouse.accumx = this.mouse.accumz = 0
		}


		// Move PRESS states into ON states, and LIFT into OFF
		for(const key in this.keys) { // Update key states after press/lift
			if(this.keys[key] === PRESS) this.keys[key] = ON
			else if(this.keys[key] === LIFT) this.keys[key] = OFF
		}


		

		// Delta accumulation for angle rotation snap
		if(Math.abs(this.mouse.accumx) > this.mouseAccumThreshold) {

			const _Q = new Quaternion()
			const _A = new Vector3()
			const _R = this.player.controller.idealTargetQuaternion.clone()

			// Naive version
			_A.set(0, this.mouse.accumx > 0 ? -1 : 1, 0)
			// _Q.setFromAxisAngle(_A, Math.PI * dt * this.player.controller.rotationSpeed)
			_Q.setFromAxisAngle(_A, MathUtils.degToRad(45))
			_R.multiply(_Q)
			this.player.controller.setRotation(_R)

			// Dampen mouse accelleration from turning too quick, following a turn
			// this.mouse.accumx = -this.mouse.accumx*(0.5)
			// Instead, we'll just wait for head rotation to indicate position.
			// this.mouse.accumx = this.mouse.dx
			this.mouse.accumx = -this.mouseAccumThreshold *(2.2/3) * Math.sign(this.mouse.accumx) // After character snap rotate, bring head (camera) back to roughly where it was before (2.2 magic number)
		}
		


		const headTurnMaxDegrees = 90 *(1/2) // Determines at what point the view will snap turn?
		this.player.controller.setHeadRotationX((this.mouse.accumx /this.mouseAccumThreshold) / 100 *headTurnMaxDegrees)

		// As player stops moving mouse to rotate, decay the threshold back to zero
		// This means when the player stops rotating, it will 're-center' them so that rotating again takes a normal movement distance
		// const reductionPerSecond = this.mouseAccumThreshold
		// this.mouse.accumx -= reductionPerSecond *dt *Math.sign(this.mouse.accumx) 
		// Per above, changing this to just be indicated by head rotation.


			// Vertical mouse look
		if(this.mouse.right) {

			// log('dz', this.mouse.dz)

			// const _Q = new Quaternion()
			// const _A = new Vector3()
			// const _R = this.babs.cameraSys.camera.quaternion.clone()
			// // Naive version
			// _A.set(1, 0, 1) //this.mouse.dz > 0 ? -1 : 1
			// _Q.setFromAxisAngle(_A, Math.PI * dt * this.player.controller.rotationSpeed)
			// _R.multiply(_Q)
			// this.babs.camera.quaternion.setRotation(_R)

			const minPolarAngle = 0; // radians
			const maxPolarAngle = Math.PI; // radians

			// From PointerLockControls
			// const _euler = new Euler( 0, 0, 0, 'YXZ' );
			// _euler.setFromQuaternion( this.babs.camera.quaternion );
			// _euler.y -= mouse.dx * 0.002;
			// _euler.x -= mouse.dz * 0.002;
			// _euler.x = Math.max( _PI_2 - scope.maxPolarAngle, Math.min( _PI_2 - scope.minPolarAngle, _euler.x ) );
			// this.babs.camera.quaternion.setFromEuler( _euler );

			// This kinda works but maybe let's not even have this?
			// this.babs.cameraSys.offsetHeight += this.mouse.dz * 0.10


		}

		

		this.mouse.dx = this.mouse.dz = 0

		if(this.mouse.ldouble !== false && Date.now() -this.mouse.ldouble > this.doubleClickMs) {
			this.mouse.ldouble = false
		}

    }

	
	postUpdate() {

		// Rotate head?  hehe!
		// if(this.mouse.accumx) {a
		// log('accum post', this.mouse.accumx)

		// We need to um, make it so head rotation goes back at the same rate as camera move.
		// 	this.player.controller.setHeadRotationX((this.mouse.accumx /this.mouseAccumThreshold) / 100 *45)

		// }

	}

}
