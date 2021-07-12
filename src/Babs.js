import {
    Vector3,
    Scene,
    BoxGeometry,
    WebGLRenderer,
    PerspectiveCamera,
    Mesh,
    sRGBEncoding,
    MeshPhongMaterial,
    AxesHelper,
} from 'three'
import { World } from './World'
import { offerReconnect, Socket } from './Socket'
import { Ui } from './Ui'
import { InputSys } from './InputSys'
import { ECS } from './ECS'
import { MoveSys } from './MoveSys'
import * as Utils from './Utils'

class BABS {
	camera
	renderer
	cube
	ui
	socket
	alreadyRunning = false
	inputSystem
	moveSystem


	static Init() {
		let babs = new BABS

		// Cookies are required
		const cookiesEnabled = (() => {
			try {
				document.cookie = 'cookietest=1';
				const ret = document.cookie.indexOf('cookietest=') !== -1;
				document.cookie = 'cookietest=1; expires=Thu, 01-Jan-1970 00:00:01 GMT';
				return ret;
			}
			catch (e) {
				return false;
			}
		})()
		console.log('Cookies?', cookiesEnabled)
		if(!cookiesEnabled) {
			offerReconnect('Session cookies needed!')
			return
		}




		// Connect immediately to check for existing session
		babs.ui = Ui.Init()
		babs.scene = new Scene()


		babs.camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 10000 )
		babs.camera.rotateY(Utils.radians(-135))
        // babs.camera.position.set(0, babs.ftHeightHead, 0)

		babs.cube = babs.makeCube()
		babs.scene.add( babs.cube )
		babs.cube.name = 'player'

		babs.world = World.Init(babs.scene, babs.camera, babs.cube)
		babs.inputSystem = InputSys.Create()
		
		babs.socket = Socket.Create(babs.scene, babs.world)

		document.getElementById('charsave').addEventListener('click', (ev) => {
			ev.preventDefault()
			document.getElementById('charsave').disabled = true
			babs.socket.enter(
				document.getElementById('email').value, 
				document.getElementById('password').value
			)
		})

		babs.moveSystem = MoveSys.Create().init()

		// Poll for ready so no circular dependency - todo rethink this dep situation
		const waitForReady = () => {
			if(babs.socket.babsReady) {
				babs.run()
			} 
			else {
				setTimeout(waitForReady, 100)
			}
		}
		waitForReady()

		return babs
	}

	async run() {
		if(this.alreadyRunning) return
		this.alreadyRunning = true


		// this.idPlayer = ECS.CreateEnt(1)
		// ECS.AddCom(this.idPlayer, 'controller', )

		// Components init
		// ECS.GetComsAll(Controller.sType).forEach(async com => {
		// 	await com.init(this.scene, this.camera, this.socket) // make 'em wait! // Should I have to pass to each?
		// })
		// todo replace above with system
		this.inputSystem.init(this.scene, this.camera, this.socket)



		window.addEventListener('resize', () => {
			console.log('resize')
			this.camera.aspect = window.innerWidth / window.innerHeight
			this.renderer.setSize( window.innerWidth, window.innerHeight )
			this.camera.updateProjectionMatrix()
			this.renderer.render( this.scene, this.camera ) // todo needed at all since animate() does it?
		})

		this.ui.createStats('fps').createStats('mem')

		this.renderer = new WebGLRenderer( { antialias: true } )
		console.log('isWebGL2', this.renderer.capabilities.isWebGL2)
		this.renderer.setPixelRatio( Ui.browser == 'chrome' ? window.devicePixelRatio : 1 )// <-'1' Helps on safari // window.devicePixelRatio )
		this.renderer.setSize( window.innerWidth, window.innerHeight )
		this.renderer.setAnimationLoop( (p) => {
			this.animation(p)
		} )
		document.body.appendChild( this.renderer.domElement )
		this.renderer.outputEncoding = sRGBEncoding // todo?
		this.renderer.shadowMap.enabled = true

		// add an AxesHelper to each node
		this.scene.children.forEach((node) => {
			const axes = new AxesHelper(10)
			axes.renderOrder = 1
			axes.position.add(new Vector3(-0.2,0.2,-0.2))
			node.add(axes)
		})

		/** @type {HTMLCanvasElement} */
		const canvas = this.renderer.domElement
		canvas.id = 'canvas'

		// console.log(this.renderer, sRGBEncoding) // confirmed: renderer.outputEncoding === THREE.sRGBEncoding


		document.getElementById('canvas').addEventListener('contextmenu', ev => ev.preventDefault()); // move to ui?
	}

	prevTime = performance.now()
	delta
	animation(time) {
		this.ui['fps']?.begin()
		this.ui['mem']?.begin()
		this.delta = (time -this.prevTime) /1000

		this.cube.rotation.x = time /4000
		this.cube.rotation.y = time /1000
		
		this.moveSystem.update(this.delta, this.camera, this.socket, this.scene)
		this.inputSystem.animControls(this.delta, this.scene)
		this.world.animate(this.delta, this.camera)

		this.socket?.update(this.delta)
		
		this.prevTime = time
		this.renderer.render( this.scene, this.camera )

		this.ui['fps']?.end()
		this.ui['mem']?.end()
	}

	makeCube() {
		const geometry = new BoxGeometry( 10, 10, 10 )
		const material = new MeshPhongMaterial()
		const cube = new Mesh(geometry, material)
		cube.name = 'this.cameracube'
		cube.position.copy(new Vector3(0,200,0))
		cube.castShadow = true
		// cube.receiveShadow = true
		return cube
	}

}

export default BABS.Init()
