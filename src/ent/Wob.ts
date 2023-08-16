import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide, Vector3, InstancedMesh, StreamDrawUsage, Matrix4, InstancedBufferAttribute, SphereGeometry, MeshBasicMaterial, Scene, PerspectiveCamera, DirectionalLight, WebGLRenderer, OrthographicCamera, BoxGeometry, AmbientLight, Quaternion, WebGLRenderTarget, MeshLambertMaterial, BoxHelper, StaticDrawUsage, DynamicDrawUsage, Object3D, BufferGeometry, InstancedBufferGeometry, MathUtils } from 'three'
import { UiSys } from '@/sys/UiSys'
import { log } from '@/Utils'
import { Flame } from '@/comp/Flame'
import { Zone } from './Zone'
import { Babs } from '@/Babs'
import { YardCoord } from '@/comp/Coord'
import { Blueprint, SharedWob as SharedWob, type Rotation } from '@/shared/SharedWob'
import { Player } from './Player'
import { InstancedWobs, type IconData } from './InstancedWobs'
import JSZip from 'jszip'

export class Wob extends SharedWob {
	constructor(
		public babs :Babs,
		public idzone :number,
		public x :number,
		public z :number,
		public r :Rotation,
		bp :Blueprint,
	) {
		super(idzone, x, z, r, bp)
	}

	get zone() {
		return this.babs.ents.get(this.idzone) as Zone
	}

	color
	attachments

	static HiddenScene = null
	static HiddenSceneRender(mesh) :Promise<IconData> {
		if(!Wob.HiddenScene) {
			const container = document.getElementById('HiddenRenderFrame')

			// create your renderer
			const renderer = new WebGLRenderer({ antialias: true, alpha: true, }) //  preserveDrawingBuffer: true, // why?
			// renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize( UiSys.ICON_SIZE, UiSys.ICON_SIZE )

			// apply the internal canvas of the renderer to the DOM
			container.appendChild( renderer.domElement )


			// Scene?
			const scene = new Scene()
	
			const fov = 45
			const aspect = 1  // the canvas default
			const near = 0.1
			const far = 1000
			// const camera = new PerspectiveCamera(fov, aspect, near, far)
			const d = 2
			const camera = new OrthographicCamera( - d * aspect, d * aspect, d, - d, near, far)
			// camera.position.set(0,0,0)
			// camera.position.set(0,0,0)
			// camera.lookAt(1, 0, 1)
			// camera.lookAt( new Vector3(20,20,20) ); // or the origin

			camera.position.set( 20, 20, 20 )
			// camera.rotation.order = 'YXZ';
			// camera.rotation.y = - Math.PI / 4;
			// camera.rotation.x = Math.atan( - 1 / Math.sqrt( 2 ) );

			camera.lookAt(scene.position)
		
			const color = 0xFFFFFF
			const intensity = 1
			const light = new DirectionalLight(color, intensity)
			// light.position.set(0,2,0)
			light.position.set( 10,20,15 )
			
			
			scene.add(light)
			
			Wob.HiddenScene = {scene, renderer, camera}




			// const geometry = new BoxGeometry(1,1,1)
			// const material = new MeshPhongMaterial
			// ambient: 0x555555
			// color: 0x555555
			// specular: 0xffffff
			// shininess: 50
			// shading: SmoothShading // was deprecated?

			// const cube = new Mesh(geometry, material)
			// scene.add(cube)

			// scene.add( new AmbientLight(0x4000ff) )

		}
		
		for(let child of Wob.HiddenScene.scene.children){ 
			if(child instanceof Mesh) {
				Wob.HiddenScene.scene.remove(child) 
			}
		}

		// if(mesh.name) {
		const localMesh = mesh.clone()
		localMesh.geometry = mesh.geometry.clone()
		Wob.HiddenScene.scene.add(localMesh)
		// localMesh.position.set(1,1,1)
		localMesh.position.set(0,-1.5,-0.5)
		// localMesh.geometry.rotateX(-Math.PI /2)

		Wob.HiddenScene.renderer.render(Wob.HiddenScene.scene, Wob.HiddenScene.camera) // Hmm what does it do? lol
		// Wob.HiddenScene.renderer.domElement.toDataURL()
		// }


		// let pickingTexture = new WebGLRenderTarget( 50, 50);
		// // log('imageData!',Wob.HiddenScene.renderer.domElement.getImage)
		// Wob.HiddenScene.renderer.setRenderTarget(pickingTexture)
		// Wob.HiddenScene.renderer.render( Wob.HiddenScene.scene, Wob.HiddenScene.camera );
		// const pixelBuffer = new Uint8Array( 4 *50*50 );
		// Wob.HiddenScene.renderer.readRenderTargetPixels( pickingTexture, 0, 0, 50, 50, pixelBuffer );
		// // log('rtpx', pixelBuffer)
		// log('rtpx', Wob.HiddenScene.renderer.context)

		const dataurl :string = Wob.HiddenScene.renderer.domElement.toDataURL()//('image/png')

		return new Promise((resolve, reject) => {
			let img = new Image()
			img.src = dataurl
			img.onload = () => {
				let canvas = document.createElement('canvas')
				canvas.width = UiSys.ICON_SIZE
				canvas.height = UiSys.ICON_SIZE
				let ctx = canvas.getContext('2d')
				ctx.drawImage(img, 0, 0)
				let imageData = ctx.getImageData(0, 0, UiSys.ICON_SIZE, UiSys.ICON_SIZE)
				let pixels = new Uint8Array(imageData.data.buffer)
				canvas.remove()
				img.remove()
		
				resolve({image: dataurl, pixels: pixels} as IconData)
			}
			img.onerror = reject
		})



	}


	static SphereGeometry = new SphereGeometry(1, 12, 12)
	static SphereMaterial = new MeshLambertMaterial({ color: 0xcccc00 })
	static SphereMesh = new Mesh(Wob.SphereGeometry, Wob.SphereMaterial)
	static FullColor = new Color(1,1,1)
	static FarwobName = 'tree twotris'
	static WobIsTallnessMinimum = 12

	static totalArrivedWobs = 0

	static LoadedGltfs = new Map<string, Mesh|true>()
	static InstancedMeshes = new Map<string, InstancedWobs>()
	static async LoadInstancedWobs(arrivalWobs :Array<SharedWob>, babs :Babs, shownames :boolean, asFarWobs :'asFarWobs' = null) {
		// arrivalWobs = arrivalWobs.splice(0, Math.round(arrivalWobs.length /2))
		log.info('arrivalWobs', arrivalWobs.length)
		const nameCounts = new Map<string, number>()

		Wob.totalArrivedWobs += arrivalWobs.length

		const playerSelf = babs.ents.get(babs.idSelf) as Player
		const playerZone = playerSelf.controller.target.zone
		const zonesNearbyIds = playerZone.getZonesAround(Zone.loadedZones).map(z=>z.id)

		for(const wob of arrivalWobs) {

			if(asFarWobs) {
				wob.name = Wob.FarwobName
				wob.blueprint_id = Wob.FarwobName
			}
			nameCounts.set(wob.name, (nameCounts.get(wob.name) || 0) +1)
		}

		const meshesToLoad = arrivalWobs.map(w=>w.name)
		log.info('meshesToLoad', nameCounts)
		await Wob.ensureGltfsLoaded(meshesToLoad, babs) // Loads them into Wob.LoadedGltfs

		log.info('LoadedGltfs', Wob.LoadedGltfs)
		// Create InstancedMeshes from loaded gltfs
		for(const [blueprint_id, wobMesh] of Wob.LoadedGltfs) {
			const newWobsCount = nameCounts.get(blueprint_id)
			let instanced = Wob.InstancedMeshes.get(blueprint_id)
			// log('Checking for instanced for blueprint_id', blueprint_id, newWobsCount)
			if(!instanced) {
				// log('About to create instanced for blueprint_id', blueprint_id, newWobsCount)
				instanced = new InstancedWobs(babs, blueprint_id, newWobsCount, wobMesh as Mesh, asFarWobs) // 'wobMesh' shouldn't be 'true' by now due to promises finishing
				log.info('Created instanced for blueprint_id', blueprint_id)
			}
		}

		// Now a properly sized instance exists.  So create wobs!
		let zone :Zone
		let yardCoord :YardCoord
		let engPositionVector :Vector3
		let matrix = new Matrix4()
		// This is for SETting instance items.  UNSET happens in Zone.removeWobGraphic.
		// Why separately?  Because this happens en-masse
		for(const fwob of arrivalWobs) {
			// log('arrival of', fwob.name, fwob.blueprint_id)
			let wob = new Wob(babs, fwob.idzone, fwob.x, fwob.z, fwob.r, {
				blueprint_id: fwob.blueprint_id, 
				locid: fwob.locid,
				comps: fwob.comps,
			})
			
			// const wobPrevious = wobZone.getWob(fwob.x, fwob.z)
			// If it's being removed from bag, delete it from bag UI
			// todo buggy
			// if(wob.idzone && (wobPrevious && !wobPrevious.idzone)) { 
			// 	// It's been moved from container into zone
			// 	// babs.uiSys.svContainers[0].delWob(wob.id) // fasttodo
			// }
			// else if(wob.idzone === null && wobPrevious && wobPrevious.idzone === null) { 
			// 	// It's been moved bagtobag, or is being initial loaded into bag
			// 	// babs.uiSys.svContainers[0].delWob(wob.id) // fasttodo
			// }

			if(wob.idzone) { // Place in zone (; is not a backpack item)
				zone = babs.ents.get(wob.idzone) as Zone

				const feim = Wob.InstancedMeshes.get(wob.name)
				// console.log('feim for', wob.name, feim)
				// const wobFromData = zone.getWob(wob.x, wob.z) // Get real data so we can see real height of objects that have been converted to far trees
				// const feimFromData = Wob.InstancedMeshes.get(wobFromData.blueprint_id)

				// Hide small objects that are far by moving them downward; no better way without an additional instancedmesh buffer!

				yardCoord = YardCoord.Create(wob)
				const engCoordCentered = yardCoord.toEngineCoordCentered()
				engPositionVector = new Vector3(engCoordCentered.x, zone.engineHeightAt(yardCoord), engCoordCentered.z)

				// Instanced is a unique case of shiftiness.  We want to shift it during zoning instead of individually shifting all things on it.  But it's global, since we don't want separate instances per zone.  So things coming in need to be position shifted against the instance's own shiftiness.
	
				engPositionVector.add(new Vector3(-babs.worldSys.shiftiness.x, 0, -babs.worldSys.shiftiness.z))
				engPositionVector.setY(engPositionVector.y +(feim.boundingSize.y /2) -feim.sink +feim.lift)

				let existingIindex
				if(!asFarWobs) {
					existingIindex = wob.zone.coordToInstanceIndex[wob.x +','+ wob.z]
					const indexDoesNotExist = existingIindex === null || existingIindex === undefined
					if(indexDoesNotExist) {
						existingIindex = feim.getLoadedCount() // Not -1, because we're about the increase the count, then this index will be count -1
						wob.zone.coordToInstanceIndex[wob.x +','+ wob.z] = existingIindex
						feim.increaseLoadedCount()
					}

					// Perhaps best way to handle removing of instanced ids is to make an association from iindex->wobid.
				}
				else {
					// The problem is that I need coordToInstanceIndex for sorting.  But on near zones, far and detailed are overlapping on it :/
					// Let's try just adding ones for far.
					existingIindex = wob.zone.farCoordToInstanceIndex[wob.x +','+ wob.z]
					const indexDoesNotExist = existingIindex === null || existingIindex === undefined
					if(indexDoesNotExist) {
						existingIindex = feim.getLoadedCount() // Not -1, because we're about the increase the count, then this index will be count -1
						wob.zone.farCoordToInstanceIndex[wob.x +','+ wob.z] = existingIindex
						feim.increaseLoadedCount()
					}
				}

				feim.instanceIndexToWob.set(existingIindex, wob)

				if(!asFarWobs) {
					// console.log(wob.r)
					matrix.makeRotationY(MathUtils.degToRad(wob.r *90))
				}
				matrix.setPosition(engPositionVector)
				feim.instancedMesh.setMatrixAt(existingIindex, matrix)
	
				feim.instancedMesh.instanceMatrix.needsUpdate = true

				if(shownames) {
					babs.uiSys.wobSaid(wob.name, YardCoord.Create(wob))
				}

				if(wob.name === 'campfire' || wob.name === 'torch') {
					let scale, yup
					if(wob.name === 'campfire') {
						scale = 3
						yup = 2
					}
					else if(wob.name === 'torch') {
						scale = 1.1
						yup = 3.5
					}
		
					// Add new flame
					const flame = Flame.Create(wob, wob.zone, babs, scale, yup) // Is relatively slow (extra ~0.25 ms)
				}

			}
			else {	// Send to bag
				const instanced = Wob.InstancedMeshes.get(wob.name)
				babs.uiSys.svContainers[0].addWob(wob, await instanced.renderedIcon())
			}

		}

	}


	static CachedGlbFiles :Promise<typeof JSZip.files>

	/**
	 * Ensures that the specified GLTF meshes are loaded exactly once.
	 * Subsequent calls with the same names will not trigger additional loads.
	 * I think that means it's idempotent?
	 * Mutates the Wob.LoadedGltfs in place.
	 */
	static async ensureGltfsLoaded(arrivalWobsNames :Array<string>, babs :Babs) {
		let loads = []

		for(const wobName of arrivalWobsNames) {
			if(!Wob.LoadedGltfs.get(wobName)){
				log.info('Loading gltf:', wobName)
				const load = babs.loaderSys.loadGltf(`/environment/gltf/${wobName}.glb`, wobName, await Wob.CachedGlbFiles)
				Wob.LoadedGltfs.set(wobName, true) // Gets set right after this
				loads.push(load)
			}
		}
		const finishedLoads = await Promise.all(loads)
		// Use name passed in to loadGltf to set so we don't have to await later
		for(const gltf of finishedLoads) {
			let wobMesh :Mesh
			try {
				wobMesh = gltf.scene.children[0]
			}
			catch(e) {
				console.warn('Error loading gltf:', gltf.name)
			}
			
			Wob.LoadedGltfs.set(gltf.name, wobMesh)
		}

	}
	
}



export type FeObject3D = Object3D & {
	idplayer? :number
	zone? :Zone
}