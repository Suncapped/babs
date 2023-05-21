import { EventSys } from '@/sys/EventSys'
import { LoaderSys } from '@/sys/LoaderSys'
import { log } from '@/Utils'
import { BoxGeometry, BufferGeometry, ClampToEdgeWrapping, Color, Euler, Line, LinearFilter, LineBasicMaterial, MathUtils, Mesh, PointLight, Quaternion, Raycaster, ShaderMaterial, sRGBEncoding, Texture, TextureLoader, UniformsUtils, Vector4 } from 'three'
import { Vector3 } from 'three'
import { Comp } from '@/comp/Comp'
import { SocketSys } from '@/sys/SocketSys'
import { WorldSys } from '@/sys/WorldSys'

import  { State, DanceState, RunState, BackwardState, WalkState, IdleState, JumpState } from './ControllerState'
import { Matrix4 } from 'three'
import { isPowerOfTwo } from 'three/src/math/MathUtils'
import { Babs } from '@/Babs'
import { Zone } from '@/ent/Zone'
import { YardCoord } from './Coord'
import { Wob } from '@/ent/Wob'
import type { WobId, SharedWob } from '@/shared/SharedWob'


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

	vertexShader: [
		'varying vec3 vWorldPos;',
		'void main() {',
		'gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
		'vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;',
		'}'
	].join('\n'),

	fragmentShader: [
		'uniform vec3 color;',
		'uniform float time;',
		'uniform float seed;',
		'uniform mat4 invModelMatrix;',
		'uniform vec3 scale;',

		'uniform vec4 noiseScale;',
		'uniform float magnitude;',
		'uniform float lacunarity;',
		'uniform float gain;',

		'uniform sampler2D fireTex;',

		'varying vec3 vWorldPos;',

		// GLSL simplex noise function by ashima / https://github.com/ashima/webgl-noise/blob/master/src/noise3D.glsl
		// -------- simplex noise
		'vec3 mod289(vec3 x) {',
		'return x - floor(x * (1.0 / 289.0)) * 289.0;',
		'}',

		'vec4 mod289(vec4 x) {',
		'return x - floor(x * (1.0 / 289.0)) * 289.0;',
		'}',

		'vec4 permute(vec4 x) {',
		'return mod289(((x * 34.0) + 1.0) * x);',
		'}',

		'vec4 taylorInvSqrt(vec4 r) {',
		'return 1.79284291400159 - 0.85373472095314 * r;',
		'}',

		'float snoise(vec3 v) {',
		'const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);',
		'const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);',

		// First corner
		'vec3 i  = floor(v + dot(v, C.yyy));',
		'vec3 x0 = v - i + dot(i, C.xxx);',

		// Other corners
		'vec3 g = step(x0.yzx, x0.xyz);',
		'vec3 l = 1.0 - g;',
		'vec3 i1 = min(g.xyz, l.zxy);',
		'vec3 i2 = max(g.xyz, l.zxy);',

		//   x0 = x0 - 0.0 + 0.0 * C.xxx;
		//   x1 = x0 - i1  + 1.0 * C.xxx;
		//   x2 = x0 - i2  + 2.0 * C.xxx;
		//   x3 = x0 - 1.0 + 3.0 * C.xxx;
		'vec3 x1 = x0 - i1 + C.xxx;',
		'vec3 x2 = x0 - i2 + C.yyy;', // 2.0*C.x = 1/3 = C.y
		'vec3 x3 = x0 - D.yyy;',      // -1.0+3.0*C.x = -0.5 = -D.y

		// Permutations
		'i = mod289(i); ',
		'vec4 p = permute(permute(permute( ',
		'i.z + vec4(0.0, i1.z, i2.z, 1.0))',
		'+ i.y + vec4(0.0, i1.y, i2.y, 1.0)) ',
		'+ i.x + vec4(0.0, i1.x, i2.x, 1.0));',

		// Gradients: 7x7 points over a square, mapped onto an octahedron.
		// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
		'float n_ = 0.142857142857;', // 1.0/7.0
		'vec3 ns = n_ * D.wyz - D.xzx;',

		'vec4 j = p - 49.0 * floor(p * ns.z * ns.z);', //  mod(p,7*7)

		'vec4 x_ = floor(j * ns.z);',
		'vec4 y_ = floor(j - 7.0 * x_);', // mod(j,N)

		'vec4 x = x_ * ns.x + ns.yyyy;',
		'vec4 y = y_ * ns.x + ns.yyyy;',
		'vec4 h = 1.0 - abs(x) - abs(y);',

		'vec4 b0 = vec4(x.xy, y.xy);',
		'vec4 b1 = vec4(x.zw, y.zw);',

		//vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
		//vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
		'vec4 s0 = floor(b0) * 2.0 + 1.0;',
		'vec4 s1 = floor(b1) * 2.0 + 1.0;',
		'vec4 sh = -step(h, vec4(0.0));',

		'vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;',
		'vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;',

		'vec3 p0 = vec3(a0.xy, h.x);',
		'vec3 p1 = vec3(a0.zw, h.y);',
		'vec3 p2 = vec3(a1.xy, h.z);',
		'vec3 p3 = vec3(a1.zw, h.w);',

		//Normalise gradients
		'vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));',
		'p0 *= norm.x;',
		'p1 *= norm.y;',
		'p2 *= norm.z;',
		'p3 *= norm.w;',

		// Mix final noise value
		'vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);',
		'm = m * m;',
		'return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));',
		'}',
		// simplex noise --------

		'float turbulence(vec3 p) {',
		'float sum = 0.0;',
		'float freq = 1.0;',
		'float amp = 1.0;',
            
		'for(int i = 0; i < OCTIVES; i++) {',
		'sum += abs(snoise(p * freq)) * amp;',
		'freq *= lacunarity;',
		'amp *= gain;',
		'}',

		'return sum;',
		'}',

		'vec4 samplerFire (vec3 p, vec4 scale) {',
		'vec2 st = vec2(sqrt(dot(p.xz, p.xz)), p.y);',

		'if(st.x <= 0.0 || st.x >= 1.0 || st.y <= 0.0 || st.y >= 1.0) return vec4(0.0);',

		'p.y -= (seed + time) * scale.w;',
		'p *= scale.xyz;',

		'st.y += sqrt(st.y) * magnitude * turbulence(p);',

		'if(st.y <= 0.0 || st.y >= 1.0) return vec4(0.0);',
           
		'return texture2D(fireTex, st);',
		'}',

		'vec3 localize(vec3 p) {',
		'return (invModelMatrix * vec4(p, 1.0)).xyz;',
		'}',

		'void main() {',
		'vec3 rayPos = vWorldPos;',

		'vec3 rayDir = normalize(rayPos - cameraPosition);',
		'float rayLen = 0.0288 * length(scale.xyz);',

		'vec4 col = vec4(0.0);',

		'for(int i = 0; i < ITERATIONS; i++) {',
		'rayPos += rayDir * rayLen;',

		'vec3 lp = localize(rayPos);',

		'lp.y += 0.5;',
		'lp.xz *= 2.0;',
		'col += samplerFire(lp, noiseScale);',
		'}',

		'col.a = col.r;',

		'gl_FragColor = col;',
		'}',

	].join('\n')

}

class ThreeFire extends Mesh {
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

		// initialize uniforms 
		fireTex.magFilter = fireTex.minFilter = LinearFilter
		// fireTex.wrapS = THREE.wrapT = THREE.ClampToEdgeWrapping; // TODO can't set THREE.wrapT
		fireTex.wrapS = ClampToEdgeWrapping
		
		fireMaterial.uniforms.fireTex.value = fireTex
		fireMaterial.uniforms.color.value = color
		fireMaterial.uniforms.invModelMatrix.value = new Matrix4()
		fireMaterial.uniforms.scale.value = new Vector3( 1, 1, 1 )
		fireMaterial.uniforms.seed.value = Math.random() * 19.19

	}

	update(dt) {
		const time = performance.now() /1000 *Flame.settings.speed // todo
		let invModelMatrix = this.material.uniforms.invModelMatrix.value

		this.updateMatrix()
		// invModelMatrix.getInverse( this.matrix );
		invModelMatrix.copy( this.matrix ).invert()
	
		if( dt !== undefined ) {
			this.material.uniforms.time.value = time
		}
	
		this.material.uniforms.invModelMatrix.value = invModelMatrix
	
		this.material.uniforms.scale.value = this.scale

	}
	
}



export class Flame extends Comp {

	static player

	static lightPool = []
	static LIGHT_POOL_MAX = 4

	static wantsLight = []

	constructor(wob :SharedWob, babs) {
		super(wob.id(), Flame, babs)
	}

	fire :ThreeFire

	points
	line

	static settings = {
		speed       : 5.0,//1
		magnitude   : 1,//1.3,
		lacunarity  : 2.0,
		gain        : 0.5,
		noiseScaleX : 1.5,//1.0,
		noiseScaleY : 1.5,//2.0,
		noiseScaleZ : 1.5,//1.0,
	}

	static fireTex :Texture
	static async Create(wob :SharedWob, zone :Zone, babs :Babs, scale, yup) {
		// log('Flame.Create, right before wantslight.push', wob.name)
		const com = new Flame(wob, babs)

		// Init static singletons
		if(Flame.lightPool.length < Flame.LIGHT_POOL_MAX) {
			const pointLight = new PointLight(0xff0000, 1, 1000, 4)
			pointLight.name = 'flamelight'
			Flame.lightPool.push(pointLight)
			babs.group.add(pointLight)
		}
		if(!Flame.player) Flame.player = babs.ents.get(babs.idSelf)

		Flame.fireTex = Flame.fireTex || await new TextureLoader().loadAsync(`${babs.urlFiles}/texture/firetex.png`)
		// fireTex.colorSpace = SRGBColorSpace // This too, though the default seems right

		com.fire = new ThreeFire(Flame.fireTex)
		com.fire.name = 'flame'
		babs.group.add(com.fire)

		com.fire.scale.set(scale,scale*1.33,scale)

		const yardCoord = YardCoord.Create(wob)

		// const rayPos = zone.rayHeightAt(yardCoord)
		const engCoordCentered = yardCoord.toEngineCoordCentered()
		const engPositionVector = new Vector3(engCoordCentered.x, zone.engineHeightAt(yardCoord), engCoordCentered.z)
		// engPositionVector.add(new Vector3(-babs.worldSys.shiftiness.x, 0, -babs.worldSys.shiftiness.z))

		com.fire.position.setY(engPositionVector.y +yup)
		com.fire.position.setX(engPositionVector.x)// +1.96) // 1.96 because torch was slightly offcenter :p  
		com.fire.position.setZ(engPositionVector.z)// +2)

		com.fire.material.uniforms.magnitude.value = Flame.settings.magnitude
		com.fire.material.uniforms.lacunarity.value = Flame.settings.lacunarity
		com.fire.material.uniforms.gain.value = Flame.settings.gain
		com.fire.material.uniforms.noiseScale.value = new Vector4(
			Flame.settings.noiseScaleX,
			Flame.settings.noiseScaleY,
			Flame.settings.noiseScaleZ,
			0.3
		)

		// Add a glow of light
		// console.log('Flame.wantsLight.push', com.fire.uuid)
		Flame.wantsLight.push(com.fire)

		// Debug flames not showing!
		// const material = new LineBasicMaterial({ color: 0xff00ff })
		// const geometry = new BufferGeometry
		// com.points = [];
		// com.points.push( babs.group.position )
		// com.points.push( babs.group.position )
		// geometry.setFromPoints(com.points)
		// com.line = new Line( geometry, material )
		// com.line.name = 'myline'
		// babs.group.add( com.line )

		return com
	}


	static async Delete(deletingWob :SharedWob, babs :Babs) {
		const flameComps = babs.compcats.get(Flame.name) as Flame[] // todo abstract this .get so that I don't have to remember to use Flame.name instead of 'Flame' - because build changes name to _Flame, while it stays Flame on local dev.
		// log('flameComps', flameComps, this.babs.compcats)
		const flame = flameComps?.find(fc => {
			return (fc.idEnt as WobId).idzone === deletingWob.id().idzone
				&& (fc.idEnt as WobId).x === deletingWob.id().x
				&& (fc.idEnt as WobId).z === deletingWob.id().z
				&& (fc.idEnt as WobId).blueprint_id === deletingWob.id().blueprint_id
		})
		if(flame) {
			const oldlen = Flame.wantsLight.length
			// log('flame to remove', flame, Flame.wantsLight.length)
			Flame.wantsLight = Flame.wantsLight.filter(f => {
				// console.log('fl', f.uuid, flame.fire.uuid)
				return f.uuid !== flame.fire.uuid
			})
			babs.group.remove(flame.fire)

			flame.fire.geometry.dispose()
			flame.fire.visible = false
			if(Array.isArray(flame.fire.material)) {
				flame.fire.material[0].dispose()
				flame.fire.material[0].visible = false
			}
			else {
				flame.fire.material.dispose()
				flame.fire.material.visible = false
			}
			
			babs.compcats.set(Flame.name, flameComps.filter(f => f.fire.uuid !== flame.fire.uuid)) // This was it.  This was what was needed
		}
	}

	update(dt) {

		// if(this.babs?.inputSys?.playerSelf?.controller?.target && this.line) {
			
		// 	const positions = this.line.geometry.attributes.position.array
		// 	const temppos = this.babs.inputSys.playerSelf.controller.target.position//new Vector3(35.78, 8361.13 +10, 77.47)
		// 	const temppos2 = this.fire.position//new Vector3(55.78, 8361.13 +40, 67.47)
		// 	positions[0 +0] = temppos.x
		// 	positions[0 +1] = temppos.y
		// 	positions[0 +2] = temppos.z
		// 	positions[0 +3] = temppos2.x
		// 	positions[0 +4] = temppos2.y
		// 	positions[0 +5] = temppos2.z
			
		// 	this.line.geometry.attributes.position.needsUpdate = true
		// 	this.line.geometry.computeBoundingBox()
		// 	this.line.geometry.computeBoundingSphere()
		// }

		this.fire?.update(dt *Flame.settings.speed)

	}

}


