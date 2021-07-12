import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide } from "three"
import { Socket } from "./Socket"
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import * as Utils from './Utils'
import { Appearance } from "./coms/Appearance"

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Gob {

    mesh

    static async Create(path, scene, socket) {
        let gob = new Gob
        const group = await Appearance.LoadFbx(socket, path)

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

	loadChar(path, socket) {
		const loader = new GLTFLoader()//.setPath( 'models/gltf/DamagedHelmet/glTF/' );

		return new Promise( (resolve, reject) => {
			console.log('loading', path)

			loader.load(`${socket.urlFiles}${path}`,// function ( gltf ) {
				(gltf) => { // onLoad callback
					// gltf.scene.traverse( function ( child ) {
					// 	if ( child.isMesh ) {
					// 		roughnessMipmapper.generateMipmaps( child.material );
					// 	}
					// } );
					// scene.add( gltf.scene );
					// // roughnessMipmapper.dispose();
					// render();

					// let mesh = gltf.scene.children[0]

					console.log('Make a scene!', gltf)

					// const material = new MeshPhongMaterial( {side: DoubleSide} )
					// mesh.material.color = new Color(55, 55, 55).convertSRGBToLinear()
					// mesh.material.emissive = new Color(0, 200, 0).convertSRGBToLinear()
					// mesh.material = material
					resolve(gltf)
				},
				(xhr) => { // onProgress callback
					console.log( (xhr.loaded / xhr.total * 100) + '% loaded' )
				},
				(err) => { // onError callback
					console.log( 'An error happened', err )
				}
			)

		}); 

	}
}


