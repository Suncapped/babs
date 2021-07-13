import { Camera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from "three"
import { BabsPointerLockControls } from "./BabsPointerLockControls"
import { Gob } from "../ent/Gob"
import { topmenuVisible } from "../stores"
import * as Utils from "../Utils"
import { get as sget } from 'svelte/store';

export class InputSys {

    static bPressingForward = false
    static bPressingBackward = false
    static bPressingLeft = false
    static bPressingRight = false
    static bCanJump = false
    static vVelocity = new Vector3()
    static vAccel = new Vector3()
    static ftpsSpeed = 500 // Todo scale this here and in tick to ft/s // Is it really speed?
    static ftHeightHead = 6
    
    static controls
    static raycaster

	// Stateful tracking of mouse button states
	static mouse = {
		button: {
			left: false,
			right: false,
			center: false,
			four: false,
			five: false,
		},
		pos: {
			x: 0,
			y: 0,
		},
	}

	static MOUSE_LEFT = 0
	static MOUSE_RIGHT = 2


    static async Start(scene, camera) {


        this.raycaster = await new Raycaster( new Vector3(), new Vector3( 0, - 1, 0 ), 0, 50 )

        this.controls = new BabsPointerLockControls( camera, document.getElementById('canvas') )


        const keyOnDown = async (ev) => {
			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' || (!ev.target.id && this.mouse.button.right))) {
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
			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' || (!ev.target.id && this.mouse.button.right))) {
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
			console.log('mouseOnDown', ev.button, ev.target.id)

			if(!sget(topmenuVisible) && (ev.target.id === 'canvas' || (!ev.target.id && this.mouse.button.right))) {
				if(ev.button === InputSys.MOUSE_LEFT) this.mouse.button.left = true
				if(ev.button === InputSys.MOUSE_RIGHT) this.mouse.button.right = true

				if(ev.target.id === 'canvas') {
					try {
						this.controls.lock()
					} catch(e) {
						console.log('hope')
					}
					
					document.getElementById('canvas').style.cursor = 'none'
				}
				if(this.mouse.button.left) {
					this.bPressingForward = true
				}
			}
        }

		topmenuVisible.subscribe(vis => vis ? this.releaseMouse() : null) // If menu becomes visible, release mouse
        const mouseOnUp = (ev) => {
			console.log('mouseOnUp', ev.button, ev.target.id)

			if(ev.button === InputSys.MOUSE_LEFT) this.mouse.button.left = false
			if(ev.button === InputSys.MOUSE_RIGHT) this.mouse.button.right = false

			if(!this.mouse.button.right && !this.mouse.button.left) {
				this.controls.unlock()
				document.getElementById('canvas').style.cursor = 'auto'
			}
			if(!this.mouse.button.left) {
				this.bPressingForward = false
			}
        }
        const mouseOnClick = (ev) => {
			console.log('mouseOnClick', ev.code, ev.button, ev.target.id)
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

    static ten = 0
    static Update(delta, scene) {

        // if (this.controls.isLocked === true) {

            this.raycaster.ray.origin.copy( this.controls.getObject().position )
            // this.raycaster.ray.origin.y += this.ftHeightHead*2
            // console.log(scene.children.length)
            let intersections = this.raycaster.intersectObjects( scene.children )
            const intersNotCamera = intersections?.filter(o => o.object.name !== 'cameracube')
            // const onObject = intersNotCamera.length > 0
            const onObject = intersNotCamera?.[0]?.distance <= this.ftHeightHead
    
            this.vVelocity.x -= this.vVelocity.x * 10.0 * delta
            this.vVelocity.z -= this.vVelocity.z * 10.0 * delta
    
            const mass = 100
            this.vVelocity.y -= 9.8 * mass * delta
    
            this.vAccel.z = Number( this.bPressingForward ) - Number( this.bPressingBackward )
            this.vAccel.x = Number( this.bPressingRight ) - Number( this.bPressingLeft )
            this.vAccel.normalize(); // this ensures consistent movements in all directions
    
            if ( this.bPressingForward || this.bPressingBackward ) this.vVelocity.z -= this.vAccel.z * this.ftpsSpeed * delta // Todo scale this here and in tick to ft/s
            if ( this.bPressingLeft || this.bPressingRight ) this.vVelocity.x -= this.vAccel.x * this.ftpsSpeed * delta // Todo scale this here and in tick to ft/s
    
            if ( onObject === true ) {
                // console.log("onObject", intersNotCamera.length, intersNotCamera[0])
                this.vVelocity.y = Math.max( 0, this.vVelocity.y ); // It's Max so that you can jump when on an object :p
                this.bCanJump = true
            }

            this.controls.moveRight( - this.vVelocity.x * delta )
            this.controls.moveForward( - this.vVelocity.z * delta )
    
            this.controls.getObject().position.y += ( this.vVelocity.y * delta ); // new behavior
    
            if ( this.controls.getObject().position.y < this.ftHeightHead ) {
    
                this.vVelocity.y = 0
                this.controls.getObject().position.y = this.ftHeightHead
    
                this.bCanJump = true
    
            }

            // this.position = this.controls.getObject().position  // this.controls.getObject() is camera I think
            // If below terrain, pop back onto it.  So you don't fall through land when going up it

            this.raycaster.ray.origin.copy( this.controls.getObject().position )
            this.raycaster.ray.origin.y += 20
            const ground = scene.children.find(o=>o.name=='ground')
            intersections = ground && this.raycaster.intersectObject(ground)
            const groundHeightY = intersections?.[0]?.point.y
            // console.log(groundHeightY, this.controls.getObject().position.y)
            if(groundHeightY > this.controls.getObject().position.y -this.ftHeightHead) {
                // console.log('stopped')
                this.controls.getObject().position.y = groundHeightY + this.ftHeightHead
            }
    
        // }
    }

}
