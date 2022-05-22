import { BoxGeometry, Color, DoubleSide, FrontSide, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, sRGBEncoding, Vector2 } from "three"
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
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { Controller } from "../com/Controller"

export class LoaderSys {

	megaMaterial

	constructor(urlFiles) {
		this.urlFiles = urlFiles

		this.loadTexture(`/environment/mega-color-atlas.png`).then((texture) => {
			this.objectTexture = texture
			this.objectTexture.encoding = sRGBEncoding // Should already be default
			this.objectTexture.flipY = false 
					// flipY false because objects are all gltf loaded per https://threejs.org/docs/#examples/en/loaders/GLTFLoader
			const material = new MeshLambertMaterial({
				name: 'megamaterial',
				map: this.objectTexture,
				// bumpMap: texture,
				// bumpScale: bumpScale,
				// color: diffuseColor,
				// specular: 0.16,
				// reflectivity: 0.5,
				// shininess: 0.2,
				// envMap: alphaIndex % 2 === 0 ? null : reflectionCube
				side: DoubleSide,
				shadowSide: FrontSide,
				// color: null,
				// emissive: null,
				// color: new Color(0,0,0).convertSRGBToLinear(),
			})
			// material.color.copy(material.color.convertSRGBToLinear())
			// material.emissive.copy(material.emissive.convertSRGBToLinear())

			this.megaMaterial = material
			// Would disposing of the old material be bad because it would have to keep re-creating it on each import?
			
		})

	}

	async loadFbx(path) {

		return new Promise( (resolve, reject) => {
			const loader = new FBXLoader()

			loader.load(
				`${this.urlFiles}${path}`, // resource URL
				(group) => { // onLoad callback
					log.info('Loaded FBX:', path, group)

					group.traverse(child => {
						if (child.isMesh) {
							// log('FBX COLOR is', child.material.color)
							child.material.color = new Color(1,1,1) // Unset any weird import colors beyond texture painting
						}
					})

					resolve(group)
				},
				(xhr) => { // onProgress callback
					log.info( (xhr.loaded / xhr.total * 100) + '% loaded' )
				},
				(err) => { // onError callback
					console.error( 'An error happened', err )
				}
			)
		}); 
	}


	async loadTexture(path) {
		const texture = await new TextureLoader().loadAsync(`${this.urlFiles}${path}`)
		texture.flipY = false // quirk for GLTFLoader separate texture loading!  (not for fbx!) // todo flipY if using with gltf
		texture.encoding = sRGBEncoding // This too, though the default seems right
		// Ah, because of this https://discourse.threejs.org/t/acesfilmictonemapping-leading-to-low-contrast-textures/15484/5
		// texture.anisotropy = 16
		return texture 

	}

	loader = new GLTFLoader()
	loadGltf(path) {
		return new Promise((resolve, reject) => {
			log.info('loading gltf', path)

			this.loader.load(`${this.urlFiles}${path}`,// function ( gltf ) {
				(gltf) => { // onLoad callback
					log.info('Loaded GLTF:', gltf)

					gltf.scene.traverse(child => {
						if (child.isMesh) {
							child.material = this.megaMaterial
						}
					})

					resolve(gltf)
				},
				(xhr) => { // onProgress callback
					log.info( (xhr.loaded / xhr.total * 100) + '% loaded' )
				},
				(err) => { // onError callback
					log.info('loadGltf error:', err) // info because can just be missing model
					reject(err)
				}
			)

		})

	}

	mapPathRigCache = new Map()
	async loadRig(gender) {
		// Todo when we switch to mega atlas, use global material (this.megaMaterial)
		const texture = await this.loadTexture(`/texture/color-atlas-new2.png`)
		texture.flipY = false // gltf flipped boolean
		const material = new MeshPhongMaterial({
			map: texture,
			// bumpMap: texture,
			// bumpScale: bumpScale,
			// color: diffuseColor,
			specular: 0.16,
			// reflectivity: 0.5,
			shininess: 0.2,
			// envMap: alphaIndex % 2 === 0 ? null : reflectionCube
			side: FrontSide,
			shadowSide: FrontSide,
		})
		
		// Either get from previous load (cache), or download for the first time.  Clone either way.
		const path = `/char/${gender}/female-rig.glb`
		const cached = this.mapPathRigCache.get(path)
		let scene
		if(cached) {
			log.info('cached rig', path)
			scene = SkeletonUtils.clone(cached)
		}
		else {
			log.info('download rig', path)
			let group = await this.loadGltf(path)
			this.mapPathRigCache.set(path, group.scene)
			scene = SkeletonUtils.clone(group.scene)
		}
		
		const skinnedMesh = scene.children[0].children[1]//group.traverse(c => c instanceof SkinnedMesh)
		skinnedMesh.material = material

		skinnedMesh.castShadow = true
		skinnedMesh.receiveShadow = true
		// scene.receiveShadow = true
		// scene.traverse(c => c.receiveShadow = true)
		// scene.children.traverse(c => c.receiveShadow = true)
		// scene.children.traverse(c => c.traverse(d => d.receiveShadow = true))

		// Okay let's try this https://stackoverflow.com/questions/27022160/three-js-can-i-apply-position-rotation-and-scale-to-the-geometry/27023024#27023024
		// Well, couldn't figure that one out :p  (deleted pages of code) Better to scale it before import.
		// Conclusion: Baking scaling this way is not easy to say the least, do it in Blender, not here.

		scene.scale.multiplyScalar(0.1 * 3.28 *Controller.sizeScaleDown) // hax for temp character

		
		// Put in a box for raycast bounding // must adjust with scale
		const cube = new Mesh(new BoxGeometry(3, 8, 3), new MeshBasicMaterial())
		cube.name = 'player_bbox'
		cube.scale.multiplyScalar(1 /scene.scale.x)
		cube.position.setY(3*(1 /scene.scale.x))
		cube.visible = false
		scene.add(cube)

		return scene
	}

	mapPathAnimCache = new Map()
	async loadAnim(gender, anim) {
		const path = `/char/${gender}/female-anim-${anim}.glb`
		const cached = this.mapPathAnimCache.get(path)
		if(cached) {
			log.info('cached anim', path)
			return cached // With animations, we don't need to clone, can just use the same ones!
		}
		else {
			log.info('download anim', path)
			let group = await this.loadGltf(path)
			this.mapPathAnimCache.set(path, group) // Store group, not group.scene, because group.animations[] is where they are.
			return group
		}
	}


}