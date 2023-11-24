import type { Babs } from '@/Babs'
import { InstancedMesh, Vector3, Matrix4, Mesh, DynamicDrawUsage, InstancedBufferAttribute } from 'three'
import { Wob } from './Wob'
import { log } from '@/Utils'
import { YardCoord } from '@/comp/Coord'

// InstancedWobs will need to manage InstancedMesh rather than extend it, mainly to manage re-creating an InstancedMesh when needing a larger count on it, but also to help manage `count` when reducing it for optimized wob rendering and wob removal.
export class InstancedWobs {
	instancedMesh :InstancedMesh
	boundingSize = new Vector3()
	public lift :number
	public sink :number
	public instanceIndexToWob = new Map<number, Wob>
	public farInstanceIndexToWob = new Map<number, Wob>
	public wobIsSmall :boolean
	public wobIsTall :boolean
	public wobIsFar :boolean

	private loadedCount :number = 0 // Number that are considered loaded, after which they are deleted or unallocated

	constructor(
		public babs :Babs,
		public blueprint_id :string,
		public maxCount :number, // Number above which a larger buffer (new InstancedMesh) is needed
		private wobMesh :Mesh,
		public asFarWobs :'asFarWobs' = null,
	) {
		// - Set up wobMesh into InstancedMesh
		if(!this.wobMesh) {
			console.warn('No wobMesh for:', this.blueprint_id)
			this.wobMesh = Wob.SphereMesh // Object wasn't loaded.  Make a sphere
		}
		else if(!this.wobMesh.geometry?.boundingBox) {
			console.warn('No boundingBox for:', this.blueprint_id)
			this.wobMesh = Wob.SphereMesh // Messed up object; display as a sphere
		}
		Wob.SphereMesh.geometry.computeBoundingBox()

		if(asFarWobs) {
			this.wobMesh.geometry.scale(4, 1, 4)
		}

		this.maxCount += Math.floor(this.maxCount *0.10) // Add 10% to maxCount for preallocation margin; prevents needing immediate reallocation
		this.instancedMesh = new InstancedMesh(this.wobMesh.geometry, this.wobMesh.material, this.maxCount)

		// - Calculate things
		this.wobMesh.geometry.boundingBox.getSize(this.boundingSize) // sets into vector

		this.wobIsSmall = this.boundingSize.y < Wob.WobIsTallnessMinimum
		this.wobIsTall = this.boundingSize.y >= Wob.WobIsTallnessMinimum
		this.wobIsFar = this.boundingSize.y >= Wob.WobIsTallnessMinimum

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

		// feim.instancedMesh.computeBoundingBox()
		this.instancedMesh.computeBoundingSphere()

		this.instancedMesh.position.setX(babs.worldSys.shiftiness.x)
		this.instancedMesh.position.setZ(babs.worldSys.shiftiness.z)

		this.instancedMesh.geometry.center()
		// ^ Fixes offset pivot point
		// https://stackoverflow.com/questions/28848863/threejs-how-to-rotate-around-objects-own-center-instead-of-world-center/28860849#28860849

		Wob.InstancedWobs.set(this.blueprint_id, this)
		this.babs.group.add(this.instancedMesh)

		// log.info('InstancedMesh created:', this.blueprint_id, this.maxCount)

	}

	getLoadedCount() {
		return this.loadedCount
	}
	increaseLoadedCount() {
		// We will always be expanding the inactiveindex
		this.loadedCount++
		// Sometimes, upping count will put it above maxcount; in that case, we need to reallocate
		if(this.loadedCount > this.maxCount) {
			// this.reallocateLargerBuffer() // No; moved to `Wob.LoadInstancedWobs`
		}

		Wob.totalArrivedWobs++ // For debug display

		this.babs.renderSys.recalcImmediatelyBpids.add(this.blueprint_id) // Recalc on next render; allows all the adds to happen before recalcing
	}
	decreaseLoadedCount() {
		this.loadedCount--
		if(this.loadedCount < 0) { 
			console.warn('decreaseLoadedCount went below 0')
		}

		Wob.totalArrivedWobs-- // For debug display

		this.babs.renderSys.recalcImmediatelyBpids.add(this.blueprint_id) // Recalc on next render; allows all the adds to happen before recalcing
	}

	reallocateLargerBuffer(maxCount :number) {
		// Expand InstancedMesh to a larger buffer
		// log(`${this.asFarWobs ? '(asFarWobs) ' : ''}inside reallocateLargerBuffer() for`, this.blueprint_id, 'from', this.maxCount, 'to', maxCount +Math.floor(this.maxCount *0.10))
		this.maxCount = maxCount 
		this.maxCount += Math.floor(this.maxCount *0.10) // Add 10%

		const newInstancedMesh = new InstancedMesh(this.wobMesh.geometry, this.wobMesh.material, this.maxCount) // this.MAXcount ...ow.  Because, we want this one new to be even bigger, of course.  That's the point of reallocate...so yes.  

		// Here we only need to copy over InstancedMesh properties, not feim (which remains the same one).
		newInstancedMesh.frustumCulled = this.instancedMesh.frustumCulled
		newInstancedMesh.count = this.instancedMesh.count // Preserve old count (will be recalced later)
		newInstancedMesh.name = this.blueprint_id
		newInstancedMesh.instanceMatrix.setUsage(DynamicDrawUsage) // todo optimize?
		let transferMatrix = new Matrix4()

		for(let i=0; i<this.loadedCount; i++) { // Optimization possible by copying whole matrix? // Maybe not, since this one is now larger
			this.instancedMesh.getMatrixAt(i, transferMatrix)
			newInstancedMesh.setMatrixAt(i, transferMatrix)
		}
		// this.instanceIndexToWob.set( // No need to set, because index will be the same and only InstancedMesh is being remade here, not InstancedWobs.
		// zone.coordToInstanceIndex[ // Same thing

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

		// feim.instancedMesh.computeBoundingBox()
		newInstancedMesh.computeBoundingSphere()

		newInstancedMesh.position.x = this.instancedMesh.position.x
		newInstancedMesh.position.z = this.instancedMesh.position.z
		// newInstancedMesh.geometry.center() // Not needed a second time, since the geometry doesn't change or get disposed.

		this.babs.group.remove(this.instancedMesh)
		this.instancedMesh.dispose()

		this.instancedMesh = newInstancedMesh
		this.babs.group.add(this.instancedMesh)
	}

		
	matrixEngCoordFromIndex(index) { 
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
	matrixIndexFromYardCoord(yardCoord :YardCoord) {
		// Returns instanced index
		const instanceMatrix = this.instancedMesh.instanceMatrix
		const imLoadedCount = this.getLoadedCount()
		
		// console.log(this.instancedMesh.count, 'vs', instanceMatrix.count)
		// for(let i=0; i<imLoadedCount; i++) {
		// 	const x = instanceMatrix.array[i *16 +12]// +this.babs.worldSys.shiftiness.x
		// 	const z = instanceMatrix.array[i *16 +14]// +this.babs.worldSys.shiftiness.z
		// 	console.log((x-2)/4, (z-2)/4, 'vs', yardCoord.x, yardCoord.z)
		// 	if((x-2)/4 === yardCoord.x && (z-2)/4 === yardCoord.z) {
		// 		return i
		// 	}
		// }


		// const tempMatrix = new Matrix4()
		// const tempPosition = new Vector3()
		// for(let i=0; i<imLoadedCount; i++) {
		// 	this.instancedMesh.getMatrixAt(i, tempMatrix)
		// 	tempPosition.setFromMatrixPosition(tempMatrix)
		// 	const engWorldCoord = tempPosition.add(this.babs.worldSys.shiftiness)

		// 	engWorldCoord.addScalar(-2).divideScalar(4)

		// 	const targetYc = YardCoord.Create({
		// 		x: engWorldCoord.x, 
		// 		z: engWorldCoord.z,
		// 		zone: yardCoord.zone,
		// 	})

		// 	// console.log(engWorldCoord.x, engWorldCoord.z, 'vs', yardCoord.x, yardCoord.z)
		// 	if(engWorldCoord.x === yardCoord.x && engWorldCoord.z === yardCoord.z) {
		// 		return i
		// 	}
		// }

		// It's simpler than all that!  Using toEngineCoordCentered
		const engCoord = yardCoord.toEngineCoordCentered()
		engCoord.sub(this.babs.worldSys.shiftiness)
		for(let i=0; i<imLoadedCount; i++) {
			const x = instanceMatrix.array[i *16 +12]// +this.babs.worldSys.shiftiness.x
			const z = instanceMatrix.array[i *16 +14]// +this.babs.worldSys.shiftiness.z
			// console.log((x-2)/4, (z-2)/4, 'vs', yardCoord.x, yardCoord.z)
			if(x === engCoord.x && z === engCoord.z) {
				return i
			}
		}


	}

	heightAdjust(engPositionVector :Vector3) {
		return engPositionVector.clone().setY(engPositionVector.y +(this.boundingSize.y /2) -this.sink +this.lift)
	}
}