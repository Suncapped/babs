import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide } from "three"
import { SocketSys } from "../sys/SocketSys"
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as Utils from '../Utils'
import { Appearance } from "../com/Appearance"

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { LoaderSys } from "../sys/LoaderSys"
import { log } from '../Utils'

export class Wob {

    mesh

	static mapPathObjectCache = new Map()
    static async Create(path, babs, childIndex = 0) {
        let wob = new Wob

		const fbxLoader = path.endsWith('.fbx')
		let group
		if(fbxLoader) {
			group = await babs.loaderSys.loadFbx(path)
		}
		else {
			// Caching
			// Assumes no object animation!
			const cached = Wob.mapPathObjectCache.get(path)
			let scene
			if(cached) {
				log.info('cached object', path)
				scene = cached.clone()
			}
			else {
				log.info('download object', path)
				let group = await babs.loaderSys.loadGltf(path)
				Wob.mapPathObjectCache.set(path, group.scene)
				scene = group.scene.clone()
			}

			group = (await babs.loaderSys.loadGltf(path)).scene
		}

		if(group.children.length > 1) {
			console.warn(`Loaded object with more than one child.  Using children[${childIndex}]`, group)
		}

		log.info(`Wob.Create ${fbxLoader ? 'FBX' : 'GLTF'} group`, group.children[0].material)
		wob.mesh = group.children[childIndex]
		
		// const material = new MeshPhongMaterial( { color: 0xF5F5F5 } )
		// const object = new Mesh( geometry, material )
		// if(Array.isArray(wob.mesh.material)) { // Fire
			// wob.mesh.material[2].side = DoubleSide
			// wob.mesh.material[2].color = new Color(0xFA942D).convertSRGBToLinear() // albedo?  moderates .map?
			// wob.mesh.material[2].emissive = new Color(102, 0, 0).convertSRGBToLinear() //  orange
		// }

		babs.scene.add( wob.mesh )

        return wob
    }
}


