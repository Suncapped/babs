import type { Babs } from '@/Babs'
import { InstancedMesh, Vector3, Matrix4, Mesh, DynamicDrawUsage, InstancedBufferAttribute } from 'three'
import { Wob } from './Wob'
import { log } from '@/Utils'

export type IconData = {image :string, pixels :Uint8Array}

// FeInstancedMesh will need to manage InstancedMesh rather than extend it, mainly to manage re-creating an InstancedMesh when needing a larger count on it, but also to help manage `count` when reducing it for optimized wob rendering and wob removal.
export class FeInstancedMesh {
	instancedMesh :InstancedMesh
	boundingSize = new Vector3()
	public lift :number
	public sink :number
	public instanceIndexToWob = new Map<number, Wob>
	public wobIsSmall :boolean
	public wobIsTall :boolean
	renderedIcon :() => Promise<IconData>|IconData

	private optimizedCount :number // Number that are rendered, after which they're temporarily hidden (optimized out)
	private loadedCount :number = 0 // Number that are considered loaded, after which they are deleted or unallocated

	constructor(
		public babs :Babs,
		public blueprint_id :string,
		private maxCount :number, // Number above which a larger buffer (new InstancedMesh) is needed
		private wobMesh :Mesh,
	) {
		// - Set up wobMesh into InstancedMesh
		if(!this.wobMesh) {
			this.wobMesh = Wob.SphereMesh // Object wasn't loaded.  Make a sphere
		}
		else if(!this.wobMesh.geometry?.boundingBox) {
			console.warn('No boundingBox for:', this.blueprint_id)
			this.wobMesh = Wob.SphereMesh // Messed up object; display as a sphere
		}
		Wob.SphereMesh.geometry.computeBoundingBox()

		const isMeshForFarWob = this.blueprint_id.indexOf(Wob.FarwobName) !== -1
		if(isMeshForFarWob) {
			this.wobMesh.geometry.scale(4, 1, 4)
		}

		this.maxCount += Math.floor(this.maxCount *0.10) // Add 10% to maxCount for preallocation margin; prevents needing immediate reallocation
		this.instancedMesh = new InstancedMesh(this.wobMesh.geometry, this.wobMesh.material, this.maxCount)

		// - Calculate things
		this.wobMesh.geometry.boundingBox.getSize(this.boundingSize) // sets into vector

		this.wobIsSmall = this.boundingSize.y < Wob.FarwobShownHeightMinimum
		this.wobIsTall = this.boundingSize.y >= Wob.FarwobShownHeightMinimum

		this.instancedMesh.frustumCulled = false
		this.instancedMesh.count = 0 // Actual rendered count; will be increased when wobs are added
		this.instancedMesh.name = this.blueprint_id
		// instanced.instanceMatrix.needsUpdate = true
		this.instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage) 
		// ^ Requires calling .needsUpdate ? // https://www.khronos.org/opengl/wiki/Buffer_Object#Buffer_Object_Usage

		this.sink = Math.min(this.boundingSize.y *0.05, 0.2)
		// ^ Sink by a percent but with a max for things like trees.
		this.lift = (this.boundingSize.y < 0.01 ? 0.066 : 0)
		// ^ For very small items (like flat 2d cobblestone tiles), let's lift them a bit

		this.instancedMesh.castShadow = this.boundingSize.y >= 1
		this.instancedMesh.receiveShadow = true

		// Set to not modify color; used later for highlight by pickedObject in InputSys
		const fullColors = new Float32Array(this.maxCount *3)
		for(let i=0; i<this.maxCount *3; i+=3) {
			fullColors[i +0] = Wob.FullColor.r
			fullColors[i +1] = Wob.FullColor.g
			fullColors[i +2] = Wob.FullColor.b
		}
		const bufferAttr = new InstancedBufferAttribute(fullColors, 3)
		this.instancedMesh.instanceColor = bufferAttr
		this.instancedMesh.instanceColor.needsUpdate = true

		this.renderedIcon = async () => {
			const {image, pixels} = await Wob.HiddenSceneRender(this.wobMesh)
			this.renderedIcon = () => { // Overwrite self?!  lol amazing
				return {image, pixels}
			}
			return this.renderedIcon()
		}

		this.instancedMesh.position.setX(babs.worldSys.shiftiness.x)
		this.instancedMesh.position.setZ(babs.worldSys.shiftiness.z)

		this.instancedMesh.geometry.center()
		// ^ Fixes offset pivot point
		// https://stackoverflow.com/questions/28848863/threejs-how-to-rotate-around-objects-own-center-instead-of-world-center/28860849#28860849

		Wob.InstancedMeshes.set(this.blueprint_id, this)
		this.babs.group.add(this.instancedMesh)

		log.info('InstancedMesh created:', this.blueprint_id, this.maxCount)

	}

	getLoadedCount() {
		return this.loadedCount
	}
	increaseLoadedCount() {
		// We will always be expanding the inactiveindex
		this.loadedCount++
		// // Sometimes that will put it above count; in that case, we need to increase count
		// if(this.loadedCount > this.maxCount) {
		// 	this.instancedMesh.count++
		// }
		// Sometimes, upping count will put it above maxcount; in that case, we need to reallocate
		if(this.loadedCount > this.maxCount) {
			this.reallocateLargerBuffer()
		}

		// // Speed up when this shows, in case it's nearby
		// // One has been added, but count doesn't necessarily increase.
		// // It's been added to tne end of loaded.  
		// // Increasing count by one here won't necessarily help display it.
		// this.instancedMesh.count = this.instancedMesh.count +1

		this.recalculateRealCount()
	}
	decreaseLoadedCount() {
		this.loadedCount--
		if(this.loadedCount < 0) { 
			console.warn('decreaseLoadedCount went below 0')
		}
		this.recalculateRealCount()
	}

	setOptimizedCount(count :number) {
		this.optimizedCount = count
		// this.recalculateRealCount()
	}

	private recalculateRealCount() {
		// This is the number of instances that are actually rendered
		const isBeingOptimized = this.optimizedCount !== undefined
		this.instancedMesh.count = isBeingOptimized ? Math.min(this.loadedCount, this.optimizedCount) : this.loadedCount
		// this.babs.renderSys.calcShowOnlyNearbyWobs(true) // recalc so it shows immediately // No, it's recursive :p  // Also slow
		this.babs.renderSys.calcRecalcImmediately = true // Recalc on next render; allows all the adds to happen before recalcing
	}

	reallocateLargerBuffer() {
		// Expand InstancedMesh to a larger buffer
		log.info('reallocateLargerBuffer for', this.blueprint_id, 'from', this.maxCount, 'to', this.maxCount *2)
		this.maxCount *= 2

		const newInstancedMesh = new InstancedMesh(this.wobMesh.geometry, this.wobMesh.material, this.maxCount)
		// Here we only need to copy over InstancedMesh properties, not feim

		newInstancedMesh.frustumCulled = this.instancedMesh.frustumCulled
		newInstancedMesh.count = this.instancedMesh.count
		newInstancedMesh.name = this.blueprint_id
		newInstancedMesh.instanceMatrix.setUsage(DynamicDrawUsage) // todo optimize?
		let transferMatrix = new Matrix4()
		for(let i=0; i<this.instancedMesh.count; i++) { // Optimization possible by copying whole matrix? // Maybe not, since this one is now larger
			this.instancedMesh.getMatrixAt(i, transferMatrix)
			newInstancedMesh.setMatrixAt(i, transferMatrix)
		}

		newInstancedMesh.castShadow = this.instancedMesh.castShadow
		newInstancedMesh.receiveShadow = this.instancedMesh.receiveShadow

		const fullColors = new Float32Array(this.maxCount *3)
		for(let i=0; i<this.maxCount *3; i+=3) {
			fullColors[i +0] = Wob.FullColor.r
			fullColors[i +1] = Wob.FullColor.g
			fullColors[i +2] = Wob.FullColor.b
		}
		newInstancedMesh.instanceColor = new InstancedBufferAttribute(fullColors, 3)
		newInstancedMesh.instanceColor.needsUpdate = true

		newInstancedMesh.position.x = this.instancedMesh.position.x
		newInstancedMesh.position.z = this.instancedMesh.position.z

		this.babs.group.remove(this.instancedMesh)
		this.instancedMesh.dispose()

		newInstancedMesh.geometry.center() 
		// ^ Fixes offset pivot point
		// https://stackoverflow.com/questions/28848863/threejs-how-to-rotate-around-objects-own-center-instead-of-world-center/28860849#28860849
		
		this.instancedMesh = newInstancedMesh
		this.babs.group.add(this.instancedMesh)
	}

		
	coordFromIndex(index) { 
		// Returns world coord; instanced are zero-oriented since they have to be shared across zones, and their 'getMatrixAt()' positions are all local, not world.  So we change them to world using shiftiness.
		const matrix = new Matrix4()
		this.instancedMesh.getMatrixAt(index, matrix)
		const position = new Vector3()
		position.setFromMatrixPosition(matrix)
		// const quat = new Quaternion()
		// quat.setFromRotationMatrix(matrix)
		const engWorldCoord = position.add(this.babs.worldSys.shiftiness)
		return engWorldCoord

		// // Um that might all be overkill!  Works just as well.  Wait no - only works in-zone.
		// for(let i=0; i<this.instanceMatrix.count *16; i+=16) { // Each instance is a 4x4 matrix; 16 floats
		// 	const x = instanceMatrix.array[i +12]
		// 	const z = instanceMatrix.array[i +14]
		// }
	}
}