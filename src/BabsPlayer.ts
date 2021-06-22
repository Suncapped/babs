import { Camera, PerspectiveCamera, Quaternion, Raycaster, Vector3 } from "three"
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls"
import { BabsObject } from "./BabsObject"

// import { Schema, type, ArraySchema, MapSchema, DataChange } from "@colyseus/schema"


export class Player {
    public sess: string
    public x: number
    public y: number
    public z: number
    public online: boolean

    controls
    raycaster
    moveForward = false
    moveBackward = false
    moveLeft = false
    moveRight = false
    canJump = false
    prevTime = performance.now()
    velocity = new Vector3()
    direction = new Vector3()
    moveSpeed = 2000//400
    
    playerHeight = 6
    cameraStartPosition = new Vector3( 0, this.playerHeight, 0 )

    async init(scene, camera) {
        camera.name = 'player'

        camera.position.copy(this.cameraStartPosition)

        this.controls = new PointerLockControls( camera, document.body )
        // const blocker = window.document.getElementById( 'blocker' )
        // const instructions = window.document.getElementById( 'instructions' )
        
        this.controls.isLocked = true // Don't require pointer lock to move around, but still allow it too, below
        window.document.addEventListener( 'click', () => {
            this.controls.lock()
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

        scene.add( this.controls.getObject() )
        const onKeyDown = async ( event ) => {
            switch ( event.code ) {
                case 'ArrowUp':
                case 'KeyW':
                    this.moveForward = true
                    break
                case 'ArrowLeft':
                case 'KeyA':
                    this.moveLeft = true
                    break
                case 'ArrowDown':
                case 'KeyS':
                    this.moveBackward = true
                    break
                case 'ArrowRight':
                case 'KeyD':
                    this.moveRight = true
                    break
                case 'Space':
                    if ( this.canJump === true ) this.velocity.y += 350
                    this.canJump = false
                    break
                case 'KeyF':
                    let obj = await new BabsObject().init('/mesh/fireplace.fbx', scene)
                    obj.mesh.scale.multiplyScalar(0.01 * 3.3)
                    const player = scene.children.find(o=>o.name=='player')
                    obj.mesh.position.copy(player.position)
                    obj.mesh.position.y -= this.playerHeight
                    break
            }
        }
        const onKeyUp = (event) => {
            switch ( event.code ) {
                case 'ArrowUp':
                case 'KeyW':
                    this.moveForward = false
                    break

                case 'ArrowLeft':
                case 'KeyA':
                    this.moveLeft = false
                    break

                case 'ArrowDown':
                case 'KeyS':
                    this.moveBackward = false
                    break

                case 'ArrowRight':
                case 'KeyD':
                    this.moveRight = false
                    break
            }
        }
        this.raycaster = await new Raycaster( new Vector3(), new Vector3( 0, - 1, 0 ), 0, 50 )
        window.document.addEventListener( 'keydown', onKeyDown )
        window.document.addEventListener( 'keyup', onKeyUp )

        return this
    }

    animControls(delta, scene) {
        if (this.controls.isLocked === true ) {

            this.raycaster.ray.origin.copy( this.controls.getObject().position )
            // this.raycaster.ray.origin.y += 40
            let intersections = this.raycaster.intersectObjects( scene.children )
            const intersNotCamera = intersections?.filter(o => o.object.name !== 'cameracube')
            // const onObject = intersNotCamera.length > 0
            const onObject = intersNotCamera?.[0]?.distance <= 6
    
            this.velocity.x -= this.velocity.x * 10.0 * delta
            this.velocity.z -= this.velocity.z * 10.0 * delta
    
            const mass = 100
            this.velocity.y -= 9.8 * mass * delta
    
            this.direction.z = Number( this.moveForward ) - Number( this.moveBackward )
            this.direction.x = Number( this.moveRight ) - Number( this.moveLeft )
            this.direction.normalize(); // this ensures consistent movements in all directions
    
            if ( this.moveForward || this.moveBackward ) this.velocity.z -= this.direction.z * this.moveSpeed * delta
            if ( this.moveLeft || this.moveRight ) this.velocity.x -= this.direction.x * this.moveSpeed * delta
    
            if ( onObject === true ) {
                // console.log("onObject", intersNotCamera.length, intersNotCamera[0])
                this.velocity.y = Math.max( 0, this.velocity.y ); // It's Max so that you can jump when on an object :p
                this.canJump = true
            }
    
            this.controls.moveRight( - this.velocity.x * delta )
            this.controls.moveForward( - this.velocity.z * delta )
    
            this.controls.getObject().position.y += ( this.velocity.y * delta ); // new behavior
    
            if ( this.controls.getObject().position.y < this.playerHeight ) {
    
                this.velocity.y = 0
                this.controls.getObject().position.y = this.playerHeight
    
                this.canJump = true
    
            }

            // this.position = this.controls.getObject().position  // this.controls.getObject() is camera I think
            // If below terrain, pop back onto it.  So you don't fall through land when going up it

            this.raycaster.ray.origin.copy( this.controls.getObject().position )
            this.raycaster.ray.origin.y += 20
            const ground = scene.children.find(o=>o.name=='ground')
            intersections = ground && this.raycaster.intersectObject(ground)
            const groundHeightY = intersections?.[0]?.point.y
            // console.log(groundHeightY, this.controls.getObject().position.y)
            if(groundHeightY > this.controls.getObject().position.y -this.playerHeight) {
                // console.log('stopped')
                this.controls.getObject().position.y = groundHeightY + this.playerHeight
            }
    
        }
    }

}
