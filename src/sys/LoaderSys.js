import { sRGBEncoding, Vector2 } from "three"
import { Vector3 } from "three"
import { SocketSys } from "./SocketSys"
import { EventSys } from "./EventSys"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader"
import { TextureLoader } from "three"
import { MeshPhongMaterial } from "three"
import { AnimationMixer } from "three"
import { SkinnedMesh } from "three"


export class LoaderSys {

	static urlFiles

	static Start(urlFiles) {
		this.urlFiles = urlFiles
	}

	static LoadFbx(path) {
		const loader = new FBXLoader()
		return new Promise( (resolve, reject) => {
			loader.load(
				`${this.urlFiles}${path}`, // resource URL
				(group) => { // onLoad callback
					console.log('Loaded FBX:', path, group)
					resolve(group)
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


	static LoadTexture(path) {

		const texture = new TextureLoader().load(`${this.urlFiles}${path}`)
		texture.flipY = false // quirk for GLTFLoader separate texture loading!  (not for fbx!) // todo flipY if loading gltf
		texture.encoding = sRGBEncoding // This too, though the default seems right
		// texture.anisotropy = 16;
		return texture 

	}


	static async LoadGltf(path) {
		const loader = new GLTFLoader()//.setPath( 'models/gltf/DamagedHelmet/glTF/' );

		return new Promise( (resolve, reject) => {
			console.log('loading', path)

			loader.load(`${this.urlFiles}${path}`,// function ( gltf ) {
				(gltf) => { // onLoad callback
					console.log('Loaded GLTF:', gltf)

					// gltf.scene.traverse( function ( child ) {
					// 	if ( child.isMesh ) {
					// 		roughnessMipmapper.generateMipmaps( child.material );
					// 	}
					// } );
					// scene.add( gltf.scene );
					// // roughnessMipmapper.dispose();
					// render();

					// let mesh = gltf.scene.children[0]

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

	static async LoadCharacter(gender) {
		const texture = await LoaderSys.LoadTexture(`/char/${gender}/color-atlas-new2.png`)
		texture.flipY = true
		const material = new MeshPhongMaterial({
			map: texture,
			// bumpMap: texture,
			// bumpScale: bumpScale,
			// color: diffuseColor,
			specular: 0.16,
			// reflectivity: 0.5,
			shininess: 0.2,
			// envMap: alphaIndex % 2 === 0 ? null : reflectionCube
		})
		
		const fbx = await LoaderSys.LoadFbx(`/char/${gender}/female-rig-idle.fbx`) 

		const skinnedMesh = fbx.children.find(c => c instanceof SkinnedMesh)
		skinnedMesh.material = material

		fbx.scale.multiplyScalar(0.1)
		fbx.traverse(c => c.castShadow = true)

		return fbx
	}
	static async LoadAnim(gender, anim) {
		const fbx = await LoaderSys.LoadFbx(`/char/${gender}/${gender}-anim-${anim}.fbx`)
		return fbx
	}


}