import { UiSys } from './UiSys'
import { log } from './../Utils'
import { ACESFilmicToneMapping, Matrix4, PerspectiveCamera, Scene, Vector3, WebGLRenderer, SRGBColorSpace, InstancedMesh, Mesh, LineSegments, SkinnedMesh } from 'three'
import { WorldSys } from './WorldSys'
import { Flame } from '@/comp/Flame'
import type { Babs } from '@/Babs'
import { Wob } from '@/ent/Wob'
import { Zone } from '@/ent/Zone'
import { CameraSys } from './CameraSys'
// import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
// import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
// import { TAARenderPass } from 'three/addons/postprocessing/TAARenderPass.js'
// import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
// import { SSGIEffect, TRAAEffect, MotionBlurEffect, VelocityDepthNormalPass } from 'realism-effects'
// import { EffectComposer as PostproEffectComposer, EffectPass as PostproEffectPass, RenderPass as PostproRenderPass } from 'postprocessing'

// import WebGPU from 'three/addons/capabilities/WebGPU.js'
import { InstancedSkinnedMesh } from '@/ent/InstancedSkinnedMesh'
// import WebGPURenderer from 'three/addons/renderers/webgpu/WebGPURenderer.js'

export class RenderSys {

	babs :Babs
	renderer :WebGLRenderer// | WebGPURenderer
	_camera :PerspectiveCamera
	_scene :Scene
	public documentHasFocus :boolean = true
	public recalcImmediatelyBpids = new Set<string>()
	public isVrActive = false

	// Custom FPS counter
	public frames = 0
	public prevTime = performance.now()
	public fpsDetected = 0

	// // Postprocessing, eg for TAA in VR
	// composer :EffectComposer
	// taaRenderPass :TAARenderPass
	// renderPass :RenderPass

	// postproComposer :PostproEffectComposer

	constructor(babs :Babs) {
		this.babs = babs

		this.renderer = new WebGLRenderer({ 
		// this.renderer = new WebGPURenderer({ 
			// antialias: window.devicePixelRatio < 3, // My monitor is 2, aliasing still shows
			antialias: true, // todo reenable for non-vr?
			// stencil: false, // Hmm
			// depth: false, // lol no!
			// powerPreference: 'high-performance',
			canvas: document.getElementById('canvas'),
			// alpha: true,
			// premultipliedAlpha: false,
			logarithmicDepthBuffer: true, // Can cause shader problems; fixed for flame (search 'logdepthbuf' ), MSAA may need fix too?  https://github.com/mrdoob/three.js/issues/22017
			// also: "Note that this setting uses gl_FragDepth if available which disables the Early Fragment Test optimization and can cause a decrease in performance." // todo test this out?
			// On VR, that helps with far tree base z fighting, but doesn't help with wob antialiasing

		})
		this.renderer.xr.enabled = true
		this.renderer.outputColorSpace = SRGBColorSpace

		// https://github.com/mrdoob/three.js/pull/24698#issuecomment-1258870071
		// this.renderer.physicallyCorrectLights = false
		// this.renderer.useLegacyLights = true // https://github.com/mrdoob/three.js/releases/tag/r154

		// https://discourse.threejs.org/t/acesfilmictonemapping-leading-to-low-contrast-textures/15484/10
		this.renderer.toneMapping = ACESFilmicToneMapping
		// this.renderer.toneMapping = ACESFilmicToneMapping // LinearToneMapping(enables toneMappingExposure) // ACESFilmicToneMapping
		// this.renderer.toneMapping = LinearToneMapping // (enables toneMappingExposure for sky) // ACESFilmicToneMapping
		this.renderer.toneMappingExposure = 1//0.5///1//0.5
		// I don't like having to do global exposure just for Sky.js, but perhaps that's considered "mid level" 5/10.  I don't know much about these kinds of things.  // Now re-setting to 1.0
		// In that case, might as well use ACES until we know whether monitors support HDR (or make a player toggle)
		// 		Later: From the sound of things, web output is in sRGB anyway, so I don't need to worry about HDR for now.
		// Now I've changed it to 0.3 but multiplied lights by (1/it), such that sky is less white and more blue, but light is still good.

		// this.renderer.setPixelRatio( babs.browser == 'chrome' ? window.devicePixelRatio : 1 )// <-'1' Helps on safari // window.devicePixelRatio )
		this.renderer.setPixelRatio(window.devicePixelRatio) // *4 did not help with VR AA
		this.renderer.setSize(window.innerWidth, window.innerHeight)

		this.renderer.domElement.addEventListener('contextmenu', ev => ev.preventDefault()) // todo move to ui
		log.info('isWebGL2', this.renderer.capabilities.isWebGL2)
		log.info('aniso', this.renderer.capabilities.getMaxAnisotropy())

		const fov = 45
		const nearClip = 12 *(CameraSys.CurrentScale) // 5.1 // Slightly over 5' for testing looking down! // Oh wow, for VR, going from 0.01 to 12 helped SO much with z fighting trees!
		this._camera = new PerspectiveCamera(fov, window.innerWidth / window.innerHeight, nearClip, WorldSys.MAX_VIEW_DISTANCE *2)
		this._camera.setRotationFromAxisAngle(new Vector3(0, 1, 0), Math.PI)
		// ^ eek "Camera’s look along the negative z-axis by default. You have to rotate the camera around the y-axis around 180 degrees so it looks along the positive z-axis like ordinary 3D objects."
		// https://discourse.threejs.org/t/three-js-attach-camera-to-a-3d-object-and-rotate-move-with-the-object-and-show-in-inset-window/12343

		// Add near clip plane to camera

		this._camera.matrixAutoUpdate = true
		this._camera.matrixWorldAutoUpdate = true

		this._scene = new Scene()

		this._scene.matrixAutoUpdate = false 
		// ^ https://discourse.threejs.org/t/question-about-object3d-updatematrixworld/6925/4

		window.addEventListener('resize', () => this.handleResize(), false)

		setInterval(() => {
			const hasFocusOld = this.documentHasFocus
			const hasFocusNew = document.hasFocus()
			this.documentHasFocus = hasFocusNew

			// Now that it's set, run the events
			if (!hasFocusOld && hasFocusNew) {
				// this.babs.uiSys.gotFocus()
			} else if (hasFocusOld && !hasFocusNew) {
				this.babs.uiSys.lostFocus()
			}
		}, 200)
		window.addEventListener('focus', (ev) => {
			log.info('window focus event')
			this.documentHasFocus = true
			this.babs.uiSys.gotWindowFocus(ev)
		})

		setInterval(() => {
			this.moveLightsNearPlayer()
			
			const xrSession = (this.renderer instanceof WebGLRenderer) && this.renderer.xr.getSession()
			const isVrActiveNow = !!xrSession
			if(!this.isVrActive && isVrActiveNow) { // Entering VR
				CameraSys.CurrentScale = CameraSys.VR_SCALE
				this._camera.near = 0.1
				this.babs.group.scale.setScalar(CameraSys.CurrentScale)

				Flame.lightPool.forEach((pointLight) => {
					pointLight.intensity = Flame.PointLightIntensity *CameraSys.CurrentScale
					pointLight.distance = Flame.PointLightDistance *CameraSys.CurrentScale
				})

				// Determine from XRWebGLLayer whether antialias is supported
				const antialias = xrSession.renderState.baseLayer.antialias
				// I could try WebXRManager.setFramebufferScaleFactor

				console.log('entering vr', antialias, this.babs.group.scale)
				// setTimeout(() => {
				// 	this.babs.uiSys.aboveHeadChat(this.babs.idSelf, 'VR antialias ability: ' + antialias)
				// }, 5000)
				// Activate another form of AA if one doesn't exist
				if(!antialias) {
					// this.composer = new EffectComposer(this.renderer)

					// this.renderPass = new RenderPass(this._scene, this._camera)
					// this.renderPass.enabled = true
					// this.composer.addPass(this.renderPass)

					// this.taaRenderPass = new TAARenderPass(this._scene, this._camera)
					// this.taaRenderPass.unbiased = false
					// this.taaRenderPass.sampleLevel = 4
					// this.taaRenderPass.enabled = true
					// this.taaRenderPass.accumulate = true
					// this.composer.addPass(this.taaRenderPass)
	
					// const outputPass = new OutputPass()
					// this.composer.addPass( outputPass )

					// That doesn't support WebXR!  https://github.com/mrdoob/three.js/pull/18846
					// (As of Oct 2023, Threejs isn't close to supporting any post processing for WebXR.
					// So for antialiasing I'll have to use something else.
					// Trying this other one from postprocessing.js and realism-effects:
					
					// Ah, also not easy!
					// Waiting on https://github.com/mrdoob/three.js/pull/26160
					// via https://github.com/search?q=repo%3Apmndrs%2Fpostprocessing+webxr&type=discussions 
					// this.postproComposer = new PostproEffectComposer(this.renderer)

					// const renderPass = new PostproRenderPass(this._scene, this._camera)
					// this.postproComposer.addPass(renderPass)

					// const velocityDepthNormalPass = new VelocityDepthNormalPass(this._scene, this._camera)
					// this.postproComposer.addPass(velocityDepthNormalPass)

					// const traaEffect = new TRAAEffect(this._scene, this._camera, velocityDepthNormalPass)
					// const effectPass = new PostproEffectPass(this._camera, traaEffect)

					// this.postproComposer.addPass(effectPass)
					
				}

			}
			else if(this.isVrActive && !isVrActiveNow) { // Leaving VR
				CameraSys.CurrentScale = CameraSys.FT_SCALE
				this.babs.group.scale.setScalar(CameraSys.CurrentScale)
				this._camera.near = 12 *CameraSys.CurrentScale

				setTimeout(() => {
					window.location.reload()
				}, 1000)
			}
			this.isVrActive = isVrActiveNow

		}, 1000)
	}

	handleResize() {
		this._camera.aspect = window.innerWidth / window.innerHeight
		this._camera.updateProjectionMatrix()
		this.renderer.setSize(window.innerWidth, window.innerHeight)
		// this.composer.setSize(window.innerWidth, window.innerHeight)
	}

	update(dt) {
		if(this.recalcImmediatelyBpids.size > 0) {
			// Run recalc for each item in the Set
			this.recalcImmediatelyBpids.forEach((bpid) => this.calcNearbyWobs(bpid))
			this.recalcImmediatelyBpids.clear()
		}

		// Efficiently get a Wob.InstancedWobs item based on its index, and calc nearby wobs for that bpid
		let currentIndex = 0
		for (let [key, value] of Wob.InstancedWobs) {
			if (currentIndex === this.calcMapIndex) {
				this.calcNearbyWobs(key)
				// console.log('calc for ', value.instancedMesh.name)
				break
			}
			currentIndex++
		}
		this.calcMapIndex++
		if(this.calcMapIndex >= Wob.InstancedWobs.size) {
			this.calcMapIndex = 0
		}

		const duration = 3.25
		const secondsElapsed = performance.now() * 0.001
		const t = secondsElapsed % duration
		for (let [name, instancedWobs] of Wob.InstancedWobs) {
			if(instancedWobs.isAnimated && instancedWobs.instancedMesh instanceof InstancedSkinnedMesh) {

				
				if(instancedWobs.blueprint_id == 'butterfly') {
					log('loaded', instancedWobs.getLoadedCount())
				}

				for(let i=0, lc=instancedWobs.getLoadedCount(); i<lc; i++) {
					// Copy from instance to silly
					let instanceMatrix = new Matrix4()
					instancedWobs.instancedMesh.getMatrixAt(i, instanceMatrix)
					instancedWobs.silly.matrix.copy(instanceMatrix)

					let instancePosition = new Vector3()
					instancePosition.setFromMatrixPosition(instanceMatrix)
					instancedWobs.silly.position.copy(instancePosition)
					instancedWobs.silly.updateMatrix()
					
					instancedWobs.animMixer.setTime(t)
					instancedWobs.silly.skeleton.bones.forEach((b) => {
						b.updateMatrixWorld()
					})

					instancedWobs.silly.updateMatrix()
					instancedWobs.instancedMesh.setMatrixAt(i, instancedWobs.silly.matrix)
					instancedWobs.instancedMesh.setBonesAt(i, instancedWobs.silly.skeleton)
				}

				instancedWobs.instancedMesh.instanceMatrix.needsUpdate = true
				if (instancedWobs.instancedMesh.skeleton?.boneTexture) {
					instancedWobs.instancedMesh.skeleton.boneTexture.needsUpdate = true
				}

			}
		}
		
		// List all materials in scene
		// const materials = new Set()
		// const scene = this.babs.scene
		// scene.traverse( function( object :any ) {
		// 	if ( object.material ) materials.add( object.material );
		// })
		// console.log(materials)

		// List all InstancedMesh in scene
		// const ims = new Set()
		// const scene = this.babs.scene
		// scene.traverse( function( object :any ) {
		// 	if ( object instanceof InstancedMesh ) ims.add( object )
		// })
		// console.log(ims)

		this.renderer.render(this._scene, this._camera)

	}

	calcMapIndex = 0
	calcNearbyWobs(bpid :string) {
		// console.log('calcShowOnlyNearbyWobs', bpid)
		// Let's sort the detailed wobs (eg Goblin Blanketflowers) instancedmeshes by distance from player

		const playerpos = this.babs.inputSys?.playerSelf?.controller?.playerRig?.position
		if(!playerpos) return

		const feim = Wob.InstancedWobs.get(bpid)
		// feim.instancedMesh.count = feim.maxCount; return // Disables calc

		// feim.instancedMesh.computeBoundingBox()
		feim.instancedMesh.computeBoundingSphere() // THIS IS IT.  OMG LOL.  Fixes bug where you couldn't click something facing one direction after zoning for a while in that direction.
		// TODO only do on rescale?  (And note there is: .copy()) https://github.com/mrdoob/three.js/blob/master/src/objects/InstancedMesh.js
		// Note that sphere is used for depth sorting: https://github.com/mrdoob/three.js/pull/25974/files
		// Also for frustum culling https://discourse.threejs.org/t/boundingsphere-and-boundingbox/17868
		// "The bounding sphere is also computed automatically when doing raycasting. The bounding box is optional. If you define it, the raycasting logic will test it too"
		// Also, this can't be moved to instancedMesh creation; may be needed either during calc updates in here, and/or after shiftiness.  Keeping it here.

		// For each index in instancedMesh, get the position relative to the player
		const instanceMatrix = feim.instancedMesh.instanceMatrix
		
		// Rather than a cutoff at a number, cutoff based on dist.
		const distCutoff = this.babs.inputSys.mouse.device === 'fingers' ? 500 : 1000 // (feim.asFarWobs ? 1000 : 500)
		// 'fingers' is currently phone and quest 2.

		let iNearby = 0
		for(let i=0, lc=feim.getLoadedCount(); i<lc; i++) { // Each instance is a 4x4 matrix; 16 floats
			// Each instance is a 4x4 matrix; 16 floats
			const x = instanceMatrix.array[i*16 +12] +this.babs.worldSys.shiftiness.x
			const z = instanceMatrix.array[i*16 +14] +this.babs.worldSys.shiftiness.z

			if(!(x && z)) continue

			// Get distance from playerpos in 2 dimensions
			const dist = Math.sqrt(Math.pow(playerpos.x -x, 2) +Math.pow(playerpos.z -z, 2))

			// iNearby finds how many wobs total are nearby, for setting .count.
			// Swap anything nearby into incrementing iNearby, then set .count to that.
			const isNearbyIsh = feim.asFarWobs ? dist >= distCutoff : dist < distCutoff
			if(isNearbyIsh) {
				// Swap far iNearby with this near i
				if(i !== iNearby) {
					Zone.swapWobsAtIndexes(iNearby, i, feim)
					// console.log('swapped: ', feim.instancedMesh.name, '('+imLoadedCount+')', iNearby, i)
				}
				iNearby++
			}
		}

		feim.instancedMesh.instanceMatrix.needsUpdate = true
		feim.instancedMesh.count = iNearby
		feim.instancedMesh.instanceMatrix.needsUpdate = true
		feim.instancedMesh.matrixWorldNeedsUpdate = true
		feim.instancedMesh.updateMatrix()
		feim.instancedMesh.updateMatrixWorld(true)
		feim.instancedMesh.instanceColor.needsUpdate = true
		
		if(feim.instancedMesh.name === 'butterfly' && feim.instancedMesh instanceof InstancedSkinnedMesh) {
			console.log('setting count', feim.instancedMesh.count, '(max ' +feim.maxCount +')', 'for', feim.instancedMesh)
			
			const wobMesh = feim.gltf.scene.children[0].children[0] as SkinnedMesh
			// feim.instancedMesh.bind(wobMesh.skeleton, wobMesh.bindMatrix)
		}
		// feim.instancedMesh.	 = feim.isAnimated ? feim.maxCount : iNearby // todo anim, this wasn't originally necessary, problem with anim counts?
	}

	moveLightsNearPlayer() {
		if(Flame.player?.controller?.playerRig) {
			const playerpos = Flame.player.controller.playerRig.position

			const nearestWants = Flame.wantsLight.sort((a, b) => {
				return Math.abs(a.position.distanceTo(playerpos)) -Math.abs(b.position.distanceTo(playerpos))
			})

			for(let index=0; index<Flame.lightPool.length; index++) {
				if(index > nearestWants.length -1) break
				Flame.lightPool[index].position.copy(nearestWants[index].position)
				Flame.lightPool[index].position.setY(Flame.lightPool[index].position.y +2)
			}
		}
	}
}
