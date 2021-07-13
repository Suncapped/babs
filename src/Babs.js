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
import { WorldSys } from './sys/WorldSys'
import { SocketSys } from './sys/SocketSys'
import { UiSys } from './sys/UiSys'
import { InputSys } from './sys/InputSys'
import { MoveSys } from './sys/MoveSys'
import * as Utils from './Utils'

class BABS {

	static isProd = window.location.href.startsWith('https://earth.suncapped.com')
	static baseDomain
	static urlFiles
	static urlSocket

	static camera
	static renderer
	static cube
	static ui
	static alreadyRunning = false


	static Start() {

		if (this.isProd) {
			this.urlSocket = `wss://proxima.suncapped.com` /* Proxima */
			this.urlFiles = `https://earth.suncapped.com` /* Express (includes Snowback build) */
			this.baseDomain = 'suncapped.com'
		}
		else {
			const localDomain = 'localhost'
			this.urlSocket = `ws://${localDomain}:2567` /* Proxima */
			this.urlFiles = `http://${localDomain}:3000` /* Express (Snowpack dev is 8081) */
			this.baseDomain = `${localDomain}`
		}

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
			UiSys.OfferReconnect('Session cookies needed!')
			return
		}

		UiSys.Start()
		
		this.scene = new Scene()

		this.camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 10000 )
		this.camera.rotateY(Utils.radians(-135))
        this.camera.position.set(0, InputSys.ftHeightHead, 0)

		this.cube = this.makeCube()
		this.scene.add( this.cube )
		this.cube.name = 'player'

		WorldSys.Start(this.scene, this.camera, this.cube)
		
		SocketSys.Start(this.scene, this.urlSocket, this.urlFiles)

		document.getElementById('charsave').addEventListener('click', (ev) => {
			ev.preventDefault()
			document.getElementById('charsave').disabled = true
			SocketSys.Enter(
				document.getElementById('email').value, 
				document.getElementById('password').value
			)
		})

		MoveSys.Start()

		// Poll for ready so no circular dependency - todo rethink this dep situation
		const waitForReady = () => {
			if(SocketSys.babsReady) {
				this.Run()
			} 
			else {
				setTimeout(waitForReady, 100)
			}
		}
		waitForReady()

	}

	static async Run() {
		if(this.alreadyRunning) return
		this.alreadyRunning = true


		InputSys.Start(this.scene, this.camera)

		window.addEventListener('resize', () => {
			console.log('resize')
			this.camera.aspect = window.innerWidth / window.innerHeight
			this.renderer.setSize( window.innerWidth, window.innerHeight )
			this.camera.updateProjectionMatrix()
			this.renderer.render( this.scene, this.camera ) // todo needed at all since animate() does it?
		})

		UiSys.CreateStats('fps')
		UiSys.CreateStats('mem')

		this.renderer = new WebGLRenderer( { antialias: true } )
		console.log('isWebGL2', this.renderer.capabilities.isWebGL2)
		this.renderer.setPixelRatio( UiSys.browser == 'chrome' ? window.devicePixelRatio : 1 )// <-'1' Helps on safari // window.devicePixelRatio )
		this.renderer.setSize( window.innerWidth, window.innerHeight )
		this.renderer.setAnimationLoop( (p) => {
			this.Update(p)
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

	static prevTime = performance.now()
	static Update(time) {
		const dt = (time -this.prevTime) /1000
		
		UiSys.UpdateBegin(dt)

		this.cube.rotation.x = time /4000
		this.cube.rotation.y = time /1000
		
		MoveSys.Update(dt, this.camera, this.scene)
		InputSys.Update(dt, this.scene)

		WorldSys.Update(dt, this.camera)

		SocketSys.Update(dt)
		
		this.prevTime = time
		this.renderer.render( this.scene, this.camera )

		UiSys.UpdateEnd(dt)
	}

	static makeCube() {
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

BABS.Start()
export default BABS
