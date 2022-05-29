import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide, Vector3, InstancedMesh, StreamDrawUsage, Matrix4, InstancedBufferAttribute, SphereGeometry, MeshBasicMaterial, Scene, PerspectiveCamera, DirectionalLight, WebGLRenderer, OrthographicCamera, BoxGeometry, SmoothShading, AmbientLight, Quaternion, WebGLRenderTarget, MeshLambertMaterial, BoxHelper } from "three"
import { SocketSys } from "../sys/SocketSys"
import { UiSys } from "../sys/UiSys"
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as Utils from '../Utils'
import { Appearance } from "../com/Appearance"

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { LoaderSys } from "../sys/LoaderSys"
import { log } from '../Utils'
import { Ent } from "./Ent"
import { Flame } from "../com/Flame"

export class Wob extends Ent {

	/** @private */
	constructor(id, babs) {
		super(id, babs)
	}

	idzone
	x
	z
	name
	color
	instancedIndex


	static HiddenScene = null
	static HiddenSceneRender(mesh) {
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

		const dataurl = Wob.HiddenScene.renderer.domElement.toDataURL()

		return new Promise((resolve, reject) => {
			let img = new Image()
			img.src = dataurl
			img.onload = () => {
				var canvas = document.createElement('canvas');
				canvas.width = UiSys.ICON_SIZE
				canvas.height = UiSys.ICON_SIZE
				var ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0);
				var imageData = ctx.getImageData(0, 0, UiSys.ICON_SIZE, UiSys.ICON_SIZE);
				let pixels = new Uint8Array(imageData.data.buffer);
				canvas.remove()
				img.remove()
		
				resolve([dataurl, pixels])
			}
			img.onerror = reject
		})



	}


	static pathObs = {}
	static async ArriveManyOld(arrivalWobs, babs, shownames) {

		// Load gltfs in parallel
		let gltfPromises = []
		for(let wob of arrivalWobs) {
			let instanced = Wob.WobInstMeshes.get(wob.name)
			if(instanced) continue // If it's already been loaded, skip loading

			const path = `/environment/gltf/obj-${wob.name}.gltf`
			if(Wob.pathObs[path]) continue // Already in the process of loading

			gltfPromises.push(babs.loaderSys.loadGltf(path))
			Wob.pathObs[path] = {
				wob: wob,
				gltfPromise: gltfPromises[gltfPromises.length -1]
			}
		}

		let readyNames = new Map
		let renders = []
		// Get mesh 
		for(let wob of arrivalWobs) {
			let instanced = Wob.WobInstMeshes.get(wob.name)
			if(instanced) continue // If it's already been loaded, skip generating

			if(readyNames.get(wob.name)) {
				continue // Already loaded
			}

			const path = `/environment/gltf/obj-${wob.name}.gltf`
			const result = Wob.pathObs[path]

			let preloadedOb
			try {
				preloadedOb = await result.gltfPromise
			}
			catch(e) {
				preloadedOb = undefined
			}


			if(preloadedOb && !preloadedOb.scene) {
				console.warn('Arrival wob has no scene: ', wob.name)
			}
			else if(preloadedOb && preloadedOb.scene.children.length == 0) {
				console.warn('Arrival wob has no children in scene: ', wob.name)
			}

			// Get mesh
			let mesh
			if(preloadedOb && preloadedOb.scene) { 
				if(preloadedOb.scene.children.length > 1) {
					console.warn(`Loaded object with more than one child.`, wob.name)
				}

				const childIndex = 0 // stub
				mesh = preloadedOb.scene.children[childIndex]
			}
			else {// Object doesn't exist.  Make a sphere
				const geometry = new SphereGeometry(1, 12, 12)
				const material = new MeshLambertMaterial({ color: 0xcccc00 })
				mesh = new Mesh(geometry, material)
				// console.warn('Arrival wob has no scene: ', wob.name)
			}

			// and generate icon
			const render = Wob.HiddenSceneRender(mesh)
			renders.push(render)
			readyNames.set(wob.name, {
				wob,
				mesh,
				render,
			})
		}

		// Run arrivals
		let arrivalPromises = []
		for(let wob of arrivalWobs) {
			// let instanced = Wob.WobInstMeshes.get(wob.name)
			// if(instanced) continue // If it's already been loaded, skip generating

			const ready = readyNames.get(wob.name)

			let preloaded = null
			if(ready) { // If there's a render.  If not, it's probably the second+ time ArriveMany was run, and the render happened in a previous iteration!
				const [icon, pixels] = await ready.render
				preloaded = {
					mesh: ready.mesh,
					icon,
					pixels,
				}
			}
			arrivalPromises.push(Wob._Arrive(wob, babs, shownames, preloaded))

		}

		return Promise.all(arrivalPromises)

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

		const filenames = [...needNames.keys()]
		if(filenames.length) {
			log('needNames', JSON.stringify(filenames))
			// const massFiles = fetch(`${babs.urlFiles}/mass`, {
			// 	method: 'POST',
			// 	body:  JSON.stringify(filenames),
			// 	headers: { 'Content-Type': 'application/json' }
			// })
		}


		let arrivalPromises = arrivalWobs.map(wob => Wob._Arrive(wob, babs, shownames))
		return arrivalPromises
	}
	
	static WobInstMeshes = new Map()
	static async _Arrive(arrivalWob, babs, shownames) {
		const wobPrevious = babs.ents.get(arrivalWob.id)

		// if(arrivalWob.name == 'hot spring') log('ARRIVE!!!!!!!', arrivalWob, wobPrevious, wobPrevious?.id, wobPrevious?.instancedIndex)

		let wob = wobPrevious || new Wob(arrivalWob.id, babs)
		wob = {...wob, ...arrivalWob} // Add and overwrite with new arrival data
		// log('........wob', arrivalWob.instancedIndex, wobPrevious, wobPrevious?.id, wobPrevious?.instancedIndex, wob.instancedIndex)
		// Note that wobPrevious might not have all its values (like instancedIndex) set yet, because that is being awaited.
		// So ....uhh I guess set that later on? Comment 1287y19y1

		babs.ents.set(arrivalWob.id, wob) // Ouch, remember that above is not mutating

		if(wob.idzone && (wobPrevious && !wobPrevious.idzone)) { // It's been moved from container into zone // what: (or...is being loaded into zone twice!)
			babs.uiSys.svContainers[0].delWob(wob.id)
		}
		else if(wob.idzone === null && wobPrevious && wobPrevious.idzone === null) { // It's been moved bagtobag
			babs.uiSys.svContainers[0].delWob(wob.id)
		}

		// if(wob.name == 'hot spring') log('----', 'arrive:', wob.name)

		// Load gltf
		// Assumes no object animation!
		let instanced = Wob.WobInstMeshes.get(wob.name)
		const isPromise = typeof instanced?.then === 'function'
		if(isPromise) { 
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
			const path = `/environment/gltf/obj-${wob.name}.gltf`

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

				instanced = new InstancedMesh(mesh.geometry, mesh.material, countMax)
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

				// Also add renderedIcon for later
				const stored = Utils.storageGet(wob.id)
				if(stored){
					instanced.renderedIcon = stored.icon
					instanced.renderedIconPixels = stored.pixels
				}
				else {
					const [icon, pixels] = await Wob.HiddenSceneRender(mesh)
					instanced.renderedIcon = icon
					instanced.renderedIconPixels = pixels
					const expireInMinutes = 60
					Utils.storageSet(wob.id, {icon, pixels}, mins *60 *1000)
				}

				Wob.WobInstMeshes.set(wob.name, instanced)
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

			const newInstance = new InstancedMesh(instanced.geometry, instanced.material, instanced.countMax *2) // Up to one for each grid space; ignores stacking, todo optimize more?
			newInstance.count = currentCount
			newInstance.countMax = instanced.countMax *2
			newInstance.name = wob.name
			newInstance.instanceMatrix.setUsage(StreamDrawUsage)
			for(let i=0; i<instanced.count; i++) {
				let transferMatrix = new Matrix4()
				instanced.getMatrixAt(i, transferMatrix)
				newInstance.setMatrixAt(i, transferMatrix)
			}
			newInstance.renderedIcon = instanced.renderedIcon
			newInstance.renderedIconPixels = instanced.renderedIconPixels
			newInstance.castShadow = instanced.castShadow
			newInstance.receiveShadow = instanced.receiveShadow

			newInstance.wobIdsByIndex = instanced.wobIdsByIndex
			
			instanced.dispose()
			babs.scene.remove(instanced)
			instanced = newInstance

			Wob.WobInstMeshes.set(wob.name, newInstance)
			babs.scene.add(newInstance)


			
		}

		// Now, if it's in zone (idzone), put it there.  Otherwise it's contained, send to container
		if(wob.idzone) { // Place in zone
			// if(wob.name == 'hot spring') log('finally-place', wob.name, instanced)
			let position = babs.worldSys.vRayGroundHeight(wob.x, wob.z)

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
			position.setY(position.y +(size.y /2) -sink +lift)

			// Yeah so per comment near top, wobPrevious.instancedIndex needs to be re-applied here because prior to the instanced await, it wasn't set on the first instance creation wob. // Comment 1287y19y1
			wob.instancedIndex = wobPrevious?.instancedIndex
			if(wob.instancedIndex === null || wob.instancedIndex === undefined) { // Doesn't already have an index, so add a new one
				wob.instancedIndex = instanced.count
				// if(wob.name == 'hot spring') log('COUNTBEF', instanced.count)
				instanced.count += 1
				// if(wob.name == 'hot spring') log('COUNT++', instanced.count)
			}
			instanced.setMatrixAt(wob.instancedIndex, new Matrix4().setPosition(position))
			instanced.instanceMatrix.needsUpdate = true

			if(!instanced.wobIdsByIndex) {
				instanced.wobIdsByIndex = []
			}
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
				babs.uiSys.wobSaid(wob.name, position)
			}

		}
		else {	// Send to bag
			babs.uiSys.svContainers[0].addWob(wob, instanced.renderedIcon)

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


	static GetPositionFromIndex(instanced, index) {
		const matrix = new Matrix4()
		instanced.getMatrixAt(index, matrix)
		const quat = new Quaternion()
		const position = new Vector3()
		quat.setFromRotationMatrix(matrix)
		position.setFromMatrixPosition(matrix)
		return position
	}


	
}


