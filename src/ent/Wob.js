import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide, Vector3, InstancedMesh, StreamDrawUsage, Matrix4, InstancedBufferAttribute, SphereGeometry, MeshBasicMaterial, Scene, PerspectiveCamera, DirectionalLight, WebGLRenderer, OrthographicCamera, BoxGeometry, SmoothShading, AmbientLight } from "three"
import { SocketSys } from "../sys/SocketSys"
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as Utils from '../Utils'
import { Appearance } from "../com/Appearance"

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { LoaderSys } from "../sys/LoaderSys"
import { log } from '../Utils'
import { Ent } from "./Ent"

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
	instanceIndex


	static HiddenScene = null
	static HiddenSceneRender(mesh) {
		if(!Wob.HiddenScene) {
			const container = document.getElementById('HiddenRenderFrame')

			// create your renderer
			const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
			// renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize( 100, 100 );

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
		log('now add',Wob.HiddenScene.scene.children)

		// if(mesh.name) {
			const localMesh = mesh.clone()
			localMesh.geometry = mesh.geometry.clone()
			Wob.HiddenScene.scene.add(localMesh)
			// localMesh.position.set(1,1,1)
			localMesh.position.set(0,-1.5,-0.5)
			localMesh.geometry.rotateX(-Math.PI /2)
			log('added', localMesh)

			Wob.HiddenScene.renderer.render(Wob.HiddenScene.scene, Wob.HiddenScene.camera) // Hmm what does it do? lol
			Wob.HiddenScene.renderer.domElement.toDataURL()
		// }

		return Wob.HiddenScene.renderer.domElement.toDataURL()
	}
	// static HiddenSceneRender(mesh, renderer) {
	// 	const scene = new Scene()
	   
	// 	const fov = 45
	// 	const aspect = 2  // the canvas default
	// 	const near = 0.1
	// 	const far = 5
	// 	const camera = new PerspectiveCamera(fov, aspect, near, far)
	// 	camera.position.z = 2
	// 	camera.position.set(0, 1, 2)
	// 	camera.lookAt(0, 0, 0)
	   
	// 	const color = 0xFFFFFF
	// 	const intensity = 1
	// 	const light = new DirectionalLight(color, intensity)
	// 	light.position.set(-1, 2, 4)
	// 	scene.add(light)

	// 	scene.add(mesh)

	// 	renderer.render(scene, camera) // Hmm what does it do? lol
	//   }
	   
	
	static WobInstMeshes = new Map()
	static async Arrive(arrivalWob, babs, shownames) {
		const wob = new Wob(arrivalWob.id, babs)
		wob.idzone = arrivalWob.idzone
		wob.x = arrivalWob.x
		wob.z = arrivalWob.z
		wob.name = arrivalWob.name
		wob.color = arrivalWob.color

		// Load gltf
		// Assumes no object animation!
		const path = `/environment/gltf/obj-${wob.name}.gltf`
		let instanced = Wob.WobInstMeshes.get(wob.name)

		const childIndex = 0 // stub
		const countMax = 3
		let currentCount = 0
		if(!instanced) {
			log.info('download, load, instantiate wobject', path)

			let mesh
			try {
				const ob = await babs.loaderSys.loadGltf(path)
				log('LOADED', path)
				if(ob.scene.children.length > 1) {
					console.warn(`Loaded object with more than one child.`, scene)
				}
				mesh = ob.scene.children[childIndex]
			}
			catch(e) { // Object doesn't exist.  Make a sphere
				const geometry = new SphereGeometry(1, 12, 12)
				const material = new MeshBasicMaterial({ color: 0xffff00 })
				mesh = new Mesh(geometry, material)
			}

			mesh.geometry.rotateX( + Math.PI / 2 ) // Make the plane horizontal

			instanced = new InstancedMesh(mesh.geometry, mesh.material, countMax) // Up to one for each grid space; ignores stacking, todo optimize more?
			instanced.countMax = countMax
			instanced.count = currentCount
			instanced.name = wob.name
			instanced.instanceMatrix.setUsage(StreamDrawUsage) // So I don't have to call .needsUpdate // https://www.khronos.org/opengl/wiki/Buffer_Object#Buffer_Object_Usage

			// Also add renderedIcon for later
			instanced.renderedIcon = Wob.HiddenSceneRender(mesh)


			Wob.WobInstMeshes.set(wob.name, instanced)
			babs.scene.add(instanced)
			
		}
		else if(instanced.count >= instanced.countMax -1) { // Overflowing instance limit, need a larger one
			log.info('enlarging IM '+instanced.name, instanced.count)
			currentCount = instanced.count
			babs.scene.remove(instanced)
			instanced.dispose()

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
			
			instanced.dispose()
			instanced = newInstance

			Wob.WobInstMeshes.set(wob.name, instanced)
			babs.scene.add(instanced)
			
		}

		// Now, if it's in zone (idzone), put it there.  Otherwise it's contained, send to container
		if(wob.idzone) { // Place in zone
			// log('positioning index')
			let position = babs.worldSys.vRayGroundHeight(wob.x, wob.z)
			position.setY(position.y +0.8)
			wob.instanceIndex = instanced.count
			instanced.setMatrixAt(wob.instanceIndex, new Matrix4().setPosition(position))
			instanced.count += 1
			instanced.instanceMatrix.needsUpdate = true

			// log('setting color')
			const mudColors = []
			const color = new Color(1,1,1) // Set to not modify color; used later for highlight by pickedObject in InputSys
			for(let i=0; i<instanced.count; i++) {
				mudColors.push(color.r, color.g, color.b)
			}
			// log('instanced attr', mudColors.length, mudColors)
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

		return wob
		
	}
	
	// mesh
	// static WobInstMeshes = new Map()
    // static async Load(path, babs, childIndex = 0) {
    //     let wob = new Wob
	// 	const fbxLoader = path.endsWith('.fbx')
	// 	let group
	// 	if(fbxLoader) {
	// 		group = await babs.loaderSys.loadFbx(path)
	// 	}
	// 	else {
	// 		// Caching
	// 		// Assumes no object animation!
	// 		const cached = Wob.WobInstMeshes.get(path)
	// 		let scene
	// 		if(cached) {
	// 			log.info('cached object', path)
	// 			scene = cached.clone()
	// 		}
	// 		else {
	// 			log.info('download object', path)
	// 			let group = await babs.loaderSys.loadGltf(path)
	// 			Wob.WobInstMeshes.set(path, group.scene)
	// 			scene = group.scene.clone()
	// 		}

	// 		group = (await babs.loaderSys.loadGltf(path)).scene
	// 	}
	// 	if(group.children.length > 1) {
	// 		console.warn(`Loaded object with more than one child.  Using children[${childIndex}]`, group)
	// 	}

	// 	log.info(`Wob.New ${fbxLoader ? 'FBX' : 'GLTF'} group`, group.children[0].material)
	// 	wob.mesh = group.children[childIndex]
		
	// 	// const material = new MeshPhongMaterial( { color: 0xF5F5F5 } )
	// 	// const object = new Mesh( geometry, material )
	// 	// if(Array.isArray(wob.mesh.material)) { // Fire
	// 		// wob.mesh.material[2].side = DoubleSide
	// 		// wob.mesh.material[2].color = new Color(0xFA942D).convertSRGBToLinear() // albedo?  moderates .map?
	// 		// wob.mesh.material[2].emissive = new Color(102, 0, 0).convertSRGBToLinear() //  orange
	// 	// }
	// 	babs.scene.add( wob.mesh )
    //     return wob
    // }
}


