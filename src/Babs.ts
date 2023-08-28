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
	Group,
} from 'three'
import { WorldSys } from '@/sys/WorldSys'
import { SocketSys } from '@/sys/SocketSys'
import { UiSys } from '@/sys/UiSys'
import { InputSys } from '@/sys/InputSys'
import { sleep, log } from '@/Utils'
import { LoaderSys } from '@/sys/LoaderSys'
import { CameraSys } from '@/sys/CameraSys'
import { RenderSys } from '@/sys/RenderSys'
import { Player } from '@/ent/Player'
import { Controller } from '@/comp/Controller'

import { baseDomain, isProd, debugMode, urlFiles } from './stores'
import { type Ent } from './ent/Ent'


export class Babs {

	isProd = window.FeIsProd
	baseDomain :string = window.FeBaseDomain
	urlFiles :string = window.FeUrlFiles
	urlSocket :string = window.FeUrlSocket
	usePail :boolean = window.FeUsePail

	browser

	camera
	scene :Scene
	renderer

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
		if(isWindows) {
			let stylesheet = document.styleSheets[0]
			console.log(stylesheet)
			stylesheet.insertRule('#Ctext>#labelRenderer>.label>span { padding-top:2px !important; padding-bottom: 2px !important; }', stylesheet.cssRules.length)
			// Hax, see also Ctext.svelte at same tab ^
		}

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
		log.info('Browser is', this.browser)

		this.socketSys = new SocketSys(this)

		this.uiSys = new UiSys(this)
		document.getElementById('topleft').style.visibility = 'hidden'

		this.uiSys.createStats('fps')
		this.uiSys.createStats('mem')

		this.renderSys = new RenderSys(this)
		this.scene = this.renderSys._scene
		this.camera = this.renderSys._camera

		this.group = new Group
		this.group.name = 'fegroup'
		this.scene.add(this.group)
		// this.group.scale.set(1.001,1.001,1.001)

		this.worldSys = new WorldSys(this.renderSys.renderer, this, this.camera)

		document.getElementById('charsave').addEventListener('click', (ev) => {
			ev.preventDefault()
			document.getElementById('charsave')['disabled'] = true
			this.socketSys.enter(
				document.getElementById('email')['value'], 
				document.getElementById('password')['value'],
			)
		})



		// this.scene.children.forEach((node) => {
		// 	const axes = new AxesHelper(10)
		// 	axes.renderOrder = 1
		// 	axes.position.add(new Vector3(-0.2,0.2,-0.2))
		// 	node.add(axes)
		// }) // todo make this happen upon all scene.add
		
		// Poll for ready so no circular dependency - todo rethink this dep situation
		const waitForReady = () => {
			if(this.socketSys.babsReady) {
				this.renderSys.renderer.setAnimationLoop( (p) => { // todo shorten?
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
	dtSinceLastFocus = 0
	update(time) {
		const dt = (time -this.prevTime) /1000 // In seconds!
		// const dt = time /1000 // In seconds!

		this.socketSys.update()

		if(this.debugMode) {
			this.uiSys['fps']?.begin()
			this.uiSys['mem']?.begin()
		}
		
		// Only update these if window has focus
		this.dtSinceLastFocus += dt
		if(this.renderSys.documentHasFocus 
			|| this.dtSinceLastFocus > 0.15) { // Allow a frame a few times per second; just about right for not breaking movement (ie rubberbanding).
			// todo just fix Controller.ts:update() to not break so badly on longer dt?

			this.uiSys.update()
			this.inputSys?.update(this.dtSinceLastFocus)
			for(let [name, coms] of this.compcats) {
				if(coms) {
					for(let com of coms) {
						com.update(this.dtSinceLastFocus)
					}
				}
			}

			this.worldSys.update(this.dtSinceLastFocus)
			this.cameraSys?.update(this.dtSinceLastFocus)
			this.renderSys.update(this.dtSinceLastFocus)

			this.dtSinceLastFocus = 0
		}


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
