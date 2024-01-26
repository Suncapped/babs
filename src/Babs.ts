import {
	Scene,
	Cache,
	Group,
} from 'three'
import { WorldSys } from '@/sys/WorldSys'
import { SocketSys } from '@/sys/SocketSys'
import { UiSys } from '@/sys/UiSys'
import { InputSys } from '@/sys/InputSys'
import { LoaderSys } from '@/sys/LoaderSys'
import { CameraSys } from '@/sys/CameraSys'
import { RenderSys } from '@/sys/RenderSys'
import { Player } from '@/ent/Player'
import { Controller } from '@/comp/Controller'

import { baseDomain, isProd, debugMode, urlFiles } from './stores'
import { type Ent } from './ent/Ent'
import type { Wob } from './ent/Wob'
import type { Zone } from './ent/Zone'
import Cookies from 'js-cookie'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'

declare global {
	interface Window {
		FeIsProd: boolean
		FeBaseDomain :string
		FeUrlFiles :string
		FeUrlSocket :string
		FeUsePail :boolean
		FeWs :WebSocket
		FeExistingSession :string
	}
}
  
export class Babs {

	isProd = window.FeIsProd
	baseDomain :string = window.FeBaseDomain
	urlFiles :string = window.FeUrlFiles
	urlSocket :string = window.FeUrlSocket
	usePail :boolean = window.FeUsePail

	vrSupported :boolean = false

	browser
	graphicsQuality :boolean

	camera
	scene :Scene

	group :Group

	cameraSys :CameraSys
	inputSys :InputSys
	loaderSys :LoaderSys
	uiSys :UiSys
	worldSys :WorldSys
	socketSys :SocketSys
	public renderSys :RenderSys

	ents = new Map<number, Ent>() // id key, value ent
	compcats = new Map() // comType key, value is an array of those coms

	zips = new Map<number, number>() // idzip key, value idplayer

	idSelf :number

	debugMode :boolean

	constructor() {
		console.log('Mode is:', import.meta.env.MODE)

		const isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0
		const isWindows = navigator.platform.toUpperCase().indexOf('WIN')>=0
		// if(isWindows) {
		// 	let stylesheet = document.styleSheets[document.styleSheets.length-1]
		// 	console.log(stylesheet)
		// 	stylesheet.insertRule('#Ctext>#labelRenderer>.label>span { padding-top:2px !important; padding-bottom: 2px !important; }', stylesheet.cssRules.length)
		// 	// Hax, see also Ctext.svelte at same tab ^
		// }
		// No longer needed due to mesh texts! :)

		// let preservedConsoleLog = console.warn
		// console.warn = function() { // Overriding to suppress Threejs FBXLoader warnings
		// 	if(
		// 		// !arguments[0]?.startsWith('THREE.FBXLoader') // fbx loader spam
		// 		// && !arguments[0]?.includes('.length has been deprecated. Use .count instead') // threejs gltf loader issues?
		// 		/* && */!arguments[0]?.includes('.gammaFactor has been removed')
		// 	) {
		// 		preservedConsoleLog.apply(console, arguments)
		// 	}
		// }

		Cache.enabled = true // Caches eg FBX anims

		this.browser = (function (agent) {
			switch (true) {
			case agent.indexOf('edge') > -1: return 'MS Edge (EdgeHtml)'
			case agent.indexOf('edg') > -1: return 'MS Edge Chromium'
			case agent.indexOf('opr') > -1 && !!window['opr']: return 'opera'
			case agent.indexOf('chrome') > -1 && !!window['chrome']: return 'chrome'
			case agent.indexOf('trident') > -1: return 'Internet Explorer'
			case agent.indexOf('firefox') > -1: return 'firefox'
			case agent.indexOf('safari') > -1: return 'safari'
			default: return 'other'
			}
		})(window.navigator.userAgent.toLowerCase())
		console.debug('Browser is', this.browser)

		this.graphicsQuality = Cookies.get('graphics') === 'quality'

		this.socketSys = new SocketSys(this)

		this.uiSys = new UiSys(this)
		document.getElementById('topleft').style.visibility = 'hidden'

		this.uiSys.createStats('fps')
		this.uiSys.createStats('mem')

		navigator?.xr?.isSessionSupported('immersive-vr').then((vrSupported :boolean) => {
			// console.log('VR supported', vrSupported)
			this.vrSupported = vrSupported

			this.renderSys = new RenderSys(this)
			this.scene = this.renderSys._scene
			this.camera = this.renderSys._camera
	
			this.group = new Group
			this.group.name = 'fegroup'
			this.scene.add(this.group)
			this.group.scale.setScalar(CameraSys.CurrentScale)
	
			this.worldSys = new WorldSys(this.renderSys.renderer, this, this.camera)

			const xrRenderer = this.renderSys.renderer.xr
			if(xrRenderer.getCamera()?.cameras[0]) { // If we can get a camera
				// Controllers
				// Get the 1st controller
				const [ct0, ct1] = [xrRenderer.getController(0), xrRenderer.getController(1)]
				console.log('controllers', ct0, ct1)
				const [ctGrip0, ctGrip1] = [xrRenderer.getControllerGrip(0), xrRenderer.getControllerGrip(1)]
				console.log('grips', ctGrip0, ctGrip1)

				const controllerModelFactory = new XRControllerModelFactory()

				const model0 = controllerModelFactory.createControllerModel( ctGrip0 )
				ctGrip0.add( model0 )
				// this.babs.group.add( ctGrip0 )

				const waitForReady = () => {
					if(this.cameraSys?.cameraGroup) {
						this.cameraSys.cameraGroup.add(ct0)
						this.cameraSys.cameraGroup.add(ctGrip0)
					} 
					else setTimeout(waitForReady, 1000)
				}
				waitForReady()
				
				const model1 = controllerModelFactory.createControllerModel( ctGrip1 )
				ctGrip1.add( model1 )
				this.group.add( ctGrip1 )
			}

		}).catch((error) => {
			console.error('Error checking for VR support:', error)
		})



		document.getElementById('charsave').addEventListener('click', (ev) => {
			ev.preventDefault()
			document.getElementById('charsave')['disabled'] = true
			this.socketSys.enter(
				document.getElementById('email')['value'], 
				document.getElementById('password')['value'],
			)
		})

		// Poll for ready so no circular dependency - todo rethink this dep situation
		const waitForReady = () => {
			if(this.socketSys.babsRunUpdate) {
				this.renderSys.renderer.setAnimationLoop( (p) => { // todo shorten?
					// Custom FPS counter
					const msBetweenReadings = 500
					this.renderSys.frames++
					const time = performance.now()
					if ( time >= this.renderSys.prevTime + msBetweenReadings ) {
						const fps = Math.round( ( this.renderSys.frames * 1000 ) / ( time - this.renderSys.prevTime ) )
						this.renderSys.frames = 0
						this.renderSys.prevTime = time
						this.renderSys.fpsDetected = fps
					}

					this.update(p)
				})
			} 
			else {
				setTimeout(waitForReady, 100)
			}
		}
		waitForReady()
	}


	prevTime = performance.now()
	update(time) {
		const dt = (time -this.prevTime) /1000 // In seconds!
		// const dt = time /1000 // In seconds!

		this.socketSys.update()

		if(this.debugMode) {
			this.uiSys['fps']?.begin()
			this.uiSys['mem']?.begin()
		}
		
		this.inputSys?.update(dt) // Needs to happen before camera updates
		for(let [name, coms] of this.compcats) {
			if(!coms) continue
			for(let com of coms) {
				com.update(dt)
			}
		}

		this.worldSys.update(dt)
		this.cameraSys?.update() // Camera gets rotated first
		this.uiSys.update() // Needs camera to have been updated
		this.renderSys.update(dt)



		this.prevTime = time


		if(this.debugMode) {
			this.uiSys['fps']?.end()
			this.uiSys['mem']?.end()
		}
	}

}


const babs = new Babs()

// Send to Svelte
baseDomain.set(babs.baseDomain)
urlFiles.set(babs.urlFiles)
isProd.set(babs.isProd)
debugMode.subscribe(on => {
	babs.debugMode = on
})

// export default babs
