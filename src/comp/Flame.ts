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

type FlameLight = {
	position: Vector3
	wobId: WobId
}

export class Flame extends Comp {
	static Player :Player

	static LightPool :PointLight[] = []
	static LIGHTPOOL_LQ = 4
	static LIGHTPOOL_HQ = 12
	static LightPoolMax :number
	static FlameLights :(ThreeFire | FlameLight)[] = []
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


	static fireTex :Texture
	static flameSettings = {
		speed       : 5.0,//1
		magnitude   : 1,//1.3,
		lacunarity  : 2.0,
		gain        : 0.5,
		noiseScaleX : 1.5,//1.0,
		noiseScaleY : 1.5,//2.0,
		noiseScaleZ : 1.5,//1.0,
	}
	fire :ThreeFire

	constructor(wob :SharedWob, babs :Babs) {
		super(wob.id(), Flame, babs)

		Flame.LightPoolMax = babs.graphicsQuality ? Flame.LIGHTPOOL_HQ : Flame.LIGHTPOOL_LQ

		// Set up smoke trail singleton
		if(!Flame.SmokePuffIm) {
			const geometry = new OctahedronGeometry(Flame.SMOKE_STARTING_SIZE, 1)
			const material = new MeshLambertMaterial({})
			Flame.SmokePuffMaxCount = Flame.SMOKE_PUFFS_PER_LIGHT * Flame.LightPoolMax
			Flame.SmokePuffIm = new InstancedMesh(geometry, material, Flame.SmokePuffMaxCount)
			Flame.SmokePuffIm.castShadow = false
			Flame.SmokePuffIm.count = 0
			Flame.SmokePuffIm.name = 'smoke'
			Flame.SmokePuffIm.instanceMatrix.setUsage(StreamDrawUsage)
			Flame.SmokePuffIm.frustumCulled = false
			babs.group.add(Flame.SmokePuffIm)

			const smokePuffColors = []
			for (let i = 0; i < Flame.SmokePuffMaxCount; i++) {
				smokePuffColors.push(0.5, 0.5, 0.5)
			}
			const bufferAttr = new InstancedBufferAttribute(new Float32Array(smokePuffColors), 3)
			bufferAttr.needsUpdate = true
			Flame.SmokePuffIm.instanceColor = bufferAttr
		}
	}

	static async Create(wob :SharedWob, zone :Zone, babs :Babs, scale, yup, asFarWobs :'asFarWobs' = null) {
		// console.log('Flame.Create', asFarWobs)
		
		// When a flame is added in a nearzone, it adds light+fire+audible.
		// When a flame is added in a farzone, it adds light.

		const yardCoord = YardCoord.Create(wob)
		const engPositionVector = yardCoord.toEngineCoordCentered('withCalcY')
		let flameLight :ThreeFire | FlameLight
		if(!asFarWobs) {
			// Add fire

			Flame.fireTex = Flame.fireTex || await LoaderSys.CachedFiretex // Ensure texture is loaded
			// fireTex.colorSpace = SRGBColorSpace // This too, though the default seems right
			const flameComp = new Flame(wob, babs)
			flameComp.fire = new ThreeFire(Flame.fireTex)
			flameComp.fire.material.uniforms.magnitude.value = Flame.flameSettings.magnitude
			flameComp.fire.material.uniforms.lacunarity.value = Flame.flameSettings.lacunarity
			flameComp.fire.material.uniforms.gain.value = Flame.flameSettings.gain
			flameComp.fire.material.uniforms.noiseScale.value = new Vector4(
				Flame.flameSettings.noiseScaleX,
				Flame.flameSettings.noiseScaleY,
				Flame.flameSettings.noiseScaleZ,
				0.3
			)
			flameComp.fire.name = 'flame'
			babs.group.add(flameComp.fire)
			flameComp.fire.scale.set(scale,scale*1.33,scale)

			flameComp.fire.position.setY(engPositionVector.y +yup)
			flameComp.fire.position.setX(engPositionVector.x)
			flameComp.fire.position.setZ(engPositionVector.z)

			// Add light
			flameComp.fire.wobId = wob.id()
			flameLight = flameComp.fire
		}
		else {
			// Add light only
			flameLight = {
				position: new Vector3(),
				wobId: wob.id(),
			}
			flameLight.position.setY(engPositionVector.y +yup)
			flameLight.position.setX(engPositionVector.x)
			flameLight.position.setZ(engPositionVector.z)
		}

		// When adding farwobs, if there's a light already there, don't add another.
		// We don't care if it's a far or near; we just want to avoid duplicates in the same spot.  
		// On delete, we'll attempt to delete either one.
		const existingLight = Flame.FlameLights.find(fl => {
			const flameLightWobId = fl.wobId as WobId
			return isMatchingWobIds(flameLightWobId, wob.id())
		})
		if(!existingLight) {
			// console.log('Flame.Create NOT existingLight', existingLight)
			// Add a glow of light, or, at least, smoke :p
			Flame.FlameLights.push(flameLight) // Must come before Flame.LightPool.push, since moveThingsToNearPlayer() shrinks one to the other.

			// Init static singletons
			// console.log('Flame.Create', Flame.LightPool.length, Flame.LightPoolMax)
			if(Flame.LightPool.length < Flame.LightPoolMax) {
				const pointLight = new PointLight(0xeb7b54, Flame.PointLightIntensity, Flame.PointLightDistance, 1.5) // 1.5 is more fun casting light on nearby trees
				// pointLight.castShadow = true // Complex?
				pointLight.intensity = Flame.PointLightIntensity *CameraSys.CurrentScale
				pointLight.distance = Flame.PointLightDistance *CameraSys.CurrentScale
				pointLight.name = 'flamelight'
				Flame.LightPool.push(pointLight)
				babs.group.add(pointLight)
				// console.log('adding pointlight', pointLight.position, wob)
			}
		}
		
		babs.renderSys.moveThingsToNearPlayer() // Move on creation so it makes light there fast :)
	}

	// I mean, it's safe to say there will always be fires.  So maybe I should just one-time instantiate the smoke IM.
	


	static async Delete(deletingWob :SharedWob, babs :Babs) {
		const flameComps = babs.compcats.get(Flame.name) as Flame[] // todo abstract this .get so that I don't have to remember to use Flame.name instead of 'Flame' - because build changes name to _Flame, while it stays Flame on local dev.
		
		const deletingWobId = deletingWob.id()

		const flameComp = flameComps?.find(fc => {
			const compWobId = fc.idEnt as WobId
			return isMatchingWobIds(compWobId, deletingWobId)
		})
		if(flameComp) {
			// console.log('Flame.Delete && flameComp')//, flameComps, babs.compcats)
			babs.group.remove(flameComp.fire)

			flameComp.fire.geometry.dispose()
			flameComp.fire.visible = false
			if(Array.isArray(flameComp.fire.material)) {
				flameComp.fire.material[0].dispose()
				flameComp.fire.material[0].visible = false
			}
			else {
				flameComp.fire.material.dispose()
				flameComp.fire.material.visible = false
			}
			
			babs.compcats.set(Flame.name, flameComps.filter(f => f.fire.uuid !== flameComp.fire.uuid)) // This was it.  This was what was needed

			Flame.FlameLights = Flame.FlameLights.filter(flameLight => {
				// console.log('Flame.Delete flameLight filter:', flameLight, deletingWobId)
				const flameLightWobId = flameLight.wobId as WobId
				const fireWobMatchesDeletingWob = isMatchingWobIds(flameLightWobId, deletingWobId)
				return !fireWobMatchesDeletingWob
			})
		}
	}

	update(dt :number) {
		this.fire?.update(dt *Flame.flameSettings.speed)
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

let FireShader = {

	defines: {
		'ITERATIONS'    : '20',
		'OCTIVES'       : '3'
	},

	uniforms: {
		'fireTex'       : { type : 't',     value : null },
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

	uniform sampler2D fireTex;

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

	vec4 samplerFire (vec3 p, vec4 scale) {
		vec2 st = vec2(sqrt(dot(p.xz, p.xz)), p.y);

		if(st.x <= 0.0 || st.x >= 1.0 || st.y <= 0.0 || st.y >= 1.0) return vec4(0.0);

		p.y -= (seed + time) * scale.w;
		p *= scale.xyz;

		st.y += sqrt(st.y) * magnitude * turbulence(p);

		if(st.y <= 0.0 || st.y >= 1.0) return vec4(0.0);

		return texture2D(fireTex, st);
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
			col += samplerFire(lp, noiseScale);
		}

		col.a = col.r;

		gl_FragColor = col;
	}

	`

}

class ThreeFire extends Mesh {
	declare material :ShaderMaterial
	public wobId: WobId

	constructor( fireTex, color = new Color( 0xeeeeee )) {
		const fireMaterial = new ShaderMaterial( {
			defines         : FireShader.defines,
			uniforms        : UniformsUtils.clone( FireShader.uniforms ),
			vertexShader    : FireShader.vertexShader,
			fragmentShader  : FireShader.fragmentShader,
			transparent     : true,
			depthWrite      : false,
			// depthTest       : false,
			depthTest       : true,
		} )

		
		super(new BoxGeometry( 1.0, 1.0, 1.0 ), fireMaterial) //THREE.Mesh.call( this, geometry, material);
		// super.material

		if(Array.isArray(this.material)) {
			console.warn('Error: Array material')
		}
		
		// initialize uniforms 
		fireTex.magFilter = fireTex.minFilter = LinearFilter
		// fireTex.wrapS = THREE.wrapT = THREE.ClampToEdgeWrapping; // TODO can't set THREE.wrapT
		fireTex.wrapS = ClampToEdgeWrapping
		fireTex.wrapT = ClampToEdgeWrapping
		
		fireMaterial.uniforms.fireTex.value = fireTex
		fireMaterial.uniforms.color.value = color
		fireMaterial.uniforms.invModelMatrix.value = new Matrix4()
		fireMaterial.uniforms.scale.value = new Vector3( 1, 1, 1 )
		fireMaterial.uniforms.seed.value = Math.random() * 19.19

	}

	update(dt) {
		const time = performance.now() /1000 *Flame.flameSettings.speed
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