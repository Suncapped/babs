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

	isProd = window.location.href.startsWith('https://earth.suncapped.com')
	baseDomain :string
	urlFiles :string
	urlSocket :string

	browser

	camera
	scene :Scene
	renderer

	cameraSys :CameraSys
	inputSys :InputSys
	loaderSys :LoaderSys
	uiSys :UiSys
	worldSys :WorldSys
	socketSys :SocketSys
	renderSys :RenderSys


	ents = new Map<number, Ent>() // id key, value ent
	compcats = new Map() // comType key, value is an array of those coms

	zips = new Map<number, number>() // idzip key, value idplayer

	idSelf :number

	debugMode :boolean



	constructor() {

		console.log('Mode is:', import.meta.env.MODE)


		let preservedConsoleLog = console.warn
		console.warn = function() { // Overriding to suppress Threejs FBXLoader warnings
			if(
				// !arguments[0]?.startsWith('THREE.FBXLoader') // fbx loader spam
				// && !arguments[0]?.includes('.length has been deprecated. Use .count instead') // threejs gltf loader issues?
				/* && */!arguments[0]?.includes('.gammaFactor has been removed')
			) {
				preservedConsoleLog.apply(console, arguments)
			}
		}

		Cache.enabled = true // Caches eg FBX anims

		const { hostname } = new URL(window.location.href) // eg 'localhost' or '192.168.0.120'
		this.baseDomain = this.isProd ? 'suncapped.com' : `${hostname}` 

		if (this.isProd || import.meta.env.MODE == 'playerdev') {
			this.urlSocket = `wss://proxima.suncapped.com` /* Proxima */
			this.urlFiles = `https://earth.suncapped.com/files` /* Expressa */
		}
		else {
			this.urlSocket = `ws://${this.baseDomain}:2567` /* Proxima */
			this.urlFiles = `http://${this.baseDomain}:3000/files` /* Expressa */
		}
		console.info('Domains:', window.location.href, this.baseDomain, this.urlSocket, this.urlFiles)

		// Cookies are required
		const cookiesEnabled = (() => {
			try {
				document.cookie = 'cookietest=1'
				const ret = document.cookie.indexOf('cookietest=') !== -1
				document.cookie = 'cookietest=1; expires=Thu, 01-Jan-1970 00:00:01 GMT'
				return ret
			}
			catch (e) {
				return false
			}
		})()

		this.loaderSys = new LoaderSys(this.urlFiles)

		this.browser = (function (agent) {
			switch (true) {
			case agent.indexOf("edge") > -1: return "MS Edge (EdgeHtml)"
			case agent.indexOf("edg") > -1: return "MS Edge Chromium"
			case agent.indexOf("opr") > -1 && !!window['opr']: return "opera"
			case agent.indexOf("chrome") > -1 && !!window['chrome']: return "chrome"
			case agent.indexOf("trident") > -1: return "Internet Explorer"
			case agent.indexOf("firefox") > -1: return "firefox"
			case agent.indexOf("safari") > -1: return "safari"
			default: return "other"
			}
		})(window.navigator.userAgent.toLowerCase())
		log.info('Browser is', this.browser)

		this.uiSys = new UiSys(this)
		this.uiSys.createStats('fps')
		this.uiSys.createStats('mem')

		log.info('Cookies?', cookiesEnabled)
		if(!cookiesEnabled) {
			this.uiSys.offerReconnect('Session cookies needed!')
			return
		}


		this.renderSys = new RenderSys(this)
		this.scene = this.renderSys._scene
		this.camera = this.renderSys._camera

		/** @type {WorldSys} */
		this.worldSys = new WorldSys(this.renderSys.renderer, this, this.camera)
		
		this.socketSys = new SocketSys(this)

		document.getElementById('charsave').addEventListener('click', (ev) => {
			ev.preventDefault()
			document.getElementById('charsave')['disabled'] = true
			this.socketSys.enter(
				document.getElementById('email')['value'], 
				document.getElementById('password')['value']
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
	update(time) {
		// log.info(time -this.prevTime)
		const dt = (time -this.prevTime) /1000 // In seconds!

		this.socketSys.update(dt)

		this.uiSys.updateBegin(dt)
		
		// LoaderSys.update(dt)
		this.inputSys?.update(dt, this.scene)
		this.worldSys.update(dt, this.camera)

		for(let [name, coms] of this.compcats) {
			if(coms) {
				for(let com of coms) {
					com.update(dt)
				}
			}
		}

		this.cameraSys?.update(dt)

		this.renderSys.update(dt)


		this.prevTime = time
		this.uiSys.updateEnd(dt)
	}

}


console.info('LoaderSys', LoaderSys) // Force it to compile/import before continuing with Babs?  lol
const babs = new Babs()

// Send to Svelte
baseDomain.set(babs.baseDomain)
urlFiles.set(babs.urlFiles)
isProd.set(babs.isProd)
debugMode.subscribe(on => {
	babs.debugMode = on
})

// export default babs
