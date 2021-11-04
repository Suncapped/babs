import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide } from "three"
import { SocketSys } from "../sys/SocketSys"
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as Utils from '../Utils'
import { Appearance } from "../com/Appearance"

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { LoaderSys } from "../sys/LoaderSys"
import { log } from './../Utils'

export class Gob {

    mesh

    static async Create(path, babs, childIndex = 0) {
        let gob = new Gob

		const fbxLoader = path.endsWith('.fbx')
		let group
		if(fbxLoader) {
			group = await babs.loaderSys.loadFbx(path)
		}
		else {
			group = (await babs.loaderSys.loadGltf(path)).scene
		}

		if(group.children.length > 1) {
			log.warn(`Loaded object with more than one child.  Using children[${childIndex}]`, group)
		}

		log.info(`Gob.Create ${fbxLoader ? 'FBX' : 'GLTF'} group`, group.children[0].material)
		gob.mesh = group.children[childIndex]
		
		// const material = new MeshPhongMaterial( { color: 0xF5F5F5 } )
		// const object = new Mesh( geometry, material )
		// if(Array.isArray(gob.mesh.material)) { // Fire
			// gob.mesh.material[2].side = DoubleSide
			// gob.mesh.material[2].color = new Color(0xFA942D).convertSRGBToLinear() // albedo?  moderates .map?
			// gob.mesh.material[2].emissive = new Color(102, 0, 0).convertSRGBToLinear() //  orange
		// }

		babs.scene.add( gob.mesh )

        return gob
    }
}


