import { sRGBEncoding, Vector2 } from "three"
import { Vector3 } from "three"
import { SocketSys } from "./SocketSys"
import { EventSys } from "./EventSys"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader"
import { TextureLoader } from "three"
import { MeshPhongMaterial } from "three"
import { AnimationMixer } from "three"
import { SkinnedMesh } from "three"
import { log, sleep } from './../Utils'
import { Matrix4 } from "three"
import { Group } from "three"
import { Bone } from "three"
import { Vector4 } from "three"
import { Matrix3 } from "three"

export class LoaderSys {

	urlFiles

	constructor(urlFiles) {
		this.urlFiles = urlFiles
	}

	async loadFbx(path) {

		return await new Promise( (resolve, reject) => {
			const loader = new FBXLoader()

			loader.load(
				`${this.urlFiles}${path}`, // resource URL
				(group) => { // onLoad callback
					log.info('Loaded FBX:', path, group)
					resolve(group)
				},
				(xhr) => { // onProgress callback
					log.info( (xhr.loaded / xhr.total * 100) + '% loaded' )
				},
				(err) => { // onError callback
					log.err( 'An error happened', err )
				}
			)
		}); 
	}


	async loadTexture(path) {
		const texture = await new TextureLoader().loadAsync(`${this.urlFiles}${path}`)
		texture.flipY = false // quirk for GLTFLoader separate texture loading!  (not for fbx!) // todo flipY if loading gltf
		texture.encoding = sRGBEncoding // This too, though the default seems right
		// Ah, because of this https://discourse.threejs.org/t/acesfilmictonemapping-leading-to-low-contrast-textures/15484/5
		// texture.anisotropy = 16
		return texture 

	}


	async loadGltf(path) {
		const loader = new GLTFLoader()//.setPath( 'models/gltf/DamagedHelmet/glTF/' )

		return new Promise( (resolve, reject) => {
			log.info('loading', path)

			loader.load(`${this.urlFiles}${path}`,// function ( gltf ) {
				(gltf) => { // onLoad callback
					log.info('Loaded GLTF:', gltf)

					// gltf.scene.traverse( function ( child ) {
					// 	if ( child.isMesh ) {
					// 		roughnessMipmapper.generateMipmaps( child.material )
					// 	}
					// } )
					// scene.add( gltf.scene )
					// // roughnessMipmapper.dispose()
					// render()

					// let mesh = gltf.scene.children[0]

					resolve(gltf)
				},
				(xhr) => { // onProgress callback
					log.info( (xhr.loaded / xhr.total * 100) + '% loaded' )
				},
				(err) => { // onError callback
					log.info( 'An error happened', err )
				}
			)

		}); 

	}

	// static cachedChar = new Map
	async loadRig(gender) {
		// if(this.cachedChar?.get(gender)) {  // Doesn't work due to ref
		// 	log('character is cached', gender)
		// 	return this.cachedChar?.get(gender)
		// }

		const texture = await this.loadTexture(`/char/${gender}/color-atlas-new2.png`)
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
		const hsl = material.color.getHSL({h:0,s:0,l:0})
		material.color.setHSL(hsl.h, hsl.s, 1)
		
		// const group = await LoaderSys.loadFbx(`/char/${gender}/female-rig-idle.fbx`) 
		const group = await this.loadFbx(`/char/${gender}/female-rig-unitstest.fbx`) 

		log.info('loadRig group', group)

		const skinnedMesh = group.children.find(c => c instanceof SkinnedMesh)
		skinnedMesh.material = material

		// // fbx.scale.multiplyScalar(0.1)
		// // Permanently scale matrix (rather than Object3d.scale, which interferes with cross products etc)
		// // const scalevector = new Vector3(1, 1, 1).multiplyScalar(0.1)
		// const newMatrixScaled = new Matrix4()
		// newMatrixScaled.copy(fbx.matrix.clone())
		// log('fbx.matrix, newMatrixScaled pre', fbx.matrix.clone(), newMatrixScaled.clone())
		// newMatrixScaled.makeScale(0.1, 0.1, 0.1)
		// log('then', newMatrixScaled)
		// newMatrixScaled.multiply(fbx.matrix)
		// log('annnnnd after thing', newMatrixScaled)
		// fbx.matrix.copy(newMatrixScaled.clone())
		// // fbx.updateMatrix( true )
		// // fbx.updateMatrixWorld( true )
		// // fbx.matrixWorldNeedsUpdate = true
		// log('scaled', fbx.matrix.clone())
		// Okay let's try this https://stackoverflow.com/questions/27022160/three-js-can-i-apply-position-rotation-and-scale-to-the-geometry/27023024#27023024

		log.info('fbx group', group)
		log.info('skinnedMesh', skinnedMesh)

		const boneRoot = group.children.find(c => c instanceof Group).children.find(c => c instanceof Bone)


		// skinnedMesh.scale.set(1,1,1)

		// group.scale.set(0.1, 0.1, 0.1)
		// group.updateMatrix()

		// skinnedMesh.updateMatrix()
		// skinnedMesh.geometry.applyMatrix(group.matrix)
		// // skinnedMesh.updateMatrix()

		// group.applyMatrix(group.matrix)
		// group.scale.set(1,1,1)
		// group.updateMatrix()

		// boneRoot.applyMatrix(group.matrix)
		
		// skinnedMesh.scale.multiplyScalar(0.1)
		// skinnedMesh.updateMatrix()
		// skinnedMesh.geometry.applyMatrix(skinnedMesh.matrix)
		// skinnedMesh.scale.set(1,1,1)
		// skinnedMesh.updateMatrix()

		// myGroup.applyMatrix( new THREE.Matrix4().makeTranslation(x, y, z) )

		// const scaleContainer = new Group()
		// scaleContainer.add(group)
		// scaleContainer.scale.set(0.1, 0.1, 0.1)



		
		
		
		/////////////

		  
		  


		  // bakeSkeleton(skinnedMesh)
		  
		//   group.scale.set(0.1, 0.1, 0.1)
		//   group.updateMatrix()
		//   skinnedMesh.geometry.applyMatrix(group.matrix.clone())
		//   group.scale.set(1,1,1)
		//   group.updateMatrix()
		//   skinnedMesh.skeleton.bones.forEach(bone => bone.scale.set(0.1,0.1,0.1))
		  
		// skinnedMesh.scale.set(1,1,1)

		  ////////////
		
		// Well, couldn't figure that one out :p  Better to scale it before import.
		group.scale.set(0.1,0.1,0.1)

		group.traverse(c => c.castShadow = true)
		// this.cachedChar.set(gender, fbx)

		return group
	}
	async loadAnim(gender, anim) {
		const fbx = await this.loadFbx(`/char/${gender}/${gender}-anim-${anim}.fbx`)

		log.info('anim', fbx)
		// fbx.traverse(c => c.scale ? c.scale.set(0.1, 0.1, 0.1) :null)
		// fbx.scale.set(0.1, 0.1, 0.1)
		// fbx.updateMatrix()
		// skinnedMesh.geometry.applyMatrix(fbx.matrix)
		// fbx.scale.set(1,1,1)
		// fbx.updateMatrix()

		return fbx
	}


}