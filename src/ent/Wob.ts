import { BufferGeometryLoader, Color, DoubleSide, Group, Mesh, MeshPhongMaterial, FrontSide, Vector3, InstancedMesh, StreamDrawUsage, Matrix4, InstancedBufferAttribute, SphereGeometry, MeshBasicMaterial, Scene, PerspectiveCamera, DirectionalLight, WebGLRenderer, OrthographicCamera, BoxGeometry, AmbientLight, Quaternion, WebGLRenderTarget, MeshLambertMaterial, BoxHelper, StaticDrawUsage, DynamicDrawUsage, Object3D, BufferGeometry, InstancedBufferGeometry, MathUtils, Box3, Euler, SkinnedMesh, AnimationClip } from 'three'
import { UiSys } from '@/sys/UiSys'
import { log } from '@/Utils'
import { Flame } from '@/comp/Flame'
import { Zone } from './Zone'
import { Babs } from '@/Babs'
import { YardCoord } from '@/comp/Coord'
import { Blueprint, SharedWob, type Rotation } from '@/shared/SharedWob'
import { Player } from './Player'
import { InstancedWobs } from './InstancedWobs'
import { LoaderSys, type Gltf } from '@/sys/LoaderSys'
import { InstancedSkinnedMesh } from './InstancedSkinnedMesh'

const FEET_IN_A_METER = 3.281

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

	static SphereGeometry = new SphereGeometry(1, 12, 12)
	static SphereMaterial = new MeshLambertMaterial({ color: 0xcccc00 })
	static SphereMesh = new Mesh(Wob.SphereGeometry, Wob.SphereMaterial)
	static FullColor = new Color(1,1,1)
	static FarwobName = 'tree twotris'
	static WobIsTallnessMinimum = 12

	static totalArrivedWobs = 0

	static LoadedGltfs = new Map<string, true|Gltf>()
	static InstancedWobs = new Map<string, InstancedWobs>()
	static async LoadInstancedWobs(arrivalWobs :Array<SharedWob>, babs :Babs, shownames :boolean, asFarWobs :'asFarWobs' = null) {
		// arrivalWobs = arrivalWobs.splice(0, Math.round(arrivalWobs.length /2))
		log.info('arrivalWobs', arrivalWobs.length)
		const nameCounts = new Map<string, number>()

		const playerSelf = babs.ents.get(babs.idSelf) as Player
		// const playerZone = playerSelf.controller.playerRig.zone
		// const zonesNearbyIds = playerZone.getZonesAround(Zone.loadedZones).map(z=>z.id)

		for(const wob of arrivalWobs) {
			if(asFarWobs) {
				wob.name = Wob.FarwobName
				wob.blueprint_id = Wob.FarwobName
			}
			nameCounts.set(wob.name, (nameCounts.get(wob.name) || 0) +1)
		}

		const wobsToLoad = arrivalWobs.map(w=>w.name)
		log.info('meshesToLoad', nameCounts)
		await Wob.ensureGltfsLoaded(wobsToLoad, babs) // Loads them into Wob.LoadedGltfs

		// log.info('LoadedGltfs', Wob.LoadedGltfs)
		// Create InstancedMeshes from loaded gltfs
		for(const [blueprint_id, gltf] of Wob.LoadedGltfs) {
			const newWobsCount = nameCounts.get(blueprint_id)
			let instanced = Wob.InstancedWobs.get(blueprint_id)
			// log('Checking for instanced for blueprint_id', blueprint_id, newWobsCount)
			if(!instanced) {
				// log('About to create instanced for blueprint_id', blueprint_id, newWobsCount)
				instanced = new InstancedWobs(babs, blueprint_id, newWobsCount, gltf as Gltf, asFarWobs) // 'wobMesh' shouldn't be 'true' by now due to promises finishing
				// log.info('Created instanced for blueprint_id', blueprint_id)
				// instanced.instancedMesh.geometry.computeBoundsTree() // bvh
			}
			else {
				if(instanced.getLoadedCount() +newWobsCount > instanced.maxCount) {
					instanced.reallocateLargerBuffer(instanced.getLoadedCount() +newWobsCount)
					// One reason it's better to do it like this rather than *2, is to prevent two simultaneous reallocations (in case of a rapidly larger number of an item)
					// However, todo?: Are we reallocating before or after removing old zone wobs with removeWobGraphic?
				}
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
			// 	// babs.uiSys.svContainers[0].delWob(wob.id)
			// }
			// else if(wob.idzone === null && wobPrevious && wobPrevious.idzone === null) { 
			// 	// It's been moved bagtobag, or is being initial loaded into bag
			// 	// babs.uiSys.svContainers[0].delWob(wob.id)
			// }

			if(wob.idzone) { // Place in zone (; is not a backpack item)
				zone = babs.ents.get(wob.idzone) as Zone
				const feim = Wob.InstancedWobs.get(wob.name)

				yardCoord = YardCoord.Create(wob)
				const engCoordCentered = yardCoord.toEngineCoordCentered()
				engPositionVector = new Vector3(engCoordCentered.x, zone.engineHeightAt(yardCoord), engCoordCentered.z)

				// Instanced is a unique case of shiftiness.  We want to shift it during zoning instead of individually shifting all things on it.  But it's global, since we don't want separate instances per zone.  So things coming in need to be position shifted against the instance's own shiftiness.
				engPositionVector.add(new Vector3(-babs.worldSys.shiftiness.x, 0, -babs.worldSys.shiftiness.z))
				engPositionVector = feim.heightAdjust(engPositionVector)

				let existingIindex
				if(!asFarWobs) {
					existingIindex = wob.zone.coordToInstanceIndex[wob.x +','+ wob.z]
					const indexDoesNotExist = existingIindex === null || existingIindex === undefined
					if(indexDoesNotExist) {
						existingIindex = feim.getLoadedCount() // Not -1, because we're about the increase the count, then this index will be count -1
						wob.zone.coordToInstanceIndex[wob.x +','+ wob.z] = existingIindex
						feim.increaseLoadedCount()
					}
					else {
						log('Index does exist?', existingIindex)
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

				const alreadyExistsAtSameSpot = JSON.stringify(feim.instanceIndexToWob.get(existingIindex)?.id()) === JSON.stringify(wob.id())

				feim.instanceIndexToWob.set(existingIindex, wob)

				// matrix = new Matrix4() // not needed I guess?
				if(!asFarWobs) {
					// console.log(wob.r)
					matrix.makeRotationY(MathUtils.degToRad(wob.r *90))
				}
				matrix.setPosition(engPositionVector)
				feim.instancedMesh.setMatrixAt(existingIindex, matrix)
	
				feim.instancedMesh.instanceMatrix.needsUpdate = true

				if(shownames) {
					babs.uiSys.wobSaid(wob.name, wob)
				}

				if(!alreadyExistsAtSameSpot &&
					(wob.name === 'campfire' || wob.name === 'torch')
				) {
					let scale, yup
					if(wob.name === 'campfire') {
						scale = 3
						yup = 1.8
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
				// const instanced = Wob.InstancedWobs.get(wob.name)
			}

		}

	}

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
				// log.info('Loading gltf:', wobName)
				const load = babs.loaderSys.loadGltf(`/environment/${wobName}.glb`, wobName, await LoaderSys.CachedGlbFiles)
				Wob.LoadedGltfs.set(wobName, true) // Hold its spot in case there are more loads.  Gets set right after this
				loads.push(load)
			}
		}
		const finishedLoads = await Promise.all(loads)
		// Use name passed in to loadGltf to set so we don't have to await later
		for(const gltf of finishedLoads) {
			let wobMesh :Mesh|SkinnedMesh|any
			// let animations :Array<AnimationClip>
			try {
				wobMesh = gltf.scene.children[0].children[0] // Counting on this, comes via FBX2GLTF script

				const isSomeKindOfMesh = (object :any) => {
					return object instanceof Mesh || object instanceof SkinnedMesh
				}

				if(!isSomeKindOfMesh(wobMesh)) {
					throw new Error('wobMesh is not a Mesh in, gltf:', gltf)
				}

				wobMesh.name = gltf.name

				// Reset scale
				let scaling = new Vector3(wobMesh.scale.x, wobMesh.scale.y, wobMesh.scale.z)
				scaling = scaling.multiplyScalar(FEET_IN_A_METER)
				wobMesh.geometry.scale(scaling.x, scaling.y, scaling.z)
				wobMesh.scale.set(1,1,1)

				// Reset position - position seems to be fine already, even when it's off in export.  But juust in case!
				// Perhaps the reason this isn't necessary, is that it's done in the InstancedMesh?  Not sure.
				wobMesh.position.set(0,0,0)

				// Reset rotation
				wobMesh.updateMatrix()
				wobMesh.geometry.applyMatrix4(wobMesh.matrix)
				wobMesh.rotation.set(0,0,0)
				wobMesh.updateMatrix()

				// Not sure if necessary
				wobMesh.geometry.computeVertexNormals()
				wobMesh.geometry.computeBoundingBox()
				wobMesh.geometry.computeBoundingSphere()

			}
			catch(e :any) {
				console.warn('Error loading gltf:', gltf.name, e.message)
			}
			
			Wob.LoadedGltfs.set(gltf.name, gltf)
		}

	}
	
}



export type FeObject3D = Object3D & {
	idplayer? :number
	zone? :Zone
	clickable? :boolean
}