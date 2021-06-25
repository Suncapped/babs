import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial } from "three"
import { Socket } from "./Socket"
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as Utils from './Utils'
export class BabsObject {

    mesh

    async init(path, scene) {
        const group = await Utils.loadFbx(path)

        // const material = new MeshPhongMaterial( { color: 0xF5F5F5 } )
        // const object = new Mesh( geometry, material )
        this.mesh = group.children[0]
        console.log(this.mesh)

        this.mesh.material[2].side = DoubleSide
        // this.mesh.material[2].color = new Color(0xFA942D) // albedo?  moderates .map?
        // this.mesh.material[2].emissive = new Color(128, 0, 0) // orange
        this.mesh.material[2].color = new Color(0xFA942D) // albedo?  moderates .map?
        this.mesh.material[2].emissive = new Color(102, 0, 0) // 


        scene.add( this.mesh )
        if(group.children.length > 1) {
            console.error("Loading FBX with more than one child!", group)
        }
        return this
    }
}


