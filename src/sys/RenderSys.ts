import { UiSys } from './UiSys'
import { log } from './../Utils'
import { ACESFilmicToneMapping, Matrix4, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { WorldSys } from './WorldSys'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { dividerOffset } from '../stores'
import { VRButton } from 'three/examples/jsm/webxr/VRButton'
import { Flame } from '@/comp/Flame'
import type { Babs } from '@/Babs'
import { Wob } from '@/ent/Wob'
import { Zone } from '@/ent/Zone'
import { CameraSys } from './CameraSys'

// Started from https://github.com/simondevyoutube/ThreeJS_Tutorial_ThirdPersonCamera/blob/main/main.js
// Updated to https://github.com/mrdoob/three.js/blob/master/examples/webgl_shaders_sky.html


export class RenderSys {

	babs :Babs
	renderer :WebGLRenderer
	labelRenderer
	_camera :PerspectiveCamera
	_scene :Scene
	public isVrSupported = false
	public documentHasFocus :boolean|'forced' = true
	public recalcImmediatelyBpids = new Set<string>()

	// Custom FPS counter
	public frames = 0
	public prevTime = performance.now()
	public fpsDetected = 0

	constructor(babs) {
		this.babs = babs
		this.renderer = new WebGLRenderer({ 
			// antialias: window.devicePixelRatio < 3, // My monitor is 2, aliasing still shows
			antialias: true,
			// powerPreference: 'high-performance',
			canvas: document.getElementById('canvas'),
			// alpha: true,
			// premultipliedAlpha: false,
			// logarithmicDepthBuffer: true, // Causes shader problems, specifically with flame, and potentially MSAA? https://github.com/mrdoob/three.js/issues/22017
			// On VR, that helps with far tree base z fighting, but doesn't help with wob antialiasing

		})
		this.renderer.xr.enabled = true
		this.renderer.outputColorSpace = SRGBColorSpace

		// https://github.com/mrdoob/three.js/pull/24698#issuecomment-1258870071
		// this.renderer.physicallyCorrectLights = false
		// this.renderer.useLegacyLights = true // https://github.com/mrdoob/three.js/releases/tag/r154

		// https://discourse.threejs.org/t/acesfilmictonemapping-leading-to-low-contrast-textures/15484/10
		this.renderer.toneMapping = ACESFilmicToneMapping
		// this.renderer.toneMapping = NoToneMapping // LinearToneMapping(enables toneMappingExposure) // ACESFilmicToneMapping
		// this.renderer.toneMapping = LinearToneMapping // (enables toneMappingExposure for sky) // ACESFilmicToneMapping
		this.renderer.toneMappingExposure = 1//0.5///1//0.5
		// I don't like having to do global exposure just for Sky.js, but perhaps that's considered "mid level" 5/10.  I don't know much about these kinds of things.  // Now re-setting to 1.0
		// In that case, might as well use ACES until we know whether monitors support HDR (or make a player toggle)
		// 		Later: From the sound of things, web output is in sRGB anyway, so I don't need to worry about HDR for now.
		// Now I've changed it to 0.3 but multiplied lights by (1/it), such that sky is less white and more blue, but light is still good.

		// this.renderer.setPixelRatio( babs.browser == 'chrome' ? window.devicePixelRatio : 1 )// <-'1' Helps on safari // window.devicePixelRatio )
		this.renderer.setPixelRatio(window.devicePixelRatio) // *4 did not help with VR AA
		this.renderer.setSize(0,0)

		// document.body.appendChild(this.renderer.domElement) // Now done in html
		// this.renderer.domElement.id = 'canvas'

		// Detect and offer VR
		navigator?.xr?.isSessionSupported('immersive-vr').then((vrSupported :boolean) => {
			if(vrSupported) {
				const vrButton = VRButton.createButton(this.renderer)
				document.body.appendChild(vrButton)
				this.isVrSupported = true
			}
		})

		this.renderer.domElement.addEventListener('contextmenu', ev => ev.preventDefault()) // todo move to ui
		log.info('isWebGL2', this.renderer.capabilities.isWebGL2)
		log.info('aniso', this.renderer.capabilities.getMaxAnisotropy())

		const fov = 45
		const nearClip = 12 *(1/CameraSys.SCALE) // 5.1 // Slightly over 5' for testing looking down! // Oh wow, for VR, going from 0.01 to 12 helped SO much with z fighting trees!
		this._camera = new PerspectiveCamera(fov, undefined, nearClip, WorldSys.MAX_VIEW_DISTANCE *2)
		this._camera.setRotationFromAxisAngle(new Vector3(0, 1, 0), Math.PI)
		// ^ eek "Camera’s look along the negative z-axis by default. You have to rotate the camera around the y-axis around 180 degrees so it looks along the positive z-axis like ordinary 3D objects."
		// https://discourse.threejs.org/t/three-js-attach-camera-to-a-3d-object-and-rotate-move-with-the-object-and-show-in-inset-window/12343

		// Add near clip plane to camera

		this._camera.matrixAutoUpdate = true
		this._camera.matrixWorldAutoUpdate = true

		this._scene = new Scene()

		this._scene.matrixAutoUpdate = false 
		// ^ https://discourse.threejs.org/t/question-about-object3d-updatematrixworld/6925/4

		this.labelRenderer = new CSS2DRenderer()
		this.labelRenderer.domElement.id = 'labelRenderer'

		document.getElementById('Ctext').appendChild(this.labelRenderer.domElement)

		window.addEventListener('resize', () => {
			this.handleResize()
		}, false)
		dividerOffset.subscribe(offsetOrObj => {
			this.handleResize()
		})
		// var ro = new ResizeObserver(entries => {
		// 	for (let entry of entries) {
		// 		// const cr = entry.contentRect;
		// 		// console.log('Element:', entry.target);
		// 		// console.log(`Element size: ${cr.width}px x ${cr.height}px`);
		// 		// console.log(`Element padding: ${cr.top}px ; ${cr.left}px`);
		// 		this.handleResize()
		// 	}
		// });
		// ro.observe(this.renderer.domElement);
		// this.handleResize()

		this.documentHasFocus = 'forced' // Start out as focused when launched, in case they launch it in background (such as on live refresh)
		setInterval(() => {
			if(this.babs.renderSys.isVrSupported) {
				this.documentHasFocus = true
				return // Don't do this for VR, since the browser itself can lose focus while user clicks elsewhere!
			}
			let hasFocusNow = document.hasFocus()
			if (this.documentHasFocus !== hasFocusNow && this.documentHasFocus) {
				// console.log('unfocused')
			} else if (this.documentHasFocus !== hasFocusNow) {
				// console.log('focused')
			}
			if(!(this.documentHasFocus === 'forced' && hasFocusNow == false)) { // Don't turn off focus if we're still in forced mode (eg was loaded in background and hasn't yet been focused)
				this.documentHasFocus = hasFocusNow
			}
		}, 500)

		setInterval(() => {
			if(Flame.player?.controller?.playerRig) {
				const playerpos = Flame.player.controller.playerRig.position

				const nearestWants = Flame.wantsLight.sort((a, b) => {
					return Math.abs(a.position.distanceTo(playerpos)) -Math.abs(b.position.distanceTo(playerpos))
				})

				for(let index=0; index<Flame.lightPool.length; index++) {
					if(index > nearestWants.length -1) break
					Flame.lightPool[index].position.copy(nearestWants[index].position)
					Flame.lightPool[index].position.setY(Flame.lightPool[index].position.y +2)
					// Hmm I think there's a bug where some are getting double
				}
			}
		}, 1000)
	}

	firstTime = true
	handleResize() {
		let width
		if(!this.renderer?.domElement) {
			setTimeout(() => this.handleResize(), 10) 
			return
		}
		width = parseFloat(getComputedStyle(this.renderer.domElement, null)?.width)			
		if(!width) {
			setTimeout(() => this.handleResize(), 10) 
			return
		}
		
		const height = parseFloat(getComputedStyle(this.renderer.domElement, null)?.height)
		this.renderer.setSize(width, height)
		this.labelRenderer.setSize(width, height)
		this._camera.aspect = width / height
		this._camera.updateProjectionMatrix()
	}

	update(dt) {
		if(this.recalcImmediatelyBpids.size > 0) {
			// Run recalc for each item in the Set
			this.recalcImmediatelyBpids.forEach(bpid => this.calcNearbyWobs(bpid))
			this.recalcImmediatelyBpids.clear()
		}

		// Efficiently get a Wob.InstancedWobs item based on its index, and calc nearby wobs for that bpid
		let currentIndex = 0
		for (let [key, value] of Wob.InstancedWobs) {
			if (currentIndex === this.calcMapIndex) {
				this.calcNearbyWobs(key)
				break
			}
			currentIndex++
		}
		this.calcMapIndex++
		if(this.calcMapIndex >= Wob.InstancedWobs.size) {
			this.calcMapIndex = 0
		}
		
		// Scaling attempt for VR
		const scaleMatrix = new Matrix4().makeScale(CameraSys.SCALE, CameraSys.SCALE, CameraSys.SCALE)
		this._camera.matrixWorldInverse.multiply(scaleMatrix)
		this._camera.updateMatrixWorld()
		this._camera.updateMatrix()
		// Set camera group scale too?
		this.babs.cameraSys.cameraGroup.scale.set(CameraSys.SCALE, CameraSys.SCALE, CameraSys.SCALE)

		this.renderer.render(this._scene, this._camera)
		this.labelRenderer.render(this._scene, this._camera)
	}

	calcMapIndex = 0
	calcNearbyWobs(bpid :string) {
		// console.log('calcShowOnlyNearbyWobs', bpid)

		const playerpos = this.babs.inputSys?.playerSelf?.controller?.playerRig?.position
		if(!playerpos) return

		// Let's sort the detailed wobs (eg Goblin Blanketflowers) instancedmeshes by distance from player
		const feim = Wob.InstancedWobs.get(bpid)

		// feim.instancedMesh.computeBoundingBox()
		feim.instancedMesh.computeBoundingSphere() // THIS IS IT.  OMG LOL.  Fixes bug where you couldn't click something facing one direction after zoning for a while in that direction.
		// TODO only do on rescale?  (And note there is: .copy()) https://github.com/mrdoob/three.js/blob/master/src/objects/InstancedMesh.js
		// Note that sphere is used for depth sorting: https://github.com/mrdoob/three.js/pull/25974/files
		// Also for frustum culling https://discourse.threejs.org/t/boundingsphere-and-boundingbox/17868
		// "The bounding sphere is also computed automatically when doing raycasting. The bounding box is optional. If you define it, the raycasting logic will test it too"

		// For each index in instancedMesh, get the position relative to the player
		const instanceMatrix = feim.instancedMesh.instanceMatrix
		
		// Rather than a cutoff at a number, cutoff based on dist.
		const distCutoff = 1000// (feim.asFarWobs ? 1000 : 500)

		// let nearItems :Array<{dist: number, originalIndex: number}> = []
		const imLoadedCount = feim.getLoadedCount()

		let iNearby = 0
		for(let i=0; i<imLoadedCount; i++) { // Each instance is a 4x4 matrix; 16 floats
			// if(i/16 >= loadedCount) break
			
			// Each instance is a 4x4 matrix; 16 floats
			const x = instanceMatrix.array[i*16 +12] +this.babs.worldSys.shiftiness.x
			const z = instanceMatrix.array[i*16 +14] +this.babs.worldSys.shiftiness.z

			if(!(x && z)) {
				if(feim.blueprint_id == 'sneezeweed') {

					// console.log('nox', x) // There's your problem.  It's all null.
				}
				continue
			}

			// Get distance from playerpos in 2 dimensions
			const dist = Math.sqrt(Math.pow(playerpos.x -x, 2) +Math.pow(playerpos.z -z, 2))

			/* Something like:
			Search for() oldArray
			When you find oldArray[i] where dist < 500:
				if i===iNearby, iNearby++ and continue (already in right place)
				Look at dist of oldArray[iNearby].  
				If that dist itself is < 500: 
					iNearby++ and while() until not < 500
					Then, swap oldArray[i] into oldArray[iNearby]
					Then iNearby++
			*/

			let tries = 10000
			const distanceCondition = feim.asFarWobs ? dist >= distCutoff : dist < distCutoff
			if(distanceCondition) {
				if(i === iNearby) {
					iNearby++
					continue // Already in the right place; skip self
				}
				do {
					// Find next nearby that's far
					const xOld = instanceMatrix.array[iNearby*16 +12] +this.babs.worldSys.shiftiness.x
					const zOld = instanceMatrix.array[iNearby*16 +14] +this.babs.worldSys.shiftiness.z
					const distOld = Math.sqrt(Math.pow(playerpos.x -xOld, 2) +Math.pow(playerpos.z -zOld, 2))

					const distanceCondition2 = feim.asFarWobs ? distOld >= distCutoff : distOld < distCutoff
					if(distanceCondition2) {
						iNearby++
						continue
					}
				} while(tries < 10000) // Just in case

				// Swap far iNearby with this near i
				Zone.swapWobsAtIndexes(iNearby, i, feim)
				iNearby++
			}
		}

		feim.instancedMesh.instanceMatrix.needsUpdate = true

		feim.instancedMesh.count = iNearby 
	}
}
