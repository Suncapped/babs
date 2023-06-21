import { UiSys } from './UiSys'
import { log } from './../Utils'
import { ACESFilmicToneMapping, ColorManagement, CullFaceBack, LinearEncoding, LinearToneMapping, Matrix4, NoToneMapping, PerspectiveCamera, Scene, SRGBColorSpace, sRGBEncoding, WebGLRenderer } from 'three'
import { WorldSys } from './WorldSys'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { dividerOffset } from '../stores'
import { VRButton } from 'three/examples/jsm/webxr/VRButton'
import { Flame } from '@/comp/Flame'
import type { Babs } from '@/Babs'
import { Wob } from '@/ent/Wob'

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
	public calcRecalcImmediately = false

	constructor(babs) {
		this.babs = babs
		this.renderer = new WebGLRenderer({ 
			// antialias: window.devicePixelRatio < 3, // My monitor is 2, aliasing still shows
			antialias: true,
			// powerPreference: 'high-performance',
			canvas: document.getElementById('canvas'),
			// alpha: true,
			// premultipliedAlpha: false,
			// physicallyCorrectLights: true, // todo https://discoverthreejs.com/book/first-steps/physically-based-rendering/
			// logarithmicDepthBuffer: true, // Causes shader problems, specifically with flame, and potentially MSAA? https://github.com/mrdoob/three.js/issues/22017 

		})
		this.renderer.xr.enabled = true
		this.renderer.outputColorSpace = SRGBColorSpace

		// https://github.com/mrdoob/three.js/pull/24698#issuecomment-1258870071
		// this.renderer.physicallyCorrectLights = false
		this.renderer.useLegacyLights = true

		// https://discourse.threejs.org/t/acesfilmictonemapping-leading-to-low-contrast-textures/15484/10
		this.renderer.toneMapping = ACESFilmicToneMapping
		// this.renderer.toneMapping = NoToneMapping // LinearToneMapping(enables toneMappingExposure) // ACESFilmicToneMapping
		// this.renderer.toneMapping = LinearToneMapping // (enables toneMappingExposure for sky) // ACESFilmicToneMapping
		this.renderer.toneMappingExposure = 0.2///1//0.5
		// I don't like having to do global exposure just for Sky.js, but perhaps that's considered "mid level" 5/10.  I don't know much about these kinds of things.  // Now re-setting to 1.0
		// In that case, might as well use ACES until we know whether monitors support HDR (or make a player toggle)
		// Now I've changed it to 0.3 but multiplied lights by (1/it), such that sky is less white and more blue, but light is still good.


		// this.renderer.setPixelRatio( babs.browser == 'chrome' ? window.devicePixelRatio : 1 )// <-'1' Helps on safari // window.devicePixelRatio )
		this.renderer.setPixelRatio(window.devicePixelRatio)
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
		const near = 0.1
		this._camera = new PerspectiveCamera(fov, undefined, near, WorldSys.MAX_VIEW_DISTANCE*2)

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
			if(Flame.player?.controller?.target) {
				const playerpos = Flame.player.controller.target.position

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

		setInterval(() => {
			this.calcShowOnlyNearbyWobs()
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

		this.babs.worldSys?.csm?.updateFrustums()
	}

	update(dt) {
		if(this.calcRecalcImmediately) {
			this.calcRecalcImmediately = false
			this.calcShowOnlyNearbyWobs()
		}

		this.renderer.render(this._scene, this._camera)
		this.labelRenderer.render(this._scene, this._camera)
	}

	calcShowOnlyNearbyWobs() {

		for(let [key, feim] of Wob.InstancedMeshes) {
			// Let's sort the Goblin Blanketflowers instancedmeshes by distance from player

			// Skip tall things like trees.
			if(feim.wobIsTall) continue

			// For each index in instancedMesh, get the position relative to the player
			const instanceMatrix = feim.instancedMesh.instanceMatrix
			// console.log('instancedMatrix', instanceMatrix)

			// Rather than a cutoff at a number, cutoff based on dist.
			const distCutoff = 600

			// let indexDistances :Array<{dist: number, originalIndex: number}> = []
			let nearItems :Array<{dist: number, originalIndex: number}> = []
			for(let i=0; i<instanceMatrix.count *16; i+=16) { // Each instance is a 4x4 matrix; 16 floats
				const x = instanceMatrix.array[i +12] +this.babs.worldSys.shiftiness.x
				const z = instanceMatrix.array[i +14] +this.babs.worldSys.shiftiness.z
				// const coord = instancedMesh.coordFromIndex(i/16)
				// // console.log(x, z, coord.x, coord.z)
				// if(x !== coord.x || z !== coord.z) {
				// 	console.warn('MISMATCH!')
				// }

				// Get distance from playerpos in 2 dimensions
				const playerpos = this.babs.inputSys.playerSelf.controller.target.position
				const dist = Math.sqrt(Math.pow(playerpos.x -x, 2) +Math.pow(playerpos.z -z, 2))

				// indexDistances[i/16] = {
				// 	dist: dist,
				// 	originalIndex: i/16,
				// }

				// We can't just swap, because it's all rearranged.
				// Instead, let's just copy in the top items that are below a certain distance!
				// Also, I need to not sort beyond loadedCount
				if(dist < distCutoff && i/16 < feim.getLoadedCount()) {
					nearItems.push({
						dist: dist,
						originalIndex: i/16,
					})
				}
			}

			// indexDistances.sort((a, b) => {
			// 	return a.dist -b.dist // Perf: I don't necessarily need to sort entire thing; I just need to get enough to fill distCutoff.
			// 	// And those don't even necessarily neeed to be sorted.  
			// 	// So I could just scan the array for any <that and move those below the threshold into the top of an/the array.
			// })
			
			// const instanceMatrixCopy = instanceMatrix.clone()
			// const instancedMeshCopy = feim.instancedMesh.clone()
			// let tempSwap = new Matrix4()
			let swapToFront = new Matrix4()
			let swapToBack = new Matrix4()
			let itemCount = 0
			// while(itemCount < indexDistances.length && indexDistances[itemCount].dist < distCutoff){
			// 	instancedMeshCopy.getMatrixAt(itemCount, swapToBack)
			// 	instancedMeshCopy.getMatrixAt(indexDistances[itemCount].originalIndex, swapToFront)
			// 	// swapToFront.fromArray(instanceMatrixCopy.array, indexDistances[itemCount].originalIndex *16)
			// 	// swapToBack.fromArray(instanceMatrixCopy.array, itemCount *16)
			// 	// ^ Is this more efficient?

			// 	instancedMesh.setMatrixAt(itemCount, swapToFront)
			// 	instancedMesh.setMatrixAt(indexDistances[itemCount].originalIndex, swapToBack)

			// 	// Perf: Don't make it swap them if they're already in the top of the array.  

			// 	if(instancedMesh.name == 'chicory'){
			// 		console.log('swapping', indexDistances[itemCount].originalIndex, 'and', itemCount, 'dist', indexDistances[itemCount].dist)
			// 	}
			// 	itemCount++
			// }
			// // Could maybe instead just overwrite this?  But it'd be way more than the top X number:
			// // 		instanceMatrix.copyArray(instanceMatrix.array)

			nearItems.forEach((nearItem, i) => {
				if(nearItem.originalIndex == i) return // Already in place
				feim.instancedMesh.getMatrixAt(i, swapToBack)
				feim.instancedMesh.getMatrixAt(nearItem.originalIndex, swapToFront)

				feim.instancedMesh.setMatrixAt(i, swapToFront)
				feim.instancedMesh.setMatrixAt(nearItem.originalIndex, swapToBack)
				// if(feim.blueprint_id == 'chicory'){
				// 	console.log('nearItems swapping in dist', nearItem.dist, 'from', nearItem.originalIndex, 'to', i)
				// }
			})
			// if(feim.blueprint_id == 'chicory'){
			// 	console.log('nearItems', nearItems)
			// }
			
			// console.log('itemCount', instancedMesh.name, itemCount)
			// if(instancedMesh.name == 'chicory'){//} && indexDistances[itemCount]) {
			// 	console.log(instancedMesh.name, instancedMesh.count, 'to', itemCount, 'dists', indexDistances.length, 'and', indexDistances[itemCount].dist, '<', distCutoff, 'so', itemCount, 'andyaknow', indexDistances)
			// }
			// instancedMesh.count = nearItems.length

			feim.setOptimizedCount(nearItems.length)
			feim.instancedMesh.instanceMatrix.needsUpdate = true
			// instancedMesh.matrixWorldNeedsUpdate = true

			

		}
	}
}
