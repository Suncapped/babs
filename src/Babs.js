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

import * as Utils from './Utils'
// import { BbPlayer } from './BabsPlayer'
import { World } from './World'
import { Socket } from './Socket'

// import Stats from 'three/examples/jsm/libs/stats.module.js'
import Stats from 'three/examples/jsm/libs/stats.module'

import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { Ui, Uic } from './Ui'
import { ComControllable } from './ComControllable'
import { Com } from './Com'
// import { Ent } from './Ent'



let camera, scene, renderer
let fps, mem
let world
let idPlayer
let cube
let prevTime = performance.now()
let uic


class ECS {
    /** @type {Set} ents */
    static ents = new Set()
    
    /** 
     * @return {number} entity id
     * */
     static CreateEnt(idEnt) {
        ECS.ents.add(idEnt)
        return idEnt
    }

    /** @type {Object.<string, Com[]>} coms - object of types, each type has array of coms */
    static coms = {}
    
    /** 
     * @param {Com|null} clCom class to get, or null for all
     * @return {Com[]} all components of given class
     * */
    static GetComsAll(clCom) {
        return clCom ? ECS.coms[clCom.sType] : ECS.coms
    }

    /** 
     * @return {null|Com} component of given class on entity, if exists
     * */
    static GetCom(clCom, idEnt) {
        if(!ECS.ents.has(idEnt)) return null
        return ECS.coms[clCom.sType].find(com => com.idEnt === idEnt)
    }

    /** 
     * @return {null|Com} component of given class on entity, if exists
     * */
    static AddCom(clCom, idEnt, props) {
        if(!ECS.ents.has(idEnt)) return null
        ECS.coms[clCom.sType] = ECS.coms[clCom.sType] || [] // Create if needed
        const length = ECS.coms[clCom.sType].push(clCom.Create(idEnt, props))
        return ECS.coms[clCom.sType][length -1]
    }

}




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
    
    world = new World(scene)
    
    idPlayer = ECS.CreateEnt(1)

    ECS.AddCom(ComControllable, idPlayer)

    ECS.GetComsAll(ComControllable).forEach(async com => {
        await com.init(scene, camera) // make 'em wait!
    })

    cube = makeCube(scene)
    world.dirLight.target = cube
    scene.add( world.dirLight.target )

    window.addEventListener('resize', function () { 
        camera.aspect = window.innerWidth / window.innerHeight
        renderer.setSize( window.innerWidth, window.innerHeight )
        camera.updateProjectionMatrix()
        renderer.render( scene, camera )
    })

    // let ui = new Ui(document)
    // ui.createStats('fps').createStats('mem')
    uic = new Uic(document)
    uic.createStats('fps').createStats('mem')

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


    /** @type {HTMLCanvasElement} */
    const canvas = renderer.domElement
    canvas.id = 'canvas'

// var outlineMaterial1 = new THREE.MeshBasicMaterial( { color: 0xff0000, side: THREE.BackSide } )
// 	var outlineMesh1 = new THREE.Mesh( geometry, outlineMaterial1 )
// 	outlineMesh1.position.set( mesh.position)
// 	outlineMesh1.scale.multiplyScalar(1.05)
// 	scene.add( outlineMesh1 )
}


let delta
function animation(time) {
    uic['fps'].begin()
    uic['mem'].begin()
    delta = (time -prevTime) /1000

	cube.rotation.x = time /4000
	cube.rotation.y = time /1000
    
    ECS.GetComsAll(ComControllable).forEach(com => {
        com.animControls(delta, scene)
    })

    world.animate(delta, camera, idPlayer)
    
    prevTime = time
	renderer.render( scene, camera )


    uic['fps'].end()
    uic['mem'].end()
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


let socket = new Socket()
socket.connect()
socket.ws.onopen = (event) => {
    console.log('socket onopen', event)
    socket.send(`Login:adam/test`)
}
/**
 * Represents a book.
 * @constructor
 * @param {MessageEvent} event - The title of the book.
 */
socket.ws.onmessage = async (event) => {
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
                await world.loadStatics(Socket.urlFiles, scene)
                // TODO do joining stuff then


                // await sleep(1000)

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
