import { BufferGeometry, DataTexture, FloatType, InstancedBufferAttribute, Material, Matrix4, RGBAFormat, ShaderChunk, SkinnedMesh } from 'three'

const _instanceLocalMatrix = /*@__PURE__*/ new Matrix4()
const _instanceWorldMatrix = /*@__PURE__*/ new Matrix4()
const _offsetMatrix = /*@__PURE__*/ new Matrix4()
const _identityMatrix = /*@__PURE__*/ new Matrix4()
const _instanceIntersects = []

let patchedChunks = false

export class InstancedSkinnedMesh extends SkinnedMesh {
	instanceMatrix :InstancedBufferAttribute
	instanceColor :InstancedBufferAttribute
	instanceBones :Float32Array
	_mesh :SkinnedMesh
	isInstancedMesh :boolean

	maxCount :number// It shall differ from InstancedMesh because I'm going to use maxCount, since some of the funs below happen after wobs are added, which is when increaseLoadedCount() is called.  We want the max to be preserved for setting bones and data texture.
	count :number // This actually gets read by the js engine like this: getInstanceCount( renderObject ) { [...] return geometry.isInstancedBufferGeometry ? geometry.instanceCount : ( object.isInstancedMesh ? object.count : 1 ) } // So this .count will thereby determine the number of instances displayed.

	constructor(geometry :BufferGeometry, material :Material|Material[], maxCount :number) {
		super(geometry, material)

		// console.log('---- Initing count', maxCount)
		this.maxCount = maxCount
		this.count = maxCount // We can init to this, and app can decide whether to lower it

		this.instanceMatrix = new InstancedBufferAttribute(new Float32Array(maxCount * 16), 16)
		this.instanceColor = null
		this.instanceBones = null

		this.frustumCulled = false

		this._mesh = null
		this.isInstancedMesh = true // PS this is also required by engine for instancing, see above comments

		const bind = this.bind.bind(this)
		this.bind = function (skeleton, bindMatrix) {
			bind(skeleton, bindMatrix)

			// @ts-ignore
			this.skeleton.update = (instanceBones, id) => {
				const bones = this.skeleton.bones
				const boneInverses = this.skeleton.boneInverses
				const boneMatrices = instanceBones || this.skeleton.boneMatrices
				const boneTexture = this.skeleton.boneTexture
				const instanceId = id || 0

				for (let i = 0, il = bones.length; i < il; i++) {
					const matrix = bones[i] ? bones[i].matrixWorld :_identityMatrix

					_offsetMatrix.multiplyMatrices(matrix, boneInverses[i])
					_offsetMatrix.toArray(boneMatrices, (i +instanceId *bones.length) *16)
				}

				if (boneTexture !== null) {
					boneTexture.needsUpdate = true
				}
			}

			// @ts-ignore
			this.skeleton.computeBoneTexture = this.skeleton.computeInstancedBoneTexture = () => {
				// console.log('--- Running (count) bind set texture', this.maxCount)
				this.skeleton.boneTexture = new DataTexture(
					this.instanceBones,
					this.skeleton.bones.length * 4,
					this.maxCount,
					RGBAFormat,
					FloatType,
				)
				this.skeleton.boneTexture.needsUpdate = true
			}
		}

		if (!patchedChunks) {
			// console.log('---patching---')
			patchedChunks = true

			ShaderChunk.skinning_pars_vertex = /* glsl */ `
        #ifdef USE_SKINNING

          uniform mat4 bindMatrix;
          uniform mat4 bindMatrixInverse;

          uniform highp sampler2D boneTexture;
          uniform int boneTextureSize;

          mat4 getBoneMatrix( const in float i ) {

          #ifdef USE_INSTANCING
              
              int j = 4 * int(i);
              vec4 v1 = texelFetch(boneTexture, ivec2( j, gl_InstanceID ), 0);
              vec4 v2 = texelFetch(boneTexture, ivec2( j + 1, gl_InstanceID ), 0);
              vec4 v3 = texelFetch(boneTexture, ivec2( j + 2, gl_InstanceID ), 0);
              vec4 v4 = texelFetch(boneTexture, ivec2( j + 3, gl_InstanceID ), 0);
              
          #else

            float j = i * 4.0;
            float x = mod( j, float( boneTextureSize ) );
            float y = floor( j / float( boneTextureSize ) );

            float dx = 1.0 / float( boneTextureSize );
            float dy = 1.0 / float( boneTextureSize );

            y = dy * ( y + 0.5 );

            vec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );
            vec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );
            vec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );
            vec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );

          #endif

            mat4 bone = mat4( v1, v2, v3, v4 );

            return bone;

          }

        #endif
      `
		}
	}

	copy(source) { // May not work?  maxCount could be weird here since stuff is already init'ed
		super.copy(source)

		if (source.isInstancedMesh) {
			this.instanceMatrix.copy(source.instanceMatrix)

			if (source.instanceColor !== null)
				this.instanceColor = source.instanceColor.clone()

			this.maxCount = source.count
			this.count = source.count
		}

		return this
	}

	getColorAt(index :number, color) {
		color.fromArray(this.instanceColor.array, index *3)
	}

	getMatrixAt(index :number, matrix) {
		matrix.fromArray(this.instanceMatrix.array, index *16)
	}

	raycast(raycaster, intersects) {
		const matrixWorld = this.matrixWorld
		const raycastTimes = this.count

		if (this._mesh === null) {
			this._mesh = new SkinnedMesh(this.geometry, this.material)
			this._mesh.copy(this)
		}

		const _mesh = this._mesh

		if (_mesh.material === undefined) return

		for (let instanceId=0; instanceId < raycastTimes; instanceId++) {
			this.getMatrixAt(instanceId, _instanceLocalMatrix)

			_instanceWorldMatrix.multiplyMatrices(matrixWorld, _instanceLocalMatrix)

			_mesh.matrixWorld = _instanceWorldMatrix

			_mesh.raycast(raycaster, _instanceIntersects)

			for (let i=0, l=_instanceIntersects.length; i < l; i++) {
				const intersect = _instanceIntersects[i]
				intersect.instanceId = instanceId
				intersect.object = this
				intersects.push(intersect)
			}

			_instanceIntersects.length = 0
		}
	}

	setColorAt(index :number, color) {
		if (this.instanceColor === null) {
			this.instanceColor = new InstancedBufferAttribute(new Float32Array(this.instanceMatrix.count *3), 3)
		}

		color.toArray(this.instanceColor.array, index *3)
	}

	setMatrixAt(index :number, matrix) {
		matrix.toArray(this.instanceMatrix.array, index *16)
	}

	setBonesAt(index :number, skeleton) {
		skeleton = skeleton || this.skeleton

		const size = skeleton.bones.length *16

		if (this.instanceBones === null) {
			// console.log('--- Bones setting instanceBones (count)', this.maxCount)
			this.instanceBones = new Float32Array(size * this.maxCount)
		}

		skeleton.update(this.instanceBones, index)
	}

	updateMorphTargets() {}

	dispose() {
		// @ts-ignore
		this.dispatchEvent({ type: 'dispose' })
	}

	computeBoundingSphere() {
		super.computeBoundingSphere()
	}

	// // Getter and setter for _count
	// get count() {
	// 	console.log('---------------- GETTING count', JSON.stringify(this._count))
	// 	return this._count
	// }
	// set count(value) {
	// 	console.log('---------------- SETTING count', JSON.stringify(this._count), '->', JSON.stringify(value))
	// 	this._count = value
	// 	this.instanceMatrix.needsUpdate = true
	// }


}
