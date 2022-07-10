import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide, Vector3, InstancedMesh, StreamDrawUsage, Matrix4, InstancedBufferAttribute, SphereGeometry, MeshBasicMaterial, Scene, PerspectiveCamera, DirectionalLight, WebGLRenderer, OrthographicCamera, BoxGeometry, SmoothShading, AmbientLight, Quaternion, WebGLRenderTarget, MeshLambertMaterial, BoxHelper } from 'three'
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

type IconData = {image :string, pixels :Uint8Array}

export class FeInstancedMesh extends InstancedMesh {
	private constructor(...args: ConstructorParameters<typeof InstancedMesh>) { super(...args) }
	static Create(babs :Babs, ...args: ConstructorParameters<typeof InstancedMesh>) {
		return new FeInstancedMesh(...args).init(babs)
	}

	babs :Babs
	wobIdsByIndex :number[] = []
	renderedIcon :() => Promise<IconData>|IconData
	countMax :number
	boundingSize = new Vector3()
	lift = 0
	sink = 0

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
		const engWorldCoord = position.add(this.babs.worldSys.shiftiness)
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
			// shading: SmoothShading

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

	static LoadedGltfs = new Map<string, any>()
	static InstancedMeshes = new Map<string, FeInstancedMesh>()
	static async ArriveMany(arrivalWobs :Array<FastWob>, babs, shownames) {
		// Load unique gltfs
		let path
		let loads = []
		let load
		const counts = new Map<string, number>()
		console.time('timing')
		for(const wob of arrivalWobs) {
			const currentCount = counts.get(wob.name) || 0
			counts.set(wob.name, currentCount +1)
			if(!Wob.LoadedGltfs.get(wob.name)){
				path = '/environment/gltf/'+wob.name+'.glb'

				load = babs.loaderSys.loadGltf(path, wob.name)

				Wob.LoadedGltfs.set(wob.name, true) // true for now, gets set right after this
				loads.push(load)
			}
		}
		console.timeLog('timing')
		// console.log('loads', loads)

		const finishedLoads = await Promise.all(loads)
		// console.log('finishedLoads', finishedLoads)
		console.timeLog('timing')
		// Use name passed in to loadGltf to set so we don't have to await later
		for(const load of finishedLoads) {
			Wob.LoadedGltfs.set(load.name, load)
		}
		// log('Wob.loadedGltfs', Wob.LoadedGltfs)

		console.timeLog('timing')
		// Create InstancedMeshes from loaded gltfs
		// const countMax = 10 // How large the instancdedmesh starts out
		const instancedExpansionAdd = 10 // How much larger the instancedmesh will get, eg +10
		for(const [wobName, gltf] of Wob.LoadedGltfs) {
			let instanced = Wob.InstancedMeshes.get(wobName)
			let newWobsCount = counts.get(wobName) || 0

			// What this does is, either creates an instancedmesh, or expands its size with some margin for adding a few wobs without having to resize it again
			if(!instanced) {
				let wobMesh
				try {
					wobMesh = gltf.scene.children[0]
				}
				catch(e) {
					log.info('error loading gltf', wobName)
				}

				if(!wobMesh) {
					wobMesh = Wob.SphereMesh // Object wasn't loaded.  Make a sphere
				}

				const countMax = newWobsCount +instancedExpansionAdd // margin for adding a few wobs without a resize
				instanced = FeInstancedMesh.Create(babs, wobMesh.geometry, wobMesh.material, countMax)
				instanced.count = 0
				instanced.countMax = countMax
				instanced.name = wobName
				// instanced.instanceMatrix.needsUpdate = true
				instanced.instanceMatrix.setUsage(StreamDrawUsage) 
				// ^ So I don't have to call .needsUpdate // https://www.khronos.org/opengl/wiki/Buffer_Object#Buffer_Object_Usage

				instanced.geometry.boundingBox?.getSize(instanced.boundingSize) // sets into vector // some don't have box, thus ?
				instanced.sink = Math.min(instanced.boundingSize.y *0.05, 0.2)  
				// ^ Sink by a percent but with a max for things like trees.
				instanced.lift = instanced.boundingSize.y < 0.01 ? 0.066 : 0
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

				Wob.InstancedMeshes.set(wobName, instanced)
				babs.scene.add(instanced)
			}
			else if(instanced.count +newWobsCount >= instanced.countMax -1) { // Needs more space (will do for backpack items too, but that's okay)
				log('instanced growing at', instanced.count, newWobsCount, instanced.countMax)

				const newMax = instanced.count +newWobsCount +instancedExpansionAdd // margin for adding a few wobs without a resize

				const newInstance = FeInstancedMesh.Create(babs, instanced.geometry, instanced.material, newMax)
				newInstance.count = instanced.count
				newInstance.countMax = newMax
				newInstance.name = wobName
				newInstance.instanceMatrix.setUsage(StreamDrawUsage) // todo optimize?
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
	
				newInstance.wobIdsByIndex = instanced.wobIdsByIndex
				
				newInstance.position.x = instanced.position.x
				newInstance.position.z = instanced.position.z

				babs.scene.remove(instanced)
				instanced.dispose()
				
				Wob.InstancedMeshes.set(wobName, newInstance)
				babs.scene.add(newInstance)
			}
			else {
				// Instance exists, doesn't need expansion based on incoming item count
				// instanced.count = instanced.count +count
			}

			
		}
		console.timeEnd('timing')
		log('latter Wob.InstancedMeshes', Wob.InstancedMeshes)

		// Now a properly sized instance exists.  So create wobs!
		let zone :Zone
		let yardCoord :YardCoord
		let engPositionVector :Vector3
		let matrix = new Matrix4()
		// This is for SETting instance items.  UNSET happens in Zone.removeWobGraphic.
		// Why separately?  Because this happens en-masse
		for(const fwob of arrivalWobs) {
			// const wobPrevious = wobZone.getWob(fwob.x, fwob.z)
			let wob = new Wob(babs, fwob.idzone, fwob.x, fwob.z, fwob.r, {blueprint_id: fwob.blueprint_id, locid: fwob.locid})
			
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
				yardCoord = YardCoord.Create(wob)
				engPositionVector = zone.rayHeightAt(yardCoord) // todo could precalc this per zone, or use elevations?
	
				// Instanced is a unique case of shiftiness.  We want to shift it during zoning instead of individually shifting all things on it.  But it's global, since we don't want separate instances per zone.  So things coming in need to be position shifted against the instance's own shiftiness.
	
				engPositionVector.add(new Vector3(-babs.worldSys.shiftiness.x, 0, -babs.worldSys.shiftiness.z))
	
				const instanced = Wob.InstancedMeshes.get(wob.name)
				// log('instanced got', instanced, wob.name, wob)
				instanced.geometry.center() 
				// ^ Fixes offset pivot point
				// https://stackoverflow.com/questions/28848863/threejs-how-to-rotate-around-objects-own-center-instead-of-world-center/28860849#28860849
	
				engPositionVector.setY(engPositionVector.y +(instanced.boundingSize.y /2) -instanced.sink +instanced.lift)

				let existingIindex = wob.zone.coordToInstanceIndex[wob.x +','+ wob.z]
				const indexDoesNotExist = !existingIindex && existingIindex !== 0
				if(indexDoesNotExist) {
					existingIindex = wob.zone.coordToInstanceIndex[wob.x +','+ wob.z] = instanced.count
					instanced.count = instanced.count +1
				}
	
				matrix.setPosition(engPositionVector)
				instanced.setMatrixAt(existingIindex, matrix)
	
				// instanced.wobIdsByIndex[wob.instancedIndex] = wob.id // fasttodo

				instanced.instanceMatrix.needsUpdate = true
	
				if(shownames) {
					babs.uiSys.wobSaid(wob.name, wob)
				}
	
			}
			else {	// Send to bag

				const instanced = Wob.InstancedMeshes.get(wob.name)
				babs.uiSys.svContainers[0].addWob(wob, await instanced.renderedIcon())
	
			}
	
	
			if(wob.name === 'firepit' || wob.name === 'torch') {
				let scale, yup
				if(wob.name === 'firepit') {
					scale = 3
					yup = 2
				}
				else if(wob.name === 'torch') {
					scale = 1.1
					yup = 3.5
				}
	
				// Remove any existing flame
				if(wob.attachments?.flame){
					babs.scene.remove(wob.attachments.flame.fire)
					delete wob.attachments.flame
				}
	
				// Add new flame
				const flame = Flame.Create(wob, babs, scale, yup)
				wob.attachments = wob.attachments || {} // For later deletion if wob is removed (moved etc)
				flame.then((res) => {
					wob.attachments.flame = res
				})
	
	
			}

		}


	}
	
}