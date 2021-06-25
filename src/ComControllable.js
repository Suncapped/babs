import { Camera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from "three"
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls"
import { BabsObject } from "./Object"
import { Com } from "./Com"

export class ComControllable extends Com {
    static sType = 'controllable'
    idEnt

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

    static Create(idEnt, props) {
        const c = new ComControllable
        c.idEnt = idEnt
        Object.assign(c, props) // Overrides of defaults // todo reenable
        return c
    }

    async init(scene, camera) {
        console.log('init ComControllable on ' + this.idEnt, this.cameraStartPosition)
        camera.name = 'player'

        camera.position.set(0, this.ftHeightHead, 0)

        this.controls = new PointerLockControls( camera, document.body )
        // const blocker = window.document.getElementById( 'blocker' )
        // const instructions = window.document.getElementById( 'instructions' )
        
        this.controls.isLocked = true // Don't require pointer lock to move around, but still allow it too, below
        window.document.addEventListener( 'click', () => {
            this.controls.lock()
            this.bPressingForward = false // In case of a previous click
        })
        // controls.addEventListener( 'lock', function () {
        //     instructions.style.display = 'none'
        //     blocker.style.display = 'none'
        // } )
        // controls.addEventListener( 'unlock', function () {
        //     blocker.style.display = 'block'
        //     instructions.style.display = ''
        // } )
        // document.addEventListener("DOMContentLoaded", function(event) {
        // })

        // scene.add( this.controls.getObject() ) // Camera is already added isn't it?

        

        const onKeyDown = async ( event ) => {
            switch ( event.code ) {
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
                    if ( this.bCanJump === true ) this.vVelocity.y += 350
                    this.bCanJump = false
                    break
                case 'KeyF':
                    let obj = await new BabsObject().init('/mesh/fireplace.fbx', scene)
                    obj.mesh.scale.multiplyScalar(0.01 * 3.3)
                    const player = scene.children.find(o=>o.name=='player')
                    obj.mesh.position.copy(player.position)
                    obj.mesh.position.y -= this.ftHeightHead
                    break
            }
        }
        const onKeyUp = (event) => {
            switch ( event.code ) {
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
        const onMouseDown = (event) => {
            if(event.button === 2) {
                this.bPressingForward = true
            }
        }
        const onMouseUp = (event) => {
            if(event.button === 2) {
                this.bPressingForward = false
            }
        }
        this.raycaster = await new Raycaster( new Vector3(), new Vector3( 0, - 1, 0 ), 0, 50 )
        window.document.addEventListener( 'keydown', onKeyDown )
        window.document.addEventListener( 'keyup', onKeyUp )
        window.document.addEventListener( 'mousedown', onMouseDown )
        window.document.addEventListener( 'mouseup', onMouseUp )

        return this
    }

    ten = 0
    animControls(delta, scene) {
        if (this.controls.isLocked === true) {

            this.raycaster.ray.origin.copy( this.controls.getObject().position )
            // this.raycaster.ray.origin.y += this.ftHeightHead*2
            // console.log(scene.children.length)
            let intersections = this.raycaster.intersectObjects( scene.children )
            const intersNotCamera = intersections?.filter(o => o.object.name !== 'cameracube')
            // const onObject = intersNotCamera.length > 0
            const onObject = intersNotCamera?.[0]?.distance <= this.ftHeightHead

            // if(this.ten < 10) {

            //     // console.log(scene.children)
            //     this.ten++
            // }
    
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
    
        }
    }

}
