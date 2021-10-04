import { Camera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from "three"
import { BabsPointerLockControls } from "./BabsPointerLockControls"
import { Gob } from "../ent/Gob"
import { topmenuVisible } from "../stores"
import * as Utils from "../Utils"
import { get as sget } from 'svelte/store'
import { log } from './../Utils'

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
		four: OFF,
		five: OFF,
		x: OFF, // false=offscreen?
		y: OFF,
	}
	keys = {
		w: OFF,
		a: OFF,
		s: OFF,
		d: OFF,
		shift: OFF,
		space: OFF,
	}
	// static touchpad = {




    constructor(babs, player) {
		this.babs = babs
		this.player = player
        // this.raycaster = await new Raycaster( new Vector3(), new Vector3( 0, - 1, 0 ), 0, 50 )
        // this.controls = new BabsPointerLockControls( camera, document.getElementById('canvas') ) // Replaced with CwameraSys

        document.addEventListener( 'keydown', async (ev) => {
			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' || (!ev.target.id && this.mouse.right))) {
				switch ( ev.code ) {
				    case 'ArrowUp':
				    case 'KeyW':
						if(this.keys.w !== ON) { // OS-level key repeat keeps sending down events; stop that from turning into presses
							this.keys.w = PRESS
						}
					break
				    case 'ArrowLeft':
				    case 'KeyA':
						if(this.keys.a !== ON) { // OS-level key repeat keeps sending down events; stop that from turning into presses
							this.keys.a = PRESS
						}
					break
				    case 'ArrowDown':
				    case 'KeyS':
						if(this.keys.s !== ON) { // OS-level key repeat keeps sending down events; stop that from turning into presses
							this.keys.s = PRESS
						}
					break
				    case 'ArrowRight':
				    case 'KeyD':
						if(this.keys.d !== ON) { // OS-level key repeat keeps sending down events; stop that from turning into presses
							this.keys.d = PRESS
						}
					break
					case 'Space':
						// if ( this.bCanJump === true ) this.vVelocity.y += 350
						// this.bCanJump = false
					break
				}
			}
			if(!sget(topmenuVisible)) {
				switch ( ev.code ) {
					case 'Escape':
						// if ( this.bCanJump === true ) this.vVelocity.y += 350
						// this.bCanJump = false
					break
					case 'KeyF':
						// let obj = await Gob.Create('/mesh/fireplace.fbx', scene)
						// obj.mesh.scale.multiplyScalar(0.01 * 3.3)
						// obj.mesh.position.copy(this.player.transform.position)
						// obj.mesh.position.y -= this.ftHeightHead

						// // Place in front; move forward parallel to the xz-plane, assume camera.up is y-up
						// const distance = 8
						// let _vector = new Vector3()
						// _vector.setFromMatrixColumn( player.matrix, 0 )  // camera.matrix
						// _vector.crossVectors( player.up, _vector ) // camera.up
						// obj.mesh.position.addScaledVector( _vector, distance )
					break
				}
			}
        })

        document.addEventListener( 'keyup', (ev) => {
			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' || (!ev.target.id && this.mouse.right))) {
				switch ( ev.code ) {
					case 'ArrowUp':
					case 'KeyW':
						this.keys.w = LIFT
					break
					case 'ArrowLeft':
					case 'KeyA':
						this.keys.a = LIFT
					break
					case 'ArrowDown':
					case 'KeyS':
						this.keys.s = LIFT
					break
					case 'ArrowRight':
					case 'KeyD':
						this.keys.d = LIFT
					break
				}
			}
        })

		// document.addEventListener( 'click', mouseOnClick )
        // const mouseOnClick = (ev) => {
		// 	log.info('mouseOnClick', ev.code, ev.button, ev.target.id)
        // }

        document.addEventListener( 'mousedown', (ev) => {
			log('mouseOnDown', ev.button, ev.target.id)

			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' || (!ev.target.id))) { //  && this.mouse.right
				if(ev.button === MOUSE_LEFT_CODE) this.mouse.left = PRESS
				if(ev.button === MOUSE_RIGHT_CODE) this.mouse.right = PRESS

				if(ev.target.id === 'canvas') {
					try {
						// this.controls.lock()
					} catch(e) {
						log.info('hope')
					}
					
					document.getElementById('canvas').style.cursor = 'none'
				}
				// if(this.mouse.left == true) {
				// 	this.bPressingForward = true
				// }
			}
        })

        document.addEventListener( 'mouseup', (ev) => {
			log.info('mouseOnUp', ev.button, ev.target.id)
			if(ev.button === MOUSE_LEFT_CODE) this.mouse.left = LIFT
			if(ev.button === MOUSE_RIGHT_CODE) this.mouse.right = LIFT

			if(this.mouse.left == false) {
				// this.controls.unlock()
				document.getElementById('canvas').style.cursor = 'auto'
				// this.bPressingForward = false
			}
        })

		topmenuVisible.subscribe(vis => !vis ? null : () => { // If menu becomes visible, release mouse
			// this.controls.unlock()
			document.getElementById('canvas').style.cursor = 'auto'
			this.bPressingForward = false
		})

        return this
    }


    async update(dt, scene) {


		if(this.keys.w || this.keys.s || this.keys.a || this.keys.d) { // Runs every frame, selecting grid position for setDestination

			// Place in front; move forward parallel to the xz-plane, assume camera.up is y-up 
			// hmm below negate because of above old camera logic?  Model upside down or something?
			const controlObject = this.player.controller.target
			let vector = new Vector3()
			vector.setFromMatrixColumn( controlObject.matrix, 0 )  // camera.matrix

			log(this.keys.w ? 'w':'-', this.keys.s ? 's':'-')
			if(this.keys.w) {
				vector.crossVectors( controlObject.up, vector ) // camera.up
			}
			else if(this.keys.s) {
				vector.crossVectors( controlObject.up, vector ) // camera.up
			}

			// controlObject.position.addScaledVector( _vector, distance )
			// Get direction
			vector.normalize()
			if(this.keys.w) vector.negate() // Direction // Why negate?
			// log('vector', vector)


			// Okay, that was direction.  Now get distance
			const gCurrentPos = controlObject.position.clone()
			.addScalar(4/2) // Add a half tile so that forward and backward are equally far apart, because this is from model (model center maybe?)
			.multiplyScalar(1/4).floor() // distance
			this.player.controller.setDestination(gCurrentPos.clone().add(vector))

		}
		
		for(const key in this.keys) { // Update key states after press/lift
			if(this.keys[key] === PRESS) this.keys[key] = ON
			else if(this.keys[key] === LIFT) this.keys[key] = OFF
		}

    }

}
