import { Camera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from "three"
import { BabsPointerLockControls } from "./BabsPointerLockControls"
import { Gob } from "../ent/Gob"
import { topmenuVisible } from "../stores"
import * as Utils from "../Utils"
// import { get as sget } from 'svelte/store'
import { log } from './../Utils'
import { MathUtils } from "three"
import { PlaneGeometry } from "three"
import { MeshBasicMaterial } from "three"
import { Mesh } from "three"
import { DoubleSide } from "three"
import { Matrix4 } from "three"
import { Vector2 } from "three"

// Stateful tracking of inputs
// 0=up(lifted), false=off, 1=down(pressed), true=on, 
const LIFT = 0
const OFF = false
const PRESS = 1
const ON = true

const MOUSE_LEFT_CODE = 0
const MOUSE_RIGHT_CODE = 2

export class InputSys {
    
	mouse = {
		left: OFF, 
		right: OFF,
		middle: OFF, // Mouse wheel button
		// back: OFF, // Doesn't work on my modified macos external mouse
		// forward: OFF, // Doesn't work also
		x: OFF, // Position // OFF is offscreen
		y: OFF,
		dx: 0, // Position delta since last frame (including during pointer lock)
		dy: 0,
		accumx: 0, // Accumulation of deltas, for angle snapped rotation
		// accumy: 0,
		ldouble: false, // Double click, managed manually
		// rdouble: false,
		scrolldx: 0, // Gesture/scroll, browser accumulates and decays it, so it's a bit weird
		scrolldy: 0,
		// scrollaccumx: 0,
		scrollaccumy: 0, // Manual scroll rate tracking, for gesture touchmove
		istouchpad: false, // a little uncertain; set based on horizontal scroll that's unlikely on mouse
		zoom: 0,
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
		// Actually, keys default to undefined, so I don't need to set OFF for F, etc. 
		// Maybe not for anything above; but, it's nice to see them enumerated.
	}
	
	characterControlMode = false // Mode that means we're controlling the character movement/rotation
	mouseAccumThreshold = 80 // Degrees at which mouse left/right movement causes a character rotation
	headTurnMaxDegrees = 45 // Determines at what point the view will snap turn
	doubleClickMs = 400 // MS was 500ms
	movelock = false // Autorun
	touchmove = 0 // Touchpad movement gesture state. -1 (back), 0 (stop), 1 (forward), 'auto' (autorun)
	runmode = true // Run mode, as opposed to walk mode
	arrowHoldStartTime = 0 // left/right arrow rotation repeat delay tracker
	topMenuVisibleLocal

    constructor(babs, player) {
		this.babs = babs
		this.player = player

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

        document.addEventListener('keydown', async ev => {
			// OS-level key repeat keeps sending down events; 
			if(this.keys[inputCodeMap[ev.code]] !== ON) { // stop that from turning into presses
				this.keys[inputCodeMap[ev.code]] = PRESS
			}
			
			if(this.characterControlMode) {
				if(this.mouse.right) {
					// Jump on spacebar if mouse right held
					if(this.keys.space === PRESS) {
						this.player.controller.jump(4)
					}
				}

				// If arrows are used for movement, it breaks out of movelock or touchmove
				if(this.keys.up === PRESS || this.keys.down === PRESS) {
					this.movelock = false
					this.touchmove = false
				}

				// If pressing left or right arrows it immediately turns
				if(this.keys.left === PRESS || this.keys.right === PRESS) {
					this.arrowHoldStartTime = 0 // Zero will trigger it immediately
				}
			}

			// Testing commands
			if(this.keys.cleft) {

				// Spawn test character
				if(this.keys.f === PRESS) {

					let obj = await Gob.Create(`/char/female/F_Bald_mesh_009.fbx`, this.babs.scene, 1)
					log('obj', obj)
					// obj.mesh.scale.multiplyScalar(10)
					// obj.mesh.scale.multiplyScalar(1/12) 
					// obj.mesh.geometry.scale.multiplyScalar(1/12) 
					obj.mesh.position.copy(new Vector3(6,0,10))

					/*
					// obj.mesh.scale.multiplyScalar(0.01 * 3.3)
					// obj.mesh.position.copy(this.player.controller.target.position)
					// obj.mesh.position.y -= this.ftHeightHead

					// Place in front; move forward parallel to the xz-plane, assume camera.up is y-up
					// const distance = 8
					// let _vector = new Vector3()
					// _vector.setFromMatrixColumn( this.player.controller.target.matrix, 0 )  // camera.matrix
					// _vector.crossVectors( this.player.controller.target.up, _vector ) // camera.up
					// obj.mesh.position.addScaledVector( _vector, distance )
					*/

				}

				// Testing commanded movement
				if(this.keys.v === PRESS) {
					let dest
					if(Math.random() > 0.5) {
						dest = new Vector3(1, 0, 1)
					} 
					else {
						dest = new Vector3(0, 0, 0)
					}
					log('dest', dest)
					this.player.controller.setDestination(dest, 'walk')
				}
			}
			
        })

        document.addEventListener('keyup', ev => {
			this.keys[inputCodeMap[ev.code]] = LIFT

			// Turning-keys repeat-delay reset
			if(this.keys.left === LIFT || this.keys.right === LIFT) {
				this.arrowHoldStartTime = 0
			}
        })

		// No 'click' handling; we do it manually via mousedown/mouseup for more control
		// document.addEventListener( 'click', mouseOnClick )

		document.addEventListener('mousemove', ev => { // :MouseEvent
			log.info('mousemove', ev.target.id, ev.offsetX, ev.movementX)
			
			// Note I get MULTIPLE mousemove calls of this func in between a single update frame!
			// Thus, setting this.mouse.dy =, doesn't work as it loses ones in between frames.
			// Instead, I should either do accumx here, or sum the deltas here instead of add, then wipe them at update.
			// Done.  What I notice is, with devtools open, events come in a lot faster than updates() (RAFs)

			// Mouse movement since last frame (including during pointer lock)
			this.mouse.dx += ev.movementX || ev.mozMovementX || ev.webkitMovementX || 0
			this.mouse.dy += ev.movementY || ev.mozMovementY || ev.webkitMovementY || 0

			// Mouse position (unchanging during pointer lock or gestures)
			// 'offsetX' means offset from screen origin, not offset from last event/frame
			this.mouse.x = ev.offsetX || ev.mozOffsetX || ev.webkitOffsetX || 0
			this.mouse.y = ev.offsetY || ev.mozOffsetY || ev.webkitOffsetY || 0
        })

        document.addEventListener('mousedown', ev => {
			log.info('mouseOnDown', ev.button, ev.target.id)

			if(!this.topMenuVisibleLocal && (ev.target.id === 'canvas' )){
				this.characterControlMode = true

				if(ev.button === MOUSE_LEFT_CODE) {
					this.mouse.left = PRESS

					if(this.mouse.right) {
						// If using touchpad then switch to mouse; modern touchpads don't have both buttons to click at once
						if(this.mouse.istouchpad) this.setTouchpad(false)
					}

					// Turn off movelock if hitting left (while right) after a delay
					if(this.mouse.right && this.movelock && Date.now() -this.mouse.ldouble > this.doubleClickMs) {
						this.movelock = false
					}

					// Double click handling
					if(this.mouse.ldouble === false) { // First click
						this.mouse.ldouble = Date.now()
					}
					else if(Date.now() -this.mouse.ldouble <= this.doubleClickMs) { // Double click within time
						// Double clicking mouse right turns on movelock
						if(this.mouse.right) {
							this.movelock = true
						}	
					}

				}

				if(ev.button === MOUSE_RIGHT_CODE) {
					this.mouse.right = PRESS

					if(this.mouse.left) {
						// If using touchpad then switch to mouse; modern touchpads don't have both buttons to click at once
						if(this.mouse.istouchpad) this.setTouchpad(false) 
					}

					// Right+left mouse during movelock, stops movement
					if(this.mouse.left && this.movelock) {
						this.movelock = false
					}

					if(this.mouse.istouchpad) {
						// Two-finger click on touchpad toggles touchmove (similar to movelock)
						if(this.touchmove === 0) { 
							this.touchmove = 'auto'
						}
						else {
							this.touchmove = 0
							this.mouse.scrollaccumy = 0
						}
					}
					else { 
						// If not touchpad, do pointer lock.  Touchpad doesn't need it because look is via gestures
						document.getElementById('canvas').requestPointerLock()
						document.getElementById('canvas').style.cursor = 'none'
					}
				}

				// Middle mouse toggles run/walk
				if(ev.button == 1) { 
					this.mouse.middle = PRESS
					this.runmode = !this.runmode
				}

			}
        })

        document.addEventListener('mouseup', ev => {
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

		document.getElementById('canvas').onwheel = ev => {
			ev.preventDefault()
			
			// https://medium.com/@auchenberg/detecting-multi-touch-trackpad-gestures-in-javascript-a2505babb10e
			if (ev.ctrlKey) { 
				// Doesn't actually require control keypress!  It's a hack that enables pinch zoom
				if(!this.mouse.istouchpad) this.setTouchpad(true) // Only a touchpad would use x scrolling or zoom.
				this.mouse.zoom -= ev.deltaY
			} else {
				if(ev.deltaX && !this.mouse.istouchpad) this.setTouchpad(true)
				this.mouse.scrolldx -= ev.deltaX
				this.mouse.scrolldy += ev.deltaY
			}

		}

		topmenuVisible.subscribe(vis => { // Menu becomes visible
			this.topMenuVisibleLocal = vis

			if(vis) {
				this.characterControlMode = false
				document.exitPointerLock()
				document.getElementById('canvas').style.cursor = 'auto'
			} 
			else {
				// Doesn't go back to this.characterControlMode until they mouse-right-hold
			}
		})

        return this
    }


	displayDestinationMesh
    async update(dt, scene) {

		log.info('scroll', this.mouse.zoom, this.mouse.scrolldy.toFixed(1), this.mouse.scrollaccumy.toFixed(1))


		if(!this.topMenuVisibleLocal) {
			// Swipe up progresses thorugh: walk -> run -> jump.  Down does the reverse
			// Tested on Mac touchpads; not sure how it will do on PC
			if(this.mouse.zoom > 50) {
				this.mouse.zoom = -this.mouse.zoom/4
				if(!this.runmode) {
					this.runmode = true
				}
				else { // If ready in runmode, jump!
					this.player.controller.jump(4)
				}
			}
			else if(this.mouse.zoom < -50) {
				this.mouse.zoom = -this.mouse.zoom/4
				this.runmode = false
			}
			
			if(this.mouse.right) {
				const mouseSensitivityPercent = 30 // hmm isn't this the same as just changing this.mouseAccumThreshold?
				this.mouse.accumx += this.mouse.dx *(0.5 * (mouseSensitivityPercent/100)) //(mouseSensitivityPercent * )
			}
			else {
				// this.mouse.accumx = this.mouse.accumy = 0
				// Let's actually not snap after release; more intuitive.
			}

			if(this.mouse.scrolldx) { // If getting a touchpad two-finger touch (not press) move event
				this.mouse.accumx += this.mouse.scrolldx

			}
			if(this.mouse.scrolldy) { 
				this.mouse.scrollaccumy += this.mouse.scrolldy /12
			}

			// touchmove
			if(this.mouse.scrollaccumy/2 > 10) {
				this.touchmove = 1
			}
			else if(this.mouse.scrollaccumy/2 < -10) {
				this.touchmove = -1
			}
			else if(this.touchmove !== 'auto') {
				this.touchmove = 0
			}


			// Delta accumulation for angle rotation snap
			if(Math.abs(this.mouse.accumx) > this.mouseAccumThreshold) {
				const gCurrentPosition = this.player.controller.target.position.clone().multiplyScalar(1/4).floor()
				const eCurrentPositionCentered = gCurrentPosition.clone().multiplyScalar(4).addScalar(2)
				
				// const eDiff = eCurrentPositionCentered.clone().sub(this.player.controller.target.position) // Distance from CENTER
				// const characterNearMiddle = Math.abs(eDiff.x) < 1 && Math.abs(eDiff.z) < 1
				// log.info('characterNearMiddle', characterNearMiddle, eDiff)
				// There's some interaction with turning fast and `if(characterNearMiddle)`.  Might be related to head rotation setting; putting it first changed things.  But might be something else.
				// So just leave that off for now.
				const characterNearMiddle = true

				if(characterNearMiddle) {
					const _Q = new Quaternion()
					const _A = new Vector3()
					const _R = this.player.controller.idealTargetQuaternion.clone()

					_A.set(0, this.mouse.accumx > 0 ? -1 : 1, 0)
					_Q.setFromAxisAngle(_A, MathUtils.degToRad(45))
					_R.multiply(_Q)
					this.player.controller.setRotation(_R)

					log.info('InputSys: call controller.setRotation()')

					// After character snap rotate, bring head (camera) back to roughly where it was before (2.2 magic number)
					this.mouse.accumx = -this.mouseAccumThreshold *(2.2/3) * Math.sign(this.mouse.accumx) 
				}

			}

		}

		// Keep head rotation going even when menu is not visible, but it has to be placed here
		// The reason for doing head rotation is to visually indicate to the player when their character is about to turn
		this.player.controller.setHeadRotationX((this.mouse.accumx /this.mouseAccumThreshold) / 100 *this.headTurnMaxDegrees)

		if(!this.topMenuVisibleLocal) {

			// Vertical mouse look
			if(this.mouse.right) {
				// log('dz', this.mouse.dy)

				// const _Q = new Quaternion()
				// const _A = new Vector3()
				// const _R = this.babs.cameraSys.camera.quaternion.clone()
				// // Naive version
				// _A.set(1, 0, 1) //this.mouse.dy > 0 ? -1 : 1
				// _Q.setFromAxisAngle(_A, Math.PI * dt * this.player.controller.rotationSpeed)
				// _R.multiply(_Q)
				// this.babs.camera.quaternion.setRotation(_R)

				// const minPolarAngle = 0; // radians
				// const maxPolarAngle = Math.PI; // radians

				// From PointerLockControls
				// const _euler = new Euler( 0, 0, 0, 'YXZ' );
				// _euler.setFromQuaternion( this.babs.camera.quaternion );
				// _euler.y -= mouse.dx * 0.002;
				// _euler.x -= mouse.dy * 0.002;
				// _euler.x = Math.max( _PI_2 - scope.maxPolarAngle, Math.min( _PI_2 - scope.minPolarAngle, _euler.x ) );
				// this.babs.camera.quaternion.setFromEuler( _euler );

				// This kinda works but maybe let's not even have this?
				// Might need it for mountains, later.
				// this.babs.cameraSys.offsetHeight += this.mouse.dy * 0.10
			}

			// Handle arrow keys turns // Move above keys with mouse stuff?
			if(this.keys.left || this.keys.right) {
				if(!this.arrowHoldStartTime || Date.now() -this.arrowHoldStartTime > this.doubleClickMs) {
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

			// Runs every frame, selecting grid position for setDestination
			if(
				(this.mouse.right && (this.keys.w || this.keys.s || this.mouse.left)) //  || this.keys.a || this.keys.d
				|| (this.keys.up || this.keys.down)
				|| this.movelock
				|| this.touchmove
				) {
				log.info(this.keys.w ? 'w':'-', this.keys.s ? 's':'-', this.keys.a ? 'a':'-', this.keys.d ? 'd':'-')

				let tempMatrix = new Matrix4().makeRotationFromQuaternion(this.player.controller.idealTargetQuaternion)
				let vector = new Vector3().setFromMatrixColumn( tempMatrix, 0 )  // get X column of matrix
				log.info('vector!', tempMatrix, vector)

				if(this.keys.w || this.keys.up || this.mouse.left || this.keys.s || this.keys.down || this.movelock || this.touchmove) {
					vector.crossVectors( this.player.controller.target.up, vector ) // camera.up
				}

				// Get direction
				vector.round()
				if(this.keys.w || this.keys.up || this.mouse.left || this.movelock || this.touchmove === 1 || this.touchmove === 'auto') {
					vector.negate() // Why is negate needed?
				}

				// Okay, that was direction.  Now get distance
				let gCurrentPos = this.player.controller.target.position.clone() 
				const gCurrentPosDivided = gCurrentPos.clone().multiplyScalar(1/4)
				const gCurrentPosFloored = gCurrentPosDivided.clone().floor()
				log.info('InputSys: update(), gCurrentPos', `(${gCurrentPos.x.toFixed(2)}, ${gCurrentPos.z.toFixed(2)}) ~ (${gCurrentPosDivided.x.toFixed(2)}, ${gCurrentPosDivided.z.toFixed(2)}) ~ (${gCurrentPosFloored.x.toFixed(2)}, ${gCurrentPosFloored.z.toFixed(2)})`)

				gCurrentPos = gCurrentPosFloored
				gCurrentPos.setY(0) // Y needs a lot of work in this area...

				const dest = gCurrentPos.clone().add(vector)
				dest.clamp(this.player.controller.vTerrainMin, this.player.controller.vTerrainMax)

				// Send to controller
				log.info('InputSys: call controller.setDestination()', dest)
				this.player.controller.setDestination(dest, this.runmode ? 'run' : 'walk') // Must round floats

				// Let's show a square in front of the player?  Their destination target square :)
				if(!this.displayDestinationMesh) {
					const geometry = new PlaneGeometry( 4, 4 )
					const material = new MeshBasicMaterial( {color: 0xff0000, side: DoubleSide} )
					geometry.rotateX( - Math.PI / 2 ); // Make the plane horizontal
					this.displayDestinationMesh = new Mesh( geometry, material )
					scene.add( this.displayDestinationMesh )
				}
				this.displayDestinationMesh.position.copy(dest).multiplyScalar(4).addScalar(2)
				const easyRaiseAbove = 0.2
				this.displayDestinationMesh.position.add(new Vector3(0, this.player.controller.target.position.y + easyRaiseAbove, 0))

			}

		}

		// Decay some stuff down over time
		[this.mouse.scrollaccumy, this.mouse.zoom] = new Vector2(this.mouse.scrollaccumy, this.mouse.zoom)
			.lerp(new Vector2(0, 0), dt)
			.toArray()

		// Reset per-frame deltas
		this.mouse.dx = this.mouse.dy = 0
		this.mouse.scrolldx = this.mouse.scrolldy = 0

		// Track double click timing
		if(this.mouse.ldouble !== false && Date.now() -this.mouse.ldouble > this.doubleClickMs) {
			this.mouse.ldouble = false
		}

		// Move PRESS states into ON states, and LIFT into OFF
		for(const key in this.keys) { // Update key states after press/lift
			if(this.keys[key] === PRESS) this.keys[key] = ON
			else if(this.keys[key] === LIFT) this.keys[key] = OFF
		}
    }

	
	setTouchpad(isTouchpad) {
		this.mouse.istouchpad = isTouchpad
		log.info(this.mouse.istouchpad ? 'Is touchpad' : 'Not touchpad')

		// If switching from touch mode to mouse, disable touchmove
		// Otherwise there's no way to stop moving hah!
		if(!this.mouse.istouchpad) {
			this.touchmove = 0
		}
		else { // And vice-versa!
			this.movelock = false
		}
	}

}
