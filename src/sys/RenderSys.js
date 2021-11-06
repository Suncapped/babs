import { UiSys } from './UiSys'
import { log } from './../Utils'
import { ACESFilmicToneMapping, LinearEncoding, LinearToneMapping, NoToneMapping, PerspectiveCamera, Scene, sRGBEncoding, WebGLRenderer } from 'three'
import { WorldSys } from './WorldSys'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

// Started from https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js
// Updated to https://github.com/mrdoob/three.js/blob/master/examples/webgl_shaders_sky.html

export class RenderSys {

	renderer
	labelRenderer

	constructor(babs) {
		this.renderer = new WebGLRenderer({ 
			antialias: window.devicePixelRatio < 3, // My monitor is 2, aliasing still shows
			// powerPreference: 'high-performance',
		})
		// this.renderer.outputEncoding = LinearEncoding
		this.renderer.outputEncoding = sRGBEncoding
		this.renderer.gammaFactor = 2.2 // SO says it's not really deprecated any time soon as of ~Feb2021

		// https://discourse.threejs.org/t/acesfilmictonemapping-leading-to-low-contrast-textures/15484/10
		this.renderer.toneMapping = ACESFilmicToneMapping
		// this.renderer.toneMapping = NoToneMapping // LinearToneMapping(enables toneMappingExposure) // ACESFilmicToneMapping
		// this.renderer.toneMapping = LinearToneMapping // (enables toneMappingExposure for sky) // ACESFilmicToneMapping
		// this.renderer.toneMappingExposure = 1//0.5
		// I don't like having to do global exposure just for Sky.js, but perhaps that's considered "mid level" 5/10.  I don't know much about these kinds of things.  // Now re-setting to 1.0
		// In that case, might as well use ACES until we know whether monitors support HDR (or make a player toggle)

		// this.renderer.shadowMap.enabled = true
		// this.renderer.shadowMap.type = THREE.PCFSoftShadowMap // todo shadows re-add?  or use in WorldSys?

		this.renderer.setPixelRatio( babs.browser == 'chrome' ? window.devicePixelRatio : 1 )// <-'1' Helps on safari // window.devicePixelRatio )
		this.renderer.setSize(window.innerWidth, window.innerHeight)

		document.body.appendChild(this.renderer.domElement)

		this.renderer.domElement.id = 'canvas'
		this.renderer.domElement.addEventListener('contextmenu', ev => ev.preventDefault()); // todo move to ui
		log.info('isWebGL2', this.renderer.capabilities.isWebGL2)

		window.addEventListener('resize', () => {
			this.windowResize()
		}, false)

		const fov = 60
		const aspect = window.innerWidth / window.innerHeight
		const near = 1.0
		this._camera = new PerspectiveCamera(fov, aspect, near, WorldSys.MAX_VIEW_DISTANCE*2)
		this._camera.position.set(12, 8, 12)

		this._scene = new Scene()

		// let light = new THREE.DirectionalLight(0xFFFFFF, 1.0)
		// light.position.set(-100, 100, 100)
		// light.target.position.set(0, 0, 0)
		// light.castShadow = true
		// light.shadow.bias = -0.001
		// light.shadow.mapSize.width = 4096
		// light.shadow.mapSize.height = 4096
		// light.shadow.camera.near = 0.1
		// light.shadow.camera.far = 500.0
		// light.shadow.camera.near = 0.5
		// light.shadow.camera.far = 500.0
		// light.shadow.camera.left = 50
		// light.shadow.camera.right = -50
		// light.shadow.camera.top = 50
		// light.shadow.camera.bottom = -50
		// this._scene.add(light)

		// let light = new THREE.AmbientLight(0xFFFFFF, 1)
		// this._scene.add(light)

		this.labelRenderer = new CSS2DRenderer()
		// this.labelRenderer.domElement.style.position = 'absolute'
		this.labelRenderer.domElement.id = 'labelRenderer'
		// this.labelRenderer.domElement.style.top = '0px'
		// this.labelRenderer.domElement.style['pointer-events'] = 'none'
		this.labelRenderer.domElement.style = {
			'background-color': 'green',
		}

		document.getElementById('Ctext').appendChild(this.labelRenderer.domElement)

		this.windowResize()
	}

	windowResize() {
		this._camera.aspect = window.innerWidth / window.innerHeight
		this._camera.updateProjectionMatrix()
		this.renderer.setSize(window.innerWidth, window.innerHeight)
		this.labelRenderer.setSize(window.innerWidth, window.innerHeight)
	}

	update(dt) {
		this.renderer.render(this._scene, this._camera)
		this.labelRenderer.render(this._scene, this._camera)
	}
}
