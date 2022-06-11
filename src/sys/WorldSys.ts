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
} from 'three'
import { log } from './../Utils'
import { WireframeGeometry } from 'three'
import { LineSegments } from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { debugMode } from "../stores"

import { Wob } from '@/ent/Wob'
import { EventSys } from './EventSys'
import * as SunCalc from 'suncalc'
// import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader'
// import { CSM } from 'three/examples/jsm/csm/CSM.js';

import '@stardazed/streams-polyfill'
import { EngineCoord, YardCoord } from '@/comp/Coord'
import { Babs } from '@/Babs'
import { Zone } from '@/ent/Zone'

export class WorldSys {

	static ZoneLength = 1000
	
	static Yard = 4
	static Piece = WorldSys.Yard *10 // 40; 10 tiles
	static Acre = WorldSys.Piece *5 // 200; 5 pieces
	
	static MAX_VIEW_DISTANCE = 1_000_000 // ~200 miles
	static DAYSKY_SCALE = 900_000
	static NIGHTSKY_SIZE = 800_000

	static ZoneSegments = 25

	static ZoneTerrainMin = new Vector3(0,0,0)
	static ZoneTerrainMax = new Vector3(1000,10_000,1000)

	static TIME_SPEED = 100

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

	colorFromLc = {
		// grass: new Color().setHSL(98/360, 100/100, 20/100),
		// dirt: new Color().setHSL(35/360, 40/100, 40/100),
		// sand: new Color().setHSL(49/360, 37/100, 68/100),

		SnowIceTundra: new Color().setHSL(75/360, 3/100, 74/100), // light gray
		BarrenRockSandClay: new Color().setHSL(39/360, 24/100, 64/100), // tan

		ForestDeciduous: new Color().setHSL(73/360, 22/100, 37/100), // green
		ForestEvergreen: new Color().setHSL(92/360, 40/100, 23/100), // dark green
		ForestMixed: new Color().setHSL(80/360, 30/100, 30/100), // in-between ish

		ShrubAndScrub: new Color().setHSL(85/360, 18/100, 47/100), // Browner light green
		Grassland: new Color().setHSL(63/360, 15/100, 50/100), // Light green

		WetlandWoody: new Color().setHSL(8/360, 19/100, 37/100), // Brownish
		WetlandHerbacious: new Color().setHSL(10/360, 14/100, 47/100), // Brownish lighter

		Lake: new Color().setHSL(222/360, 39/100, 34/100),
		LakeShore: new Color().setHSL(51/360, 39/100, 34/100),
		River: new Color().setHSL(222/360, 39/100, 34/100),
		RiverShore: new Color().setHSL(51/360, 39/100, 34/100),
		StreamSmall: new Color().setHSL(222/360, 39/100, 34/100),
		StreamMedium: new Color().setHSL(222/360, 39/100, 34/100),
		StreamLarge: new Color().setHSL(222/360, 39/100, 34/100),
		StreamShore: new Color().setHSL(51/360, 39/100, 34/100),

		Cliff: new Color().setHSL(13/360, 61/100, 24/100),
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
        // this.babs.scene.add( sky )


		// New sky (not lighting)
		this.daysky = new Sky()
		this.daysky.name = 'daysky'
		this.daysky.scale.setScalar(WorldSys.DAYSKY_SCALE )
		this.babs.scene.add(this.daysky)
		
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
		// this.babs.scene.add(light)

        this.hemiLight = new HemisphereLight(0xffffff, 0xffffff, 0)
		this.hemiLight.name = 'hemilight'
        const hemiLightHelper = new HemisphereLightHelper(this.hemiLight, 10)
		hemiLightHelper.name = 'three-helper'
        this.babs.scene.add(hemiLightHelper)
        this.hemiLight.color.setHSL(45/360, 1, 1).convertSRGBToLinear()
        this.hemiLight.groundColor.setHSL(245/360, 92/100, 1).convertSRGBToLinear()
        this.babs.scene.add(this.hemiLight)

        this.babs.scene.fog = new FogExp2(
			new Color(), 
			// 1, 
			// WorldSys.MAX_VIEW_DISTANCE
			0.0000012 // Default is 0.00025 // Has to be low enough to see stars/skybox
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
		const sides = ['north', 'south', 'top', 'bottom', 'west', 'east'] // +y as north

		const tl = new TextureLoader()
		const nightskyImages = sides.map(side => {

			// Attempting to use precompiled textures but they ended up being huge file sizes and unloadable.  Try again later?
			// var ktx2Loader = new KTX2Loader();
			// ktx2Loader.setTranscoderPath( '/node_modules/three/examples/js/libs/basis/' );
			// ktx2Loader.detectSupport( renderer );
			// return ktx2Loader.load( `${this.babs.urlFiles}/texture/sky/stars-${side}.ktx2`, function ( texture ) {
			// 	// var material = new MeshStandardMaterial( { map: texture } );
			// 	return texture
			// }, function () {
			// 	console.log( 'onProgress' );
			// }, function ( e ) {
			// 	console.error( e );
			// } );

			return tl.loadAsync(`${this.babs.urlFiles}/texture/sky/stars-${side}.png`)
		})

		let materialArray = []
		const buildSkybox = () => {
			const size = WorldSys.NIGHTSKY_SIZE
			const nightskyGeo = new BoxGeometry(size, size, size)
			this.nightsky = new Mesh(nightskyGeo, materialArray)
			this.nightsky.name = 'nightsky'

			// todo perhaps use offscreencanvas to fix this? 
			this.babs.scene.add(this.nightsky)
		}
		Promise.all(nightskyImages).then((images, index) => {
			images.forEach((texture, index) => {
				// Using index to ensure correct order
				materialArray[index] = new MeshBasicMaterial({ map: texture, side: BackSide, transparent: true, })
				if(index === images.length -1 && !this.nightsky) { // Done loading the final one
					buildSkybox()
				}
			})
		})
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
			this.babs.scene.add(this.dirLightHelper)
			
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

			this.babs.scene.add(this.dirLight)

			this.cameraHelper = new CameraHelper(this.dirLight.shadow.camera)
			this.cameraHelper.name = 'camerahelper'
			this.babs.scene.add(this.cameraHelper)

			this.renderer.shadowMap.enabled = true

			// this.renderer.shadowMap.type = BasicShadowMap
			this.renderer.shadowMap.type = PCFShadowMap
			// this.renderer.shadowMap.type = PCFSoftShadowMap
			// this.renderer.shadowMap.type = VSMShadowMap

			this.renderer.shadowMap.autoUpdate = true // /needsUpdate 
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

	// isDaytime = null
	timeMultiplier = WorldSys.TIME_SPEED
	duskMargin = -0.1

	// Temp hack to roughly start people out at the same time
	// tempTimeDiff = new Date().getTime() -new Date(`March 22, 2022 12:00:00`).getTime()

	// todo set from Proxima // need to think more about this!
	// timeAccum = 60*60*12*122 // nighttime
	timeAccum = 60*60*12*1223 // daytime

    update(dt, camera) {

		// Update sun position over time!
		// let hourOfDay = Math.round(new Date().getTime() /1000) %24
		// let nowDate = new Date(`March 22, 2022 ${hourOfDay}:${minOfDay}:00 MDT`)
		// nowDate.setTime(nowDate.getTime() -(1000 *60 *60 *6)) // hours back

		this.timeAccum += dt*1000 *this.timeMultiplier
		// log(Math.round(this.timeAccum))

		let nowDate = new Date(Math.round(this.timeAccum))
		const sunCalcPos = SunCalc.getPosition(nowDate, 39.7392, -104.985)

		const phi = MathUtils.degToRad(90) -sunCalcPos.altitude // transform from axis-start to equator-start
		const theta = MathUtils.degToRad(90*3) -sunCalcPos.azimuth // transform to match experience

		// Adjust fog lightness (white/black) to sun elevation
		const noonness = 1 -(MathUtils.radToDeg(phi) /90) // 0-1, 0 and negative after sunset, positive up to 90 (at equator) toward noon!
		// log('time:', noonness)

		if(noonness < 0 +this.duskMargin) { // nighttime
			this.timeMultiplier = WorldSys.TIME_SPEED *10 // speed up nighttime
			if(this.nightsky?.material[0].opacity !== 1.0) { // Optimization; only run once
				this.nightsky?.material.forEach(m => m.opacity = 1.0)
			}
			
		}
		else if(noonness >= 0 +this.duskMargin) { // daytime
			this.timeMultiplier = WorldSys.TIME_SPEED
			const opacity = MathUtils.lerp(1, 0, (noonness +0.1) *10)
			this.nightsky?.material.forEach(m => m.opacity = opacity)
			this.dirLight ? this.dirLight.castShadow = true : 0
		}

		// Rotate sky // Todo more accurate lol!
		this.nightsky?.rotateY(-0.0002)
		this.nightsky?.rotateX(-0.0002)

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
				// ^ todo have shadows fade out rather than just disappear?
				// 	Or just have less ambient lighting of objects at night?
				this.dirLight.castShadow = false
				this.dirLight.intensity = 0
			}
			else {
				this.dirLight.castShadow = true
				// Intensity based on noonness
				this.dirLight.intensity = MathUtils.lerp(
					0.01, 
					1.0 *(1/this.renderer.toneMappingExposure), 
					Math.max(this.duskMargin, noonness +0.5) // +0.5 boots light around dusk!
				)
			}
		}
		this.hemiLight.intensity = MathUtils.lerp(
			0.5,//0.05, 
			0.3 *(1/this.renderer.toneMappingExposure), 
			Math.max(this.duskMargin, noonness +0.5) // +0.5 boots light around dusk!
		)
		// log('intensity', this.dirLight?.intensity, this.hemiLight.intensity)

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

		this.csm?.update()

		this.updateCount++
    }

	currentGround
	groundMaterial
    async loadStatics(urlFiles, zone, isStartingZone = false) {
        let geometry = new PlaneGeometry(WorldSys.ZoneLength, WorldSys.ZoneLength, WorldSys.ZoneSegments, WorldSys.ZoneSegments)
		// geometry = geometry.toNonIndexed()
        geometry.rotateX( -Math.PI / 2 ); // Make the plane horizontal
        geometry.translate(
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
			// side: Side,
			shadowSide: FrontSide,
			// depthFunc: NeverDepth,
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
		newGround.idzone = zone.id
        newGround.castShadow = true
        newGround.receiveShadow = true
		newGround.zone = zone
		newGround.position.setX(WorldSys.ZoneLength *zone.x)
		newGround.position.setZ(WorldSys.ZoneLength *zone.z)
        this.babs.scene.add(newGround)

		this.babs.ents.get(zone.id).ground = newGround

		if(isStartingZone) {
			log('playerStartingZone', newGround)
			this.currentGround = newGround
		}

		const groundGrid = new LineSegments(new WireframeGeometry(geometry))
		groundGrid.name = 'groundgrid'
		groundGrid.material.color.setHex(0x333333).convertSRGBToLinear()
		groundGrid.position.setX(WorldSys.ZoneLength *zone.x)
		groundGrid.position.setZ(WorldSys.ZoneLength *zone.z)
		this.babs.scene.add(groundGrid)
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

    elevationData = {}
    landcoverData
	waterInstancedMesh
	waterInstancedRands = []
    async genElevation(urlFiles, geometry, zone) {
		// Save thigns onto zone for later
		zone.geometry = geometry

		const nCoordsComponents = 3; // x,y,z
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
			const nCoordsComponents = 3; // x,y,z
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
    async genLandcover(urlFiles, geometry, zone) {
		// Get landcover data
        
		// Vertex colors on BufferGeometry using a non-indexed array
        const verticesRef = geometry.getAttribute('position').array
		const nColorComponents = 3;  // r,g,b
		// const nFaces = WorldSys.ZoneSegments *WorldSys.ZoneSegments *2; // e.g. 6 for a pyramid (?)
		// const nVerticesPerFace = 3; // 3 for Triangle faces
		
		// Add color attribute to geometry, so that I can use vertex colors
		const colorArr = new Float32Array(verticesRef.length) 
		geometry.setAttribute( 'color', new Float32BufferAttribute(colorArr, nColorComponents))
		const colorsRef = geometry.getAttribute('color').array
	

		let waterNearbyIndex = new Array(26*26).fill(0)

        for (let index=0, l=verticesRef.length /nColorComponents; index < l; index++) {
			const lcString = this.StringifyLandcover[zone.landcoverData[index]]
			let color = this.colorFromLc[lcString]

			// Spread color from this vertex as well as to its +1 forward vertices (ie over the piece, the 40x40ft)
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
							})
							const engineCoord = yardCoord.toEngineCoord()
							const rayPosition = entZone.calcHeightAt(engineCoord).toVector3()
							// New Coords are beautiful to work with...

							if(waterNearbyIndex[index] > 7 && rayPosition) {
								waterCubePositions.push(rayPosition)

								const riverBaseColor = this.colorFromLc.River.clone()
								riverBaseColor.offsetHSL(0, 0, (Math.random() -0.1) * 20/100) // -0.1 biases it toward dark

								waterCubeColors.push(riverBaseColor.r, riverBaseColor.g, riverBaseColor.b)
							}

						}
					}
				}
			}

			const geometry = new BoxGeometry(cubeSize *4, cubeSize *4, cubeSize *4)
			const material = new MeshLambertMaterial({})
			this.waterInstancedMesh = new InstancedMesh(geometry, material, waterCubePositions.length)
			this.waterInstancedMesh.name = 'water'
			this.waterInstancedMesh.instanceMatrix.setUsage( StreamDrawUsage ) // So I don't have to call .needsUpdate // https://www.khronos.org/opengl/wiki/Buffer_Object#Buffer_Object_Usage
			this.babs.scene.add(this.waterInstancedMesh)


			const bufferAttr = new InstancedBufferAttribute(new Float32Array( waterCubeColors), 3)
			bufferAttr.needsUpdate = true
			this.waterInstancedMesh.instanceColor = bufferAttr


			for(let i=0, l=waterCubePositions.length; i<l; i++) {
				let matrix = new Matrix4().setPosition(waterCubePositions[i].setY(waterCubePositions[i].y -(cubeSize *4)/2))
				this.waterInstancedMesh.setMatrixAt(i, matrix)
				// this.waterInstancedMesh.setColorAt(i, new Color(0xffffff))
				this.waterInstancedRands[i] = Math.random() - 0.5
			}

		}, 1) // todo race condition here

    }

	zoneAndPosFromCurrent(relativeGridPoint, resolution) { // res eg 40 for pieces, 4? for tiles

		const divisor = 1000 /resolution
	
		const zoneDelta = new Vector3(
			Math.floor(relativeGridPoint.x /divisor),
			0,
			Math.floor(relativeGridPoint.z /divisor),
		)
		// log('curg', this.currentGround)
		const targetZoneCoords = new Vector3(
			(this.currentGround.zone.x + zoneDelta.x),
			0,
			(this.currentGround.zone.z + zoneDelta.z),
		)
		
		const targetZone = this.zones.find(zone=>zone.x==targetZoneCoords.x && zone.z == targetZoneCoords.z)
		if(!targetZone) {
			log('zoneAndPosFromCurrent: No target zone at', targetZoneCoords, 'for relativeGridPoint', relativeGridPoint)
		}
		
		let targetPos = new Vector3(
			relativeGridPoint.x %divisor,
			relativeGridPoint.y, // No transform of Y
			relativeGridPoint.z %divisor,
		)
		// Loop back to max on negative (balances modulus which handles positive)
		if(targetPos.x < 0) targetPos.x += divisor
		if(targetPos.z < 0) targetPos.z += divisor
			
		// log('zoneAndPosFromCurrent', zoneDelta.x+','+zoneDelta.z, ' to ', targetZoneCoords.x+','+targetZoneCoords.z, ' results in ', targetZone.id, ' at point ', targetGridPoint.x+','+targetGridPoint.z)

		return {targetZone, targetPos}
	}

	shiftEverything(xShift, zShift, butPlayer = false) {
		const excludeFromShift = [
			// 'ground', 'groundgrid', 
			butPlayer ? 'player' : 'asdf',
			'camerahelper', 
			'three-helper', 'dirlight', 'hemilight',
			'nightsky', 'daysky',

		] // , 'PointLight', 'ThreeFire', InstancedMesh
		this.babs.scene.children.forEach(child => {
			if(!excludeFromShift.includes(child.name)) {
				child.position.setX(child.position.x +xShift)
				child.position.setZ(child.position.z +zShift)
				if(child.name != 'ground' && child.name != 'groundgrid' ) {
					log('shift', child.name)
				}
			}
			else {
				log('NOT SHIFT', child.name)
			}
		})
	}

}

export class PatchableReadableStream extends ReadableStream {
	constructor (reader) {
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
  