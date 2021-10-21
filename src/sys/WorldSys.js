
import * as Utils from '../Utils'
import ndarray from 'ndarray'
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
} from 'three'
import { log } from './../Utils'
import { WireframeGeometry } from 'three'
import { LineSegments } from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'

import { GUI } from 'three/examples/jsm/libs/dat.gui.module.js'

export class WorldSys {

    static ZoneLength = 1000

	static MAX_VIEW_DISTANCE = WorldSys.ZoneLength
	
    worldMesh

	scene

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
		mieDirectionalG: 0.7,
		elevation: 45,//2,
		azimuth: 180,
		// exposure: renderer.toneMappingExposure
	}

	
    constructor(renderer, scene, camera, player) {

		this.scene = scene

        // Old sky
        // scene.background = new Color().setHSL( 0.6, 0, 1 )
        // const vertexShader = document.getElementById( 'vertexShader' ).textContent
        // const fragmentShader = document.getElementById( 'fragmentShader' ).textContent
        // const uniforms = {
        //     "topColor": { value: new Color( 0x0077ff ) },
        //     "bottomColor": { value: new Color( 0xffffff ) },
        //     "offset": { value: 33 },
        //     "exponent": { value: 0.6 }
        // }
        // uniforms.topColor.value.copy( hemiLight.color )
        // scene.fog.color.copy( uniforms[ "bottomColor" ].value )
        // const skyGeo = new SphereGeometry( 4000, 32, 15 )
        // const skyMat = new ShaderMaterial( {
        //     uniforms: uniforms,
        //     vertexShader: vertexShader,
        //     fragmentShader: fragmentShader,
        //     side: BackSide
        // } )
        // const sky = new Mesh( skyGeo, skyMat )
        // scene.add( sky )


		// New sky (not lighting)
		this.sky = new Sky()
		this.sky.scale.setScalar(450000)
		scene.add(this.sky)
		
		this.sunPosition = new Vector3()

		this.effectController.exposure = renderer.toneMappingExposure
		const updateSkyValues = () => {


			const uniforms = this.sky.material.uniforms
			uniforms[ 'turbidity' ].value = this.effectController.turbidity
			uniforms[ 'rayleigh' ].value = this.effectController.rayleigh
			uniforms[ 'mieCoefficient' ].value = this.effectController.mieCoefficient
			uniforms[ 'mieDirectionalG' ].value = this.effectController.mieDirectionalG

			const phi = MathUtils.degToRad( 90 - this.effectController.elevation )
			const theta = MathUtils.degToRad( this.effectController.azimuth )

			this.sunPosition.setFromSphericalCoords( 1, phi, theta )

			uniforms['sunPosition'].value.copy( this.sunPosition )

			renderer.toneMappingExposure = this.effectController.exposure
			renderer.render( scene, camera )

		}

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
		// scene.add(light)

        this.hemiLight = new HemisphereLight( 0xffffff, 0xffffff, 0)
        const hemiLightHelper = new HemisphereLightHelper( this.hemiLight, 10 )
        scene.add( hemiLightHelper )
        this.hemiLight.color.setHSL( 45/360, 1, 1)//92/100 )
        this.hemiLight.groundColor.setHSL( 245/360, 92/100, 1)
        scene.add( this.hemiLight )

		// https://hslpicker.com/#fff5d6
		// http://www.workwithcolor.com/hsl-color-picker-01.htm







		// Directional light

        this.dirLight = new DirectionalLight(0xffffff, 0)
		this.dirLight.target = player
        scene.add(this.dirLight)
        this.dirLightHelper = new DirectionalLightHelper( this.dirLight, 10 )
        scene.add( this.dirLightHelper )

		const hsl = { h: 45/360, s: 1, l: 1}//92/100 }
        this.dirLight.color.copy(new Color().setHSL(hsl.h, hsl.s, hsl.l))
        // this.dirLight.position.set(this.lightShift.x, this.lightShift.y, this.lightShift.z).normalize()
        // this.dirLight.position.multiplyScalar( 3 )




		// Shadow
		// Perhaps use https://github.com/vHawk/three-csm https://threejs.org/examples/?q=shadow#webgl_shadowmap_csm

		// this.dirLight.castShadow = true
        // this.dirLight.shadow.mapSize.width = 2048
        // this.dirLight.shadow.mapSize.height = 2048
        // const d = 75
        // this.dirLight.shadow.camera.top = 0//d
        // this.dirLight.shadow.camera.left = 0
        // this.dirLight.shadow.camera.bottom = 0
        // this.dirLight.shadow.camera.right = 0//d
        // this.dirLight.shadow.camera.far = 500
        // this.dirLight.shadow.bias = - 0.001

		// var shadowHelper = new CameraHelper( this.dirLight.shadow.camera )
		// scene.add( shadowHelper )

        // renderer.shadowMap.enabled = true
		// renderer.shadowMap.type = PCFSoftShadowMap
        // renderer.shadowMap.autoUpdate/needsUpdate // Maybe use when sun isn't moving every frame

        scene.fog = new Fog(
			new Color(), 
			1, 
			this.MAX_VIEW_DISTANCE
		)
		// May have to do like sun.material.fog = false ?  Not for sun since it's shader, but perhaps for other far things
		// https://www.youtube.com/watch?v=k1zGz55EqfU Fog video, would be great for rain

    }

    update(delta, camera) {
		
		// Adjust fog lightness (white/black) to sun elevation
		const elevationRatio = this.effectController.elevation /90
		const elevationRatioCapped = Math.min(50, this.effectController.elevation) /90
		this.scene.fog.color.setHSL(
			34/360, // Which color
			0.1, // How much color
			0.02 + (elevationRatioCapped *1.25) // Tweak this 1.25 and the 50 above, to adjust fog appropriateness
		)
		// this.scene.fog.far = ((this.effectController.elevation /elevationMax)  // Decrease fog at night // Not needed with better ratio

		// Put directional light at sun position, just farther out
		this.dirLight.position.copy(this.sunPosition.clone().multiplyScalar(10000))

		this.dirLight.intensity = MathUtils.lerp(0, 2, elevationRatio)
		this.hemiLight.intensity = MathUtils.lerp(0.20, 0.75, elevationRatio)
		// log('intensity', this.dirLight.intensity, this.hemiLight.intensity)

    }


    async loadStatics(urlFiles, scene, zone) {
        const geometry = new PlaneGeometry( 1000, 1000, 25, 25 )
        geometry.rotateX( - Math.PI / 2 ); // Make the plane horizontal
        geometry.translate(WorldSys.ZoneLength /2, 0, WorldSys.ZoneLength /2)

        const material = new MeshPhongMaterial( {side: FrontSide} )
        material.color.setHSL( 0.095, 0.5, 0.20 )
        const ground = new Mesh( geometry, material )
        ground.name = 'ground'
        ground.castShadow = true
        ground.receiveShadow = true


        await this.genTerrain(urlFiles, geometry, zone)
        geometry.computeVertexNormals()

        scene.add( ground )

		let wireframe = new WireframeGeometry( geometry )
		let line = new LineSegments( wireframe )
		line.material.color.setHex(0x000000)
		scene.add(line)

    }

    terrainData = null
    // rawTexture1
    // rawTexture2
    // public groundMesh
    // waterMesh
    // async loadStatics(urlFiles, scene) {

    //     let timeReporter = Utils.createTimeReporter(); timeReporter.next()
    //     timeReporter.next('loadStatics:')

    //     log.info("loading~")
    //     // const light = new HemisphericLight('light1', new Vector3(0, 1, 0), scene) // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    //     const light = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 0.5), scene)
    //     light.intensity = 1

    //         // Skybox
    //     var skybox = Mesh.CreateBox("skyBox", 10000.0, scene)
    //     skybox.position = new Vector3(500, -100, 500)
    //     var skyboxMaterial = new StandardMaterial("skyBox", scene)
    //     skyboxMaterial.backFaceCulling = false
    //     skyboxMaterial.reflectionTexture = new CubeTexture(`${urlFiles}/texture/TropicalSunnyDay`, scene)
    //     skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE
    //     skyboxMaterial.diffuseColor = new Color3(0, 0, 0)
    //     skyboxMaterial.specularColor = new Color3(0, 0, 0)
    //     skyboxMaterial.disableLighting = true
    //     skybox.material = skyboxMaterial

    //     let mixMaterial = Utils.getMixMaterial(urlFiles, scene)
    //     // mixMaterial.wireframe = true
    //     this.rawTexture1 = new RawTexture( new Uint8Array(250*250*4),
    //         ZONE.ZONE_DATUMS, ZONE.ZONE_DATUMS, Engine.TEXTUREFORMAT_RGBA, scene,
    //         Utils.ZONE_TEXTURE_GEN_MIPMAPS, Utils.ZONE_TEXTURE_INVERTY, 
    //         Texture.TRILINEAR_SAMPLINGMODE, Engine.TEXTURETYPE_UNSIGNED_INT
    //     )
    //     mixMaterial.mixTexture1 = this.rawTexture1
    //     this.rawTexture2 = new RawTexture( new Uint8Array(250*250*4),
    //         ZONE.ZONE_DATUMS, ZONE.ZONE_DATUMS, Engine.TEXTUREFORMAT_RGBA, scene,
    //         Utils.ZONE_TEXTURE_GEN_MIPMAPS, Utils.ZONE_TEXTURE_INVERTY, 
    //         Texture.TRILINEAR_SAMPLINGMODE, Engine.TEXTURETYPE_UNSIGNED_INT
    //     )
    //     mixMaterial.mixTexture2 = this.rawTexture2

    //     this.groundMesh = Mesh.CreateGround('ground', 1000, 1000, 1)
    //     this.groundMesh.setParent(this.worldMesh)
    //     this.groundMesh.material = mixMaterial

    //     this.waterMesh = new Mesh(`Waters`, scene)
    //     this.waterMesh.setParent(this.worldMesh)
    //     this.waterMesh.position = new Vector3(0,0,0) 
    //     this.waterMesh.scaling = new Vector3(1,1,1)

    //     var waterMaterial = new WaterMaterial("water_material", scene, new Vector2(1, 1))
    //     waterMaterial.bumpTexture = new Texture(`${urlFiles}/texture/waterbump.png`, scene)
    //     waterMaterial.windForce = 30
    //     waterMaterial.waveHeight = 0//0.05
    //     waterMaterial.windDirection = new Vector2(1, 1)
    //     waterMaterial.waterColor = new Color3(0.1, 0.1, 0.6)
    //     waterMaterial.colorBlendFactor = 0.3
    //     waterMaterial.bumpHeight = 1
    //     waterMaterial.waveLength = 0 //1
    //     // waterMaterial.addToRenderList(skybox) // TODO seems a bit broken
    //     // waterMaterial.addToRenderList(ground)
    //     this.waterMesh.material = waterMaterial

    //     timeReporter.next('updateTerrain:')
    //     await this.updateTerrain(urlFiles)
    //     timeReporter.next('updateLandcover:')
    //     await this.updateLandcover(urlFiles)
    //     timeReporter.next('Done')
    // }
    async genTerrain(urlFiles, geometry, zone) {
        let timeReporter = Utils.createTimeReporter(); timeReporter.next()

        timeReporter.next('Terrain start')
        this.terrainData = null
        timeReporter.next('Terrain unset')
        
        // this.groundMesh.name = `ground` // dataUrl.split('/').slice(-1)[0]
        // const data = await ky.get(dataUrl)
        // timeReporter.next('Terrain ky.get')
        const fet = await fetch(`${urlFiles}/zone/${zone.id}/elevations`)
        const data = await fet.blob()
        timeReporter.next('Terrain fetch.blob')

        const buff = await data.arrayBuffer()
        // timeReporter.next('Terrain data.arrayBuffer')
        this.terrainData = new Uint8Array(buff)
        // timeReporter.next('Terrain new Uint8Array')
        // this.groundMesh = await Utils.terrainGenerate(this.terrainData, this.groundMesh)


        const vertices = geometry.getAttribute('position').array
        for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
            // j + 1 because it is the y component that we modify
            vertices[ j + 1 ] = this.terrainData[ i ]

        }

        timeReporter.next('Terrain Utils.terrainGenerate')
    }
    // async updateLandcover(urlFiles) {
    //     while(this.terrainData === null) await sleep(100)
    //     const lcBuffer = await ky.get(`${urlFiles}/terrain/LANDCOVER.bil`).arrayBuffer()
    //     const landcoverData = ndarray(new Uint8Array(lcBuffer), [ZONE.ARR_SIDE_LEN,ZONE.ARR_SIDE_LEN])
    //     const [landcoverRGBAs1, landcoverRGBAs2] = await Utils.landcoverGenerate(landcoverData)
    //     this.rawTexture1.update(landcoverRGBAs1)
    //     this.rawTexture2.update(landcoverRGBAs2)
    //     const water = Utils.waterGenerate(landcoverData, ndarray(this.terrainData, [251,251]))
    //     if(water) {
    //         water.applyToMesh(this.waterMesh, true)
    //     }
    // }

    

}
