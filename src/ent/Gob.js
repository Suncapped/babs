import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide } from "three"
import { SocketSys } from "../sys/SocketSys"
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as Utils from '../Utils'
import { Appearance } from "../com/Appearance"

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoaderSys } from "../sys/LoaderSys"

export class Gob {

    mesh

    static async Create(path, scene) {
        let gob = new Gob
        const group = await LoaderSys.LoadFbx(path)

        // const material = new MeshPhongMaterial( { color: 0xF5F5F5 } )
        // const object = new Mesh( geometry, material )
        gob.mesh = group.children[0]
        console.log('gob.mesh',(group))

		if(Array.isArray(gob.mesh.material)) { // Fire
			gob.mesh.material[2].side = DoubleSide
			gob.mesh.material[2].color = new Color(0xFA942D) // albedo?  moderates .map?
			gob.mesh.material[2].emissive = new Color(102, 0, 0) //  orange
		}
		else { // Player
			gob.mesh.material.side = DoubleSide
			gob.mesh.material.color = new Color(55, 200, 55)
			gob.mesh.material.emissive = new Color(0, 100, 0)
		}


        scene.add( gob.mesh )
        if(group.children.length > 1) {
            console.error("Loading FBX with more than one child!", group)
        }
        return gob
    }
}


