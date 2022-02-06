import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide, Vector3, InstancedMesh, StreamDrawUsage, Matrix4 } from "three"
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
	
	static wobInstMeshes = new Map()
	static async Arrive(arrival, babs) {
		const wob = new Wob(arrival.id, babs)
		wob.idzone = arrival.idzone
		wob.x = arrival.x
		wob.z = arrival.z
		wob.name = arrival.name
		wob.color = arrival.color

		// Load gltf
		// Assumes no object animation!
		const path = `/environment/gltf/obj-${wob.name}.gltf`
		let instanced = Wob.wobInstMeshes.get(wob.name)

		const childIndex = 0 // stub
		const countMax = 3
		let currentCount = 0
		if(!instanced) {
			log('object instance new, instantiate', path)
			log.info('download and load object', path)
			const ob = await babs.loaderSys.loadGltf(path)
			let scene = ob.scene
			if(scene.children.length > 1) {
				console.warn(`Loaded object with more than one child.`, scene)//  Using children[${childIndex}]`, group)
			}
			const mesh = scene.children[childIndex]

			instanced = new InstancedMesh(mesh.geometry, mesh.material, countMax) // Up to one for each grid space; ignores stacking, todo optimize more?
			instanced.countMax = countMax
			instanced.count = currentCount
			instanced.name = wob.name
			instanced.instanceMatrix.setUsage(StreamDrawUsage) // So I don't have to call .needsUpdate // https://www.khronos.org/opengl/wiki/Buffer_Object#Buffer_Object_Usage

			log('instance', instanced)

			Wob.wobInstMeshes.set(wob.name, instanced)
			babs.scene.add(instanced)
			
		}
		else if(instanced.count >= instanced.countMax -1) { // Overflowing instance limit, need a larger one
			log('enlarging', instanced.count)
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
			
			instanced.dispose()
			instanced = newInstance

			Wob.wobInstMeshes.set(wob.name, instanced)
			babs.scene.add(instanced)
			
		}

		log('positioning index')
		let position = babs.worldSys.vRayGroundHeight(wob.x, wob.z)
		wob.instanceIndex = instanced.count
		instanced.setMatrixAt(wob.instanceIndex, new Matrix4().setPosition(position))
		instanced.count += 1
		instanced.instanceMatrix.needsUpdate = true

		log('log wob', wob)
		babs.uiSys.wobSaid(wob.name, position)

		return wob



		// Mesh method
		// Load gltf // Assumes no object animation!
		// const path = `/environment/gltf/obj-${arrival.name}.gltf`
		// const cached = Wob.mapPathObjectCache.get(path)
		// let scene
		// const childIndex = 0 // stub
		// if(cached) {
		// 	log.info('cached object', path)
		// 	scene = cached.clone()
		// }
		// else {
		// 	log.info('download object', path)
		// 	const ob = await babs.loaderSys.loadGltf(path)
		// 	scene = ob.scene
		// 	if(scene.children.length > 1) {
		// 		console.warn(`Loaded object with more than one child.`, scene)//  Using children[${childIndex}]`, group)
		// 	}
		// 	Wob.mapPathObjectCache.set(path, scene)
		// 	scene = scene.clone()
		// }
		// wob.mesh = scene.children[childIndex]
		// babs.scene.add(wob.mesh)
		// wob.mesh.position.copy(babs.worldSys.vRayGroundHeight(arrival.x, arrival.z))


		
	}
	
	// mesh
	// static wobInstMeshes = new Map()
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
	// 		const cached = Wob.wobInstMeshes.get(path)
	// 		let scene
	// 		if(cached) {
	// 			log.info('cached object', path)
	// 			scene = cached.clone()
	// 		}
	// 		else {
	// 			log.info('download object', path)
	// 			let group = await babs.loaderSys.loadGltf(path)
	// 			Wob.wobInstMeshes.set(path, group.scene)
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


