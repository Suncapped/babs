import { Camera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from "three"
import { BabsPointerLockControls } from "./BabsPointerLockControls"
import { Gob } from "./Gob"
import * as Utils from "./Utils"

export class InputSystem {

    bPressingForward = false
    bPressingBackward = false
    bPressingLeft = false
    bPressingRight = false
    bCanJump = false
    vVelocity = new Vector3()
    vAccel = new Vector3()
    ftpsSpeed = 2000 // Todo scale this here and in tick to ft/s // Is it really speed?
    ftHeightHead = 6
    
    controls
    raycaster

    static Create() {
        return new InputSystem
    }

    async init(scene, camera, socket) {

        camera.name = 'player'
        camera.rotateY(Utils.radians(-135))
        camera.position.set(0, this.ftHeightHead, 0)
        scene.add(camera)

        this.raycaster = await new Raycaster( new Vector3(), new Vector3( 0, - 1, 0 ), 0, 50 )

        this.controls = new BabsPointerLockControls( camera, document.body )

        const onKeyDown = async ( ev ) => {

            switch ( ev.code ) {
                case 'ArrowUp':
                // case 'KeyW':
                    this.bPressingForward = true
                    break
                case 'ArrowLeft':
                // case 'KeyA':
                    this.bPressingLeft = true
                    break
                case 'ArrowDown':
                // case 'KeyS':
                    this.bPressingBackward = true
                    break
                case 'ArrowRight':
                // case 'KeyD':
                    this.bPressingRight = true
                    break
                case 'Space':
                    // if ( this.bCanJump === true ) this.vVelocity.y += 350
                    // this.bCanJump = false
                    break
                case 'KeyF':
                    // let obj = await Gob.Create('/mesh/fireplace.fbx', scene, socket)
                    // obj.mesh.scale.multiplyScalar(0.01 * 3.3)
                    // const player = scene.children.find(o=>o.name=='player')
                    // obj.mesh.position.copy(player.position)
                    // obj.mesh.position.y -= this.ftHeightHead

					// Place fire in front of you:
					// // move forward parallel to the xz-plane
					// // assumes camera.up is y-up
					// _vector.setFromMatrixColumn( camera.matrix, 0 );
					// _vector.crossVectors( camera.up, _vector );
					// camera.position.addScaledVector( _vector, distance );
					
                    break
            }
        }
        const onKeyUp = (ev) => {
            switch ( ev.code ) {
                case 'ArrowUp':
                // case 'KeyW':
                    this.bPressingForward = false
                    break

                case 'ArrowLeft':
                // case 'KeyA':
                    this.bPressingLeft = false
                    break

                case 'ArrowDown':
                // case 'KeyS':
                    this.bPressingBackward = false
                    break

                case 'ArrowRight':
                // case 'KeyD':
                    this.bPressingRight = false
                    break
            }
        }
        const onMouseDown = (ev) => {
            if(ev.button === 2) {
				if(ev.target.id === 'canvas') {
					console.log('mouse2down target', ev.target.id)
					this.controls.lock()
					this.bPressingForward = true
					document.getElementById('canvas').style.cursor = 'none'
				}
            }
        }
        const onMouseUp = (ev) => {
            if(ev.button === 2) {
				console.log('mouse2up target', ev.target.id)
				this.controls.unlock()
                this.bPressingForward = false
				document.getElementById('canvas').style.cursor = 'auto'
            }
        }

        const keyListener = (ev) => {
            // console.log('KL', ev)
            // if(this.controls.isLocked === true) {
                switch(ev.type) {
                    case 'keydown':
                        onKeyDown(ev)
                    break
                    case 'keyup':
                        onKeyUp(ev)
                    break
                }
            // }
        }

        const mouseListener = (ev) => {
            // console.log('ML', ev)
            // if(ev.target.id === 'canvas'){ // Limit to canvas
            //     if(ev.type == 'click') {
			// 		// this.controls.lock()
			// 		document.getElementById('canvas').style.cursor = 'none'
			// 		this.bPressingForward = false // In case of a previous click
            //     }
            // }
            // if(this.controls.isLocked === true){
                switch(ev.type) {
                    case 'mousedown':
                        onMouseDown(ev)
                    break
                    case 'mouseup':
                        onMouseUp(ev)
                    break
                    case 'keydown':
                        onKeyDown(ev)
                    break
                    case 'keyup':
                        onKeyUp(ev)
                    break
                }
            // }

        }
        window.document.addEventListener( 'click', mouseListener )
        window.document.addEventListener( 'mousedown', mouseListener )
        window.document.addEventListener( 'mouseup', mouseListener )
        window.document.addEventListener( 'keyup', keyListener )
        window.document.addEventListener( 'keydown', keyListener )

        return this
    }

    ten = 0
    animControls(delta, scene) {
		
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
