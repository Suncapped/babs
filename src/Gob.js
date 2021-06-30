import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial } from "three"
import { Socket } from "./Socket"
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as Utils from './Utils'
import { Appearance } from "./Appearance"
export class Gob {

    mesh

    static async Create(path, scene, socket) {
        let gob = new Gob
        const group = await Appearance.LoadFbx(socket, path)

        // const material = new MeshPhongMaterial( { color: 0xF5F5F5 } )
        // const object = new Mesh( geometry, material )
        gob.mesh = group.children[0]
        console.log(gob.mesh)

        gob.mesh.material[2].side = DoubleSide
        // gob.mesh.material[2].color = new Color(0xFA942D) // albedo?  moderates .map?
        // gob.mesh.material[2].emissive = new Color(128, 0, 0) // orange
        gob.mesh.material[2].color = new Color(0xFA942D) // albedo?  moderates .map?
        gob.mesh.material[2].emissive = new Color(102, 0, 0) // 


        scene.add( gob.mesh )
        if(group.children.length > 1) {
            console.error("Loading FBX with more than one child!", group)
        }
        return gob
    }
}


