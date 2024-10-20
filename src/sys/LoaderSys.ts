import { AnimationClip, AnimationMixer, AudioLoader, BackSide, BoxGeometry, Color, DoubleSide, FrontSide, Loader, Material, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, MeshToonMaterial, Object3D, Scene, SkinnedMesh, SRGBColorSpace, Texture } from 'three'
import { Vector3 } from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { TextureLoader } from 'three'
import { MeshPhongMaterial } from 'three'

import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { Controller } from '@/comp/Controller'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import JSZip, { type files } from 'jszip'
import { Wob, type FeObject3D } from '@/ent/Wob'
import type { Babs } from '@/Babs'
import { DateTime } from 'luxon'


export type FeGltf = {
	animations: Array<AnimationClip>,
	scene: Scene,
	name: string,
	glbUpdatedAt: string,
}

export class LoaderSys {

	static CachedGlbFiles :Promise<typeof JSZip.files>
	static CachedDekazoneFiles :Promise<typeof JSZip.files>
	static CachedDekafarwobsFiles :Promise<typeof JSZip.files>
	static CachedFlametex :Promise<Texture>
	static MegaColorAtlas :Promise<void>
	static ColorAtlasNew2 :Promise<Texture>
	static VashriaTextures :Array<Promise<Texture>>
	static CachedKidRig :Promise<GLTF>
	static KidAnimList = ['idle', 'run', 'walk']
	static KidAnimPaths = {}
	static CachedKidAnims = {}

	megaMaterial
	loader :GLTFLoader
	dracoLoader
	urlFiles
	objectTexture :Texture
	audioLoader :AudioLoader
	loadedAudioBuffers :Map<string, Promise<AudioBuffer>> = new Map()

	constructor(public babs :Babs) {
		// console.log('LoaderSys', urlFiles)
		this.urlFiles = babs.urlFiles

		this.audioLoader = new AudioLoader()

		this.loader = new GLTFLoader()
		this.dracoLoader = new DRACOLoader()
		// this.dracoLoader.setDecoderPath('../../node_modules/three/addons/libs/draco/gltf/')
		// this.dracoLoader.setDecoderPath('https://raw.githubusercontent.com/mrdoob/three.js/dev/addons/libs/draco/')
		this.dracoLoader.setDecoderPath('/draco/')
		// this.dracoLoader.setDecoderPath('three/examples/js/libs/draco')
		// this.dracoLoader.setDecoderConfig({ type: 'wasm' })
		this.dracoLoader.preload()
		this.loader.setDRACOLoader(this.dracoLoader)

		// this.dracoLoader.getDecoderModule() // Prefetch // Doesn't work


		// Prefetch and process cached GLB files
		LoaderSys.CachedGlbFiles = babs.usePail && (async () => {
			const response = await fetch('https://pail.suncapped.com/glb.zip.gz')
			
			const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'))
			// const blob = await new Response(decompressedStream).blob()
			const arrayBuffer = await new Response(decompressedStream).arrayBuffer()

			const jszip = new JSZip()
			const zipContents = await jszip.loadAsync(arrayBuffer)
			return zipContents.files
		})()

		// Prefetch and process cached dekazone terrain files
		LoaderSys.CachedDekazoneFiles = babs.usePail && (async () => {
			const response = await fetch('https://pail.suncapped.com/dekazone.zip.gz')
			
			const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'))
			const arrayBuffer = await new Response(decompressedStream).arrayBuffer()

			const jszip = new JSZip()
			const zipContents = await jszip.loadAsync(arrayBuffer)
			return zipContents.files
		})()

		// Prefetch and process cached dekazone farwobs files
		LoaderSys.CachedDekafarwobsFiles = babs.usePail && (async () => {
			const response = await fetch('https://pail.suncapped.com/dekafarwobs.zip.gz')
			
			const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'))
			const arrayBuffer = await new Response(decompressedStream).arrayBuffer()

			const jszip = new JSZip()
			const zipContents = await jszip.loadAsync(arrayBuffer)
			return zipContents.files
		})()



		// Prefetch Flametex
		LoaderSys.CachedFlametex = new TextureLoader().loadAsync(`${babs.urlFiles}/texture/flametex.png`).then((texture) => {
			// texture.colorSpace = SRGBColorSpace // Nope!  Made it quite transparent
			return texture
		})

		// Prefetch Color Textures
		LoaderSys.MegaColorAtlas = this.loadTexture(`/texture/mega-color-atlas.png`).then((texture) => {
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
			// return texture // Currently this is not used anywhere.  this.megaMaterial gets set above.
		})
		LoaderSys.ColorAtlasNew2 = this.loadTexture(`/texture/color-atlas-new2.png`)
		LoaderSys.VashriaTextures = [
			this.loadTexture(`/char/vashria/mats/jpeg/vashria-purple.jpg`),
			this.loadTexture(`/char/vashria/mats/jpeg/vashria-pink.jpg`),
			this.loadTexture(`/char/vashria/mats/jpeg/vashria-green.jpg`),
			this.loadTexture(`/char/vashria/mats/jpeg/vashria-yellow.jpg`),
		]

		// Prefetch Kid Rig
		LoaderSys.CachedKidRig = this.loadGltf(`/char/vashria/vashria-rig.glb`)
		
		// Prefetch Kid Anims
		LoaderSys.KidAnimList.forEach(anim => {
			LoaderSys.KidAnimPaths[anim] = `/char/vashria/vashria-anim-${anim}.glb`
		})
		Object.entries(LoaderSys.KidAnimPaths).forEach(([anim, path] :[string, string|unknown]) => {
			LoaderSys.CachedKidAnims[anim] = this.loadGltf(path as string)
		})

	}

	async loadFbx(path) {

		return new Promise( (resolve, reject) => {
			const fbxLoader = new FBXLoader()

			fbxLoader.load(
				`${this.urlFiles}${path}`, // resource URL
				(group) => { // onLoad callback
					console.debug('Loaded FBX:', path, group)

					group.traverse(child => {
						if (child instanceof Mesh) {
							// console.log('FBX COLOR is', child.material.color)
							child.material.color = new Color(1,1,1) // Unset any weird import colors beyond texture painting
						}
					})

					resolve(group)
				},
				(xhr) => { // onProgress callback
					// console.debug( (xhr.loaded / xhr.total * 100) + '% loaded' )
				},
				(err) => { // onError callback
					console.error( 'An error happened', err )
				}
			)
		})
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

	
	async loadGltf(path :string, name :string = 'noname', archivedGlbs :typeof files = null) :Promise<GLTF> {

		let loadFromArchive :ArrayBuffer = null
		let glbUpdatedAt = ''
		if(archivedGlbs) {
			// In `name`, get only the string after the last `/`
			const nameInArchive = name.split('/').pop()
			// Find the item in `checkArchive` that matches the `name`.
			const file = archivedGlbs[nameInArchive + '.glb']
			if(file) {
				glbUpdatedAt = 'glb: '+DateTime.fromJSDate(file.date, { zone: 'America/Chicago' }).toFormat("yyyy-MMM-d '@'h:mm:ssa").toLowerCase()

				// console.log(nameInArchive, 'glbUpdatedAt', glbUpdatedAt)
				const filedata = await file.async('arraybuffer')  // or 'text' for text files
				if(filedata) {
					loadFromArchive = filedata
				}
			}
			else {
				console.debug('File not in archive:', nameInArchive, file)
			}
		}

		return new Promise((resolve, reject) => {
			let url = `${this.urlFiles}${path}`

			const success = (gltf) => {

				// gltf.name is string.  See if it contains 'butterfly'
				// if(name.includes('butterfly')) {
				// 	console.log('Loaded GLTF:', gltf)
				// }

				gltf.scene.traverse(child => {
					if (child instanceof Mesh || child instanceof SkinnedMesh) {
						child.material = this.megaMaterial
					}
				})
	
				if(gltf.scene) {
					if(gltf.scene.children.length == 0) {
						console.warn('Arrival wob has no children in scene: ', name)
					}
					else {
						if(gltf.scene.children.length > 1) {
							console.warn(`Loaded gltf scene with more than one child.`, name)
						}
					}
				}
				else {
					console.warn('Arrival wob has no scene: ', name)
				}
				
				if(gltf.animations.length > 0 && name != 'noname') console.log(`${name} has animations:`, gltf.animations) // noname must be fbx char
	
				gltf.name = name
				gltf.glbUpdatedAt = glbUpdatedAt

				resolve(gltf)
			}
			const progress = (xhr) => { // onProgress callback
				// console.debug( (xhr.loaded / xhr.total * 100) + '% loaded' )
			}
			const error = (err) => { // onError callback
				console.error(`loadGltf error for '${name}':`, err.message) // info because can just be missing model
				resolve(null)
			}
		

			if(loadFromArchive && loadFromArchive.byteLength !== 0) {
				this.loader.parse(loadFromArchive, '', success, error)
			}
			else {
				// byteLength === 0 happens like when expressa fbx2gltf fails to convert something.  So it doesn't go into the archive?
				// So in that case let's attempt a regular load, which also fails better.
				this.loader.load(url, success, progress, error) // Should handle cache situations?  Maybe not for updated.
			}


		})

	}

	mapPathRigCache = new Map()
	async loadRig(gender :string, idPlayer :number) {
		// Todo when we switch to mega atlas, use global material (this.megaMaterial)
		// const texture = await LoaderSys.ColorAtlasNew2
		const textures = await Promise.all(LoaderSys.VashriaTextures)
		const deterministicIndex = Math.abs(idPlayer % textures.length) // Associate a texture with their player id
		const texture = textures[deterministicIndex]

		texture.flipY = false // gltf flipped boolean
		// const material = new MeshToonMaterial({ // hmm.  .flatShading is more appropriate!
		const material = new MeshPhongMaterial({
			map: texture,
			// bumpMap: texture,
			// bumpScale: bumpScale,
			// color: diffuseColor,
			// specular: 0.16,
			// shininess: 0.2,
			// reflectivity: 0.5,
			// envMap: alphaIndex % 2 === 0 ? null : reflectionCube
			side: FrontSide,
			shadowSide: FrontSide, // More even looking flatShading shadows
			// flatShading: true,
		})
		
		// Either get from previous load (cache), or download for the first time.  Clone either way.
		const path = `/char/vashria/vashria-rig.glb`
		const cached = this.mapPathRigCache.get(path)
		let rigGroupScene :Object3D
		if(cached) {
			console.debug('cached rig', path)
			rigGroupScene = SkeletonUtils.clone(cached)
		}
		else {
			console.debug('download rig', path)
			let group = await LoaderSys.CachedKidRig
			this.mapPathRigCache.set(path, group.scene)
			rigGroupScene = SkeletonUtils.clone(group.scene)
		}
		
		const skinnedMesh = rigGroupScene.children[0].children[0] as SkinnedMesh//group.traverse(c => c instanceof SkinnedMesh)
		skinnedMesh.material = material

		skinnedMesh.castShadow = true
		skinnedMesh.receiveShadow = true
		// skinnedMesh.traverse(c => c.receiveShadow = false)
		// skinnedMesh.traverse(c => c.castShadow = false)

		// rigGroupScene.scale.multiplyScalar(0.1 * 3.28 *Controller.sizeScaleDown) // hax for temp character
		rigGroupScene.scale.multiplyScalar(3.5) // hax for temp character
		
		// Put in a box for raycast bounding // must adjust with scale
		const cube :FeObject3D = new Mesh(new BoxGeometry(0.75, 2.5, 0.75), new MeshBasicMaterial())
		cube.name = 'player_bbox'
		cube.scale.multiplyScalar(1 /rigGroupScene.scale.x).multiplyScalar(1.5)
		cube.position.setY(3*(1 /rigGroupScene.scale.x))
		cube.visible = false
		cube.clickable = true
		rigGroupScene.add(cube)

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

		return rigGroupScene
	}

	mapPathAnimCache = new Map<string, GLTF>()
	async loadAnim(gender, anim) {
		const path = LoaderSys.KidAnimPaths[anim]
		
		const cached = this.mapPathAnimCache.get(path)
		if(cached) {
			// console.log('cached anim', path)
			return cached // With animations, we don't need to clone, can just use the same ones!
		}
		else {
			// console.log('download anim', path)
			let group = LoaderSys.CachedKidAnims[anim]
			this.mapPathAnimCache.set(path, group) // Store group, not group.scene, because group.animations[] is where they are.
			return group
		}
	}

	async getLoadedAudioBuffer(name :string) :Promise<AudioBuffer> {

		const buffer = this.babs.loaderSys.loadedAudioBuffers.get(name)
		if(buffer) return buffer

		// Use a promised buffer to prefetch and load the file
		const newBufferPromise = new Promise<AudioBuffer>((resolve, reject) => {
			this.babs.loaderSys.audioLoader.load(`${this.babs.urlFiles}/audio/sounds/${name}.mp3`, function( newBuffer ) {
				resolve(newBuffer)
			})
		})

		this.loadedAudioBuffers.set(name, newBufferPromise)
		return newBufferPromise
	}


}