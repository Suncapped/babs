import { 
	PlaneGeometry, 
	MeshBasicMaterial, 
	Mesh,
	Color,
	DoubleSide,
	FrontSide,
	MeshPhongMaterial,
	Vector3,
	HemisphereLightHelper,
	HemisphereLight,
	DirectionalLight,
	DirectionalLightHelper,
	BackSide,
	CameraHelper,
	MathUtils,
	Float32BufferAttribute,
	BoxGeometry,
	MeshLambertMaterial,
	InstancedMesh,
	Matrix4,
	Quaternion,
	Euler,
	InstancedBufferAttribute,
	StreamDrawUsage,
	TextureLoader,
	FogExp2,
	PCFShadowMap,
	Material,
	NearestFilter,
	IcosahedronGeometry,
	SRGBColorSpace,
	PCFSoftShadowMap,
	BasicShadowMap,
	Vector2,
} from 'three'

import { WireframeGeometry } from 'three'
import { LineSegments } from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { debugMode } from '../stores'

import { Wob, type FeObject3D } from '@/ent/Wob'
import { EventSys } from './EventSys'
import * as SunCalc from 'suncalc'
// import { KTX2Loader } from 'three/addons/loaders/KTX2Loader'
// import { CSM } from 'three/addons/csm/CSM.js';

import { YardCoord } from '@/comp/Coord'
import { Babs } from '@/Babs'
import { Zone } from '@/ent/Zone'
import { Player } from '@/ent/Player'
import { DateTime } from 'luxon'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

import { GUI } from 'lil-gui'
import { Fire } from '@/comp/Fire'
import { coordToIndex, indexToCoord } from '@/shared/consts'

export class WorldSys {

	public static ZONE_LENGTH_FEET = 1000
	public static ZONE_DATUM_SIZE = 20 // was 40
	public static ZONE_DATUMS = WorldSys.ZONE_LENGTH_FEET/WorldSys.ZONE_DATUM_SIZE // was 25, now 50
	public static ZONE_ARR_SIDE_LEN = WorldSys.ZONE_DATUMS +1 // For 40ft was 26; now for 20ft it's 51.
	public static ZONE_MOVEMENT_EXTENT = 249

	static Yard = 4
	static Plot = WorldSys.Yard *5 // 20 ft; 5 tiles
	static Acre = WorldSys.Plot *10 // 200 ft; 50 tiles, 10 plots
	
	static MAX_VIEW_DISTANCE = 1_000_000 // ~200 miles
	static DAYSKY_SCALE = 450_000
	static NIGHTSKY_SIZE = 800_000

	static ZoneTerrainMin = new Vector3(0,0,0)
	static ZoneTerrainMax = new Vector3(WorldSys.ZONE_LENGTH_FEET, 5_000, WorldSys.ZONE_LENGTH_FEET)

	static FogDefaultDensity = 0.0000012

	babs :Babs
	renderer

	dirLight
	dirLightHelper
	// lightShift = new Vector3((- 1) *30, 0.25 *30, 1 *30) // for re-use
	hemiLight :HemisphereLight
	hemiLightHelper :HemisphereLightHelper

	sky
	sunPosition
	// effectController = {
	// 	turbidity: 10,
	// 	rayleigh: 1,//3,
	// 	mieCoefficient: 0.005,
	// 	mieDirectionalG: 0.5, // 0.7,
	// 	elevation: 75,//2,
	// 	azimuth: 180,
	// 	// exposure: renderer.toneMappingExposure
	// }
	effectController = {
		turbidity: 0.8,
		rayleigh: 0.2,
		mieCoefficient: 0.1,
		mieDirectionalG: 0.999,
		elevation: 75,//2,
		azimuth: 180,
		// exposure: renderer.toneMappingExposure
	}

	updateSkyValues

	daysky :Sky 
	nightsky :Mesh & {material: Material[]}

	cameraHelper :CameraHelper

	static StringifyLandcover = {
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
	static LandcoverStringToEnglish = {
		'SnowIceTundra': 'Tundra',
		'BarrenRockSandClay': 'Barren',

		'ForestDeciduous': 'Deciduous',
		'ForestEvergreen': 'Evergreen',
		'ForestMixed': 'Forest',

		'ShrubAndScrub': 'Shrubland',
		'Grassland': 'Grassland',

		'WetlandWoody': 'Swamp',
		'WetlandHerbacious': 'Marsh',

		'Lake': 'Lake',
		'LakeShore': 'Lakeshore',
		'River': 'River',
		'RiverShore': 'Riverbank',

		'StreamSmall': 'Brook',
		'StreamMedium': 'Creek',
		'StreamLarge': 'Stream',

		'StreamShore': 'Shoreline',
		'Cliff': 'Cliffside',
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


		this.sunPosition = new Vector3()

		// New sky (not lighting)
		this.daysky = new Sky()
		this.daysky.name = 'daysky'
		this.daysky.scale.setScalar(WorldSys.DAYSKY_SCALE)
		this.babs.group.add(this.daysky)

		// this.effectController.exposure = renderer.toneMappingExposure
		this.updateSkyValues = () => {
			const uniforms = this.daysky.material.uniforms
			uniforms[ 'turbidity' ].value = this.effectController.turbidity
			uniforms[ 'mieCoefficient' ].value = this.effectController.mieCoefficient
			uniforms[ 'mieDirectionalG' ].value = this.effectController.mieDirectionalG
			uniforms[ 'rayleigh' ].value = this.effectController.rayleigh
			// const phi = MathUtils.degToRad( 90 - this.effectController.elevation )
			// const theta = MathUtils.degToRad( this.effectController.azimuth )
			// this.sunPosition.setFromSphericalCoords( 1, phi, theta )
			uniforms['sunPosition'].value.copy( this.sunPosition )
			// renderer.toneMappingExposure = this.effectController.exposure
			// renderer.render( this.babs.scene, camera )
			this.daysky.material.uniforms = uniforms
		}
		this.updateSkyValues()

		// const gui = new GUI()
		// gui.add( this.effectController, 'turbidity', 0.0, 20.0, 0.1 ).onChange( this.updateSkyValues )
		// gui.add( this.effectController, 'mieCoefficient', 0.0, 0.1, 0.001 ).onChange( this.updateSkyValues )
		// gui.add( this.effectController, 'mieDirectionalG', 0.0, 1, 0.001 ).onChange( this.updateSkyValues )
		// gui.add( this.effectController, 'rayleigh', 0.0, 4, 0.001 ).listen().disable().onChange( this.updateSkyValues )
		// // gui.add( this.effectController, 'elevation', 0, 90, 0.1 ).onChange( this.updateSkyValues )
		// // gui.add( this.effectController, 'azimuth', - 180, 180, 0.1 ).onChange( this.updateSkyValues )
		// // gui.add( this.effectController, 'exposure', 0, 1, 0.0001 ).onChange( this.updateSkyValues )

		this.hemiLight = new HemisphereLight(0xffffff, 0xffffff, 0)
		this.hemiLight.name = 'hemilight'
		this.hemiLightHelper = new HemisphereLightHelper(this.hemiLight, 10)
		this.hemiLightHelper.name = 'three-helper'
		this.babs.group.add(this.hemiLightHelper)
		this.hemiLightHelper.visible = false
		this.hemiLight.color.setHSL(45/360, 1, 0.5).convertSRGBToLinear() // light from above
		this.hemiLight.groundColor.setHSL(245/360, 92/100, 0.5).convertSRGBToLinear() // from below
		this.babs.group.add(this.hemiLight)

		this.babs.scene.fog = new FogExp2(
			new Color(), // Gets set in update
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
			console.debug('loading stars')
			
			const sides = ['north', 'south', 'top', 'bottom', 'west', 'east'] // +y as north

			// const ktx2Loader = new TextureLoader()
			let ktx2Loader = new KTX2Loader()
			ktx2Loader.setTranscoderPath('/basis/')
			ktx2Loader.detectSupport(this.babs.renderSys.renderer)
			// ktx2Loader.setTranscoderPath('/node_modules/three/addons/libs/basis/');
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

				// return ktx2Loader.loadAsync(`${this.babs.urlFiles}/texture/sky/direction-ref/stars-${side}.png`)
				return ktx2Loader.loadAsync(`${this.babs.urlFiles}/texture/sky/etc1s-128/stars-${side}.ktx2`)
					.then(texture => {
						texture.colorSpace = SRGBColorSpace
						return texture
					})

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
					materialArray[index] = new MeshBasicMaterial({ map: texture, side: BackSide, transparent: false, })
					if(index === images.length -1 && !this.nightsky) { // Done loading the final one
						buildSkybox()
					}
				})
			})
		}
		setTimeout(delayLoadNightsky, dayCheckInterval)
	}

	shadowDist = WorldSys.Acre
	Event(type, data) {
		if(type === 'controller-ready') {
			if(!data.isSelf) return // Only add lights for self

			const playerRig = data.controller.playerRig

			// Directional light

			// todo have this track not-the-player lol.  Perhaps an origin that doesn't move?  Used to be cube
			this.dirLight = new DirectionalLight(0xffffff, 0)
			this.dirLight.name = 'dirlight'
			this.dirLight.target = playerRig

			this.dirLightHelper = new DirectionalLightHelper(this.dirLight, 1000)
			this.dirLightHelper.name = 'three-helper'
			// this.babs.group.add(this.dirLightHelper)
			
			this.dirLight.color.setHSL(45/360, 1, 1).convertSRGBToLinear()
			
			// https://web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE // this.renderer.capabilities.maxTextureSize
			const shadowTextureSize = this.babs.graphicsQuality ? 4096*4 : 4096
			this.shadowDist = this.babs.graphicsQuality ? WorldSys.ZONE_LENGTH_FEET : WorldSys.Acre
			// Shadow
			this.dirLight.castShadow = true
			this.dirLight.shadow.bias = -0.0001
			this.dirLight.shadow.normalBias = 0.1
			this.dirLight.shadow.mapSize.width = shadowTextureSize
			this.dirLight.shadow.mapSize.height = shadowTextureSize
			this.dirLight.shadow.camera.near = 0.5
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

			// this.renderer.shadowMap.type = PCFShadowMap
			this.renderer.shadowMap.type = PCFSoftShadowMap
			// this.renderer.shadowMap.type = BasicShadowMap // No
			// this.renderer.shadowMap.type = VSMShadowMap // No

			this.renderer.shadowMap.autoUpdate = true

			debugMode.subscribe(on => {
				this.cameraHelper.visible = on
				this.dirLightHelper.visible = on
				this.hemiLightHelper.visible = on
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
	
	snapshotRealHourFraction :number
	snapshotTimestamp :DateTime
	GAME_SPEED_MULTIPLIER = 24

	realHoursElapsedSinceSnapshot :number
	gameBaseDatetime :DateTime = DateTime.utc().set({
		year: 2022, month: 8, day: 6, // Sat
		hour: 6, minute: 0, second: 0, millisecond: 0, // Note hours offset - is that time zone or?
	})

	phi :number // Preserve this so we can skip frames
	theta :number

	smokeAccumulator = 0
	update(dt :number) {
		if(!this.snapshotRealHourFraction) return // Time comes before Earth :)

		// Update sun position over time!

		// We pretty much need to add the snapshotted fetime to the time passed since then
		// if(!this.realHoursElapsedSinceSnapshot) { // Cache this and recalc it only second
		// 	const calcRHESS = () => {
		// 		// this.realHoursElapsedSinceSnapshot += 1/60
		// 		this.realHoursElapsedSinceSnapshot = DateTime.utc().diff(this.snapshotTimestamp, 'hours').hours
		// 	}
		// 	calcRHESS()
		// 	setInterval(calcRHESS, 100) // 150 ms is enough to where sun/shadows look animated to me!
		// 	this.gameBaseDatetime = DateTime.utc().set({
		// 		year: 2022, month: 8, day: 6, // Sat
		// 		hour: 6, minute: 0, second: 0, millisecond: 0, // Note hours offset - is that time zone or?
		// 	})
		// }
		this.realHoursElapsedSinceSnapshot = DateTime.utc().diff(this.snapshotTimestamp, 'hours').hours
		const realHoursIntoHour = (this.snapshotRealHourFraction +this.realHoursElapsedSinceSnapshot) %1 
		// ^ Modulus to wrap this from <1.0 into 0.0, while keeping decimal places.
		
		// Attempt to make it usually be daytime, with only a 5min night
		// Attempt #1:
		// That is a decimal between 0.0 and <1.0.
		// 1. First, figure out how far past the hour we are.  realHoursIntoHour is that.
		// 2. Divide it up and sum the two parts.
		// 		This is about finding how much of the hour needs to be multiplied vs how much of it needs to be divided.
		// 3. For the portion up to the first part, we multiply by something to slow it down (reduce the number).
		// 4. For the portion up to the second part, we multiply by something to speed it up (increase the number).
		// 5. (Later, we should make sure to %/modulus as needed.)

		// 2. 
		// const daytimeRealPortionOfHour = Math.min(0.90, realHoursIntoHour)
		// ^ So if input is 0.20, output is 0.10.  0.60, 0.50.
		// let nighttimePortionOfHour = 0
		// if(realHoursIntoHour > 0.90) {
		// 	nighttimePortionOfHour = realHoursIntoHour -0.90
		// }
		// console.log('portions', daytimeRealPortionOfHour.toFixed(3), nighttimePortionOfHour.toFixed(3))

		// 3 & 4
		// const fakeDaytimePassed = daytimeRealPortionOfHour *0.5
		// const fakeNighttimePassed = nighttimePortionOfHour *4

		// const fakeHoursIntoHour = fakeDaytimePassed +fakeNighttimePassed
		// console.log('fake', fakeDaytimePassed.toFixed(3), fakeNighttimePassed.toFixed(3), '=', realHoursIntoHour.toFixed(3), '->', fakeHoursIntoHour.toFixed(3))

		// Attempt #2:
		// Let's try something else; a simple multiplied slowdown of 'sun time', then it just loops back to 0.
		// So night doesn't truly speed up, it just skips; worry about that later :-P  Maybe future me will be smarter...

		const fakeHoursIntoHour = realHoursIntoHour *0.64 // ~16 out of 24 hours; 0.64 landed sunset right at :55.
		// ^ If we simply divide the hour time, then the day will move more slowly.  At 0.5, it will be 6am to 6pm, before resetting to zero (6am again).  We're zooming in.
		// ^ Being 0.5 is a bit too much, because sunset should actually be past 7pm, so 13 hours.  
		// / That works well enough for now!  
		// Note some of the below comments are based on the old unmultiplied version.
		// In theory, we could perhaps change this speed during the night.  But there's no use for that currently.
		// console.log(realHoursIntoHour.toFixed(3), '->', fakeHoursIntoHour.toFixed(3))

		//

		// fakeHoursIntoHour = realHoursIntoHour // old 'equal-time' nights
		// Turn it into game hours
		const gameHoursFromTopOfRealHour = fakeHoursIntoHour *24 // 24 game hours per real hour // eg =24 after 1 real hour has passed
		let gameTimeOfDayHours = gameHoursFromTopOfRealHour +6 // +6 for 6am sunrise // eg =30 after 1 real hour has passed (6am)
		// Game time of day represents the "Real" time of day in game.  Eg 12 is noon, 24 is midnight, 28 is 4am.

		// Create a DateTime
		const gameDatetime = this.gameBaseDatetime.plus({ hours: gameTimeOfDayHours })

		// Use on SunCalc
		const sunDate = new Date(gameDatetime.toISO())
		// console.log(gameHourTimeofday, sunDate)
		const sunCalcPos = SunCalc.getPosition(sunDate, 39.7392, -104.985)
		this.phi = MathUtils.degToRad(90) -sunCalcPos.altitude // transform from axis-start to equator-start
		this.theta = MathUtils.degToRad(90*3) -sunCalcPos.azimuth // transform to match experience

		////

		// Adjust fog lightness (white/black) to sun elevation
		const noonness = 1 -(MathUtils.radToDeg(this.phi) /90) // 0-1, 0 and negative after sunset, positive up to 90 (at equator) toward noon!
		// console.log('time:', noonness)

		this.effectController.rayleigh = Math.max(0.2, MathUtils.lerp(3, 0.2 -3.5, noonness))
		this.daysky.material.uniforms['rayleigh'].value = this.effectController.rayleigh

		if(noonness < 0 +this.duskMargin) { // nighttime
			if(this.nightsky?.material[0].opacity !== 1.0) { // Optimization; only run once 
				// Doesn't happen on nighttime launch I think, since material opacity starts out as 1.0
				this.nightsky?.material.forEach(m => m.opacity = 1.0)
			}
		}
		else if(noonness >= 0 +this.duskMargin) { // daytime
			const opacity = MathUtils.lerp(1, 0, (noonness +0.1) *10)
			this.nightsky?.material.forEach(m => m.opacity = opacity)
			if(this.nightsky) {
				if(opacity < 0) {
					this.nightsky.visible = false
				}
				else {
					this.nightsky.visible = true
				}
			}
			// console.log('opacity', opacity)
			this.dirLight ? this.dirLight.castShadow = true : 0
		}

		// Rotate sky // Todo more accurate lol! // And make stars accurate in their positioning with Celestia?
		this.nightsky?.rotateY(-0.0015 *dt)
		this.nightsky?.rotateX(-0.0015 *dt)

		const elevationRatioCapped = Math.min(50, 90 -MathUtils.radToDeg(this.phi)) /90
		// console.log(noonness, 90 -MathUtils.radToDeg(phi))
		this.babs.scene.fog?.color.setHSL(
			34/360, // Which color
			0.1, // How much color
			0.02 + (elevationRatioCapped *1.25) // Tweak this 1.25 and the 50 above, to adjust fog appropriateness
		)
		// this.babs.scene.fog.far = ((this.effectController.elevation /elevationMax)  // Decrease fog at night // Not needed with better ratio

		// console.log('time', timeOfDay, MathUtils.radToDeg(sunCalcPos.altitude), MathUtils.radToDeg(pos.azimuth))
		this.sunPosition.setFromSphericalCoords(WorldSys.DAYSKY_SCALE, this.phi, this.theta)
		this.daysky.material.uniforms['sunPosition'].value.copy(this.sunPosition)

		if(this.cameraHelper) this.cameraHelper.update()

		if(this.dirLight){
			// Put directional light at sun position, but closer in!
			this.dirLight.position.setFromSphericalCoords(this.shadowDist, this.phi, this.theta)
			this.dirLight.position.add(this.babs.inputSys.playerSelf.controller.playerRig.position.clone()) // move within zone (sky uses 0,0?) to match sun origin

			this.dirLightHelper.update()
			this.cameraHelper.update()

			if(noonness < 0 +this.duskMargin /7) { 
				this.isDaytimeWithShadows = false
				// ^ todo have shadows fade out rather than just disappear?
				// 	Or just have less ambient lighting of objects at night?
				this.dirLight.castShadow = false
				this.dirLight.intensity = 0

				if(this.babs.scene.fog) (this.babs.scene.fog as FogExp2).density = 0
			}
			else {
				this.isDaytimeWithShadows = true
				this.dirLight.castShadow = true
				// Intensity based on noonness
				this.dirLight.intensity = MathUtils.lerp(
					0.01, 
					1 *(1/this.renderer.toneMappingExposure), 
					Math.max(this.duskMargin, (noonness) +0.5) // +0.5 boosts light around dusk!
				) * MathUtils.lerp(0.5,6, noonness) // Why ~4?  Why not?

				if(this.babs.scene.fog) (this.babs.scene.fog as FogExp2).density = WorldSys.FogDefaultDensity
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
	

		/* @removewater
		if(!this.babs.uiSys.isGameAway) {

			// Water randomized rotation
			const spinSpeedMult = 5
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
		}
		*/


		// Update smoke (even if game away, but prevent accum buildup too)
		if(Fire.SmokePuffIm) {
			// We need to do more generation when there are more lights, or else smoke stacks get too high
			const actualNumLightsFactor = Fire.LightPool.length / Fire.LIGHTPOOL_LQ // aka 4/4 (1.0) or 12/4 (3.0)

			// Maybe create a new smoke puff occasionally
			this.smokeAccumulator += (dt *actualNumLightsFactor)
			if(this.smokeAccumulator >= Fire.SMOKE_PUFF_CREATION_INTERVAL) {
				// Prevent huge accumulator buildup if not rendering
				if(this.smokeAccumulator > Fire.SMOKE_PUFF_CREATION_INTERVAL *10) {
					this.smokeAccumulator = Fire.SMOKE_PUFF_CREATION_INTERVAL
				}
				this.smokeAccumulator -= Fire.SMOKE_PUFF_CREATION_INTERVAL
				this.createSmokePuffs(dt)
			}

			this.smokePuffsRiseScale(dt)
			
		}

		// this.csm?.update()


		this.updateCount++
	}

	currentGround
	groundMaterial
	async loadStatics(urlFiles, zone, isLoadinZone = false) {
		let geometry = new PlaneGeometry(WorldSys.ZONE_LENGTH_FEET, WorldSys.ZONE_LENGTH_FEET, WorldSys.ZONE_DATUMS, WorldSys.ZONE_DATUMS)
		// geometry = geometry.toNonIndexed()
		geometry.rotateX( -Math.PI / 2 ) // Make the plane horizontal
		geometry.translate( // Uncenter it, align at corner
			WorldSys.ZONE_LENGTH_FEET /2,// +WorldSys.ZONE_LENGTH_FEET *zone.x, 
			zone.y,//zone.y -8000,
			WorldSys.ZONE_LENGTH_FEET /2,// +WorldSys.ZONE_LENGTH_FEET *zone.z,
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
			vertexColors: true,
		} )
		// const material = new MeshStandardMaterial({vertexColors: true})
		// this.groundMaterial.color.setHSL( 0.095, 0.5, 0.20 )

		// this.groundMaterial.flatShading = true

		// console.time('ele')
		await this.genElevation(urlFiles, geometry, zone)
		// console.timeEnd('ele') // 17ms
		// console.time('landcover')
		await this.genLandcover(urlFiles, geometry, zone)
		// console.timeEnd('landcover') // 32ms // meh
		
		geometry.computeVertexNormals()

		const newGround :FeObject3D = new Mesh( geometry, this.groundMaterial)
		newGround.name = 'ground'
		newGround.castShadow = true
		newGround.receiveShadow = true
		newGround.zone = zone
		newGround.position.setX(WorldSys.ZONE_LENGTH_FEET *zone.x)
		newGround.position.setZ(WorldSys.ZONE_LENGTH_FEET *zone.z)
		zone.ground = newGround
		this.babs.group.add(newGround)

		if(isLoadinZone) {
			console.debug('playerStartingZone', newGround)
			this.currentGround = newGround
		}

	}
	createSmokePuffs(dt :number) {
		const currentLimitBasedOnNumStacks = Fire.LightPool.length *Fire.SMOKE_PUFFS_PER_LIGHT
		// console.log('smoke stats:', `${Fire.SmokePuffIm.count} of ${Fire.SmokePuffMaxCount} (${currentLimitBasedOnNumStacks}), index: ${Fire.SmokeLatestIndex}`)

		if(Fire.SmokeLatestIndex >= currentLimitBasedOnNumStacks) {
			// We've reached the max, so loop index back to 0
			// Fire.SmokePuffIm.count = 0
			Fire.SmokeLatestIndex = 0
		}
		if(Fire.SmokePuffIm.count < currentLimitBasedOnNumStacks) {
			// Up the render count (until we reach max)
			Fire.SmokePuffIm.count++
		}
		const tempMatrix = new Matrix4()
		const tempPosition = new Vector3()

		// Pick a random from Fire.LightPool
		const randomIndex = Math.floor(Math.random() *Fire.LightPool.length)
		const randomLight = Fire.LightPool[randomIndex]

		// console.log('randomLight', randomIndex, randomLight.position)

		// It seems that sometimes, the light is null due to fast zoning.  
		if(randomLight) {
			// Create a smoke puff at that light's position
			randomLight.getWorldPosition(tempPosition)
			
			// Subtract smoke IM offset so that it's relative to shifted position
			tempPosition.sub(Fire.SmokePuffIm.position)

			// Add a bit of randomness
			const randomFactor = 5
			const randomness = new Vector2().random().multiplyScalar(randomFactor).subScalar(randomFactor/2)
			tempPosition.add(new Vector3(randomness.x, 0, randomness.y))
			tempPosition.y += Fire.SMOKE_STARTING_EXTRAHEIGHT// +(randomFactor/2) // Don't let randomness tart it below the fire

			tempMatrix.setPosition(tempPosition)
			Fire.SmokePuffIm.setMatrixAt(Fire.SmokeLatestIndex, tempMatrix)
			Fire.SmokePuffIm.instanceMatrix.needsUpdate = true

			Fire.SmokeLatestIndex++
			// console.log('Just set a new smoke puff at', tempPosition, Fire.SmokePuffIm.count, Fire.SmokeLatestIndex)
		}
		else {
			console.warn('randomLight is null')
		}
	}
	smokePuffsRiseScale(dt :number) {
		// dt on 120fps = 0.008399999999999637
		// For each SmokePuffIm instance, make it rise on y
		// Also make it get larger over time
		const tempMatrix = new Matrix4()
		const tempPosition = new Vector3()
		const scaleupQualityRelative = 1 +(Fire.SMOKE_SCALEUP_RATE *dt) // Was designed at 60fps, this scales it using dt
		for(let i=0; i<Fire.SmokePuffIm.count; i++) {
			Fire.SmokePuffIm.getMatrixAt(i, tempMatrix)
			tempPosition.setFromMatrixPosition(tempMatrix)

			// Make it rise
			tempPosition.y += Fire.SMOKE_SPEED *dt

			// Make it get larger
			const scale = tempMatrix.getMaxScaleOnAxis()
			if (scale < Fire.SMOKE_MAX_SCALE) {
				// const growthFactor = 1 + (1 - scale / Fire.SMOKE_MAX_SCALE) * 0.003
				// tempMatrix.scale(new Vector3(growthFactor, growthFactor, growthFactor))
				const reduceBy = 0.00005//0.05 *dt
				const scaleBy = new Vector3().setScalar(scaleupQualityRelative)
				scaleBy.setY(scaleBy.y *(1.0 -reduceBy))
				tempMatrix.scale(scaleBy)
			}

			// Make it randomly move on x and z too
			const randomFactor = 2 *dt
			const randomness = new Vector2().random().multiplyScalar(randomFactor).subScalar(randomFactor/2)
			tempPosition.add(new Vector3(randomness.x, 0, randomness.y))

			// // If elevation above ground is past max height, reset it
			// const yardCoord = YardCoord.Create({position: tempPosition, babs: this.babs})
			// if(!yardCoord.zone) {
			// 	console.log('yardCoord.zone is null', yardCoord)
			// 	continue
			// }
			// const groundHeight = yardCoord.zone.engineHeightAt(yardCoord)
			// if(tempPosition.y > groundHeight + Fire.SMOKE_MAX_HEIGHT) {
			// 	tempPosition.y = groundHeight + Fire.SMOKE_STARTING_EXTRAHEIGHT // Reset y
			// 	tempMatrix.makeScale(1,1,1) // Reset scale
			// }
			// Actually, we kinda want it so that smoke is getting moved/removed before reaching its y limits.  That way, when a light is moved, the smoke doesn't y reset on the old position.

			tempMatrix.setPosition(tempPosition)
			Fire.SmokePuffIm.setMatrixAt(i, tempMatrix)
			Fire.SmokePuffIm.instanceMatrix.needsUpdate = true
		}
	}
	
	elevationData = {}
	landcoverData
	// waterInstancedMesh
	// waterInstancedRands = []
	async genElevation(urlFiles :string, geometry :PlaneGeometry, zone :Zone) {
		// Save thigns onto zone for later
		zone.geometry = geometry

		const nCoordsCount = 3 // x,y,z
		const verticesRef = geometry.getAttribute('position').array as Float32Array

		// let lowestElevation = 1_000_000
		for (let i=0, j=0; i < zone.elevationData.length; i++, j += nCoordsCount ) {
			// j + 1 because it is the y aspect that we modify
			// Wow, 'vertices' is a reference that mutates passed-in 'geometry' in place.  That's counter-intuitive.
			// Set vertex height from elevations data
			verticesRef[j +1] = zone.elevationData[i] * zone.yscale// +zone.y
			// lowestElevation = Math.min(lowestElevation, verticesRef[j +1])
		}
		// console.log('lowestElevation', lowestElevation)
	}

	zones = []
	async stitchElevation(zones) {
		this.zones = zones
		for(let zone of zones) {
			const nCoordsCount = 3 // x,y,z
			const verticesRef = zone.geometry.getAttribute('position').array
	
			const zoneMinusZ = zones.find(z => z.x==zone.x && z.z==zone.z-1)
			const zoneMinusX = zones.find(z => z.x==zone.x-1 && z.z==zone.z)
			const zoneMinusBoth = zones.find(z => z.x==zone.x-1 && z.z==zone.z-1)

			const zoneMinusZVerts = zoneMinusZ?.geometry.getAttribute('position').array
			const zoneMinusXVerts = zoneMinusX?.geometry.getAttribute('position').array
			const zoneMinusBothVerts = zoneMinusBoth?.geometry.getAttribute('position').array
	
			for (let i=0, j=0; i < zone.elevationData.length; i++, j += nCoordsCount ) {
				// j + 1 because it is the y aspect that we modify
				// Wow, 'vertices' is a reference that mutates passed-in 'geometry' in place.  That's counter-intuitive.
	
				// Set vertex height from elevations data
				// verticesRef[j +1] = zone.elevationData[i] * zone.yscale// +zone.y

				const {x: thisx, z: thisz} = indexToCoord(i)

				// Stitch terrain elevations together
				if(thisx === 0 && thisz === 0) { // angled one, not a side
					if(zoneMinusBoth) {
						const indexOnOtherZone = coordToIndex(WorldSys.ZONE_DATUMS, WorldSys.ZONE_DATUMS, WorldSys.ZONE_ARR_SIDE_LEN, 3)
						verticesRef[j +1] = zoneMinusBothVerts[indexOnOtherZone +1] //hrmrm
					}
				}
				else if(thisz === 0) { // rearward edge on z
					if(zoneMinusZ) {
						const indexOnOtherZone = coordToIndex(thisx, WorldSys.ZONE_DATUMS, WorldSys.ZONE_ARR_SIDE_LEN, 3)
						verticesRef[j +1] = zoneMinusZVerts[indexOnOtherZone +1] //hrmrm
					}
				}
				else if(thisx === 0) {
					if(zoneMinusX) {
						const indexOnOtherZone = coordToIndex(WorldSys.ZONE_DATUMS, thisz, WorldSys.ZONE_ARR_SIDE_LEN, 3)
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
		const nColorCount = 3 // r,g,b
		// const nFaces = WorldSys.ZONE_DATUMS *WorldSys.ZONE_DATUMS *2; // e.g. 6 for a pyramid (?)
		// const nVerticesPerFace = 3; // 3 for Triangle faces
		
		// Add color attribute to geometry, so that I can use vertex colors
		const colorArr = new Float32Array(verticesRef.length) 
		geometry.setAttribute('color', new Float32BufferAttribute(colorArr, nColorCount))
		const colorsRef = geometry.getAttribute('color').array as Float32Array
	
		// console.log(verticesRef.length, colorArr.length, colorsRef.length, geometry)

		// let waterNearbyIndex = new Array(WorldSys.ZONE_ARR_SIDE_LEN **2).fill(0)
		let colorNotFound = ''

		for (let index=0, l=verticesRef.length /nColorCount; index < l; index++) {
			const lcString = WorldSys.StringifyLandcover[zone.landcoverData[index]]
			let color = this.colorFromLc[lcString]

			const coordOfVerticesIndex = indexToCoord(index, WorldSys.ZONE_ARR_SIDE_LEN) // i abstracts away color index

			// Find water nearby
			/* @removewater
			for(let z=-1; z<=1; z++) {
				for(let x=-1; x<=1; x++) {
					const offsetIndex = coordToIndex(coordOfVerticesIndex.x +x, coordOfVerticesIndex.z +z, WorldSys.ZONE_ARR_SIDE_LEN)
					if(
						WorldSys.StringifyLandcover[zone.landcoverData[offsetIndex]] === 'River'
						|| WorldSys.StringifyLandcover[zone.landcoverData[offsetIndex]] === 'Lake'
						// || WorldSys.StringifyLandcover[zone.landcoverData[offsetIndex]] === 'Streamsmall'
						// || WorldSys.StringifyLandcover[zone.landcoverData[offsetIndex]] === 'Streammedium'
						// || WorldSys.StringifyLandcover[zone.landcoverData[offsetIndex]] === 'Streamlarge'
					) {
						waterNearbyIndex[index]++ // Save for later
					}
				}
			}
				*/

			// Spread color from this vertex as well as to its +1 forward vertices (ie over the plot, the 20x20ft)
			// LateR: Well, it doesn't work because they get overwritten by their fellows; so instead just do on single point with x<=0,z<=0.
			for(let z=0; z<=0; z++) {
				for(let x=0; x<=0; x++) {
					const colorsIndexOfGridPoint = coordToIndex(coordOfVerticesIndex.x +x, coordOfVerticesIndex.z +z, WorldSys.ZONE_ARR_SIDE_LEN, 3)
					if(!color) {
						colorNotFound = zone.landcoverData[index] + lcString
						color = this.colorFromLc.Grassland // todo add colors?
					}

					// if(x==1 && z==1) continue
					// We don't want to overwrite points already written forward; so skip any already written.
					// if(!(colorsRef[colorsIndexOfGridPoint +0] == 0 
					// 	&& colorsRef[colorsIndexOfGridPoint +1] == 0
					// 	&& colorsRef[colorsIndexOfGridPoint +2] == 0
					// )) continue
					// {
					// Not yet set
					colorsRef[colorsIndexOfGridPoint +0] = color.r
					colorsRef[colorsIndexOfGridPoint +1] = color.g
					colorsRef[colorsIndexOfGridPoint +2] = color.b
					// }
				}
			}
		}
		if(colorNotFound) console.warn('Some colors not found!  One is:', colorNotFound)

		// Save a copy of colorsRef to the zone so we can bounce off it later when adding footsteps dirt color
		zone.colorsCopy = colorsRef.slice()

		// Water?  Delayed?
		/* @removewater
		setTimeout(() => {
			if(!
			(
				(zone.x == 0 && zone.z == 0)
			)
			){
				return // zonetodo
			}

			const cubeSize = 3 // Must divide into 10
			const waterCubePositions = []
			const waterCubeColors = []

			const entZone = this.babs.ents.get(zone.id) as Zone // zonetodo convert all zone refs to ents

			for (let index=0, l=verticesRef.length /nColorCount; index < l; index++) {
				const lcString = WorldSys.StringifyLandcover[zone.landcoverData[index]]
				const coordOfVerticesIndex = indexToCoord(index, WorldSys.ZONE_ARR_SIDE_LEN) // i abstracts away color index
				// console.log('gridPointofVerticesIndex', coordOfVerticesIndex)
				// Create cubes on all spots in between
				if(this.WaterTypes.includes(lcString)) {
					const spacing = 1
					for(let z=0; z<4 /cubeSize /Math.round(spacing); z++) {
						for(let x=0; x<4/cubeSize /Math.round(spacing); x++) {

							const xpos = coordOfVerticesIndex.x *5 +z*cubeSize *spacing -spacing*4 +1// Well that's opaque lol
							const zpos = coordOfVerticesIndex.z *5 +x*cubeSize *spacing -spacing*4 +1
							
							const yardCoord = YardCoord.Create({
								x: clamp(xpos, 0, WorldSys.ZONE_MOVEMENT_EXTENT),
								z: clamp(zpos, 0, WorldSys.ZONE_MOVEMENT_EXTENT),
								zone: entZone,
							})
							// const engineCoord = yardCoord.toEngineCoord()
							// const rayPosition = entZone.rayHeightAt(engineCoord)
							// New Coords are beautiful to work with...
							const engCoordCentered = yardCoord.toEngineCoordCentered()
							const engPositionVector = new Vector3(engCoordCentered.x, entZone.engineHeightAt(yardCoord), engCoordCentered.z)
							// engPositionVector.add(new Vector3(-this.babs.worldSys.shiftiness.x, 0, -this.babs.worldSys.shiftiness.z))

							if(waterNearbyIndex[index] > 5) {
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
			const geometry2 = new IcosahedronGeometry(sizeish, 1)
			const material = new MeshLambertMaterial({})
			this.waterInstancedMesh = new InstancedMesh(geometry2, material, waterCubePositions.length)
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

		}, 2000) // todo race condition here; will get fixed when water moves to wobs
		*/
	}

	shiftiness = new Vector3()
	shiftEverything(xShift :number, zShift :number, initialLoadExcludeSelf = false) {
		console.debug('shiftEverything', xShift, zShift, initialLoadExcludeSelf ? 'initialLoadExcludeSelf=truthy' : 'initialLoadExcludeSelf=falsy')
		const shiftVector = new Vector3(xShift, 0, zShift)

		const excludeFromShift = [
			// 'ground',
			'groundgrid',
			'camerahelper', 
			'three-helper', 'dirlight', 'hemilight',
			'nightsky', 'daysky',
			'cameraGroup', 'camera', // Doesn't really matter since they're set per frame anyway, but might as well.
		]
		if(initialLoadExcludeSelf) excludeFromShift.push('self')

		let shiftingLog = []
		this.babs.group.children.forEach(child => {
			// console.log('will shift?', child.name)
			if(excludeFromShift.includes(child.name)) return

			// @ts-ignore
			if(child.noShiftiness) {
				// console.log('noShiftiness', child.name) // todo shiftiness
				return // Having done this, now the shift is just: ground, fire, firelight, and self (sometimes).
			}
			// console.log('gonna shift', child.name)

			child.position.setX(child.position.x +shiftVector.x)
			child.position.setZ(child.position.z +shiftVector.z)
			if(child.name != 'ground') {
				shiftingLog.push(child.name || child)
			}
			if(child.name == 'player') {
				// const player = this.babs.ents.get(child.idplayer) as Player
				// const shiftYards = shiftVector.clone().divideScalar(4).floor()
				// player.controller.gDestination.add(shiftYards)
			}
			// child.updateMatrixWorld(true)
			// child.updateMatrix()
			// child.matrixWorldNeedsUpdate = true
		})

		// Also update Fire.FireLights, since they are not in the group (they're just recordkeeping)
		Fire.FireLights.forEach(light => {
			light.position.add(shiftVector)
		})

		this.shiftiness.add(shiftVector)
		// return shiftVector
		
		console.debug('shiftEverything includes (minus ground)', xShift, zShift, 'shifted', shiftingLog.join(', '))
	}

}

