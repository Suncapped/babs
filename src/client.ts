import {
    Vector3,
    Scene,
    BoxGeometry,
    WebGLRenderer,
    PerspectiveCamera,
    MeshNormalMaterial,
    Mesh,
    MeshBasicMaterial,
    Fog,
    Color,
    Raycaster,
    DirectionalLight,
    DirectionalLightHelper,
    BackSide,
    SphereGeometry,
    ShaderMaterial,
    HemisphereLight,
    HemisphereLightHelper,
    sRGBEncoding,
    MeshPhongMaterial,
    MeshLambertMaterial,
    AxesHelper,
    Quaternion,
} from 'three'
import ndarray from 'ndarray'
import ops from 'ndarray-ops'
import bicubic from 'bicubic-interpolate'
import ndinterpolate from 'ndarray-linear-interpolate'

import { clamp, rand, sleep, ZONE } from './shared/FeShared'
import * as BabsUtils from './BabsUtils'
import { Player } from './BabsPlayer'
import { World } from './BabsWorld'
import { BabsSocket } from './BabsSocket'

// import Stats from 'three/examples/jsm/libs/stats.module.js'
import Stats from 'three/examples/jsm/libs/stats.module'

import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'



let camera, scene, renderer
let stats
let world, player
let cube
let prevTime = performance.now()


async function init() {
	scene = new Scene()
	camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 10000 )

    // camera.useQuaternion = true
    // var y_axis = new Vector3( 0, 1, 0 )
    // var quaternion = new Quaternion
    // camera.position.applyQuaternion(quaternion.setFromAxisAngle(y_axis, 100))
    // var qm = new Quaternion()
    // Quaternion.slerp(camera.quaternion, destRotation, qm, 0.07)
    // camera.quaternion = qm
    // camera.quaternion.normalize()
    // camera.rotation.y = 2
    // camera.rotateY( - Math.PI / 2 )
    camera.rotateY(BabsUtils.radians(-135))
    
    world = new World(scene)
    player = await new Player().init(scene, camera)
    
    
    cube = makeCube(scene)
    world.dirLight.target = cube
    scene.add( world.dirLight.target )

    window.addEventListener('resize', function () { 
        camera.aspect = window.innerWidth / window.innerHeight
        renderer.setSize( window.innerWidth, window.innerHeight )
        camera.updateProjectionMatrix()
        renderer.render( scene, camera )
    })

    stats = Stats()
    document.body.appendChild( stats.dom )

    
    renderer = new WebGLRenderer( { antialias: true } )
    renderer.setPixelRatio( window.devicePixelRatio )
	renderer.setSize( window.innerWidth, window.innerHeight )
	renderer.setAnimationLoop( animation )
	document.body.appendChild( renderer.domElement )
    renderer.outputEncoding = sRGBEncoding // todo?
    renderer.shadowMap.enabled = true


    // add an AxesHelper to each node
    scene.children.forEach((node) => {
        const axes = new AxesHelper(10)
        axes.renderOrder = 1
        axes.position.add(new Vector3(-0.2,0.2,-0.2))
        node.add(axes)
    })



    const canvas = renderer.domElement as HTMLCanvasElement

// var outlineMaterial1 = new THREE.MeshBasicMaterial( { color: 0xff0000, side: THREE.BackSide } )
// 	var outlineMesh1 = new THREE.Mesh( geometry, outlineMaterial1 )
// 	outlineMesh1.position.set( mesh.position)
// 	outlineMesh1.scale.multiplyScalar(1.05)
// 	scene.add( outlineMesh1 )
}

let delta
function animation( time ) {
    stats.begin()
    delta = (time -prevTime) /1000

	cube.rotation.x = time /4000
	cube.rotation.y = time /1000

    player?.animControls(delta, scene)
    world.animate(delta, camera, player)

    
    prevTime = time
	renderer.render( scene, camera )
    stats.end()
}


init()


// let cube, geometry, material
function makeCube(scene) {
    const geometry = new BoxGeometry( 10, 10, 10 )
    const material = new MeshPhongMaterial()
    const cube = new Mesh(geometry, material)
    cube.name = 'cameracube'
    cube.position.copy(new Vector3(0,200,0))
    cube.castShadow = true
    cube.receiveShadow = true
    return cube
}

// --

// SETUP // todo, env based on url maybe?
// if(import.meta.env.SNOWPACK_PUBLIC_DEVONLIVE === 'true') {
//     console.log('import.meta.env.SNOWPACK_PUBLIC_DEVONLIVE:', import.meta.env.SNOWPACK_PUBLIC_DEVONLIVE)
// }
// console.log('import.meta.env.NODE_ENV: ', import.meta.env.NODE_ENV) 

// const engine = new Engine(canvas, true, {
//     deterministicLockstep: true, lockstepMaxSteps: 4
// })
// window.addEventListener('beforeunload', function(event) {
    // socket.ws.close()
// }, false)

// let [forward, left, right, back] = [false, false, false, false]
// scene.onKeyboardObservable.add((kbInfo) => {
//     // if(kbInfo.type === KeyboardEventTypes.KEYDOWN) {
//         switch (kbInfo.event.key) {
//             case 'w':
//             case 'ArrowUp':
//                 forward = kbInfo.type === KeyboardEventTypes.KEYDOWN
//                 break
//             case 'a':
//             case 'ArrowLeft':
//                 left = kbInfo.type === KeyboardEventTypes.KEYDOWN
//                 break

//             case 's':
//             case 'ArrowDown':
//                 back = kbInfo.type === KeyboardEventTypes.KEYDOWN
//                 break

//             case 'd':
//             case 'ArrowRight':
//                 right = kbInfo.type === KeyboardEventTypes.KEYDOWN
//                 break

//             // case KeyboardEventTypes.KEYDOWN:
//             // break
//             // case KeyboardEventTypes.KEYUP:
//             //     console.log("KEY UP: ", kbInfo.event.keyCode)
//             //     break
//         }
//     // }
// })


// PERSONS
// var spheres = new Array<Mesh>()
// var texts = new Array<TextBlock>()


let socket = new BabsSocket()
socket.connect()
socket.ws.onopen = (event) => {
    console.log('socket onopen', event)
    socket.send(`Login:adam/test`)
}
socket.ws.onmessage = async (event:MessageEvent<any>) => {
    console.log('Rec:', event.data)
    if(typeof event.data === 'string') {
        const parts = event.data.split(/\:(.+)/) // split on first ':'
        if(parts.length > 1) {
            if('Session' === parts[0]) {
                socket.session = parts[1]
                localStorage.setItem('session', socket.session)
                socket.send('Session:'+socket.session)
            }
            else if('Join' === parts[0]) {
                const joinZone = parts[1]
                await world.loadStatics(BabsSocket.urlFiles, scene)
                // TODO do joining stuff then


                await sleep(1000)

                socket.send('Join:'+joinZone)
            }
            else {
                console.log('Unknown event.data value')
            }
        }
    }
}


// ENGINE
// Render every frame
// var renderi = 0
// var mypos = new Vector3(0,0,0)
// const moveSpeed = 12 // feet per second, aka 3 squares
// let speed, move
// engine.runRenderLoop(() => {

//     // speed = moveSpeed * engine.getDeltaTime() / 1000
//     // move = new Vector3(left?-speed:right?speed:0, 0, back?-speed:forward?speed:0)
//     // player.position.addInPlace(move)
//     // camera.position.addInPlace(move)
//     // camera.setTarget(player.position)

//     // renderi++
//     // if(renderi % 60 === 1) 
//     // if(!camera.position.floor().equals(mypos)) {
//     //     mypos = camera.position.floor()
//         // room.send("move", { x: mypos.x, y: mypos.y, z: mypos.z })
//     // }
    
//     // var fpsLabel = document.getElementById('fpsLabel')!
//     // fpsLabel.innerHTML = engine.getFps().toFixed() + ' fps & '+camera.rotation
//     // Move into client renderer

//     outer:
//     for(let text of texts){
//         for(let sphere of spheres) {
//             if(text.name == sphere.name){
//                 text.moveToVector3(new Vector3(sphere.position.x, sphere.position.y + 10, sphere.position.z), scene)
//                 break outer // More performant than returning a function
//             }
//         }
//     }
//     scene.render()
// })
