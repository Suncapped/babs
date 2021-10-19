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
	Cache,
} from 'three'
import { WorldSys } from './sys/WorldSys'
import { SocketSys } from './sys/SocketSys'
import { UiSys } from './sys/UiSys'
import { InputSys } from './sys/InputSys'
import * as Utils from './Utils'
import { LoaderSys } from './sys/LoaderSys'
import { CameraSys } from './sys/CameraSys'
import { RenderSys } from './sys/RenderSys'
import { log } from './Utils'
import { Player } from './ent/Player'
import { Controller } from './com/Controller'

class BABS {

	static isProd = window.location.href.startsWith('https://earth.suncapped.com')
	static baseDomain
	static urlFiles
	static urlSocket

	static camera
	static scene
	static renderer
	static cube
	static ui

	static cameraSys
	static inputSys

	static ents = new Map() // id key, value ent
	static comcats = new Map() // comType key, value is an array of those coms

	static zips = new Map() // idzip key, value idplayer

	static idSelf


	static Start() {

		log('Mode is', import.meta.env.MODE)


		var preservedConsoleLog = console.warn;
		console.warn = function() { // Overriding to suppress Threejs FBXLoader warnings
			if(!arguments[0]?.startsWith('THREE.FBXLoader')) {
				preservedConsoleLog.apply(console, arguments)
			}
		}

		Cache.enabled = true // Caches eg FBX anims

		if (this.isProd || import.meta.env.MODE == 'playerdev') {
			this.urlSocket = `wss://proxima.suncapped.com` /* Proxima */
			this.urlFiles = `https://earth.suncapped.com/files` /* Expressa */
			this.baseDomain = 'suncapped.com'
		}
		else {
			const { hostname } = new URL(window.location.href) // eg 'localhost' or '192.168.0.120'
			const localDomain = hostname
			this.urlSocket = `ws://${localDomain}:2567` /* Proxima */
			this.urlFiles = `http://${localDomain}:3000/files` /* Expressa */
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

		UiSys.Start(this)

		log.info('Cookies?', cookiesEnabled)
		if(!cookiesEnabled) {
			UiSys.OfferReconnect('Session cookies needed!')
			return
		}

		LoaderSys.Start(this.urlFiles)

		
		this.renderSys = new RenderSys()
		this.scene = this.renderSys._scene
		this.camera = this.renderSys._camera

		this.cube = this.makeCube()
		this.scene.add( this.cube )
		this.cube.name = 'cube'

		WorldSys.Start(this.scene, this.camera, this.cube)
		
		SocketSys.Start(this)

		document.getElementById('charsave').addEventListener('click', (ev) => {
			ev.preventDefault()
			document.getElementById('charsave').disabled = true
			SocketSys.Enter(
				document.getElementById('email').value, 
				document.getElementById('password').value
			)
		})

		UiSys.CreateStats('fps')
		UiSys.CreateStats('mem')

		// this.scene.children.forEach((node) => {
		// 	const axes = new AxesHelper(10)
		// 	axes.renderOrder = 1
		// 	axes.position.add(new Vector3(-0.2,0.2,-0.2))
		// 	node.add(axes)
		// }) // todo make this happen upon all scene.add
		
		// Poll for ready so no circular dependency - todo rethink this dep situation
		const waitForReady = () => {
			if(SocketSys.babsReady) {
				this.renderSys._threejs.setAnimationLoop( (p) => { // todo shorten?
					this.Update(p)
				})
			} 
			else {
				setTimeout(waitForReady, 100)
			}
		}
		waitForReady()

	}


	static prevTime = performance.now()
	static Update(time) {
		// log.info(time -this.prevTime)
		const dt = (time -this.prevTime) /1000 // In seconds!
		UiSys.UpdateBegin(dt)

		// this.cube.rotation.x = time /4000
		// this.cube.rotation.y = time /1000
		
		// LoaderSys.Update(dt)
		this.inputSys?.update(dt, this.scene)
		WorldSys.Update(dt, this.camera)

		for(let [name, coms] of this.comcats) {
			if(coms) {
				for(let com of coms) {
					com.update(dt)
				}
			}
		}

		this.cameraSys?.update(dt)

		this.renderSys.update(dt)


		this.prevTime = time
		UiSys.UpdateEnd(dt)
	}

	static makeCube() {
		const geometry = new BoxGeometry( 6, 6, 6 )
		const material = new MeshPhongMaterial()
		const cube = new Mesh(geometry, material)
		cube.name = 'this.cameracube'
		cube.position.copy(new Vector3(10,3,0))
		cube.castShadow = true
		// cube.receiveShadow = true
		return cube
	}

}

BABS.Start()
export default BABS
