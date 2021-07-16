import * as THREE from 'three'
import { UiSys } from './UiSys'

// Taken and inspired from https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js

export class RenderSys {
	constructor() {
		this._Initialize()
	}

	_Initialize() {
		this._threejs = new THREE.WebGLRenderer({ antialias: true })
		this._threejs.outputEncoding = THREE.sRGBEncoding
		this._threejs.shadowMap.enabled = true
		this._threejs.shadowMap.type = THREE.PCFSoftShadowMap
		// this._threejs.setPixelRatio(window.devicePixelRatio)

		this._threejs.setPixelRatio( UiSys.browser == 'chrome' ? window.devicePixelRatio : 1 )// <-'1' Helps on safari // window.devicePixelRatio )
		this._threejs.setSize(window.innerWidth, window.innerHeight)

		document.body.appendChild(this._threejs.domElement)

		this._threejs.domElement.id = 'canvas'
		this._threejs.domElement.addEventListener('contextmenu', ev => ev.preventDefault()); // todo move to ui
		console.log('isWebGL2', this._threejs.capabilities.isWebGL2)

		window.addEventListener('resize', () => {
			this._OnWindowResize()
		}, false)

		const fov = 60
		const aspect = window.innerWidth / window.innerHeight
		const near = 1.0
		const far = 1000.0
		this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
		this._camera.position.set(12, 8, 12)

		this._scene = new THREE.Scene()

		let light = new THREE.DirectionalLight(0xFFFFFF, 1.0)
		light.position.set(-100, 100, 100)
		light.target.position.set(0, 0, 0)
		light.castShadow = true
		light.shadow.bias = -0.001
		light.shadow.mapSize.width = 4096
		light.shadow.mapSize.height = 4096
		light.shadow.camera.near = 0.1
		light.shadow.camera.far = 500.0
		light.shadow.camera.near = 0.5
		light.shadow.camera.far = 500.0
		light.shadow.camera.left = 50
		light.shadow.camera.right = -50
		light.shadow.camera.top = 50
		light.shadow.camera.bottom = -50
		this._scene.add(light)

		light = new THREE.AmbientLight(0xFFFFFF, 0.25)
		this._scene.add(light)

		// const loader = new THREE.CubeTextureLoader()
		// const texture = loader.load([
		// 	'./resources/posx.jpg',
		// 	'./resources/negx.jpg',
		// 	'./resources/posy.jpg',
		// 	'./resources/negy.jpg',
		// 	'./resources/posz.jpg',
		// 	'./resources/negz.jpg',
		// ])
		// texture.encoding = THREE.sRGBEncoding
		// this._scene.background = texture

		// const plane = new THREE.Mesh(
		// 	new THREE.PlaneGeometry(100, 100, 10, 10),
		// 	new THREE.MeshStandardMaterial({
		// 		color: 0x808080,
		// 	}))
		// plane.castShadow = false
		// plane.receiveShadow = true
		// plane.rotation.x = -Math.PI / 2
		// this._scene.add(plane)

		// this._mixers = []
		// this._previousRAF = null

		this._OnWindowResize()

		//   this._RAF()
	}

	_OnWindowResize() {
		this._camera.aspect = window.innerWidth / window.innerHeight
		this._camera.updateProjectionMatrix()
		this._threejs.setSize(window.innerWidth, window.innerHeight)
	}

	// _RAF() {
	//   requestAnimationFrame((t) => {
	// 	if (this._previousRAF === null) {
	// 	  this._previousRAF = t
	// 	}

	// 	this._RAF()

	// 	this._threejs.render(this._scene, this._camera)
	// 	this._Step(t - this._previousRAF)
	// 	this._previousRAF = t
	//   })
	// }

	update(dt) {
		this._threejs.render(this._scene, this._camera)
	}
}
