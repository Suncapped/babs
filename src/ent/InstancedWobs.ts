import type { Babs } from '@/Babs'
import { Group, InstancedMesh, Vector3, Matrix4, Mesh, SkinnedMesh, DynamicDrawUsage, AnimationMixer, InstancedBufferAttribute, StreamDrawUsage } from 'three'
import { Wob } from './Wob'

import { YardCoord } from '@/comp/Coord'
import { InstancedSkinnedMesh } from './InstancedSkinnedMesh'
import type { Gltf } from '@/sys/LoaderSys'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { objectIsSomeKindOfMesh } from '@/Utils'

const INSTANCED_MAXCOUNT_EXTRA_MIN = 10 // Minimum number of extra instances to add when reallocating a larger buffer

// InstancedWobs will need to manage InstancedMesh rather than extend it, mainly to manage re-creating an InstancedMesh when needing a larger count on it, but also to help manage `count` when reducing it for optimized wob rendering and wob removal.
export class InstancedWobs {
	instancedMesh :InstancedMesh|InstancedSkinnedMesh // Note that visually/hierarchically, this is added to a Group.
	imGroup :Group
	isAnimated :boolean = false
	animMixer :AnimationMixer
	animTimeOffsets :number[] = []
	public silly :SkinnedMesh

	boundingSize = new Vector3()
	public lift :number
	public sink :number
	public instanceIndexToWob = new Map<number, Wob>
	public farInstanceIndexToWob = new Map<number, Wob>
	public wobIsSmall :boolean
	public wobIsTall :boolean
	public wobIsFar :boolean

	private loadedCount :number = 0 // Number that are considered loaded, after which they are deleted or unallocated

	public glbUpdatedAt :string = ''
	constructor(
		public babs :Babs,
		public blueprint_id :string,
		public maxCount :number, // Number above which a larger buffer (new InstancedMesh) is needed
		public gltf :Gltf,
		public asFarWobs :'asFarWobs' = null,
	) {
		let wobMesh :Mesh|SkinnedMesh// = gltf?.scene?.children[0]?.children[0] as Mesh|SkinnedMesh
		gltf.scene.traverse(child => objectIsSomeKindOfMesh(child) ? wobMesh = child : null)
		this.glbUpdatedAt = gltf.glbUpdatedAt
		
		// - Set up wobMesh into InstancedMesh
		if(!Wob.SphereMesh) { // Init it once
			Wob.SphereMesh = new Mesh(Wob.SphereGeometry, Wob.SphereMaterial)
			Wob.SphereMesh.geometry.computeVertexNormals()
			Wob.SphereMesh.geometry.computeBoundingBox()
			Wob.SphereMesh.geometry.computeBoundingSphere()
		}
		if(!wobMesh) {
			console.warn('No wobMesh for:', this.blueprint_id)
			wobMesh = Wob.SphereMesh // Object wasn't loaded.  Make a sphere
		}
		else if(!wobMesh.geometry?.boundingBox) {
			console.warn('No boundingBox for:', this.blueprint_id)
			wobMesh = Wob.SphereMesh // Messed up object; display as a sphere
		}

		if(asFarWobs) {
			wobMesh.geometry.scale(4, 1, 4)
		}

		this.maxCount += Math.max(Math.floor(this.maxCount *0.10), INSTANCED_MAXCOUNT_EXTRA_MIN) // Add +10% or +INSTANCED_EXTRA_MAXCOUNT to maxCount for preallocation margin; prevents needing immediate reallocation.

		if(this.gltf.animations?.length !== 0 && !(wobMesh instanceof SkinnedMesh)) { // Eg animated but not loading as a SkinnedMesh due to hierarchy
			console.warn('Weird animation / SkinnedMesh mismatch for '+blueprint_id+':', this.gltf, wobMesh)
		}
		if(wobMesh instanceof SkinnedMesh){ // Type narrowing
			this.isAnimated = true

			this.silly = wobMesh
			this.instancedMesh = new InstancedSkinnedMesh(wobMesh.geometry, wobMesh.material, this.maxCount)
			this.instancedMesh.bind(wobMesh.skeleton, wobMesh.bindMatrix)
			// this.instancedMesh.copy(wobMesh) // Seems not necessary in my case
			// this.instancedMesh.isMesh = true // Not necessary, seems to already be true

			this.animMixer = new AnimationMixer(this.gltf.scene)
			this.animMixer.clipAction(this.gltf.animations[0]).play()
		}
		else {
			this.isAnimated = false
			this.instancedMesh = new InstancedMesh(wobMesh.geometry, wobMesh.material, this.maxCount)
		}

		wobMesh.visible = false // Hide the original mesh // Is this necessary?
		wobMesh.geometry.boundingBox.getSize(this.boundingSize) // sets into vector
		this.wobIsSmall = this.boundingSize.y < Wob.WobIsTallnessMinimum
		this.wobIsTall = this.boundingSize.y >= Wob.WobIsTallnessMinimum
		this.wobIsFar = this.boundingSize.y >= Wob.WobIsTallnessMinimum

		this.sink = Math.min(this.boundingSize.y *0.05, 0.2)
		// ^ Sink by a percent but with a max for things like trees.
		this.lift = (this.boundingSize.y < 0.01 ? 0.066 : 0)
		// ^ For very small items (like flat 2d cobblestone tiles), let's lift them a bit

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

		this.instancedMesh.count = 0 // Actual rendered count; will be increased when wobs are added
		this.instancedMesh.name = this.blueprint_id
		this.instancedMesh.frustumCulled = false // todo optimize?
		this.instancedMesh.instanceMatrix.setUsage(this.isAnimated ? StreamDrawUsage : DynamicDrawUsage) // todo optimize?
		// ^ Requires calling .needsUpdate ? // https://www.khronos.org/opengl/wiki/Buffer_Object#Buffer_Object_Usage
		// instanced.instanceMatrix.needsUpdate = true
		
		this.instancedMesh.castShadow = this.boundingSize.y >= 1
		this.instancedMesh.receiveShadow = true

		this.instancedMesh.computeBoundingSphere()
		this.instancedMesh.geometry.center()
		// ^ Fixes offset pivot point
		// https://stackoverflow.com/questions/28848863/threejs-how-to-rotate-around-objects-own-center-instead-of-world-center/28860849#28860849
		
		// Add instancedMesh and gltf.scene to a group
		this.imGroup = new Group()
		this.imGroup.name = this.blueprint_id
		// @ts-ignore
		this.imGroup.noShiftiness = true
		// if(!asFarWobs && this.isAnimated) {
		// 	this.imGroup.add(gltf.scene) // Necessary for InstancedSkinnedMesh at least, so that translation doesn't...affect bones separately?  This when the butterflies would go in all directions when translating their instancedMesh on purely z axis. // Nevermind?
		// }
		this.imGroup.add(this.instancedMesh)
		this.babs.group.add(this.imGroup)

		// Will not need re-setting during reallocate
		// this.imGroup.position.setX(babs.worldSys.shiftiness.x)
		// this.imGroup.position.setZ(babs.worldSys.shiftiness.z)
		this.imGroup.updateMatrix()
		this.imGroup.updateMatrixWorld()

		Wob.InstancedWobs.set(this.blueprint_id, this)
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
		console.debug('Reallocate:', this.blueprint_id, this.maxCount, '->', maxCount)
		// Expand InstancedMesh to a larger buffer
		this.maxCount = maxCount 
		this.maxCount += Math.max(Math.floor(this.maxCount *0.10), INSTANCED_MAXCOUNT_EXTRA_MIN) // Add +10% or +INSTANCED_EXTRA_MAXCOUNT

		// const wobMesh = this.gltf.scene.children[0].children[0] as Mesh|SkinnedMesh
		let wobMesh :Mesh|SkinnedMesh// = gltf?.scene?.children[0]?.children[0] as Mesh|SkinnedMesh
		this.gltf.scene.traverse(child => objectIsSomeKindOfMesh(child) ? wobMesh = child : null)

		let newInstancedMesh :InstancedMesh|InstancedSkinnedMesh
		if(!this.isAnimated) {
			newInstancedMesh = new InstancedMesh(wobMesh.geometry, wobMesh.material, this.maxCount) // this.MAXcount ...ow.  Because, we want this one new to be even bigger, of course.  That's the point of reallocate...so yes.  
		}
		else if((wobMesh instanceof SkinnedMesh)){ // Type narrowing
			const clonedScene = SkeletonUtils.clone(this.gltf.scene)
			// const clonedMesh = clonedScene.children[0].children[0] as SkinnedMesh
			let clonedMesh :SkinnedMesh// = gltf?.scene?.children[0]?.children[0] as Mesh|SkinnedMesh
			clonedScene.traverse(child => objectIsSomeKindOfMesh(child) && child instanceof SkinnedMesh ? clonedMesh = child : null)

			const singleMaterial = Array.isArray(clonedMesh.material) ? clonedMesh[0].material : clonedMesh.material
			newInstancedMesh = new InstancedSkinnedMesh(clonedMesh.geometry, singleMaterial, this.maxCount)
			// newInstancedMesh.copy(this.instancedMesh)
			newInstancedMesh.bind(clonedMesh.skeleton, clonedMesh.bindMatrix)

			this.silly = clonedMesh
			this.animMixer = new AnimationMixer(clonedScene)
			this.animMixer.clipAction(this.gltf.animations[0]).play()
		}
		wobMesh.visible = false // Hide the original mesh // Is this necessary?

		// Here we only need to copy over InstancedMesh properties, not feim (which remains the same one).
		newInstancedMesh.frustumCulled = this.instancedMesh.frustumCulled
		newInstancedMesh.count = this.instancedMesh.count // Preserve old count (will be recalced later)
		newInstancedMesh.name = this.blueprint_id
		newInstancedMesh.instanceMatrix.setUsage(this.isAnimated ? StreamDrawUsage : DynamicDrawUsage)

		let transferMatrix = new Matrix4()
		for(let i=0; i<this.loadedCount; i++) { // Optimization possible by copying whole matrix? // Maybe not, since this one is now larger
			this.instancedMesh.getMatrixAt(i, transferMatrix)
			newInstancedMesh.setMatrixAt(i, transferMatrix)
		}
		// this.instanceIndexToWob.set( // No need to set, because index will be the same and only InstancedMesh is being remade here, not InstancedWobs.
		// zone.coordToInstanceIndex[ // Same thing
		this.instancedMesh.instanceMatrix.needsUpdate = true // Is this necessary?

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
		// newInstancedMesh.geometry.center() // Not needed a second time, since the geometry doesn't change or get disposed.

		// Remove and dispose
		this.imGroup.remove(this.instancedMesh)
		this.instancedMesh.dispose()
		this.instancedMesh.visible = false

		// Reassign to new one and add
		this.instancedMesh = newInstancedMesh
		this.imGroup.add(this.instancedMesh)


		Wob.InstancedWobs.set(this.blueprint_id, this)
	}

		
	matrixEngCoordFromIndex(index) {
		// Returns world coord; instanced are zero-oriented since they have to be shared across zones, and their 'getMatrixAt()' positions are all local, not world.  So we change them to world using shiftiness.
		const matrix = new Matrix4()
		this.instancedMesh.getMatrixAt(index, matrix)
		const position = new Vector3()
		position.setFromMatrixPosition(matrix)
		// const engWorldCoord = position.add(this.babs.worldSys.shiftiness) // todo shiftiness
		return position

		// // Um that might all be overkill!  Works just as well.  Wait no - only works in-zone.
		// for(let i=0; i<this.instanceMatrix.count *16; i+=16) { // Each instance is a 4x4 matrix; 16 floats
		// 	const x = instanceMatrix.array[i +12]
		// 	const z = instanceMatrix.array[i +14]
		// }
	}
	matrixIndexFromYardCoord(yardCoord :YardCoord) {
		// Returns instanced index
		
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
		// engCoord.sub(this.babs.worldSys.shiftiness) // todo shiftiness
		for(let i=0; i<this.getLoadedCount(); i++) {
			const x = this.instancedMesh.instanceMatrix.array[i *16 +12]// +this.babs.worldSys.shiftiness.x
			const z = this.instancedMesh.instanceMatrix.array[i *16 +14]// +this.babs.worldSys.shiftiness.z
			// console.log((x-2)/4, (z-2)/4, 'vs', yardCoord.x, yardCoord.z)
			if(x === engCoord.x && z === engCoord.z) {
				return i
			}
		}


	}

	heightTweak(engPositionVector :Vector3) {
		return engPositionVector.clone().setY(engPositionVector.y +(this.boundingSize.y /2) -this.sink +this.lift)
	}
}