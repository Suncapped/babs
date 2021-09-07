import { Camera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from "three"
import { BabsPointerLockControls } from "./BabsPointerLockControls"
import { Gob } from "../ent/Gob"
import { topmenuVisible } from "../stores"
import * as Utils from "../Utils"
import { get as sget } from 'svelte/store'
import { log } from './../Utils'

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
    
    // static controls

	// Stateful tracking of mouse buttons
	static mouse = {
		left: false, // false=off, 1=pressed, true=on, 0=lifted
		right: false,
		center: false,
		four: false,
		five: false,
		x: false, // false=offscreen?
		y: false,
	}
	static keys = {
		w: false, // false=off, 1=pressed, true=on, 0=lifted
		a: false,
		s: false,
		d: false,
		shift: false,
		space: false,
	}

	static MOUSE_LEFT_CODE = 0
	static MOUSE_RIGHT_CODE = 2


    static async Start(scene, camera) {
        // this.raycaster = await new Raycaster( new Vector3(), new Vector3( 0, - 1, 0 ), 0, 50 )
        // this.controls = new BabsPointerLockControls( camera, document.getElementById('canvas') )

        const keyOnDown = async (ev) => {
			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' || (!ev.target.id && this.mouse.right))) {
				switch ( ev.code ) {
				    case 'ArrowUp':
				    case 'KeyW':
				        this.bPressingForward = true
					break
				    case 'ArrowLeft':
				    case 'KeyA':
				        this.bPressingLeft = true
					break
				    case 'ArrowDown':
				    case 'KeyS':
				        this.bPressingBackward = true
					break
				    case 'ArrowRight':
				    case 'KeyD':
				        this.bPressingRight = true
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
						let obj = await Gob.Create('/mesh/fireplace.fbx', scene)
						obj.mesh.scale.multiplyScalar(0.01 * 3.3)
						const player = scene.children.find(o=>o.name=='player')
						obj.mesh.position.copy(player.position)
						obj.mesh.position.y -= this.ftHeightHead

						// Plaxe in front; move forward parallel to the xz-plane, assume camera.up is y-up
						const distance = 8
						let _vector = new Vector3()
						_vector.setFromMatrixColumn( player.matrix, 0 )  // camera.matrix
						_vector.crossVectors( player.up, _vector ) // camera.up
						obj.mesh.position.addScaledVector( _vector, distance )
					break
				}
			}
        }
        const keyOnUp = (ev) => {
			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' || (!ev.target.id && this.mouse.right))) {
				switch ( ev.code ) {
					case 'ArrowUp':
					case 'KeyW':
						this.bPressingForward = false
					break
					case 'ArrowLeft':
					case 'KeyA':
						this.bPressingLeft = false
					break
					case 'ArrowDown':
					case 'KeyS':
						this.bPressingBackward = false
					break
					case 'ArrowRight':
					case 'KeyD':
						this.bPressingRight = false
					break
				}
			}
        }

        const mouseOnDown = (ev) => {
			log.info('mouseOnDown', ev.button, ev.target.id)

			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' || (!ev.target.id && this.mouse.right))) {
				if(ev.button === InputSys.MOUSE_LEFT_CODE) this.mouse.left = true
				if(ev.button === InputSys.MOUSE_RIGHT_CODE) this.mouse.right = true

				if(ev.target.id === 'canvas') {
					try {
						this.controls.lock()
					} catch(e) {
						log.info('hope')
					}
					
					document.getElementById('canvas').style.cursor = 'none'
				}
				if(this.mouse.left) {
					this.bPressingForward = true
				}
			}
        }

		topmenuVisible.subscribe(vis => vis ? this.releaseMouse() : null) // If menu becomes visible, release mouse
        const mouseOnUp = (ev) => {
			log.info('mouseOnUp', ev.button, ev.target.id)

			if(ev.button === InputSys.MOUSE_LEFT_CODE) this.mouse.left = false
			if(ev.button === InputSys.MOUSE_RIGHT_CODE) this.mouse.right = false

			if(!this.mouse.right && !this.mouse.left) {
				this.controls.unlock()
				document.getElementById('canvas').style.cursor = 'auto'
			}
			if(!this.mouse.left) {
				this.bPressingForward = false
			}
        }
        const mouseOnClick = (ev) => {
			log.info('mouseOnClick', ev.code, ev.button, ev.target.id)
        }

        window.document.addEventListener( 'click', mouseOnClick )
        window.document.addEventListener( 'mousedown', mouseOnDown )
        window.document.addEventListener( 'mouseup', mouseOnUp )
        window.document.addEventListener( 'keyup', keyOnUp )
        window.document.addEventListener( 'keydown', keyOnDown )

        return this
    }

	static releaseMouse() {
		this.controls.unlock()
		document.getElementById('canvas').style.cursor = 'auto'
		this.bPressingForward = false
	}

    static Update(delta, scene) {

    }

}
