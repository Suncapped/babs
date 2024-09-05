import { UiSys } from './UiSys'

import { Euler, MathUtils, ACESFilmicToneMapping, Matrix4, PerspectiveCamera, Scene, Vector3, WebGLRenderer, SRGBColorSpace, InstancedMesh, Mesh, LineSegments, SkinnedMesh, Quaternion, MeshBasicMaterial, SphereGeometry, DoubleSide, BufferGeometry, Line } from 'three'
import { WorldSys } from './WorldSys'
import { Fire } from '@/comp/Fire'
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
import { YardCoord } from '@/comp/Coord'
import Cookies from 'js-cookie'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js'
import type { Player } from '@/ent/Player'
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

	public xrBaseReferenceSpace :XRReferenceSpace	

	constructor(babs :Babs) {
		this.babs = babs

		this.renderer = new WebGLRenderer({ 
		// this.renderer = new WebGPURenderer({ 
			// antialias: window.devicePixelRatio < 3, // My monitor is 2, aliasing still shows
			antialias: babs.graphicsQuality || babs.vrSupported, // Antialias (MSAA?) was killing M1 perf.  // Quest 2 needs it badly. 
			// multiviewStereo: true, // OCULUS_multiview handling in WebXR, not ready yet https://github.com/mrdoob/three.js/pull/25981
			// depth: false, // lol no!
			// powerPreference: 'high-performance',
			canvas: document.getElementById('canvas'),
			// alpha: true,
			// premultipliedAlpha: false,
			logarithmicDepthBuffer: true, // Can cause shader problems; fixed for fire (search 'logdepthbuf' ), MSAA may need fix too?  https://github.com/mrdoob/three.js/issues/22017
			// also: "Note that this setting uses gl_FragDepth if available which disables the Early Fragment Test optimization and can cause a decrease in performance." // todo test this out?
			// On VR, that helps with far tree base z fighting, but doesn't help with wob antialiasing

		})
		this.renderer.xr.enabled = true
		this.renderer.outputColorSpace = SRGBColorSpace
		console.debug('Graphics support:', 'maxTextureSize', this.renderer.capabilities.maxTextureSize)

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
		console.debug('aniso', this.renderer.capabilities.getMaxAnisotropy())

		const fov = 45
		const nearClip = 12 *(CameraSys.CurrentScale) // 5.1 // Slightly over 5' for testing looking down! // Oh wow, for VR, going from 0.01 to 12 helped SO much with z fighting trees! // Because GPT: "Avoid setting the near plane too close to 0, as this can disproportionately allocate depth precision near the camera. Finding the right balance is key to maintaining visual quality over a range of distances."
		this._camera = new PerspectiveCamera(fov, window.innerWidth / window.innerHeight, nearClip, WorldSys.MAX_VIEW_DISTANCE *2)
		// Note: AVP (Apple Vision Pro) has a far clip that maxes out at around 1000 ish.  Moving your head creates a weird disappearing-land-edge effect.  Lowering the clip here doesn't help, the effect just happens closer by.  Currently I can't think of a workaround that's easy!
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
			console.debug('window focus event')
			this.documentHasFocus = true
			this.babs.uiSys.gotWindowFocus(ev)
		})

		setInterval(() => {
			this.moveLightsToNearPlayer()
			
			const xrSession = (this.renderer instanceof WebGLRenderer) && this.renderer.xr.getSession()
			const isVrSessionActivated = !!xrSession
			if(!this.isVrActive && isVrSessionActivated) { // Entering VR
				CameraSys.CurrentScale = CameraSys.VR_SCALE
				this._camera.near = 0.1
				this.babs.group.scale.setScalar(CameraSys.CurrentScale)

				Fire.LightPool.forEach((pointLight) => {
					pointLight.intensity = Fire.PointLightIntensity *CameraSys.CurrentScale
					pointLight.distance = Fire.PointLightDistance *CameraSys.CurrentScale
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

				// Set up controllers
				// In steam, OpenXR runtime must be set to SteamVR, not Varjo?  This is set in Steam, and unset in Varjo Base by disabling OpenXR.  I think because...AI: "Varjo is a plugin for SteamVR, and it's not a standalone runtime." - not sure if true :p
				const xrRenderer = this.renderer.xr
				if(xrRenderer.getCamera()?.cameras[0]) { // If we can get a camera
					console.log('Setting up VR controllers')
					const [controller0, controller1] = [xrRenderer.getController(0), xrRenderer.getController(1)]
					console.log('controllers', controller0, controller1)
					
					const controllerModelFactory = new XRControllerModelFactory()
					const [controllerGrip0, controllerGrip1] = [xrRenderer.getControllerGrip(0), xrRenderer.getControllerGrip(1)]
					console.log('grips', controllerGrip0, controllerGrip1)
					controllerGrip0.add(controllerModelFactory.createControllerModel(controllerGrip0))
					controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1))
					
					this.babs.scene.add(controller0)
					this.babs.scene.add(controller1)
					this.babs.scene.add(controllerGrip0)
					this.babs.scene.add(controllerGrip1)

					this.xrBaseReferenceSpace = this.babs.renderSys.renderer.xr.getReferenceSpace()

					// controller0.position.set(5, 12, 5)
					// controllerGrip0.position.setY(40)
					// controllerGrip1.position.setY(40)
	
					const waitForReady = () => {
						if(this.babs.cameraSys?.cameraGroup) {

							// this.babs.cameraSys.camera.add(controller1)
							// this.babs.cameraSys.camera.add(controllerGrip1)

							// this.babs.inputSys.playerSelf.controller.playerRig.add(controller1)
							// this.babs.inputSys.playerSelf.controller.playerRig.add(controllerGrip1)


							console.log('Adding controllers to cameraGroup')

							const geometryline0 = new BufferGeometry().setFromPoints( [ new Vector3( 0, 0, 0 ), new Vector3( 0, 0, - 1 ) ] )
							const line0 = new Line( geometryline0, new MeshBasicMaterial( { color: 0x00ff00 } ))
							line0.scale.z = 500
							line0.scale.x = 50
							line0.scale.y = 50
							controller0.add( line0.clone() )

							const geometryline1 = new BufferGeometry().setFromPoints( [ new Vector3( 0, 0, 0 ), new Vector3( 0, 0, - 1 ) ] )
							const line1 = new Line( geometryline1, new MeshBasicMaterial( { color: 0x0000ff } ))
							line1.scale.z = 500
							line1.scale.x = 50
							line1.scale.y = 50
							controller1.add( line1.clone() )

							// let geometry = new SphereGeometry(1, 32, 32);
							// let material = new MeshBasicMaterial({color: 0xff0000});
							// material.side = DoubleSide
							// let sphere = new Mesh(geometry, material);
							// sphere.position.copy(controller1.position);
							// this.babs.scene.add(sphere);

							const zone = this.babs.inputSys.playerSelf.controller.playerRig.zone
							// const wobAtCoord = zone.getWob(0,0)

							/* Log things in world rendered text
							this.babs.uiSys.wobSaid( 'VR has been initialized. VR has been initialized. VR has been initialized. VR has been initialized. VR has been initialized. VR has been initialized. VR has been initialized. ', wobAtCoord)

							controller0.addEventListener('selectstart', (event) => {
								console.log('controller0 selectstart')
								this.babs.uiSys.wobSaid('<controller0 selectstart>', wobAtCoord)
							})
							controller0.addEventListener('selectend', (event) => {
								console.log('controller0 selectend')
								this.babs.uiSys.wobSaid('<controller0 selectend>', wobAtCoord)
							})

							controller1.addEventListener('selectstart', (event) => {
								console.log('controller1 selectstart')
								this.babs.uiSys.wobSaid('<controller1 selectstart>', wobAtCoord)
							})
							controller1.addEventListener('selectend', (event) => {
								console.log('controller1 selectend')
								this.babs.uiSys.wobSaid('<controller1 selectend>', wobAtCoord)
							})
							*/


							// Hands?

							let hand1, hand2
							hand1 = this.babs.renderSys.renderer.xr.getHand(0)
							hand2 = this.babs.renderSys.renderer.xr.getHand(1)
							this.babs.scene.add(hand1)
							this.babs.scene.add(hand2)

							let handModelFactory = new XRHandModelFactory()
							hand1.add(handModelFactory.createHandModel(hand1))
							hand2.add(handModelFactory.createHandModel(hand2))


						} 
						else setTimeout(waitForReady, 1000)
					}
					waitForReady()
				}

			}
			else if(this.isVrActive && !isVrSessionActivated) { // Leaving VR
				CameraSys.CurrentScale = CameraSys.FT_SCALE
				this.babs.group.scale.setScalar(CameraSys.CurrentScale)
				this._camera.near = 12 *CameraSys.CurrentScale

				setTimeout(() => {
					window.location.reload()
				}, 1000)
			}
			this.isVrActive = isVrSessionActivated

		}, 1000)
	}

	handleResize() {
		this._camera.aspect = window.innerWidth / window.innerHeight
		this._camera.updateProjectionMatrix()
		this.renderer.setSize(window.innerWidth, window.innerHeight)
		// this.composer.setSize(window.innerWidth, window.innerHeight)
	}

	maxFrameRate = 30
	framedropSeconds = 0
	update(dt) {
		this.maxFrameRate = Math.max(this.maxFrameRate, this.fpsDetected) // calcNearbyWobs will start with a short distance so framerate should start out high.

		if(this.babs.graphicsQuality) {
			if(this.fpsDetected < this.maxFrameRate -(this.maxFrameRate *0.10)) { // More than a 20% framedrop
				this.framedropSeconds += dt
				if(this.framedropSeconds > 10 && !this.isVrActive && this.documentHasFocus) { // 5 seconds of framedrop, and not VR, and not because they tabbed away
					this.babs.graphicsQuality = false // Stop coming into this loop
					// Switch to performance mode
					this.babs.uiSys.aboveHeadChat(this.babs.idSelf, '<low framerate, switching graphics to performance>')
					Cookies.set('graphics', 'performance', { 
						domain: this.babs.baseDomain,
						secure: this.babs.isProd,
						sameSite: 'strict',
					})
					setTimeout(() => {
						window.location.reload()
					}, 3000)
				}
			}
			else {
				this.framedropSeconds -= dt
				this.framedropSeconds = Math.max(this.framedropSeconds, 0)
			}
		}
		// console.log('this.framedropSeconds', this.fpsDetected, this.maxFrameRate, this.framedropSeconds)

		// Calc one wob type each update
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

		const secondsElapsed = performance.now() * 0.001
		for (let [name, instancedWobs] of Wob.InstancedWobs) {
			if(instancedWobs.isAnimated && instancedWobs.instancedMesh instanceof InstancedSkinnedMesh) {
				for(let i=0, lc=instancedWobs.getLoadedCount(); i<lc; i++) {
					const duration = instancedWobs.gltf.animations[0].duration
					const timeOffset = instancedWobs.animTimeOffsets[i]
					const animTime = (secondsElapsed +timeOffset) % duration

					if(instancedWobs.animMixer) { // Guard in case of disabling animations at ISM creation
						instancedWobs.animMixer.setTime(animTime)
						instancedWobs.silly.skeleton.bones.forEach((b) => {
							b.updateMatrixWorld()
						})

						instancedWobs.silly.updateMatrix()
						// instancedWobs.instancedMesh.updateMatrix()
						// instancedWobs.instancedMesh.setMatrixAt(i, instancedWobs.silly.matrix) // not needed since I'm not translating etc it?
						instancedWobs.instancedMesh.setBonesAt(i, instancedWobs.silly.skeleton)
						// instancedWobs.instancedMesh.updateMatrix()
					}
				}

				instancedWobs.instancedMesh.instanceMatrix.needsUpdate = true
				if (instancedWobs.instancedMesh.skeleton?.boneTexture) {
					instancedWobs.instancedMesh.skeleton.boneTexture.needsUpdate = true
				}
			}

		}

		this.renderer.render(this._scene, this._camera)
	}

	calcMapIndex = 0
	calcPositionChanged = false // May want to use with calcDistanceModifier
	calcDistanceModifier = 1
	calcNearbyWobs(bpid :string) {
		/* Disable calc
		const feimTemp = Wob.InstancedWobs.get(bpid)
		// feimTemp.maxCount
		feimTemp.instancedMesh.count = Math.min(1, Math.round(feimTemp.maxCount /100))
		return
		//*/
		// console.log('calcShowOnlyNearbyWobs', bpid)
		// const start = window.performance.now()

		// // Only do this once every x frames
		// if(this.frames % 60 !== 0) {
		// 	return
		// }

		const controller = this.babs.inputSys?.playerSelf?.controller
		const playerpos = controller?.playerRig?.position
		if(!playerpos) {
			return
		}

		const isZoning = controller.selfWaitZoningExitZone
		if(isZoning) { // Skip while zoning to prevent mid-shift resorting
			return
		}

		const feim = Wob.InstancedWobs.get(bpid)

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
		// And let's have that distance vary by wob height, so that eg grasses don't display way far away.
		const distPerFoot = 100
		const extraLoadingDistMult = 1.5
		let distCutoff = MathUtils.clamp(feim.boundingSize.y *distPerFoot, WorldSys.Acre *extraLoadingDistMult, WorldSys.ZONE_LENGTH_FEET) // Min-max = 200-1000.  Latter needs to be <=1000 or there are zoning artifacts
		if(this.babs.graphicsQuality) distCutoff = WorldSys.ZONE_LENGTH_FEET

		/*{ // Removed because we want all players to see the same thing!
			// Cap distance each frame to a max
			const isAtMaxFps = this.fpsDetected >= this.maxFrameRate -(this.maxFrameRate *0.10) // More than a 10% framedrop
			const slowdown = 5
			if(isAtMaxFps) {
				this.calcDistanceModifier += 0.01 /slowdown
			}
			else {
				this.calcDistanceModifier -= 0.01 /slowdown
			}

			const minDistanceFactorLowPerf = 0.2
			const extraDistanceFactorHighPerf = 2
			this.calcDistanceModifier = MathUtils.clamp(this.calcDistanceModifier, minDistanceFactorLowPerf, extraDistanceFactorHighPerf) // Up to 2, because it can go to 200%, making close grasses appear farther on fast clients


			distCutoff = distCutoff *this.calcDistanceModifier
			distCutoff = Math.min(distCutoff, 1000) // Cap at 1000ft

			// console.log(this.calcDistanceModifier)
		}*/



		let iNearby = 0
		const gDestRef = this.babs.inputSys.playerSelf.controller.gDestination // Careful, it's a ref
		for(let i=0, lc=feim.getLoadedCount(); i<lc; i++) { // Each instance is a 4x4 matrix; 16 floats // Replicated in setDestination()
			// Each instance is a 4x4 matrix; 16 floats
			const x = instanceMatrix.array[i*16 +12]// +this.babs.worldSys.shiftiness.x // todo shiftiness
			const z = instanceMatrix.array[i*16 +14]// +this.babs.worldSys.shiftiness.z
			if(!(x && z)) continue

			// Get distance from playerpos in 2 dimensions
			const targetYardCoord = YardCoord.Create({ // From Controller
				...gDestRef, // Use this so that calcFrameMod doesn't change as often as movement momentum
				zone: this.babs.worldSys.currentGround.zone, // Hmm will this work cross zone?
			})
			const engPos = targetYardCoord.toEngineCoordCentered()
			const dist = Math.sqrt(Math.pow(engPos.x -x, 2) +Math.pow(engPos.z -z, 2))
			
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

		// const end = window.performance.now()
		// const time = end -start
		// if(time > 0.1) {
		// 	console.log('calcNearbyWobs', time+'', bpid, feim.getLoadedCount()) // tree twotris takes 7ms, others max at 1ms.
		// }
	}

	moveLightsToNearPlayer() {
		if(!Fire.Player) Fire.Player = this.babs.ents.get(this.babs.idSelf) as Player

		const playerPos = Fire.Player?.controller?.playerRig?.position
		if(playerPos) {
			const nearestFires = Fire.FireLights.sort((a, b) => {
				return Math.abs(a.position.distanceTo(playerPos)) -Math.abs(b.position.distanceTo(playerPos))
			})
			// console.log('nearestFires', nearestFires.length, nearestFires[0])

			// If there's more lightpool spots than actual fires, reduce pool
			// console.log('Fire.LightPool.length', Fire.LightPool.length, 'nearestFires.length', nearestFires.length)
			if(Fire.LightPool.length > nearestFires.length) {
				for(let i=nearestFires.length; i<Fire.LightPool.length; i++) {
					const pointLight = Fire.LightPool[i]
					pointLight.parent.remove(pointLight)
				}
				Fire.LightPool.length = nearestFires.length
			}

			for(let index=0; index<Fire.LightPool.length; index++) {
				Fire.LightPool[index].position.copy(nearestFires[index].position)
				Fire.LightPool[index].position.setY(Fire.LightPool[index].position.y +2)
			}
		}
	}
}
