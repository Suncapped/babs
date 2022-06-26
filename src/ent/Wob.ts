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

type IconData = {image :string, pixels :Uint8Array}

export class FeInstancedMesh extends InstancedMesh {
	private constructor(...args: ConstructorParameters<typeof InstancedMesh>) { super(...args) }
	static Create(babs :Babs, ...args: ConstructorParameters<typeof InstancedMesh>) {
		return new FeInstancedMesh(...args).init(babs)
	}

	babs :Babs
	wobIdsByIndex :number[] = []
	renderedIcon :Promise<IconData>|IconData
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

export class Wob extends Ent {
	private constructor(id, babs) {
		super(id, babs)
	}

	x
	z
	name
	color
	instancedIndex

	idzone

	get zone() {
		return this.babs.ents.get(this.idzone) as Zone
	}


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

	static ArriveMany(arrivalWobs, babs, shownames) {

		const prefix = 'environment/'

		// We can do a mass file request so server doesn't have to handle so many requests.
		let needNames = new Map()
		arrivalWobs.forEach(wob => {
			// if(wob.name == 'hot spring') log('needlog', wob.name)
			if(!Wob.WobInstMeshes.get(wob.name)) { // Not loaded, not promised
				const path = `${wob.name}`
				needNames.set(path, null)
			}
		}) 

		// const filenames = [...needNames.keys()]
		// if(filenames.length) {
		// 	log('needNames', JSON.stringify(filenames))
		// }

		let arrivalPromises = arrivalWobs.map(wob => Wob._Arrive(wob, babs, shownames))
		return arrivalPromises
	}
	
	static WobInstMeshes = new Map<string, Promise<FeInstancedMesh> | FeInstancedMesh>()
	static async _Arrive(arrivalWob, babs :Babs, shownames) {
		const wobPrevious = babs.ents.get(arrivalWob.id) as Wob

		let wob = new Wob(arrivalWob.id, babs)
		wob = Object.assign(wob, arrivalWob) // Add and overwrite with new arrival data
		// Note that wobPrevious might not have all its values (like instancedIndex) set yet, because that is being awaited.
		// So ....uhh I guess set that later on? Comment 1287y19y1
		babs.ents.set(arrivalWob.id, wob)

		if(wob.idzone && (wobPrevious && !wobPrevious.idzone)) { 
			// It's been moved from container into zone
			babs.uiSys.svContainers[0].delWob(wob.id)
		}
		else if(wob.idzone === null && wobPrevious && wobPrevious.idzone === null) { 
			// It's been moved bagtobag, or is being initial loaded into bag
			babs.uiSys.svContainers[0].delWob(wob.id)
		}

		// if(wob.name == 'hot spring') log('----', 'arrive:', wob.name)

		// Load gltf
		// Assumes no object animation!
		let instanced = Wob.WobInstMeshes.get(wob.name)
		if(instanced instanceof Promise) { 
			// Wow okay.  The problem is, it was setting as the *returned* instance.  
			// But we want the one modified by instance expansion below, so re-get from Map
			// if(wob.name == 'hot spring') log('was promise', wob.name)
			await instanced
			instanced = Wob.WobInstMeshes.get(wob.name)
			// if(wob.name == 'hot spring') log('after promise', instanced)
			// Huge side effect here: Only AFTER this point do other wobs have updated props like instancedIndex // Comment 1287y19y1
		}
		// if(wob.name == 'hot spring') log('instanced', wob.name, instanced)

		const countMax = 200
		let currentCount = 0
		if(!instanced) {
			// if(wob.name == 'hot spring') log('not instanced', wob.name)
			const path = `/environment/gltf/obj-${wob.name}.glb`

			const loadstuff = async () => {

				let mesh
				try {
					const gltf = await babs.loaderSys.loadGltf(path)
					// if(wob.name == 'hot spring') log('downloading wob', wob.name)
					if(gltf.scene) { 
						if(gltf.scene.children.length == 0) {
							console.warn('Arrival wob has no children in scene: ', wob.name)
						}
						else {
							mesh = gltf.scene.children[0]
							if(gltf.scene.children.length > 1) {
								console.warn(`Loaded object with more than one child.`, wob.name)
							}
						}
					}
					else {
						console.warn('Arrival wob has no scene: ', wob.name)
					}
					
				}
				catch(e) {
				}

				if(!mesh) { 
					// Object wasn't loaded.  Make a sphere
					const geometry = new SphereGeometry(1, 12, 12)
					const material = new MeshLambertMaterial({ color: 0xcccc00 })
					mesh = new Mesh(geometry, material)
				}

				instanced = FeInstancedMesh.Create(babs, mesh.geometry, mesh.material, countMax)
				// ^ Up to one for each grid space; ignores stacking, todo optimize more?
				instanced.countMax = countMax
				instanced.count = currentCount
				instanced.name = wob.name
				instanced.instanceMatrix.setUsage(StreamDrawUsage) 
				// ^ So I don't have to call .needsUpdate // https://www.khronos.org/opengl/wiki/Buffer_Object#Buffer_Object_Usage
				// instanced.instanceMatrix.needsUpdate = true

				let size = new Vector3()
				instanced.geometry?.boundingBox?.getSize(size)

				instanced.castShadow = size.y >= 1
				instanced.receiveShadow = true


				instanced.renderedIcon = async () => {
					const {image, pixels} = await Wob.HiddenSceneRender(mesh)
					instanced.renderedIcon = () => { // Overwrite self?!  lol amazing
						return {image, pixels}
					}
					return instanced.renderedIcon()
				}

				Wob.WobInstMeshes.set(wob.name, instanced)

				instanced.position.setX(babs.worldSys.shiftiness.x)
				instanced.position.setZ(babs.worldSys.shiftiness.z)

				babs.scene.add(instanced)

				return instanced
			}


			const prom = loadstuff()
			Wob.WobInstMeshes.set(wob.name, prom)
			await prom // Await here too so that this first-loaded object gets loaded below (needs this loaded instance)


		}
		else if(wob.idzone && instanced.count >= instanced.countMax -1) { // Is an actual instance, and needs more space
			// Overflowing instance limit, need a larger one
			// if(wob.name == 'hot spring') log('enlarging IM ', wob.name, currentCount, instanced.count, instanced.countMax)
			currentCount = instanced.count

			const newInstance = FeInstancedMesh.Create(babs, instanced.geometry, instanced.material, instanced.countMax *2) // Up to one for each grid space; ignores stacking, todo optimize more?
			newInstance.count = currentCount
			newInstance.countMax = instanced.countMax *2
			newInstance.name = wob.name
			newInstance.instanceMatrix.setUsage(StreamDrawUsage)
			for(let i=0; i<instanced.count; i++) {
				let transferMatrix = new Matrix4()
				instanced.getMatrixAt(i, transferMatrix)
				newInstance.setMatrixAt(i, transferMatrix)
			}

			// save rendered icons (they may have been added JIT)
			newInstance.renderedIcon = instanced.renderedIcon

			newInstance.castShadow = instanced.castShadow
			newInstance.receiveShadow = instanced.receiveShadow

			newInstance.wobIdsByIndex = instanced.wobIdsByIndex
			newInstance.position.x = instanced.position.x
			newInstance.position.z = instanced.position.z
			
			babs.scene.remove(instanced)
			instanced.dispose()
			instanced = newInstance

			Wob.WobInstMeshes.set(wob.name, newInstance)
			babs.scene.add(newInstance)
		}

		// Now, if it's in zone (idzone), put it there.  Otherwise it's contained, send to container
		if(wob.idzone) { // Place in zone
			const zone = babs.ents.get(wob.idzone) as Zone
			log('--\n--\nnewwob with wob: ', wob.name, wob, zone)
			const yardCoord = YardCoord.Create(wob)
			log('newwob yardCoord', yardCoord)
			const eCoord = yardCoord.toEngineCoord()
			log('newwob eCoord', eCoord)
			const heighted = zone.calcHeightAt(yardCoord)
			log('newwob heighted', heighted)
			let engPositionVector = heighted
			log('newwob vector', engPositionVector)

			// Instanced is a unique case of shiftiness.  We want to shift it during zoning instead of individually shifting all things on it.  But it's global, since we don't want separate instances per zone.  So things coming in need to be position shifted against the instance's own shiftiness.

			log('SHIFTINESS', babs.worldSys.shiftiness.x)
			engPositionVector.add(new Vector3(-babs.worldSys.shiftiness.x, 0, -babs.worldSys.shiftiness.z))


			//

			instanced.geometry?.center() 
			// ^ Fixes offset pivot point
			// https://stackoverflow.com/questions/28848863/threejs-how-to-rotate-around-objects-own-center-instead-of-world-center/28860849#28860849

			let size = new Vector3()
			instanced.geometry?.boundingBox?.getSize(size)

			// console.log('sizey', size.y, wob.name)
			const sink = Math.min(size.y *0.05, 0.2)  
			// ^ Sink by a percent but with a max for things like trees.
			const lift = size.y < 0.01 ? 0.066 : 0
			// ^ For very small items (like flat 2d cobblestone tiles), let's lift them a bit
			engPositionVector.setY(engPositionVector.y +(size.y /2) -sink +lift)

			// Yeah so per comment near top, wobPrevious.instancedIndex needs to be re-applied here because prior to the instanced await, it wasn't set on the first instance creation wob. // Comment 1287y19y1
			wob.instancedIndex = wobPrevious?.instancedIndex
			if(wob.instancedIndex === null || wob.instancedIndex === undefined) { // Doesn't already have an index, so add a new one
				wob.instancedIndex = instanced.count
				// if(wob.name == 'hot spring') log('COUNTBEF', instanced.count)
				instanced.count += 1
				// if(wob.name == 'hot spring') log('COUNT++', instanced.count)
			}
			instanced.setMatrixAt(wob.instancedIndex, new Matrix4().setPosition(engPositionVector))
			instanced.instanceMatrix.needsUpdate = true

			instanced.wobIdsByIndex[wob.instancedIndex] = wob.id

			const mudColors = []
			const color = new Color(1,1,1) // Set to not modify color; used later for highlight by pickedObject in InputSys
			for(let i=0; i<instanced.count; i++) {
				mudColors.push(color.r, color.g, color.b)
			}
			const bufferAttr = new InstancedBufferAttribute(new Float32Array(mudColors), 3)
			bufferAttr.needsUpdate = true
			instanced.instanceColor = bufferAttr

			if(shownames) {
				babs.uiSys.wobSaid(wob.name, wob)
			}

		}
		else {	// Send to bag
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

		return wob
		
	}
	
}


