import * as Utils from './../Utils'
import { 
	PlaneGeometry, 
	MeshBasicMaterial, 
	Mesh,
	Color,
	DoubleSide,
	FrontSide,
	MeshPhongMaterial,
	Vector3,
	Raycaster,
	Fog,
	HemisphereLightHelper,
	HemisphereLight,
	DirectionalLight,
	DirectionalLightHelper,
	SphereGeometry,
	ShaderMaterial,
	BackSide,
	PerspectiveCamera,
	WebGLRenderer,
	PCFSoftShadowMap,
	BoxBufferGeometry,
	AxesHelper,
	LineBasicMaterial,
	TubeGeometry,
	BufferGeometry,
	Vector2,
	CameraHelper,
	AmbientLight,
	MathUtils,
	BufferAttribute,
	MeshStandardMaterial,
	Float32BufferAttribute,
	BoxGeometry,
	MeshLambertMaterial,
	InstancedMesh,
	Object3D,
	DynamicDrawUsage,
	Matrix4,
	Quaternion,
	Euler,
	InstancedBufferAttribute,
	StreamDrawUsage,
	TextureLoader,
	FogExp2,
	NeverDepth,
	BasicShadowMap,
	PCFShadowMap,
	VSMShadowMap,
	Material,
	NearestFilter,
	IcosahedronGeometry,
} from 'three'
import { log } from './../Utils'
import { WireframeGeometry } from 'three'
import { LineSegments } from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { debugMode } from '../stores'

import { Wob } from '@/ent/Wob'
import { EventSys } from './EventSys'
import * as SunCalc from 'suncalc'
// import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader'
// import { CSM } from 'three/examples/jsm/csm/CSM.js';

import '@stardazed/streams-polyfill'
import { YardCoord } from '@/comp/Coord'
import { Babs } from '@/Babs'
import { Zone } from '@/ent/Zone'
import { Player } from '@/ent/Player'
import { DateTime } from 'luxon'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader'

export class WorldSys {

	static ZoneLength = 1000
	
	static Yard = 4
	static Plot = WorldSys.Yard *10 // 40; 10 tiles
	static Acre = WorldSys.Plot *5 // 200; 5 plots
	
	static MAX_VIEW_DISTANCE = 1_000_000 // ~200 miles
	static DAYSKY_SCALE = 900_000
	static NIGHTSKY_SIZE = 800_000

	static ZoneSegments = 25

	static ZoneTerrainMin = new Vector3(0,0,0)
	static ZoneTerrainMax = new Vector3(1000,10_000,1000)

	static FogDefaultDensity = 0.0000012

	babs :Babs
	renderer

	dirLight
	dirLightHelper
	// lightShift = new Vector3((- 1) *30, 0.25 *30, 1 *30) // for re-use
	hemiLight

	sky
	sunPosition
	effectController = {
		turbidity: 10,
		rayleigh: 1,//3,
		mieCoefficient: 0.005,
		mieDirectionalG: 0.5, // 0.7,
		elevation: 75,//2,
		azimuth: 180,
		// exposure: renderer.toneMappingExposure
	}

	daysky :Sky
	nightsky :Mesh & {material: Material[]}

	cameraHelper :CameraHelper

	StringifyLandcover = {
		12: 'SnowIceTundra',
		31: 'BarrenRockSandClay',
		
		41: 'ForestDeciduous',
		42: 'ForestEvergreen',
		43: 'ForestMixed',

		52: 'ShrubAndScrub',
		71: 'Grassland',

		90: 'WetlandWoody',
		95: 'WetlandHerbacious',

		108: 'Lake',
		112: 'LakeShore',
		116: 'River',
		120: 'RiverShore',
		124: 'StreamSmall',
		128: 'StreamMedium',
		132: 'StreamLarge',
		136: 'StreamShore',

		200: 'Cliff',
	}

	libo = 0 // ground nighttime lightness boost
	colorFromLc = {
		// grass: new Color().setHSL(98/360, 100/100, 20/100),
		// dirt: new Color().setHSL(35/360, 40/100, 40/100),
		// sand: new Color().setHSL(49/360, 37/100, 68/100),

		SnowIceTundra: new Color().setHSL(75/360, 3/100, (74+this.libo)/100), // light gray
		BarrenRockSandClay: new Color().setHSL(39/360, 24/100, (64+this.libo)/100), // tan

		ForestDeciduous: new Color().setHSL(73/360, 22/100, (37+this.libo)/100), // green
		ForestEvergreen: new Color().setHSL(92/360, 40/100, (23+this.libo)/100), // dark green
		ForestMixed: new Color().setHSL(80/360, 30/100, (30+this.libo)/100), // in-between ish

		ShrubAndScrub: new Color().setHSL(85/360, 18/100, (47+this.libo)/100), // Browner light green
		Grassland: new Color().setHSL(63/360, 15/100, (50+this.libo)/100), // Light green

		WetlandWoody: new Color().setHSL(8/360, 19/100, (37+this.libo)/100), // Brownish
		WetlandHerbacious: new Color().setHSL(10/360, 14/100, (47+this.libo)/100), // Brownish lighter

		Lake: new Color().setHSL(222/360, 39/100, (34+this.libo)/100),
		LakeShore: new Color().setHSL(51/360, 39/100, (34+this.libo)/100),
		River: new Color().setHSL(222/360, 39/100, (34+this.libo)/100),
		RiverShore: new Color().setHSL(51/360, 39/100, (34+this.libo)/100),
		StreamSmall: new Color().setHSL(222/360, 39/100, (34+this.libo)/100),
		StreamMedium: new Color().setHSL(222/360, 39/100, (34+this.libo)/100),
		StreamLarge: new Color().setHSL(222/360, 39/100, (34+this.libo)/100),
		StreamShore: new Color().setHSL(51/360, 39/100, (34+this.libo)/100),

		Cliff: new Color().setHSL(13/360, 61/100, (24+this.libo)/100),
	}

	WaterTypes = [
		'Lake',
		'River',
		'Streamsmall',
		'Streammedium',
		'Streamlarge',
	]
	ShoreTypes = [
		'Lakeshore',
		'Rivershore',
		'Streamshore',
	]

	
	constructor(renderer, babs, camera) {
		EventSys.Subscribe(this)

		this.babs = babs
		this.renderer = renderer


		Object.keys(this.colorFromLc).forEach(key => this.colorFromLc[key].convertSRGBToLinear())


		// Old sky
		// this.babs.scene.background = new Color().setHSL( 0.6, 0, 1 )
		// const vertexShader = document.getElementById( 'vertexShader' ).textContent
		// const fragmentShader = document.getElementById( 'fragmentShader' ).textContent
		// const uniforms = {
		//     "topColor": { value: new Color( 0x0077ff ) },
		//     "bottomColor": { value: new Color( 0xffffff ) },
		//     "offset": { value: 33 },
		//     "exponent": { value: 0.6 }
		// }
		// uniforms.topColor.value.copy( hemiLight.color )
		// this.babs.scene.fog.color.copy( uniforms[ "bottomColor" ].value )
		// const skyGeo = new SphereGeometry( 4000, 32, 15 )
		// const skyMat = new ShaderMaterial( {
		//     uniforms: uniforms,
		//     vertexShader: vertexShader,
		//     fragmentShader: fragmentShader,
		//     side: BackSide
		// } )
		// const sky = new Mesh( skyGeo, skyMat )
		// this.babs.group.add( sky )


		// New sky (not lighting)
		this.daysky = new Sky()
		this.daysky.name = 'daysky'
		this.daysky.scale.setScalar(WorldSys.DAYSKY_SCALE )
		this.babs.group.add(this.daysky)
		
		this.sunPosition = new Vector3()

		this.effectController.exposure = renderer.toneMappingExposure
		const updateSkyValues = () => {


			const uniforms = this.daysky.material.uniforms
			uniforms[ 'turbidity' ].value = this.effectController.turbidity
			uniforms[ 'rayleigh' ].value = this.effectController.rayleigh
			uniforms[ 'mieCoefficient' ].value = this.effectController.mieCoefficient
			uniforms[ 'mieDirectionalG' ].value = this.effectController.mieDirectionalG

			const phi = MathUtils.degToRad( 90 - this.effectController.elevation )
			const theta = MathUtils.degToRad( this.effectController.azimuth )
			this.sunPosition.setFromSphericalCoords( 1, phi, theta )

			uniforms['sunPosition'].value.copy( this.sunPosition )

			renderer.toneMappingExposure = this.effectController.exposure
			renderer.render( this.babs.scene, camera )

		}


		// import { GUI } from 'dat.gui'
		// const gui = new GUI()
		// gui.add( this.effectController, 'turbidity', 0.0, 20.0, 0.1 ).onChange( updateSkyValues )
		// gui.add( this.effectController, 'rayleigh', 0.0, 4, 0.001 ).onChange( updateSkyValues )
		// gui.add( this.effectController, 'mieCoefficient', 0.0, 0.1, 0.001 ).onChange( updateSkyValues )
		// gui.add( this.effectController, 'mieDirectionalG', 0.0, 1, 0.001 ).onChange( updateSkyValues )
		// gui.add( this.effectController, 'elevation', 0, 90, 0.1 ).onChange( updateSkyValues )
		// gui.add( this.effectController, 'azimuth', - 180, 180, 0.1 ).onChange( updateSkyValues )
		// gui.add( this.effectController, 'exposure', 0, 1, 0.0001 ).onChange( updateSkyValues )


		updateSkyValues()


		// New lighting
		// Might want ambient light in addition to hemispheric?  Maybe for indoors?
		// let light = new AmbientLight(0xFFFFFF, 1)
		// this.babs.group.add(light)

		this.hemiLight = new HemisphereLight(0xffffff, 0xffffff, 0)
		this.hemiLight.name = 'hemilight'
		const hemiLightHelper = new HemisphereLightHelper(this.hemiLight, 10)
		hemiLightHelper.name = 'three-helper'
		this.babs.group.add(hemiLightHelper)
		this.hemiLight.color.setHSL(45/360, 1, 0.5).convertSRGBToLinear() // light from above
		this.hemiLight.groundColor.setHSL(245/360, 92/100, 0.5).convertSRGBToLinear() // from below
		this.babs.group.add(this.hemiLight)

		this.babs.scene.fog = new FogExp2(
			new Color(), 
			// 1, 
			// WorldSys.MAX_VIEW_DISTANCE
			WorldSys.FogDefaultDensity // Default is 0.00025 // Has to be low enough to see stars/skybox
		)
		// May have to do like sun.material.fog = false ?  Not for sun since it's shader, but perhaps for other far things
		// https://www.youtube.com/watch?v=k1zGz55EqfU Fog video, would be great for rain


		// nightsky Skybox

		// const sides = ['ft', 'bk', 'up', 'dn', 'rt', 'lf'];
		// this is actually going to be +x/-x, +y/-y, +z/-z!
		// https://miro.medium.com/max/528/1*rC0T9uCBds1hxOBiUfbm6A.png
		// https://codinhood.com/static/78e5f34c1ceb1e205cc8cc00b01a7d53/14e05/skybox2.png
		// Cool: https://matheowis.github.io/HDRI-to-CubeMap/

		// https://github.com/Stellarium/stellarium/issues/2223
		// "If I map west to front (+Z), east to back (-Z), top to up (+Y), bottom to down (-Y) these all form a seamless whole. [...] if I map north to left (+X) and south to right (-X)"

		// 				+x		-x		+y			-y		+z		-z
		const dayCheckInterval = 1_000
		const delayLoadNightsky = () => {
			if(this.isDaytimeWithShadows) {
				// Wait until night to load
				setTimeout(delayLoadNightsky, dayCheckInterval)
				return
			}
			log.info('loading stars')
			
			const sides = ['north', 'south', 'top', 'bottom', 'west', 'east'] // +y as north

			// const tl = new TextureLoader()
			let ktx2Loader = new KTX2Loader()
			// ktx2Loader.setTranscoderPath('/node_modules/three/examples/jsm/libs/basis/');
			// ktx2Loader.setTranscoderPath('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/libs/basis/')
			ktx2Loader.setTranscoderPath('/basis/')
			// ktx2Loader.setTranscoderPath('https://raw.githubusercontent.com/BinomialLLC/basis_universal/master/webgl/transcoder/build/')
			ktx2Loader.detectSupport(this.babs.renderSys.renderer)
			// dracoLoader.setDecoderConfig({ type: 'js' })
			// this.dracoLoader.preload()
			// this.loader.setDRACOLoader(this.dracoLoader)

			const nightskyImages = sides.map(side => {
				// return tl.loadAsync(`${this.babs.urlFiles}/texture/sky/stars-${side}.png`)

				// Attempting to use precompiled textures but they ended up being huge file sizes and unloadable.  Try again later?
				// Second try!
				// Install kronos ktx tools from https://github.com/KhronosGroup/KTX-Software/releases
				/* 
				3.3MB to 2.9 (2.2 if zcmp set to 20):
				toktx --target_type RGB --t2 --encode uastc --uastc_quality 2 --zcmp 3 --uastc_rdo_l --verbose ktx2/stars-bottom old-fullres-pre-tinypng/stars-bottom.png
				
				Cranked compression: 2.1MB (so zcmp did most of the work, rdo didn't do much...for filesize, maybe for mem though)
				toktx --target_type RGB --t2 --encode uastc --uastc_quality 2 --zcmp 20 --uastc_rdo_l 10 --verbose ktx2/stars-bottom old-fullres-pre-tinypng/stars-bottom.png

				Let's try ETC1S
				toktx --target_type RGB --t2 --encode etc1s --clevel 5 --qlevel 128 --verbose ktx2/stars-bottom old-fullres-pre-tinypng/stars-bottom.png

				*/

				return ktx2Loader.loadAsync(`${this.babs.urlFiles}/texture/sky/etc1s-128/stars-${side}.ktx2`)

			})

			let materialArray = []
			const buildSkybox = () => {
				const size = WorldSys.NIGHTSKY_SIZE
				const nightskyGeo = new BoxGeometry(size, size, size)
				this.nightsky = new Mesh(nightskyGeo, materialArray)
				this.nightsky.name = 'nightsky'

				// todo perhaps use offscreencanvas to fix this? 
				this.babs.group.add(this.nightsky)
			}
			Promise.all(nightskyImages).then((images) => {
				images.forEach((texture, index) => {
					// Using index to ensure correct order
					// console.log(texture.anisotropy, texture)
					texture.magFilter = NearestFilter // These make them sparkle
					texture.minFilter = NearestFilter //   !
					// texture.anisotropy = 16
					materialArray[index] = new MeshBasicMaterial({ map: texture, side: BackSide, transparent: true, })
					if(index === images.length -1 && !this.nightsky) { // Done loading the final one
						buildSkybox()
					}
				})
			})
		}
		setTimeout(delayLoadNightsky, dayCheckInterval)
	}

	shadowDist = 150
	playerTarget
	Event(type, data) {
		if(type === 'controller-ready') {
			if(!data.isSelf) return // Only add lights for self

			// Directional light
			this.playerTarget = data.controller.target

			// todo have this track not-the-player lol.  Perhaps an origin that doesn't move?  Used to be cube
			this.dirLight = new DirectionalLight(0xffffff, 0)
			this.dirLight.name = 'dirlight'
			this.dirLight.target = this.playerTarget

			this.dirLightHelper = new DirectionalLightHelper(this.dirLight, 1000)
			this.dirLightHelper.name = 'three-helper'
			this.babs.group.add(this.dirLightHelper)
			
			this.dirLight.color.setHSL(45/360, 1, 1).convertSRGBToLinear()
			
			// Shadow
			this.dirLight.castShadow = true
			this.dirLight.shadow.bias = -0.0001
			this.dirLight.shadow.normalBias = 0.1
			this.dirLight.shadow.mapSize.width = 4096
			this.dirLight.shadow.mapSize.height = 4096
			this.dirLight.shadow.camera.near = 0
			this.dirLight.shadow.camera.far = this.shadowDist *2
			this.dirLight.shadow.camera.left = this.shadowDist
			this.dirLight.shadow.camera.right = -this.shadowDist
			this.dirLight.shadow.camera.top = this.shadowDist
			this.dirLight.shadow.camera.bottom = -this.shadowDist

			this.babs.group.add(this.dirLight)

			this.cameraHelper = new CameraHelper(this.dirLight.shadow.camera)
			this.cameraHelper.name = 'camerahelper'
			this.babs.group.add(this.cameraHelper)

			this.renderer.shadowMap.enabled = true

			// this.renderer.shadowMap.type = BasicShadowMap
			this.renderer.shadowMap.type = PCFShadowMap
			// this.renderer.shadowMap.type = PCFSoftShadowMap
			// this.renderer.shadowMap.type = VSMShadowMap

			this.renderer.shadowMap.autoUpdate = false // /needsUpdate 
			// ^ Only needed to false if updating manually; true updates every frame

			debugMode.subscribe(on => {
				this.cameraHelper.visible = on
				this.dirLightHelper.visible = on
			})


			// Trying out CSM
			// https://github.com/vHawk/three-csm https://threejs.org/examples/?q=shadow#webgl_shadowmap_csm
			// const params = {
			// 	orthographic: false,
			// 	fade: false,
			// 	far: 4000,
			// 	mode: 'practical',
			// 	lightX: 0.5,
			// 	lightY: 0.5,
			// 	lightZ: 0.5,
			// 	margin: 100,
			// 	lightFar: 4000,
			// 	lightNear: 1,
			// };
			// this.csm = new CSM( {
			// 	maxFar: params.far,
			// 	cascades: 4,
			// 	mode: params.mode,
			// 	parent: this.babs.scene,
			// 	shadowMapSize: 1024,
			// 	lightDirection: new Vector3( params.lightX, params.lightY, params.lightZ ).normalize(),
			// 	camera: this.babs.camera
			// } );
			// this.csm.setupMaterial(this.babs.worldSys.groundMaterial)
			// Nope, sketchy integration with engine, lambert, maybe instancemesh, light color


			
		}
	}

	updateCount = 0
	rand = new Vector3().random()
	waterMatrix = new Matrix4()
	vectorPosition = new Vector3()
	quatRotation = new Quaternion()

	isDaytimeWithShadows
	duskMargin = -0.1
	
	proximaSecondsSinceHour :number
	localTimeWhenGotProximaTime :DateTime
	GAME_SPEED_MULTIPLIER = 24


	frameCount = 0
	// DO_EVERY_FRAMES = 120
	DO_EVERY_FRAMES = 1

	update(dt) {
		// Update sun position over time!
		if(!this.proximaSecondsSinceHour) return // Time comes before Earth :)


		this.frameCount++
		// if(this.frameCount % this.DO_EVERY_FRAMES === 0) // Shadows and sun too jerky.
		{
			this.frameCount = 0
			this.renderer.shadowMap.needsUpdate = true

			// this.secondsSinceHour = this.secondsSinceHour.plus({milliseconds: dt *1000 *this.GAME_SPEED_MULTIPLIER})
			const proximaRealSecondsAsGameHours = (this.proximaSecondsSinceHour *24) /3600
			const localSecondsPassedSinceProxima = DateTime.utc().diff(this.localTimeWhenGotProximaTime, 'seconds').seconds
			const localGameHoursPassedSinceProxima = (localSecondsPassedSinceProxima *24) /3600 //        *3600 /20
			// console.log('localGameHoursPassedSinceProxima', proximaRealSecondsAsGameHours, localGameHoursPassedSinceProxima)
			const secondsAsDatetime = DateTime.utc().set({
				year: 2022, month: 8, day: 6, // Sat
				hour: 0, minute: 0, second: 0, millisecond: 0,
			})
			const gameHourOfDay = 6 +proximaRealSecondsAsGameHours +localGameHoursPassedSinceProxima // 6am sunrise // MT
			const timezoneOffset = +6
			const hackOffset = 0//28.5
			const datetimeWithSunriseOffset = secondsAsDatetime.plus({hours: gameHourOfDay +timezoneOffset +hackOffset})
			const date = new Date(datetimeWithSunriseOffset.toISO())
			// console.log('plusHours', gameHourOfDay, datetimeWithSunriseOffset.toISO(), '--', date.toUTCString())
			const sunCalcPos = SunCalc.getPosition(date, 39.7392, -104.985)


			const phi = MathUtils.degToRad(90) -sunCalcPos.altitude // transform from axis-start to equator-start
			const theta = MathUtils.degToRad(90*3) -sunCalcPos.azimuth // transform to match experience

			// Adjust fog lightness (white/black) to sun elevation
			const noonness = 1 -(MathUtils.radToDeg(phi) /90) // 0-1, 0 and negative after sunset, positive up to 90 (at equator) toward noon!
			// log('time:', noonness)

			if(noonness < 0 +this.duskMargin) { // nighttime
				if(this.nightsky?.material[0].opacity !== 1.0) { // Optimization; only run once 
					// Doesn't happen on nighttime launch I think, since material opacity starts out as 1.0
					this.nightsky?.material.forEach(m => m.opacity = 1.0)
				}
			}
			else if(noonness >= 0 +this.duskMargin) { // daytime
				const opacity = MathUtils.lerp(1, 0, (noonness +0.1) *10)
				this.nightsky?.material.forEach(m => m.opacity = opacity)
				this.dirLight ? this.dirLight.castShadow = true : 0
			}

			// Rotate sky // Todo more accurate lol! // And make stars accurate in their positioning with Celestia?
			this.nightsky?.rotateY(-0.0015 *this.DO_EVERY_FRAMES *dt)
			this.nightsky?.rotateX(-0.0015 *this.DO_EVERY_FRAMES *dt)

			const elevationRatioCapped = Math.min(50, 90 -MathUtils.radToDeg(phi)) /90
			// log(noonness, 90 -MathUtils.radToDeg(phi))
			this.babs.scene.fog.color.setHSL(
				34/360, // Which color
				0.1, // How much color
				0.02 + (elevationRatioCapped *1.25) // Tweak this 1.25 and the 50 above, to adjust fog appropriateness
			)
			// this.babs.scene.fog.far = ((this.effectController.elevation /elevationMax)  // Decrease fog at night // Not needed with better ratio

			// log('time', timeOfDay, MathUtils.radToDeg(sunCalcPos.altitude), MathUtils.radToDeg(pos.azimuth))
			this.sunPosition.setFromSphericalCoords(WorldSys.DAYSKY_SCALE, phi, theta)
			this.daysky.material.uniforms['sunPosition'].value.copy(this.sunPosition)


			if(this.dirLight){
				// Put directional light at sun position, but closer in!
				this.dirLight.position.setFromSphericalCoords(this.shadowDist, phi, theta)
				this.dirLight.position.add(this.playerTarget.position.clone()) // move within zone (sky uses 0,0?) to match sun origin

				this.dirLightHelper.update()
				this.cameraHelper.update()
				// console.log('dirlight', this.dirLightHelper.position, this.playerTarget.position)

				if(noonness < 0 +this.duskMargin /7) { 
					this.isDaytimeWithShadows = false
					// ^ todo have shadows fade out rather than just disappear?
					// 	Or just have less ambient lighting of objects at night?
					this.dirLight.castShadow = false
					// this.isDaytime = false
					this.dirLight.intensity = 0

					;(this.babs.scene.fog as FogExp2).density = 0
				}
				else {
					this.isDaytimeWithShadows = true
					this.dirLight.castShadow = true
					// this.isDaytime = true
					// Intensity based on noonness
					this.dirLight.intensity = MathUtils.lerp(
						0.01, 
						1 *(1/this.renderer.toneMappingExposure), 
						Math.max(this.duskMargin, (noonness) +0.5) // +0.5 boots light around dusk!
					)

					;(this.babs.scene.fog as FogExp2).density = WorldSys.FogDefaultDensity
				}
			}
			this.hemiLight.intensity = MathUtils.lerp(
				0.5,//0.05, 
				0.3 *(1/this.renderer.toneMappingExposure), 
				Math.max(this.duskMargin, noonness +0.5) // +0.5 boots light around dusk!
			)

			// Make hemiLight more intense at night
			this.hemiLight.intensity += -noonness *7 // *x brings this to ~3.5 at night
			if(noonness < 1) this.hemiLight.intensity += 1 // todo does it need smoothing?

			this.hemiLight.color.setHSL(222/360, 60/100, 66/100).convertSRGBToLinear() // light from above
			this.hemiLight.groundColor.setHSL(222/360, 60/100, 66/100).convertSRGBToLinear() // from below
			// ^ Fine to use night color there since intensity is negative during the day anyway (sunlight takes over)
			this.hemiLight.intensity = Math.max(this.hemiLight.intensity, 2)
			// ^ todo make hemilight functional during daylight too; that is a hack, blue daytime light :/
			// console.log('noonness', noonness, this.hemiLight.intensity)
		

			// Water randomized rotation
			const spinSpeedMult = 5 * this.DO_EVERY_FRAMES
			const secondsFrequency = 1
			const normalFps = 60
			if(this.updateCount % (normalFps *secondsFrequency) === 0) {
				const updated = new Vector3().random().addScalar(-0.5).multiplyScalar(0.3)
				this.rand.add(updated).clampScalar(-0.5, 0.5)
			}

			// Instanced mesh version
			// https://www.cs.uaf.edu/2015/spring/cs482/lecture/02_16_rotation.html
			// https://medium.com/@joshmarinacci/quaternions-are-spooky-3a228444956d
			for(let i=0, l=this.waterInstancedMesh?.count; i<l; i++) {
				// Get
				this.waterInstancedMesh.getMatrixAt(i, this.waterMatrix)
				
				// Extract
				this.quatRotation.setFromRotationMatrix(this.waterMatrix)
				this.vectorPosition.setFromMatrixPosition(this.waterMatrix)

				// Rotate
				const rot = new Quaternion().setFromEuler(new Euler(
					spinSpeedMult *this.rand.x *this.waterInstancedRands[i] *dt,
					spinSpeedMult *this.rand.y *this.waterInstancedRands[i] *dt,
					spinSpeedMult *this.rand.z *this.waterInstancedRands[i] *dt,
				))
				this.quatRotation.multiply(rot)
					.normalize() // Roundoff to prevent scaling

				// Compile
				this.waterMatrix.makeRotationFromQuaternion(this.quatRotation)
				this.waterMatrix.setPosition(this.vectorPosition)
				
				// Update
				this.waterInstancedMesh.setMatrixAt(i, this.waterMatrix)
				this.waterInstancedMesh.instanceMatrix.needsUpdate = true
			}

			// this.csm?.update()

			this.updateCount++
		}
	}

	currentGround
	groundMaterial
	async loadStatics(urlFiles, zone, isLoadinZone = false) {
		let geometry = new PlaneGeometry(WorldSys.ZoneLength, WorldSys.ZoneLength, WorldSys.ZoneSegments, WorldSys.ZoneSegments)
		// geometry = geometry.toNonIndexed()
		geometry.rotateX( -Math.PI / 2 ) // Make the plane horizontal
		geometry.translate( // Uncenter it, align at corner
			WorldSys.ZoneLength /2,// +WorldSys.ZoneLength *zone.x, 
			0,//zone.y -8000,
			WorldSys.ZoneLength /2,// +WorldSys.ZoneLength *zone.z,
		)
			
		// const material = new MeshPhongMaterial({
		// 	name: 'megamaterial',
		// 	map: this.objectTexture,
		// 	// bumpMap: texture,
		// 	// bumpScale: bumpScale,
		// 	// color: diffuseColor,
		// 	specular: 0.16,
		// 	// reflectivity: 0.5,
		// 	shininess: 0.2,
		// 	// envMap: alphaIndex % 2 === 0 ? null : reflectionCube
		// 	side: FrontSide,
		// 	// color: null,
		// 	// emissive: null,
		// 	// color: new Color(0,0,0).convertSRGBToLinear(),
		// })
		this.groundMaterial = this.groundMaterial || new MeshLambertMaterial( {
			side: FrontSide,
			shadowSide: FrontSide,
			// emissive: new Color().setHSL(0/360, 0/100, 10/100),
			// depthFunc: NeverDepth,
			dithering: true,
			// toneMapped: false, // oohhh lets me avoid renderer's tonemapping settings!
		} )
		// const material = new MeshStandardMaterial({vertexColors: true})
		// this.groundMaterial.color.setHSL( 0.095, 0.5, 0.20 )
		this.groundMaterial.vertexColors = true

		// console.time('ele')
		await this.genElevation(urlFiles, geometry, zone)
		// console.timeEnd('ele') // 17ms
		// console.time('landcover')
		await this.genLandcover(urlFiles, geometry, zone)
		// console.timeEnd('landcover') // 32ms // meh
		
		geometry.computeVertexNormals()

		const newGround = new Mesh( geometry, this.groundMaterial )
		newGround.name = 'ground'
		newGround.castShadow = true
		newGround.receiveShadow = true
		newGround.zone = zone
		newGround.position.setX(WorldSys.ZoneLength *zone.x)
		newGround.position.setZ(WorldSys.ZoneLength *zone.z)
		zone.ground = newGround
		this.babs.group.add(newGround)

		if(isLoadinZone) {
			log.info('playerStartingZone', newGround)
			this.currentGround = newGround
		}

		const groundGrid = new LineSegments(new WireframeGeometry(geometry))
		groundGrid.name = 'groundgrid'
		groundGrid.material.color.setHex(0x333333).convertSRGBToLinear()
		groundGrid.position.setX(WorldSys.ZoneLength *zone.x)
		groundGrid.position.setZ(WorldSys.ZoneLength *zone.z)
		this.babs.group.add(groundGrid)
		debugMode.subscribe(on => {
			groundGrid.visible = on
		})

	}

	async loadObjects(urlFiles, zone) {
		const fet = await fetch(`${urlFiles}/zone/${zone.id}/cache`)
		// log('fet.status', fet.status)
		if(fet.status == 404) {// No such zone or zone with no objects cached yet
			return []
		}

		const dataBlob = await fet.blob()
		// log('fet.blob', dataBlob)
		if(dataBlob.size == 2) {  // hax on size (for `{}`)
			return []
		}

		let ds = new DecompressionStream('gzip')
		
		// const stream = dataBlob.stream()
		// Hack patch from https://github.com/stardazed/sd-streams/issues/8
		const readableStream = new PatchableReadableStream(dataBlob.stream().getReader())

		let decompressedStream = readableStream.pipeThrough(ds) // Note: pipeThrough not FF compatible as of 2022-02-21 https://caniuse.com/streams // But, we have now polyfilled it (and Safari) using @stardazed/streams-polyfill

		const response = new Response(decompressedStream)
		const decompressedBlob = await response.blob()

		const text = await decompressedBlob.text()
		const wobs = JSON.parse(text)
		return wobs
	}

	async loadWobLocations(urlFiles, zone) {
		const fet = await fetch(`${urlFiles}/zone/${zone.id}/locations.bin`)
		if(fet.status == 404) {// No such zone or zone with no objects cached yet
			return new Uint8Array()
		}

		const dataBlob = await fet.blob()
		if(dataBlob.size == 2) {  // hax on size (for `{}`)
			return new Uint8Array()
		}

		const buff = await dataBlob.arrayBuffer()
		const locations = new Uint8Array(buff)

		return locations
	}

	elevationData = {}
	landcoverData
	waterInstancedMesh
	waterInstancedRands = []
	async genElevation(urlFiles :string, geometry :PlaneGeometry, zone :Zone) {
		// Save thigns onto zone for later
		zone.geometry = geometry

		const nCoordsComponents = 3 // x,y,z
		const verticesRef = geometry.getAttribute('position').array

		for (let i=0, j=0; i < zone.elevationData.length; i++, j += nCoordsComponents ) {
			// j + 1 because it is the y component that we modify
			// Wow, 'vertices' is a reference that mutates passed-in 'geometry' in place.  That's counter-intuitive.

			// Set vertex height from elevations data
			verticesRef[j +1] = zone.elevationData[i] * zone.yscale +zone.y
		}
	}

	zones = []
	async stitchElevation(zones) {
		this.zones = zones
		for(let zone of zones) {
			const nCoordsComponents = 3 // x,y,z
			const verticesRef = zone.geometry.getAttribute('position').array
	
			const zoneMinusZ = zones.find(z => z.x==zone.x && z.z==zone.z-1)
			const zoneMinusX = zones.find(z => z.x==zone.x-1 && z.z==zone.z)
			const zoneMinusBoth = zones.find(z => z.x==zone.x-1 && z.z==zone.z-1)

			const zoneMinusZVerts = zoneMinusZ?.geometry.getAttribute('position').array
			const zoneMinusXVerts = zoneMinusX?.geometry.getAttribute('position').array
			const zoneMinusBothVerts = zoneMinusBoth?.geometry.getAttribute('position').array
	
			for (let i=0, j=0; i < zone.elevationData.length; i++, j += nCoordsComponents ) {
				// j + 1 because it is the y component that we modify
				// Wow, 'vertices' is a reference that mutates passed-in 'geometry' in place.  That's counter-intuitive.
	
				// Set vertex height from elevations data
				verticesRef[j +1] = zone.elevationData[i] * zone.yscale +zone.y

				const {x: thisx, z: thisz} = Utils.indexToCoord(i)

				// Stitch terrain elevations together
				if(thisx === 0 && thisz === 0) { // angled one, not a side
					if(zoneMinusBoth) {
						const indexOnOtherZone = Utils.coordToIndex(25, 25, 26, 3)
						verticesRef[j +1] = zoneMinusBothVerts[indexOnOtherZone +1] //hrmrm
					}
				}
				else if(thisz === 0) { // rearward edge on z
					if(zoneMinusZ) {
						const indexOnOtherZone = Utils.coordToIndex(thisx, 25, 26, 3)
						verticesRef[j +1] = zoneMinusZVerts[indexOnOtherZone +1] //hrmrm
					}
				}
				else if(thisx === 0) {
					if(zoneMinusX) {
						const indexOnOtherZone = Utils.coordToIndex(25, thisz, 26, 3)
						verticesRef[j +1] = zoneMinusXVerts[indexOnOtherZone +1] //hrmrm
					}
				}

			}
		}

	}
	async genLandcover(urlFiles :string, geometry :PlaneGeometry, zone :Zone) {
		// Get landcover data
        
		// Vertex colors on BufferGeometry using a non-indexed array
		const verticesRef = geometry.getAttribute('position').array
		const nColorComponents = 3 // r,g,b
		// const nFaces = WorldSys.ZoneSegments *WorldSys.ZoneSegments *2; // e.g. 6 for a pyramid (?)
		// const nVerticesPerFace = 3; // 3 for Triangle faces
		
		// Add color attribute to geometry, so that I can use vertex colors
		const colorArr = new Float32Array(verticesRef.length) 
		geometry.setAttribute('color', new Float32BufferAttribute(colorArr, nColorComponents))
		const colorsRef = geometry.getAttribute('color').array
	

		let waterNearbyIndex = new Array(26*26).fill(0)

		for (let index=0, l=verticesRef.length /nColorComponents; index < l; index++) {
			const lcString = this.StringifyLandcover[zone.landcoverData[index]]
			let color = this.colorFromLc[lcString]

			// Spread color from this vertex as well as to its +1 forward vertices (ie over the plot, the 40x40ft)
			const coordOfVerticesIndex = Utils.indexToCoord(index, 26) // i abstracts away color index
			for(let z=0; z<=1; z++) {
				for(let x=0; x<=1; x++) {
					const colorsIndexOfGridPoint = Utils.coordToIndex(coordOfVerticesIndex.x +x, coordOfVerticesIndex.z +z, 26, 3)
					if(!color) {
						console.warn('Color not found!', zone.landcoverData[index], lcString)
						color = this.colorFromLc.Grassland // todo add colors?
					}
					colorsRef[colorsIndexOfGridPoint +0] = color.r
					colorsRef[colorsIndexOfGridPoint +1] = color.g
					colorsRef[colorsIndexOfGridPoint +2] = color.b
				}
			}


			// Find water nearby
			for(let z=-1; z<=1; z++) {
				for(let x=-1; x<=1; x++) {
					const offsetIndex = Utils.coordToIndex(coordOfVerticesIndex.x +x, coordOfVerticesIndex.z +z, 26)
					if(
						this.StringifyLandcover[zone.landcoverData[offsetIndex]] === 'River'
						|| this.StringifyLandcover[zone.landcoverData[offsetIndex]] === 'Lake'
					
					) {

						waterNearbyIndex[index]++
					}

				}
			}
		}

		// Water?  Delayed?
		setTimeout(() => {
			if(!
			(
				(zone.x == 0 && zone.z == 0)
			)
			){
				return // zonetodo
			}

			const cubeSize = 4 // Must divide into 10
			const waterCubePositions = []
			const waterCubeColors = []

			const entZone = this.babs.ents.get(zone.id) as Zone // zonetodo convert all zone refs to ents

			for (let index=0, l=verticesRef.length /nColorComponents; index < l; index++) {
				const lcString = this.StringifyLandcover[zone.landcoverData[index]]
				const coordOfVerticesIndex = Utils.indexToCoord(index, 26) // i abstracts away color index
				// log('gridPointofVerticesIndex', coordOfVerticesIndex)
				// Create cubes on all spots in between
				if(this.WaterTypes.includes(lcString)) {
					const spacing = 1
					for(let z=0; z<10 /cubeSize /Math.round(spacing); z++) {
						for(let x=0; x<10/cubeSize /Math.round(spacing); x++) {

							const xpos = coordOfVerticesIndex.x *10 +z*cubeSize *spacing -spacing*4 // Well that's opaque lol
							const zpos = coordOfVerticesIndex.z *10 +x*cubeSize *spacing -spacing*4
							
							const yardCoord = YardCoord.Create({
								x: Utils.clamp(xpos, 0, 249),
								z: Utils.clamp(zpos, 0, 249),
								zone: entZone,
							})
							// const engineCoord = yardCoord.toEngineCoord()
							// const rayPosition = entZone.rayHeightAt(engineCoord)
							// New Coords are beautiful to work with...
							const engCoordCentered = yardCoord.toEngineCoordCentered()
							const engPositionVector = new Vector3(engCoordCentered.x, entZone.engineHeightAt(yardCoord), engCoordCentered.z)
							// engPositionVector.add(new Vector3(-this.babs.worldSys.shiftiness.x, 0, -this.babs.worldSys.shiftiness.z))

							if(waterNearbyIndex[index] > 7) {
								waterCubePositions.push(engPositionVector)

								const riverBaseColor = this.colorFromLc.River.clone()
								riverBaseColor.offsetHSL(0, 0, (Math.random() -0.1) * 20/100) // -0.1 biases it toward dark

								waterCubeColors.push(riverBaseColor.r, riverBaseColor.g, riverBaseColor.b)
							}

						}
					}
				}
			}

			// const geometry = new BoxGeometry(cubeSize *4, cubeSize *4, cubeSize *4)
			const sizeish = cubeSize *3.5
			const geometry = new IcosahedronGeometry(sizeish, 1)
			const material = new MeshLambertMaterial({})
			this.waterInstancedMesh = new InstancedMesh(geometry, material, waterCubePositions.length)
			this.waterInstancedMesh.name = 'water'
			this.waterInstancedMesh.instanceMatrix.setUsage( StreamDrawUsage ) 
			// ^ So I don't have to call .needsUpdate // https://www.khronos.org/opengl/wiki/Buffer_Object#Buffer_Object_Usage
			this.babs.group.add(this.waterInstancedMesh)


			const bufferAttr = new InstancedBufferAttribute(new Float32Array( waterCubeColors), 3)
			bufferAttr.needsUpdate = true
			this.waterInstancedMesh.instanceColor = bufferAttr


			for(let i=0, l=waterCubePositions.length; i<l; i++) {
				let matrix = new Matrix4().setPosition(waterCubePositions[i].setY(waterCubePositions[i].y -sizeish/1.5))
				this.waterInstancedMesh.setMatrixAt(i, matrix)
				// this.waterInstancedMesh.setColorAt(i, new Color(0xffffff))
				this.waterInstancedRands[i] = Math.random() - 0.5
			}

		}, 1) // todo race condition here

	}

	shiftiness = new Vector3()
	shiftEverything(xShift, zShift, excludeSelf = false) {
		const shiftVector = new Vector3(xShift, 0, zShift)

		const excludeFromShift = [
			// 'ground', 'groundgrid', 
			'camerahelper', 
			'three-helper', 'dirlight', 'hemilight',
			'nightsky', 'daysky',

		] // , 'PointLight', 'ThreeFire', InstancedMesh
		if(excludeSelf) excludeFromShift.push('self')

		let shiftingLog = []
		this.babs.group.children.forEach(child => {
			if(!excludeFromShift.includes(child.name)) {
				child.position.setX(child.position.x +shiftVector.x)
				child.position.setZ(child.position.z +shiftVector.z)
				if(child.name != 'ground' && child.name != 'groundgrid' ) {
					shiftingLog.push(child.name || child)
				}
				if(child.name == 'player') {
					const player = this.babs.ents.get(child.idplayer) as Player
					// const shiftYards = shiftVector.clone().divideScalar(4).floor()
					// player.controller.gDestination.add(shiftYards)
				}
			}
		})
		this.shiftiness.add(shiftVector)

		// log.info('shifted', shiftingLog)
	}

}

export class PatchableReadableStream extends ReadableStream {
	constructor(reader) {
		super({
			async start(controller) {
				while (true) {
					const { done, value } = await reader.read()
					if (done) break
					controller.enqueue(value)
				}
				controller.close()
				reader.releaseLock()
			}
		})
	}
}
