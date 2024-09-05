import { EventSys } from '@/sys/EventSys'
import { LoaderSys } from '@/sys/LoaderSys'

import { BoxGeometry, BufferGeometry, ClampToEdgeWrapping, Color, Euler, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Line, LinearFilter, LineBasicMaterial, Material, MathUtils, Mesh, MeshLambertMaterial, Object3D, OctahedronGeometry, PointLight, Quaternion, ShaderMaterial, StreamDrawUsage, Texture, TextureLoader, UniformsUtils, Vector4 } from 'three'
import { Vector3 } from 'three'
import { Comp } from '@/comp/Comp'
import { SocketSys } from '@/sys/SocketSys'
import { WorldSys } from '@/sys/WorldSys'

import  { State, DanceState, RunState, BackwardState, WalkState, IdleState, JumpState } from './ControllerState'
import { Matrix4 } from 'three'
import { Babs } from '@/Babs'
import { Zone } from '@/ent/Zone'
import { YardCoord } from './Coord'
import { Wob } from '@/ent/Wob'
import { type WobId, type SharedWob, isMatchingWobIds } from '@/shared/SharedWob'
import { CameraSys } from '@/sys/CameraSys'
import type { Player } from '@/ent/Player'

type FireLight = {
	position: Vector3
	wobId: WobId
}

export class Fire extends Comp {
	static Player :Player

	static LightPool :PointLight[] = []
	static LIGHTPOOL_LQ = 4
	static LIGHTPOOL_HQ = 12
	static LightPoolMax :number
	static FireLights :(ThreeFlame | FireLight)[] = []
	static PointLightIntensity = 400
	static PointLightDistance = 100

	static SMOKE_STARTING_SIZE = 1
	static SMOKE_STARTING_EXTRAHEIGHT = 12
	static SMOKE_PUFFS_PER_LIGHT = 80
	// static SMOKE_MAX_HEIGHT = 475
	static SMOKE_PUFF_CREATION_INTERVAL = 0.2
	static SMOKE_MAX_SCALE = 150
	static SMOKE_SPEED = 12
	static SMOKE_SCALEUP_RATE = 0.07
	static SmokePuffIm :InstancedMesh
	static SmokeRandomizationPool :Vector3[]
	static SmokePuffMaxCount = 0 // gets set during init
	static SmokeLatestIndex = 0


	static flameTex :Texture
	static flameSettings = {
		speed       : 5.0,//1
		magnitude   : 1,//1.3,
		lacunarity  : 2.0,
		gain        : 0.5,
		noiseScaleX : 1.5,//1.0,
		noiseScaleY : 1.5,//2.0,
		noiseScaleZ : 1.5,//1.0,
	}
	flame :ThreeFlame
	
	static Setup(babs :Babs) { // Static initializer
		Fire.LightPoolMax = babs.graphicsQuality ? Fire.LIGHTPOOL_HQ : Fire.LIGHTPOOL_LQ
		Fire.SmokePuffMaxCount = Fire.SMOKE_PUFFS_PER_LIGHT * Fire.LightPoolMax

		// Set up smoke trail singleton // Requires babs.group to be ready
		if(!Fire.SmokePuffIm) {
			const geometry = new OctahedronGeometry(Fire.SMOKE_STARTING_SIZE, 1)
			const material = new MeshLambertMaterial({})
			Fire.SmokePuffIm = new InstancedMesh(geometry, material, Fire.SmokePuffMaxCount)
			Fire.SmokePuffIm.castShadow = false
			Fire.SmokePuffIm.count = 0
			Fire.SmokePuffIm.name = 'smoke'
			Fire.SmokePuffIm.instanceMatrix.setUsage(StreamDrawUsage)
			Fire.SmokePuffIm.frustumCulled = false
			babs.group.add(Fire.SmokePuffIm)

			const smokePuffColors = []
			for (let i = 0; i < Fire.SmokePuffMaxCount; i++) {
				smokePuffColors.push(0.5, 0.5, 0.5)
			}
			const bufferAttr = new InstancedBufferAttribute(new Float32Array(smokePuffColors), 3)
			bufferAttr.needsUpdate = true
			Fire.SmokePuffIm.instanceColor = bufferAttr
		}
	}

	constructor(wob :SharedWob, babs :Babs) {
		super(wob.id(), Fire, babs)
	}

	static async Create(wob :SharedWob, zone :Zone, babs :Babs, scale, yup, asFarWobs :'asFarWobs' = null) {
		// console.log('Fire.Create', asFarWobs)
		// When a fire is added asfarwobs, it should only add light.  As near, only adds flame.

		const yardCoord = YardCoord.Create(wob)
		const engPositionVector = yardCoord.toEngineCoordCentered('withCalcY')
		if(!asFarWobs) {
			console.log('Fire.Create near (add flame only)', asFarWobs)
			// Add flame

			Fire.flameTex = Fire.flameTex || await LoaderSys.CachedFlametex // Ensure texture is loaded
			// flameTex.colorSpace = SRGBColorSpace // This too, though the default seems right
			const fireComp = new Fire(wob, babs)
			fireComp.flame = new ThreeFlame(Fire.flameTex)
			fireComp.flame.material.uniforms.magnitude.value = Fire.flameSettings.magnitude
			fireComp.flame.material.uniforms.lacunarity.value = Fire.flameSettings.lacunarity
			fireComp.flame.material.uniforms.gain.value = Fire.flameSettings.gain
			fireComp.flame.material.uniforms.noiseScale.value = new Vector4(
				Fire.flameSettings.noiseScaleX,
				Fire.flameSettings.noiseScaleY,
				Fire.flameSettings.noiseScaleZ,
				0.3
			)
			fireComp.flame.name = 'fire'
			babs.group.add(fireComp.flame)
			fireComp.flame.scale.set(scale,scale*1.33,scale)

			fireComp.flame.position.setY(engPositionVector.y +yup)
			fireComp.flame.position.setX(engPositionVector.x)
			fireComp.flame.position.setZ(engPositionVector.z)

			// // Add light
			fireComp.flame.wobId = wob.id()
		}
		else {
			console.log('Fire.Create asFarWobs (add light only)', asFarWobs)
			// Add light only
			
			
			const fireLight :FireLight = {
				position: new Vector3(
					engPositionVector.x,
					engPositionVector.y +yup,
					engPositionVector.z
				),
				wobId: wob.id(),
			}
			Fire.FireLights.push(fireLight) // Must come before Fire.LightPool.push, since moveThingsToNearPlayer() shrinks one to the other.

			if(Fire.LightPool.length < Fire.LightPoolMax) {
				const pointLight = new PointLight(0xeb7b54, Fire.PointLightIntensity, Fire.PointLightDistance, 1.5) // 1.5 is more fun casting light on nearby trees
				// pointLight.castShadow = true // Complex?
				pointLight.intensity = Fire.PointLightIntensity *CameraSys.CurrentScale
				pointLight.distance = Fire.PointLightDistance *CameraSys.CurrentScale
				pointLight.name = 'firelight'
				Fire.LightPool.push(pointLight)
				babs.group.add(pointLight)
				// console.log('adding pointlight', pointLight.position, wob)
			}

			babs.renderSys.moveLightsToNearPlayer() // Move on creation so it makes light there fast :)
		}

	}

	static async Delete(deletingWob :SharedWob, babs :Babs, isFarWobs :boolean) {
		// When a fire is removed asfarwobs, it should only remove light.  As near, only removes flame.

		const deletingWobId = deletingWob.id()
		if(isFarWobs) {
			// This means that it was a farwob, so only had a light.
			// Remove light
			console.log(`Fire.Delete for farwob (only light):`, deletingWob)
			// console.log('FireLights before filter', Fire.FireLights)
			Fire.FireLights = Fire.FireLights.filter(fireLight => {
				const fireLightWobId = fireLight.wobId as WobId

				let compareWobId = deletingWobId
				if(isFarWobs) { // For farwobs, allow comparing on comp visible name (eg 'tree twotris') for removal
					compareWobId.blueprint_id = deletingWob.comps?.visible?.farMesh
					if(!compareWobId.blueprint_id) {
						console.warn('Farwob without visible comp, giving up on removing it!', deletingWob)
						return true
					}
				}

				const onlyDeleteFarXorNear = true
				const flameWobMatchesDeletingWob = isMatchingWobIds(fireLightWobId, compareWobId, onlyDeleteFarXorNear)
				return !flameWobMatchesDeletingWob
			})
			// console.log('FireLights after filter', Fire.FireLights)
		}
		else {
			// It was a nearwob, so had only a flame.
			const fireComps = babs.compcats.get(Fire.name) as Fire[] // todo abstract this .get so that I don't have to remember to use Fire.name instead of 'Fire' - because build changes name to _Fire, while it stays Fire on local dev.
			const fireComp = fireComps?.find(fc => {
				const compWobId = fc.idEnt as WobId
				const onlyDeleteFarXorNear = true
				return isMatchingWobIds(compWobId, deletingWobId, onlyDeleteFarXorNear)
			})

			if(!fireComp) {
				// console.warn('Fire.Delete nearwob without fireComp:', deletingWob)
				// This is very typical, eg for everything but fire.  Sneezeweed has Delete() called for instance.
				return
			}
			const zone = babs.ents.get(fireComp.flame.wobId.idzone)
			console.log(`Fire.Delete && fireComp on so deletingWob, on zone:`, deletingWob, zone)

			// Remove flame
			babs.group.remove(fireComp.flame)
			fireComp.flame.geometry.dispose()
			fireComp.flame.visible = false
			if(Array.isArray(fireComp.flame.material)) {
				fireComp.flame.material[0].dispose()
				fireComp.flame.material[0].visible = false
			}
			else {
				fireComp.flame.material.dispose()
				fireComp.flame.material.visible = false
			}
			babs.compcats.set(Fire.name, fireComps.filter(f => f.flame.uuid !== fireComp.flame.uuid)) // This was it.  This was what was needed
		}
	}

	update(dt :number) {
		this.flame?.update(dt *Fire.flameSettings.speed)
	}

}


/**
 * The following section of the code is adapted from https://github.com/mattatz/THREE.Fire, under the MIT License.
 * Copyright (c) 2015 mattatz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

let FlameShader = {

	defines: {
		'ITERATIONS'    : '20',
		'OCTIVES'       : '3'
	},

	uniforms: {
		'flameTex'       : { type : 't',     value : null },
		'color'         : { type : 'c',     value : null },
		'time'          : { type : 'f',     value : 0.0 },
		'seed'          : { type : 'f',     value : 0.0 },
		'invModelMatrix': { type : 'm4',    value : null },
		'scale'         : { type : 'v3',    value : null },

		'noiseScale'    : { type : 'v4',    value : new Vector4(1, 2, 1, 0.3) },
		'magnitude'     : { type : 'f',     value : 1.3 },
		'lacunarity'    : { type : 'f',     value : 2.0 },
		'gain'          : { type : 'f',     value : 0.5 }
	},

	// logarithmicDepthBuffer / logdepthbuf includes like: https://discourse.threejs.org/t/shadermaterial-render-order-with-logarithmicdepthbuffer-is-wrong/49221/3
	vertexShader: `
	#include <common> // for logdepthbuf
	#include <logdepthbuf_pars_vertex> // for logdepthbuf

	varying vec3 vWorldPos;
	void main() {
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

		#include <logdepthbuf_vertex> // for logdepthbuf
	}`,

	fragmentShader: `
	uniform vec3 color;
	uniform float time;
	uniform float seed;
	uniform mat4 invModelMatrix;
	uniform vec3 scale;

	uniform vec4 noiseScale;
	uniform float magnitude;
	uniform float lacunarity;
	uniform float gain;

	uniform sampler2D flameTex;

	#include <common> // for logdepthbuf
	#include <logdepthbuf_pars_fragment> // for logdepthbuf

	varying vec3 vWorldPos;

	// GLSL simplex noise function by ashima / https://github.com/ashima/webgl-noise/blob/master/src/noise3D.glsl
	// -------- simplex noise
	vec3 mod289(vec3 x) {
		return x - floor(x * (1.0 / 289.0)) * 289.0;
	}

	vec4 mod289(vec4 x) {
		return x - floor(x * (1.0 / 289.0)) * 289.0;
	}

	vec4 permute(vec4 x) {
		return mod289(((x * 34.0) + 1.0) * x);
	}

	vec4 taylorInvSqrt(vec4 r) {
		return 1.79284291400159 - 0.85373472095314 * r;
	}

	float snoise(vec3 v) {
		const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
		const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

		// First corner
		vec3 i  = floor(v + dot(v, C.yyy));
		vec3 x0 = v - i + dot(i, C.xxx);

		// Other corners
		vec3 g = step(x0.yzx, x0.xyz);
		vec3 l = 1.0 - g;
		vec3 i1 = min(g.xyz, l.zxy);
		vec3 i2 = max(g.xyz, l.zxy);

		//   x0 = x0 - 0.0 + 0.0 * C.xxx;
		//   x1 = x0 - i1  + 1.0 * C.xxx;
		//   x2 = x0 - i2  + 2.0 * C.xxx;
		//   x3 = x0 - 1.0 + 3.0 * C.xxx;
		vec3 x1 = x0 - i1 + C.xxx;
		vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
		vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

		// Permutations
		i = mod289(i);
		vec4 p = permute(permute(permute(
		i.z + vec4(0.0, i1.z, i2.z, 1.0))
		+ i.y + vec4(0.0, i1.y, i2.y, 1.0))
		+ i.x + vec4(0.0, i1.x, i2.x, 1.0));

		// Gradients: 7x7 points over a square, mapped onto an octahedron.
		// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
		float n_ = 0.142857142857; // 1.0/7.0
		vec3 ns = n_ * D.wyz - D.xzx;

		vec4 j = p - 49.0 * floor(p * ns.z * ns.z); //  mod(p,7*7)

		vec4 x_ = floor(j * ns.z);
		vec4 y_ = floor(j - 7.0 * x_); // mod(j,N)

		vec4 x = x_ * ns.x + ns.yyyy;
		vec4 y = y_ * ns.x + ns.yyyy;
		vec4 h = 1.0 - abs(x) - abs(y);

		vec4 b0 = vec4(x.xy, y.xy);
		vec4 b1 = vec4(x.zw, y.zw);

		//vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
		//vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
		vec4 s0 = floor(b0) * 2.0 + 1.0;
		vec4 s1 = floor(b1) * 2.0 + 1.0;
		vec4 sh = -step(h, vec4(0.0));

		vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
		vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

		vec3 p0 = vec3(a0.xy, h.x);
		vec3 p1 = vec3(a0.zw, h.y);
		vec3 p2 = vec3(a1.xy, h.z);
		vec3 p3 = vec3(a1.zw, h.w);

		//Normalise gradients
		vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
		p0 *= norm.x;
		p1 *= norm.y;
		p2 *= norm.z;
		p3 *= norm.w;

		// Mix final noise value
		vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
		m = m * m;
		return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
	}
	// simplex noise --------

	float turbulence(vec3 p) {
		float sum = 0.0;
		float freq = 1.0;
		float amp = 1.0;

		for(int i = 0; i < OCTIVES; i++) {
			sum += abs(snoise(p * freq)) * amp;
			freq *= lacunarity;
			amp *= gain;
		}

		return sum;
	}

	vec4 samplerFlame (vec3 p, vec4 scale) {
		vec2 st = vec2(sqrt(dot(p.xz, p.xz)), p.y);

		if(st.x <= 0.0 || st.x >= 1.0 || st.y <= 0.0 || st.y >= 1.0) return vec4(0.0);

		p.y -= (seed + time) * scale.w;
		p *= scale.xyz;

		st.y += sqrt(st.y) * magnitude * turbulence(p);

		if(st.y <= 0.0 || st.y >= 1.0) return vec4(0.0);

		return texture2D(flameTex, st);
	}

	vec3 localize(vec3 p) {
		return (invModelMatrix * vec4(p, 1.0)).xyz;
	}

	void main() {
		#include <logdepthbuf_fragment> // for logdepthbuf

		vec3 rayPos = vWorldPos;

		vec3 rayDir = normalize(rayPos - cameraPosition);
		float rayLen = 0.0288 * length(scale.xyz);

		vec4 col = vec4(0.0);

		for(int i = 0; i < ITERATIONS; i++) {
			rayPos += rayDir * rayLen;

			vec3 lp = localize(rayPos);

			lp.y += 0.5;
			lp.xz *= 2.0;
			col += samplerFlame(lp, noiseScale);
		}

		col.a = col.r;

		gl_FragColor = col;
	}

	`

}

class ThreeFlame extends Mesh {
	declare material :ShaderMaterial
	public wobId: WobId

	constructor( flameTex, color = new Color( 0xeeeeee )) {
		const flameMaterial = new ShaderMaterial( {
			defines         : FlameShader.defines,
			uniforms        : UniformsUtils.clone( FlameShader.uniforms ),
			vertexShader    : FlameShader.vertexShader,
			fragmentShader  : FlameShader.fragmentShader,
			transparent     : true,
			depthWrite      : false,
			// depthTest       : false,
			depthTest       : true,
		} )

		
		super(new BoxGeometry( 1.0, 1.0, 1.0 ), flameMaterial) //THREE.Mesh.call( this, geometry, material);
		// super.material

		if(Array.isArray(this.material)) {
			console.warn('Error: Array material')
		}
		
		// initialize uniforms 
		flameTex.magFilter = flameTex.minFilter = LinearFilter
		// flameTex.wrapS = THREE.wrapT = THREE.ClampToEdgeWrapping; // TODO can't set THREE.wrapT
		flameTex.wrapS = ClampToEdgeWrapping
		flameTex.wrapT = ClampToEdgeWrapping
		
		flameMaterial.uniforms.flameTex.value = flameTex
		flameMaterial.uniforms.color.value = color
		flameMaterial.uniforms.invModelMatrix.value = new Matrix4()
		flameMaterial.uniforms.scale.value = new Vector3( 1, 1, 1 )
		flameMaterial.uniforms.seed.value = Math.random() * 19.19

	}

	update(dt) {
		const time = performance.now() /1000 *Fire.flameSettings.speed
		let invModelMatrix = this.material.uniforms.invModelMatrix.value

		// this.updateMatrix()
		this.updateMatrixWorld()

		// invModelMatrix.getInverse( this.matrix );
		invModelMatrix.copy(this.matrixWorld).invert()
	
		if( dt !== undefined ) {
			this.material.uniforms.time.value = time
		}
	
		this.material.uniforms.invModelMatrix.value = invModelMatrix
	
		this.material.uniforms.scale.value = this.scale

	}
	
}