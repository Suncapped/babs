import { BoxGeometry, Color, DoubleSide, FrontSide, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Object3D, Scene, SRGBColorSpace, sRGBEncoding, Texture } from 'three'
import { Vector3 } from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { TextureLoader } from 'three'
import { MeshPhongMaterial } from 'three'
import { log } from './../Utils'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Controller } from '@/comp/Controller'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'

export class LoaderSys {

	megaMaterial
	loader :GLTFLoader
	dracoLoader
	urlFiles
	objectTexture :Texture

	constructor(urlFiles) {
		// log('LoaderSys', urlFiles)
		this.urlFiles = urlFiles

		this.loadTexture(`/environment/mega-color-atlas.png`).then((texture) => {
			this.objectTexture = texture
			texture.colorSpace = SRGBColorSpace
			this.objectTexture.flipY = false 
			// flipY false because objects are all gltf loaded per https://threejs.org/docs/#examples/en/loaders/GLTFLoader
			// this.objectTexture.minFilter = 
			// this.objectTexture.magFilter = 

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
				shadowSide: DoubleSide, // Might have to use separate materials if I want more granularity.
				// color: null,
				// emissive: null,
				// color: new Color(0,0,0).convertSRGBToLinear(),
			})
			// material.color.copy(material.color.convertSRGBToLinear())
			// material.emissive.copy(material.emissive.convertSRGBToLinear())

			this.megaMaterial = material
			// Would disposing of the old material be bad because it would have to keep re-creating it on each import?
			
		})

		this.loader = new GLTFLoader()
		this.dracoLoader = new DRACOLoader()
		// this.dracoLoader.setDecoderPath('../../node_modules/three/examples/jsm/libs/draco/gltf/')
		// this.dracoLoader.setDecoderPath('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/libs/draco/')
		this.dracoLoader.setDecoderPath('/draco/')
		// this.dracoLoader.setDecoderPath('three/examples/js/libs/draco')
		// this.dracoLoader.setDecoderConfig({ type: 'wasm' })
		this.dracoLoader.preload()
		this.loader.setDRACOLoader(this.dracoLoader)
	}

	async loadFbx(path) {

		return new Promise( (resolve, reject) => {
			const fbxLoader = new FBXLoader()

			fbxLoader.load(
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
		// texture.encoding = sRGBEncoding // Deprecated
		texture.colorSpace = SRGBColorSpace // This too, though the default seems right
		// Ah, because of this https://discourse.threejs.org/t/acesfilmictonemapping-leading-to-low-contrast-textures/15484/5
		// texture.anisotropy = 16
		return texture 

	}

	
	loadGltf(path, name) :Promise<{scene, animations}|{name :string}> {
		return new Promise((resolve, reject) => {
			this.loader.load(`${this.urlFiles}${path}`,// function ( gltf ) {
				(gltf) => { // onLoad callback
					log.info('Loaded GLTF:', gltf)
					// log('Loaded GLTF:', gltf.scene.children[0])

					gltf.scene.traverse(child => {
						if (child.isMesh) {
							child.material = this.megaMaterial
						}
					})

					if(gltf.scene) {
						if(gltf.scene.children.length == 0) {
							console.warn('Arrival wob has no children in scene: ', name)
						}
						else {
							if(gltf.scene.children.length > 1) {
								console.warn(`Loaded object with more than one child.`, name)
							}
						}
					}
					else {
						console.warn('Arrival wob has no scene: ', name)
					}

					gltf.name = name

					resolve(gltf)
				},
				(xhr) => { // onProgress callback
					log.info( (xhr.loaded / xhr.total * 100) + '% loaded' )
				},
				(err) => { // onError callback
					log.info('loadGltf error:', err.message) // info because can just be missing model
					resolve({name: name}) // Need to return name so it doesn't fail to make an instanced for spheres
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
			shininess: 0.2,
			// reflectivity: 0.5,
			// envMap: alphaIndex % 2 === 0 ? null : reflectionCube
			side: FrontSide,
			shadowSide: FrontSide,
		})
		
		// Either get from previous load (cache), or download for the first time.  Clone either way.
		const path = `/char/${gender}/female-rig.glb`
		const cached = this.mapPathRigCache.get(path)
		let groupScene :Object3D
		if(cached) {
			log.info('cached rig', path)
			groupScene = SkeletonUtils.clone(cached)
		}
		else {
			log.info('download rig', path)
			let group = await this.loadGltf(path)
			this.mapPathRigCache.set(path, group.scene)
			groupScene = SkeletonUtils.clone(group.scene)
		}
		
		const skinnedMesh = groupScene.children[0].children[0]//group.traverse(c => c instanceof SkinnedMesh)
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

		groupScene.scale.multiplyScalar(0.1 * 3.28 *Controller.sizeScaleDown) // hax for temp character

		
		// Put in a box for raycast bounding // must adjust with scale
		const cube = new Mesh(new BoxGeometry(0.75, 2.5, 0.75), new MeshBasicMaterial())
		cube.name = 'player_bbox'
		cube.scale.multiplyScalar(1 /groupScene.scale.x)
		cube.position.setY(3*(1 /groupScene.scale.x))
		cube.visible = false
		cube.clickable = true
		groupScene.add(cube)

		skinnedMesh.geometry.computeBoundingSphere()
		// skinnedMesh.geometry.boundingSphere.center = new Vector3(0, 3, 0)
		// skinnedMesh.geometry.boundingSphere.radius = 1
		// skinnedMesh.matrixWorldNeedsUpdate = true
		// skinnedMesh.geometry.matrixWorldNeedsUpdate = true

		// // Re-scale boundingsphere
		// // https://stackoverflow.com/questions/68562800/three-js-bounding-sphere-of-a-scaled-object
		// // Copy the geometry 
		// let geoClone = skinnedMesh.geometry.clone() // really bad for memory, but it's simple/easy
		// // Apply the world transformation to the copy (updates vertex positions)
		// geoClone.applyMatrix4( skinnedMesh.matrixWorld )
		// // Convert the vertices into Vector3s (also bad for memeory)
		// let vertices = []
		// let pos = geoClone.attributes.position.array
		// for( let i = 0, l = pos.length; i < l; i += 3 ){
		// 	vertices.push( new Vector3( pos[i], pos[i+1], pos[i+2] ) )
		// }
		// // Create and set your mesh's bounding sphere
		// skinnedMesh.geometry.boundingSphere = new Sphere()
		// skinnedMesh.geometry.boundingSphere.setFromPoints( vertices )


		setTimeout(() => {
			skinnedMesh.geometry.boundingSphere.center = new Vector3(0, 5, 0)
			skinnedMesh.geometry.boundingSphere.radius = 200 // ?!
			// skinnedMesh.matrixWorldNeedsUpdate = true
			// skinnedMesh.geometry.matrixWorldNeedsUpdate = true
		}, 1)

		return groupScene
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