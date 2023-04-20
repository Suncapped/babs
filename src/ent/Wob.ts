import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide, Vector3, InstancedMesh, StreamDrawUsage, Matrix4, InstancedBufferAttribute, SphereGeometry, MeshBasicMaterial, Scene, PerspectiveCamera, DirectionalLight, WebGLRenderer, OrthographicCamera, BoxGeometry, AmbientLight, Quaternion, WebGLRenderTarget, MeshLambertMaterial, BoxHelper, StaticDrawUsage, DynamicDrawUsage } from 'three'
import { SocketSys } from '@/sys/SocketSys'
import { UiSys } from '@/sys/UiSys'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as Utils from '@/Utils'
import { Appearance } from '@/comp/Appearance'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { LoaderSys } from '@/sys/LoaderSys'
import { log } from '@/Utils'
import { Ent } from './Ent'
import { Flame } from '@/comp/Flame'
import { Zone } from './Zone'
import { Babs } from '@/Babs'
import { YardCoord } from '@/comp/Coord'
import { Blueprint, FastWob, type Rotation } from '@/shared/SharedZone'
import { Player } from './Player'

type IconData = {image :string, pixels :Uint8Array}

export class FeInstancedMesh extends InstancedMesh {
	private constructor(...args: ConstructorParameters<typeof InstancedMesh>) { super(...args) }
	static Create(babs :Babs, ...args: ConstructorParameters<typeof InstancedMesh>) {
		return new FeInstancedMesh(...args).init(babs)
	}

	babs :Babs
	renderedIcon :() => Promise<IconData>|IconData
	countMax :number
	boundingSize = new Vector3()
	lift = 0
	sink = 0
	instanceIndexToWob = new Map<number, Wob>

	init(babs :Babs) {
		this.babs = babs
		return this
	}

	coordFromIndex(index) { 
		// Returns world coord; instanced are zero-oriented since they have to be shared across zones, and their 'getMatrixAt()' positions are all local, not world.  So we change them to world using shiftiness.
		const matrix = new Matrix4()
		this.getMatrixAt(index, matrix)
		const quat = new Quaternion()
		const position = new Vector3()
		quat.setFromRotationMatrix(matrix)
		position.setFromMatrixPosition(matrix)
		const engWorldCoord = position.clone().add(this.babs.worldSys.shiftiness)
		return engWorldCoord
	}
}

export class Wob extends FastWob {
	constructor(
		public babs :Babs,
		public idzone :number,
		public x :number,
		public z :number,
		public r :Rotation,
		bp :Blueprint,
	) {
		super(idzone, x, z, r, bp)
	}

	get zone() {
		return this.babs.ents.get(this.idzone) as Zone
	}

	color
	attachments

	static HiddenScene = null
	static HiddenSceneRender(mesh) :Promise<IconData> {
		if(!Wob.HiddenScene) {
			const container = document.getElementById('HiddenRenderFrame')

			// create your renderer
			const renderer = new WebGLRenderer({ antialias: true, alpha: true, }) //  preserveDrawingBuffer: true, // why?
			// renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize( UiSys.ICON_SIZE, UiSys.ICON_SIZE );

			// apply the internal canvas of the renderer to the DOM
			container.appendChild( renderer.domElement );


			// Scene?
			const scene = new Scene()
	
			const fov = 45
			const aspect = 1  // the canvas default
			const near = 0.1
			const far = 1000
			// const camera = new PerspectiveCamera(fov, aspect, near, far)
			const d = 2
			const camera = new OrthographicCamera( - d * aspect, d * aspect, d, - d, near, far)
			// camera.position.set(0,0,0)
			// camera.position.set(0,0,0)
			// camera.lookAt(1, 0, 1)
			// camera.lookAt( new Vector3(20,20,20) ); // or the origin

			camera.position.set( 20, 20, 20 );
			// camera.rotation.order = 'YXZ';
			// camera.rotation.y = - Math.PI / 4;
			// camera.rotation.x = Math.atan( - 1 / Math.sqrt( 2 ) );

			camera.lookAt(scene.position)
		
			const color = 0xFFFFFF
			const intensity = 1
			const light = new DirectionalLight(color, intensity)
			// light.position.set(0,2,0)
			light.position.set( 10,20,15 )
			
			
			scene.add(light)
			
			Wob.HiddenScene = {scene, renderer, camera}




			// const geometry = new BoxGeometry(1,1,1)
			// const material = new MeshPhongMaterial
			// ambient: 0x555555
			// color: 0x555555
			// specular: 0xffffff
			// shininess: 50
			// shading: SmoothShading // was deprecated?

			// const cube = new Mesh(geometry, material)
			// scene.add(cube)

			// scene.add( new AmbientLight(0x4000ff) )

		}
		
		for(let child of Wob.HiddenScene.scene.children){ 
			if(child instanceof Mesh) {
				Wob.HiddenScene.scene.remove(child); 
			}
		}

		// if(mesh.name) {
			const localMesh = mesh.clone()
			localMesh.geometry = mesh.geometry.clone()
			Wob.HiddenScene.scene.add(localMesh)
			// localMesh.position.set(1,1,1)
			localMesh.position.set(0,-1.5,-0.5)
			// localMesh.geometry.rotateX(-Math.PI /2)

			Wob.HiddenScene.renderer.render(Wob.HiddenScene.scene, Wob.HiddenScene.camera) // Hmm what does it do? lol
			// Wob.HiddenScene.renderer.domElement.toDataURL()
		// }


		// let pickingTexture = new WebGLRenderTarget( 50, 50);
		// // log('imageData!',Wob.HiddenScene.renderer.domElement.getImage)
		// Wob.HiddenScene.renderer.setRenderTarget(pickingTexture)
		// Wob.HiddenScene.renderer.render( Wob.HiddenScene.scene, Wob.HiddenScene.camera );
		// const pixelBuffer = new Uint8Array( 4 *50*50 );
		// Wob.HiddenScene.renderer.readRenderTargetPixels( pickingTexture, 0, 0, 50, 50, pixelBuffer );
		// // log('rtpx', pixelBuffer)
		// log('rtpx', Wob.HiddenScene.renderer.context)

		const dataurl :string = Wob.HiddenScene.renderer.domElement.toDataURL()//('image/png')

		return new Promise((resolve, reject) => {
			let img = new Image()
			img.src = dataurl
			img.onload = () => {
				let canvas = document.createElement('canvas');
				canvas.width = UiSys.ICON_SIZE
				canvas.height = UiSys.ICON_SIZE
				let ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0);
				let imageData = ctx.getImageData(0, 0, UiSys.ICON_SIZE, UiSys.ICON_SIZE);
				let pixels = new Uint8Array(imageData.data.buffer);
				canvas.remove()
				img.remove()
		
				resolve({image: dataurl, pixels: pixels} as IconData)
			}
			img.onerror = reject
		})



	}


	static SphereGeometry = new SphereGeometry(1, 12, 12)
	static SphereMaterial = new MeshLambertMaterial({ color: 0xcccc00 })
	static SphereMesh = new Mesh(Wob.SphereGeometry, Wob.SphereMaterial)
	static FullColor = new Color(1,1,1)
	static FarwobName = 'tree twotris'
	static FarwobShownHeightMinimum = 12
	static FarwobHiddenBuryDepth = 1000

	static LoadedGltfs = new Map<string, any>()
	static InstancedMeshes = new Map<string, FeInstancedMesh>()
	static async LoadInstancedGraphics(arrivalWobs :Array<FastWob>, babs :Babs, shownames :boolean) {
		// arrivalWobs = arrivalWobs.splice(0, Math.round(arrivalWobs.length /2))
		log.info('arrivalWobs', arrivalWobs.length)
		// Load unique gltfs
		// Also load far tree visuals for taller wobs
		let loads = []
		let load
		const nameCounts = new Map<string, number>()
		// console.time('timing')
		let gltfCounts = 0


		const playerSelf = babs.ents.get(babs.idSelf) as Player
		const playerZone = playerSelf.controller.target.zone
		const zoneIdsAroundPlayerZone = playerZone.getZonesAround().map(z=>z.id)

		for(const wob of arrivalWobs) {
			// log('nameCount of', wob.name, nameCount)

			// Generate far trees for far zones
			const wobIsFar = !zoneIdsAroundPlayerZone.includes(wob.idzone)
			if(wobIsFar) { // Useful during initial loading
				// Make it always load the instanced at least, so later we can check boundingSize.y for hiding short things as far trees
				// Optimization note, this forces loading of every gltf in objects sent :/

				if(nameCounts.get(wob.name) === undefined) {
					// log('Manual loading:', wob.name)
					nameCounts.set(wob.name, 0)

					gltfCounts++
					load = babs.loaderSys.loadGltf(`/environment/gltf/${wob.name}.glb`, wob.name)
					Wob.LoadedGltfs.set(wob.name, true) // true for now, gets set right after this
					loads.push(load)
				}

				// Now set up for treating as far tree
				// log(wob.name, '->', Wob.FarwobName)
				wob.name = Wob.FarwobName
				wob.blueprint_id = Wob.FarwobName
			}

			nameCounts.set(wob.name, (nameCounts.get(wob.name) || 0) +1)
			if(!Wob.LoadedGltfs.get(wob.name)){
				gltfCounts++
				load = babs.loaderSys.loadGltf(`/environment/gltf/${wob.name}.glb`, wob.name)
				Wob.LoadedGltfs.set(wob.name, true) // true for now, gets set right after this
				loads.push(load)
			}
		}
		// log('gltfCounts', gltfCounts)
		// console.timeLog('timing')
		const finishedLoads = await Promise.all(loads)
		// console.timeLog('timing')
		// Use name passed in to loadGltf to set so we don't have to await later
		for(const load of finishedLoads) {
			Wob.LoadedGltfs.set(load.name, load)
		}
		// log('Wob.loadedGltfs', Wob.LoadedGltfs)

		// console.timeLog('timing')
		// Create InstancedMeshes from loaded gltfs
		// const countMax = 10 // How large the instancdedmesh starts out

		const instancedExpansionAdd = 0 // How much larger the instancedmesh will get, eg +10 
		// ^ Is now set to zero (do nothing) because it's buggy thus: /clear zone, refresh, /gen 1, exit zone; items disappear.
		// ^ But only when zonesAround() is narrowed to one.  :S  Anyway, simpler without it.

		for(const [instancedMeshName, gltf] of Wob.LoadedGltfs) {
			let instanced = Wob.InstancedMeshes.get(instancedMeshName)
			let newWobsCount = nameCounts.get(instancedMeshName)

			// What this does is, either creates an instancedmesh, or expands its size with some margin for adding a few wobs without having to resize it again
			if(!instanced) {
				let wobMesh :Mesh
				try {
					wobMesh = gltf.scene.children[0]
				}
				catch(e) {
					log.info('error loading gltf', instancedMeshName)
				}

				if(!wobMesh) {
					wobMesh = Wob.SphereMesh // Object wasn't loaded.  Make a sphere
				}

				let boundingSize :Vector3 = new Vector3
				wobMesh.geometry.boundingBox?.getSize(boundingSize) // sets into vector // some don't have box, thus ?
				// log('boundingSize.y', boundingSize.y.toFixed(3), wobName)

				const isMeshForFarWob = instancedMeshName.indexOf(Wob.FarwobName) !== -1
				if(isMeshForFarWob) {
					wobMesh.geometry.scale(4, 1, 4)
				}

				const countMax = newWobsCount +instancedExpansionAdd // margin for adding a few wobs without a resize
				instanced = FeInstancedMesh.Create(babs, wobMesh.geometry, wobMesh.material, countMax)
				instanced.count = 0
				instanced.countMax = countMax
				instanced.name = instancedMeshName
				// instanced.instanceMatrix.needsUpdate = true
				instanced.instanceMatrix.setUsage(DynamicDrawUsage) 
				// ^ Requires calling .needsUpdate ? // https://www.khronos.org/opengl/wiki/Buffer_Object#Buffer_Object_Usage

				instanced.boundingSize = boundingSize 
				instanced.sink = Math.min(instanced.boundingSize.y *0.05, 0.2) // +(boundingSize.y /(1/scaleFartrees))
				// ^ Sink by a percent but with a max for things like trees.
				instanced.lift = (instanced.boundingSize.y < 0.01 ? 0.066 : 0)
				// ^ For very small items (like flat 2d cobblestone tiles), let's lift them a bit

				instanced.castShadow = instanced.boundingSize.y >= 1
				instanced.receiveShadow = true

				// 			const mudColors = []
				// 			const color = new Color(1,1,1) // Set to not modify color; used later for highlight by pickedObject in InputSys
				// 			for(let i=0; i<instanced.count; i++) {
				// 				mudColors.push(color.r, color.g, color.b)
				// 			}
				// 			const bufferAttr = new InstancedBufferAttribute(new Float32Array(mudColors), 3)
				// 			bufferAttr.needsUpdate = true
				// 			instanced.instanceColor = bufferAttr

				// Set to not modify color; used later for highlight by pickedObject in InputSys
				const fullColors = new Float32Array(instanced.countMax *3)
				for(let i=0; i<instanced.countMax *3; i+=3) {
					fullColors[i +0] = Wob.FullColor.r
					fullColors[i +1] = Wob.FullColor.g
					fullColors[i +2] = Wob.FullColor.b
				}
				const bufferAttr = new InstancedBufferAttribute(fullColors, 3)
				instanced.instanceColor = bufferAttr
				instanced.instanceColor.needsUpdate = true

				instanced.renderedIcon = async () => {
					const {image, pixels} = await Wob.HiddenSceneRender(wobMesh)
					instanced.renderedIcon = () => { // Overwrite self?!  lol amazing
						return {image, pixels}
					}
					return instanced.renderedIcon()
				}

				instanced.position.setX(babs.worldSys.shiftiness.x)
				instanced.position.setZ(babs.worldSys.shiftiness.z)

				instanced.geometry.center()
				// ^ Fixes offset pivot point
				// https://stackoverflow.com/questions/28848863/threejs-how-to-rotate-around-objects-own-center-instead-of-world-center/28860849#28860849

				Wob.InstancedMeshes.set(instancedMeshName, instanced)
				babs.group.add(instanced)

				log.info('instanced created at', instanced.name, instanced.count, newWobsCount, instanced.countMax)
			}
			else if(instanced.count +newWobsCount >= instanced.countMax -1) { // Needs more space (will do for backpack items too, but that's okay)
				log.info('instanced growing with', instanced.name, instanced.count, newWobsCount, instanced.countMax)

				const newMax = instanced.count +newWobsCount +instancedExpansionAdd // margin for adding a few wobs without a resize

				const newInstance = FeInstancedMesh.Create(babs, instanced.geometry, instanced.material, newMax)
				newInstance.count = instanced.count
				newInstance.countMax = newMax
				newInstance.name = instancedMeshName
				newInstance.instanceMatrix.setUsage(DynamicDrawUsage) // todo optimize?
				let transferMatrix = new Matrix4()
				for(let i=0; i<instanced.count; i++) {
					instanced.getMatrixAt(i, transferMatrix)
					newInstance.setMatrixAt(i, transferMatrix)
				}
	
				// save rendered icons (they may have been added JIT)
				newInstance.renderedIcon = instanced.renderedIcon
	
				newInstance.sink = instanced.sink
				newInstance.lift = instanced.lift
				newInstance.boundingSize = instanced.boundingSize

				newInstance.castShadow = instanced.castShadow
				newInstance.receiveShadow = instanced.receiveShadow

				const fullColors = new Float32Array(newInstance.countMax *3)
				for(let i=0; i<newInstance.countMax *3; i+=3) {
					fullColors[i +0] = Wob.FullColor.r
					fullColors[i +1] = Wob.FullColor.g
					fullColors[i +2] = Wob.FullColor.b
				}
				newInstance.instanceColor = new InstancedBufferAttribute(fullColors, 3)
				newInstance.instanceColor.needsUpdate = true
	
				newInstance.position.x = instanced.position.x
				newInstance.position.z = instanced.position.z

				newInstance.instanceIndexToWob = new Map(instanced.instanceIndexToWob)

				babs.group.remove(instanced)
				instanced.dispose()

				newInstance.geometry.center() 
				// ^ Fixes offset pivot point
				// https://stackoverflow.com/questions/28848863/threejs-how-to-rotate-around-objects-own-center-instead-of-world-center/28860849#28860849
				
				Wob.InstancedMeshes.set(instancedMeshName, newInstance)
				babs.group.add(newInstance)
			}
			else {
				// Instance exists, doesn't need expansion based on incoming item count
				// instanced.count = instanced.count +count
			}

			
		}
		// console.timeLog('timing')

		// Now a properly sized instance exists.  So create wobs!
		let zone :Zone
		let yardCoord :YardCoord
		let engPositionVector :Vector3
		let matrix = new Matrix4()
		// This is for SETting instance items.  UNSET happens in Zone.removeWobGraphic.
		// Why separately?  Because this happens en-masse
		let count = 0
		// console.log('fwobs to load:', arrivalWobs.length)
		for(const fwob of arrivalWobs) {
			let isTargetWob =false//count === 10
			// if(fwob.idzone == 1495567058 && fwob.name === 'campfire') { // 0,0
			// 	count++
			// 	if(count === 1) {
			// 		isTargetWob = true
			// 	}
			// 	else {
			// 		isTargetWob = false
			// 	}
			// }
			// else {
			// 	isTargetWob = false
			// }

			let wob = new Wob(babs, fwob.idzone, fwob.x, fwob.z, fwob.r, {blueprint_id: fwob.blueprint_id, locid: fwob.locid})
			
			// const wobPrevious = wobZone.getWob(fwob.x, fwob.z)
			// If it's being removed from bag, delete it from bag UI
			// todo buggy
			// if(wob.idzone && (wobPrevious && !wobPrevious.idzone)) { 
			// 	// It's been moved from container into zone
			// 	// babs.uiSys.svContainers[0].delWob(wob.id) // fasttodo
			// }
			// else if(wob.idzone === null && wobPrevious && wobPrevious.idzone === null) { 
			// 	// It's been moved bagtobag, or is being initial loaded into bag
			// 	// babs.uiSys.svContainers[0].delWob(wob.id) // fasttodo
			// }

			if(wob.idzone) { // Place in zone (; is not a backpack item)
				zone = babs.ents.get(wob.idzone) as Zone

				const instanced = Wob.InstancedMeshes.get(wob.name)
				// Visibility for far objects?  todo better not to upload them?  Or maybe not.
				const wobFromData = zone.getFastWob(wob.x, wob.z) // Get real data so we can see real height of objects that have been converted to far trees
				const instancedFromData = Wob.InstancedMeshes.get(wobFromData.blueprint_id)
				// console.log('wobFromData', wobFromData.name, instancedFromData.name, instanced.name, wob.name)

				// Hide small objects that are far by moving them downward; no better way without an additional instancedmesh buffer!
				const wobIsFar = !zoneIdsAroundPlayerZone.includes(wob.idzone)
				const wobIsSmall = instancedFromData.boundingSize.y < Wob.FarwobShownHeightMinimum
				if(wobIsFar && wobIsSmall) {
					// Third idea...let it allocate the instance memory, whatever.  But skip loading them in afterward.
					// instanced.count = instanced.count -1
					// 	^ Nice!  Third idea doubled framerate
				}
				else 
				{ // Keep it
					yardCoord = YardCoord.Create(wob)
					const engCoordCentered = yardCoord.toEngineCoordCentered()
					engPositionVector = new Vector3(engCoordCentered.x, zone.engineHeightAt(yardCoord), engCoordCentered.z)

					// Instanced is a unique case of shiftiness.  We want to shift it during zoning instead of individually shifting all things on it.  But it's global, since we don't want separate instances per zone.  So things coming in need to be position shifted against the instance's own shiftiness.
		
					engPositionVector.add(new Vector3(-babs.worldSys.shiftiness.x, 0, -babs.worldSys.shiftiness.z))
					engPositionVector.setY(engPositionVector.y +(instanced.boundingSize.y /2) -instanced.sink +instanced.lift)

					let existingIindex = wob.zone.coordToInstanceIndex[wob.x +','+ wob.z]
					const indexDoesNotExist = existingIindex === null || existingIindex === undefined
					if(indexDoesNotExist) {
						existingIindex = instanced.count
						wob.zone.coordToInstanceIndex[wob.x +','+ wob.z] = instanced.count
						// console.log('Wob.ts setting '+wob.blueprint_id+' coordToInstanceIndex['+wob.x +','+ wob.z+'] = '+instanced.count+'(+-) ', instanced.count +1, instanced.count -1)
						instanced.count = instanced.count +1
					}

					matrix.setPosition(engPositionVector)
					instanced.setMatrixAt(existingIindex, matrix)

					// Perhaps best way to handle removing of instanced ids is to make an association from iindex->wobid.
					instanced.instanceIndexToWob.set(existingIindex, wob)
		
					instanced.instanceMatrix.needsUpdate = true

					if(shownames) {
						babs.uiSys.wobSaid(wob.name, YardCoord.Create(wob))
					}
				}

			}
			else {	// Send to bag
				const instanced = Wob.InstancedMeshes.get(wob.name)
				babs.uiSys.svContainers[0].addWob(wob, await instanced.renderedIcon())
			}
	
			if(wob.name === 'campfire' || wob.name === 'torch') {
				let scale, yup
				if(wob.name === 'campfire') {
					scale = 3
					yup = 2
				}
				else if(wob.name === 'torch') {
					scale = 1.1
					yup = 3.5
				}
	
				// Add new flame
				const flame = Flame.Create(wob, babs, scale, yup) // Is relatively slow (extra ~0.25 ms)
			}

		}


		// console.timeEnd('timing')


	}
	
}