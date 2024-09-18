import { Color, DoubleSide, Mesh, MeshPhongMaterial, FrontSide, Vector3, Matrix4, InstancedBufferAttribute, SphereGeometry, MeshLambertMaterial, StaticDrawUsage, DynamicDrawUsage, Object3D, BufferGeometry, InstancedBufferGeometry, MathUtils, Box3, Euler, SkinnedMesh, AnimationClip, Vector2, PositionalAudio, Quaternion } from 'three'
import { UiSys } from '@/sys/UiSys'

import { Fire } from '@/comp/Fire'
import { Zone } from './Zone'
import { Babs } from '@/Babs'
import { YardCoord } from '@/comp/Coord'
import { SharedBlueprint, isMatchingWobIds, SharedWob, type RotationCardinal } from '@/shared/SharedWob'
import { Player } from './Player'
import { InstancedWobs } from './InstancedWobs'
import { LoaderSys, type FeGltf } from '@/sys/LoaderSys'
import { InstancedSkinnedMesh } from './InstancedSkinnedMesh'
import { objectIsSomeKindOfMesh } from '@/Utils'
import { WorldSys } from '@/sys/WorldSys'
import { Audible } from '@/comp/Audible'

const FEET_IN_A_METER = 3.281

export class Wob extends SharedWob {
	constructor(
		public babs :Babs,
		public idzone :number,
		public x :number,
		public z :number,
		public r :RotationCardinal,
		bp :SharedBlueprint,
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
	static SphereMesh :Mesh
	static FullColor = new Color(1,1,1)
	static FarwobName = 'tree twotris'
	static WobIsTallnessMinimum = 12
	static WobIsFlatnessMaximum = 3

	static totalArrivedWobs = 0

	static LoadedGltfs = new Map<string, Promise<FeGltf>>()
	static InstancedWobs = new Map<string, InstancedWobs>()
	static async LoadInstancedWobs(arrivalWobs :Array<SharedWob>, babs :Babs, shownames :boolean, asFarWobs :'asFarWobs' = null) {
		// arrivalWobs = arrivalWobs.splice(0, Math.round(arrivalWobs.length /2))
		console.debug('arrivalWobs', arrivalWobs.length)
		const nameCounts = new Map<string, number>()

		for(const wob of arrivalWobs) {
			// Filter farwobs that do not have a bluests.visible
			if(asFarWobs && !wob.bluests?.visible?.farMesh) {
				// console.log('skipping', wob.name, 'as', wob, 'arrivalWobs', arrivalWobs) // This is normal for wobs that aren't far, eg sneezeweed
				continue
			}
			if(asFarWobs) {
				wob.name = Wob.FarwobName
				wob.blueprint_id = Wob.FarwobName
			}

			nameCounts.set(wob.name, (nameCounts.get(wob.name) || 0) +1)
			// console.log('name has been set', wob.name)
		}

		// console.log('nameCounts', [...nameCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])))

		const wobsToLoad = arrivalWobs.map(w=>w.name)
		console.debug('meshesToLoad', nameCounts, asFarWobs)
		await Wob.ensureGltfsLoaded(wobsToLoad, babs) // Loads them into Wob.LoadedGltfs

		// console.debug('LoadedGltfs', Wob.LoadedGltfs)
		// Create InstancedMeshes from loaded gltfs
		for(const [blueprint_id, gltfMaybe] of Wob.LoadedGltfs) {
			const gltfResolved = await gltfMaybe
			// console.log('blueprint_id, gltf', blueprint_id, gltfResolved)
			if(!gltfResolved.hasOwnProperty('scene')) {
				// Skip if failed to load
				console.warn('gltfResolved does not have scene:', blueprint_id, gltfResolved)
				continue
			}

			const newWobsCount = nameCounts.get(blueprint_id)
			let instanced = Wob.InstancedWobs.get(blueprint_id)
			// console.log('Checking for instanced for blueprint_id', blueprint_id, newWobsCount)
			if(!instanced) {
				// console.log('About to create instanced for blueprint_id', blueprint_id, newWobsCount)
				instanced = new InstancedWobs(babs, blueprint_id, newWobsCount, gltfResolved, asFarWobs) // 'wobMesh' shouldn't be 'true' by now due to promises finishing
				// console.debug('Created instanced for blueprint_id', blueprint_id)
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
			// console.log('arrival of', fwob.name, fwob.blueprint_id)

			// Filter farwobs that do not have a bluests.visible
			if(asFarWobs && (!fwob.bluests?.visible?.farMesh)) {
				// console.log('skipping', fwob.name, 'as', fwob, 'arrivalWobs', arrivalWobs) // This is normal for wobs that aren't far, eg sneezeweed
				continue
			}

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

			if(fwob.idzone) { // Place in zone (; is not a backpack item)
				const feim = Wob.InstancedWobs.get(fwob.blueprint_id)
				if(!feim) {
					console.warn('No feim for:', fwob.blueprint_id)
					continue
				}

				let wob = new Wob(babs, fwob.idzone, fwob.x, fwob.z, fwob.r, {
					blueprint_id: fwob.blueprint_id, 
					locid: fwob.locid,
					bluests: fwob.bluests,
				})
				zone = babs.ents.get(wob.idzone) as Zone

				
				// Translate locid back to blueprint_id, so that farwob original name can be found for fires!
				const farwobOrigBp = zone.locidToBlueprint[fwob.locid]
				// console.log('wob to bp', wob, bp.blueprint_id)

				yardCoord = YardCoord.Create(wob)
				engPositionVector = yardCoord.toEngineCoordCentered('withCalcY')
				engPositionVector = feim.heightTweak(engPositionVector)

				let existingIindex
				if(!asFarWobs) {
					existingIindex = wob.zone.coordToInstanceIndex[wob.x +','+ wob.z]
					const indexDoesNotExist = existingIindex === null || existingIindex === undefined
					if(indexDoesNotExist) {
						existingIindex = feim.getLoadedCount() // Not -1, because we're about the increase the count, then this index will be count -1
						wob.zone.coordToInstanceIndex[wob.x +','+ wob.z] = existingIindex
						feim.increaseLoadedCount()

						if(feim.instancedMesh instanceof InstancedSkinnedMesh) {
							// Start animation at a random spot so that they're not all in sync
							feim.animTimeOffsets[existingIindex] = Math.random() *feim.gltf.animations[0].duration // Works with rearrangements?  Maybe doesn't matter too much.
						}
					}
					else {
						// This happens when Proxima re-sends everything during a generate.
						// console.log('Index does exist?', existingIindex)
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
				const alreadyExistedAtSameSpot = isMatchingWobIds(wob, feim.instanceIndexToWob.get(existingIindex)?.id(), true)
				if(alreadyExistedAtSameSpot) {
					// console.log('alreadyExistedAtSameSpot', wob.id(), feim.instanceIndexToWob.get(existingIindex)?.id())
					continue
				}

				feim.instanceIndexToWob.set(existingIindex, wob)

				matrix.identity()
				if(!asFarWobs) {
					const tiltFactor = feim.wobIsFlat ? 0.4 : 0.05 // Graduate the tilt because it's inaccurately steep by default :p // Taller things get less tilt
					const normal = zone.engineNormalAt(yardCoord)

					// Blend the normal with the up vector
					const upVector = new Vector3(0, 1, 0)
					const blendedNormal = new Vector3().lerpVectors(upVector, normal, tiltFactor).normalize()

					// Create a quaternion that rotates the object's up vector (0, 1, 0) to the normal
					const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), blendedNormal)
					// object.quaternion.copy(quaternion);
					// Reset then apply this to matrix
					matrix.makeRotationFromQuaternion(quaternion)
				}
				// Apply the server-set Y rotation
				const yRotationMatrix = new Matrix4().makeRotationY(MathUtils.degToRad(wob.r * 90))
				matrix.multiply(yRotationMatrix)

				matrix.setPosition(engPositionVector)
				feim.instancedMesh.setMatrixAt(existingIindex, matrix)
	
				feim.instancedMesh.instanceMatrix.needsUpdate = true

				if(shownames) {
					babs.uiSys.wobSaid(wob.name, wob)
				}

				if(//!alreadyExistedAtSameSpot &&
					(farwobOrigBp.blueprint_id === 'campfire' || farwobOrigBp.blueprint_id === 'torch' || farwobOrigBp.blueprint_id === 'brushfire')
				) {
					let scale, yup
					if(farwobOrigBp.blueprint_id === 'campfire') {
						scale = 3
						yup = 1.8
					}
					else if(farwobOrigBp.blueprint_id === 'torch') {
						scale = 1.1
						yup = 3.5
					}
					else if(farwobOrigBp.blueprint_id === 'brushfire') {
						scale = 1
						yup = 0.8
					}

					// console.log('Adding fire:', farwobOrigBp.blueprint_id, wob.x, wob.z, asFarWobs)
		
					// Add new fire
					// Smoke and light we'll attach exclusively to  farwobs via 'asFarWobs' flag
					Fire.Create(wob, wob.zone, babs, scale, yup, asFarWobs) // Is relatively slow (extra ~0.25 ms) // Not awaiting
				}

				if(!asFarWobs) {
					// Add audio, if any
					const sharedBluestAudible = wob.bluests?.audible
					if(sharedBluestAudible) {
						// console.debug('serverAudible', sharedBluestAudible)
						const audible = Audible.Create(wob, babs, sharedBluestAudible)

						if(babs.soundSys.hasContextStartedRunning) {
							(await audible).playContinuous()
						}
						else {
							// Later, upon user gesture (CameraSys), we will find all wobs with continuous sounds and play them then.
						}
					}
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
		// console.log('ensureGltfsLoaded 1:', arrivalWobsNames)

		for(const wobName of arrivalWobsNames) {
			if(!Wob.LoadedGltfs.get(wobName)){ // If not loaded (gltf) or loading (promise)
				console.debug('Loading gltf:', wobName)
				const load = babs.loaderSys.loadGltf(`/environment/${wobName}.glb`, wobName, await LoaderSys.CachedGlbFiles)
				Wob.LoadedGltfs.set(wobName, load as unknown as Promise<FeGltf>) // Hold its spot in case there are more loads.  Gets set right after this
				loads.push(load)
			}
		}
		// console.log('ensureGltfsLoaded 2:', arrivalWobsNames)
		const finishedLoads = await Promise.all(loads)
		// Use name passed in to loadGltf to set so we don't have to await later
		for(const gltf of finishedLoads) {
			// console.log('finishedLoad:', gltf.name, gltf)
			let wobMesh :Mesh|SkinnedMesh
			// let animations :Array<AnimationClip>
			try {
				// Use Object3D.traverse to filter for Mesh or SkinnedMesh; ends up with the last one
				gltf.scene.traverse(child => objectIsSomeKindOfMesh(child) ? wobMesh = child : null)

				if(!objectIsSomeKindOfMesh(wobMesh)) {
					console.warn('wobMesh is not a Mesh in gltf:', gltf)
					throw new Error('wobMesh is not a Mesh in gltf')
				}

				wobMesh.name = gltf.name

				// // Reset scale
				// let scaling = new Vector3(wobMesh.scale.x, wobMesh.scale.y, wobMesh.scale.z)
				// scaling = scaling.multiplyScalar(FEET_IN_A_METER)
				// wobMesh.geometry.scale(scaling.x, scaling.y, scaling.z)
				// wobMesh.scale.set(1,1,1)

				// // Reset position - position seems to be fine already, even when it's off in export.  But juust in case!
				// // Perhaps the reason this isn't necessary, is that it's done in the InstancedMesh?  Not sure.
				// wobMesh.position.set(0,0,0)

				// // Reset rotation
				// wobMesh.updateMatrix()
				// wobMesh.geometry.applyMatrix4(wobMesh.matrix)
				// wobMesh.rotation.set(0,0,0)
				// wobMesh.updateMatrix()

				// Bake / reset transformation (position, rotation, scale) 
				// https://stackoverflow.com/questions/27022160/three-js-can-i-apply-position-rotation-and-scale-to-the-geometry/27023024#27023024
				// wobMesh.updateMatrix()
				// wobMesh.geometry.applyMatrix4(wobMesh.matrix)

				// Bake original scale (before rotating)
				let scaling = new Vector3(wobMesh.scale.x, wobMesh.scale.y, wobMesh.scale.z)
				scaling = scaling.multiplyScalar(FEET_IN_A_METER)
				wobMesh.geometry.scale(scaling.x, scaling.y, scaling.z)
				wobMesh.scale.set(1, 1, 1)

				// Bake original rotation
				wobMesh.updateMatrix()
				if(!(wobMesh instanceof SkinnedMesh)) wobMesh.geometry.applyMatrix4(wobMesh.matrix) // hax // todo anim
				wobMesh.rotation.set(0,0,0)

				// let rotation = wobMesh.rotation.clone()
				// console.log('rotation', wobMesh.name, rotation.x, rotation.y, rotation.z)
				// wobMesh.geometry.rotateX(rotation.x)
				// wobMesh.geometry.rotateY(rotation.y)
				// wobMesh.geometry.rotateZ(rotation.z)
				// wobMesh.rotation.set(0, 0, 0)
				
				// Bake original position
				wobMesh.position.set(0, 0, 0) // Does it do anything?  Where is center?  And other such questions :p

				wobMesh.updateMatrix()

				// Not sure if necessary
				wobMesh.geometry.computeVertexNormals()
				wobMesh.geometry.computeBoundingBox()
				wobMesh.geometry.computeBoundingSphere()

			}
			catch(e :any) {
				console.warn('Error loading gltf:', gltf.name, e.message)
			}
			
			// console.log('finished, reassigning:', gltf.name)
			Wob.LoadedGltfs.set(gltf.name, gltf)
		}
		// console.log('ensureGltfsLoaded 3', arrivalWobsNames)
	}
	
}



export type FeObject3D = Object3D & {
	idplayer? :number
	zone? :Zone
	clickable? :boolean
}
