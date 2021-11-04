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
} from 'three'
import { log } from './../Utils'
import { WireframeGeometry } from 'three'
import { LineSegments } from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { debugMode } from "../stores"

import { GUI } from 'three/examples/jsm/libs/dat.gui.module.js'
import { Gob } from '../ent/Gob'

export class WorldSys {

	static ZoneLength = 1000

	static MAX_VIEW_DISTANCE = WorldSys.ZoneLength

	static ZoneSegments = 25

	static ZoneTerrainMin = new Vector3(0,0,0)
	static ZoneTerrainMax = new Vector3(1000,10_000,1000)

	
    worldMesh

	babs

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
		elevation: 75,//2,
		azimuth: 180,
		// exposure: renderer.toneMappingExposure
	}

	LANDCOVER = {
		56: 'grass',
		64: 'dirt',
		69: 'sand',
		76: 'cliff',
		4: 'lake',
		5: 'lakeshore',
		6: 'river',
		7: 'rivershore',
		8: 'streamsmall',
		9: 'streammedium',
		10: 'streamlarge',
		11: 'streamshore',
	}

	
    constructor(renderer, babs, camera, player) {

		this.babs = babs

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
		this.sky = new Sky()
		this.sky.scale.setScalar(450000)
		this.babs.scene.add(this.sky)
		
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
			renderer.render( this.babs.scene, camera )

		}

		const skyUi = false
		if(skyUi) {
			const gui = new GUI()
			gui.add( this.effectController, 'turbidity', 0.0, 20.0, 0.1 ).onChange( updateSkyValues )
			gui.add( this.effectController, 'rayleigh', 0.0, 4, 0.001 ).onChange( updateSkyValues )
			gui.add( this.effectController, 'mieCoefficient', 0.0, 0.1, 0.001 ).onChange( updateSkyValues )
			gui.add( this.effectController, 'mieDirectionalG', 0.0, 1, 0.001 ).onChange( updateSkyValues )
			gui.add( this.effectController, 'elevation', 0, 90, 0.1 ).onChange( updateSkyValues )
			gui.add( this.effectController, 'azimuth', - 180, 180, 0.1 ).onChange( updateSkyValues )
			gui.add( this.effectController, 'exposure', 0, 1, 0.0001 ).onChange( updateSkyValues )
		}
		updateSkyValues()


		// New lighting
		// Might want ambient light in addition to hemispheric?  Maybe for indoors?
		// let light = new AmbientLight(0xFFFFFF, 1)
		// this.babs.scene.add(light)

        this.hemiLight = new HemisphereLight(0xffffff, 0xffffff, 0)
        const hemiLightHelper = new HemisphereLightHelper(this.hemiLight, 10)
        this.babs.scene.add(hemiLightHelper)
        this.hemiLight.color.setHSL(45/360, 1, 1).convertSRGBToLinear()
        this.hemiLight.groundColor.setHSL(245/360, 92/100, 1).convertSRGBToLinear()
        this.babs.scene.add(this.hemiLight)

		// https://hslpicker.com/#fff5d6
		// http://www.workwithcolor.com/hsl-color-picker-01.htm


		// Directional light
        this.dirLight = new DirectionalLight(0xffffff, 0)
		this.dirLight.target = player
        this.babs.scene.add(this.dirLight)
        this.dirLightHelper = new DirectionalLightHelper(this.dirLight, 10)
        this.babs.scene.add(this.dirLightHelper)

        this.dirLight.color.setHSL(45/360, 1, 1).convertSRGBToLinear()
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
		// this.babs.scene.add( shadowHelper )

        // renderer.shadowMap.enabled = true
		// renderer.shadowMap.type = PCFSoftShadowMap
        // renderer.shadowMap.autoUpdate/needsUpdate // Maybe use when sun isn't moving every frame

        this.babs.scene.fog = new Fog(
			new Color(), 
			1, 
			WorldSys.MAX_VIEW_DISTANCE *1.5
		)
		// May have to do like sun.material.fog = false ?  Not for sun since it's shader, but perhaps for other far things
		// https://www.youtube.com/watch?v=k1zGz55EqfU Fog video, would be great for rain


    }

    update(delta, camera) {
		
		// Adjust fog lightness (white/black) to sun elevation
		const elevationRatio = this.effectController.elevation /90
		const elevationRatioCapped = Math.min(50, this.effectController.elevation) /90
		this.babs.scene.fog.color.setHSL(
			34/360, // Which color
			0.1, // How much color
			0.02 + (elevationRatioCapped *1.25) // Tweak this 1.25 and the 50 above, to adjust fog appropriateness
		)
		// this.babs.scene.fog.far = ((this.effectController.elevation /elevationMax)  // Decrease fog at night // Not needed with better ratio

		// Put directional light at sun position, just farther out
		this.dirLight.position.copy(this.sunPosition.clone().multiplyScalar(10000))

		this.dirLight.intensity = MathUtils.lerp(0.01, 0.75, elevationRatio)
		this.hemiLight.intensity = MathUtils.lerp(0.05, 0.25, elevationRatio)
		// log('intensity', this.dirLight.intensity, this.hemiLight.intensity)

    }


    async loadStatics(urlFiles, zone) {
        let geometry = new PlaneGeometry(WorldSys.ZoneLength, WorldSys.ZoneLength, WorldSys.ZoneSegments, WorldSys.ZoneSegments)
		// geometry = geometry.toNonIndexed()
        geometry.rotateX( -Math.PI / 2 ); // Make the plane horizontal
        geometry.translate(WorldSys.ZoneLength /2, 0, WorldSys.ZoneLength /2)

        const material = new MeshPhongMaterial( {side: FrontSide} )
        // const material = new MeshStandardMaterial({vertexColors: true})
        // material.color.setHSL( 0.095, 0.5, 0.20 )
		material.vertexColors = true


        await this.genTerrain(urlFiles, geometry, zone)
        await this.genLandcover(urlFiles, geometry, zone)
		
        geometry.computeVertexNormals()


        const ground = new Mesh( geometry, material )
        ground.name = 'ground'
        ground.castShadow = true
        ground.receiveShadow = true
        this.babs.scene.add( ground )

		const groundGrid = new LineSegments(new WireframeGeometry(geometry))
		groundGrid.material.color.setHex(0x333333).convertSRGBToLinear()
		this.babs.scene.add(groundGrid)
		debugMode.subscribe(on => {
			log('debugMode change', on)
			groundGrid.visible = on
		})

    }

    async loadObjects(zone) {
        
		setTimeout(async () => { // do on next event loop
			// Sampling of objects
			const childIndex = 0
			const loadItems = [
				'flower-lotus.gltf',
				'flowers-carnations.gltf', 'grass-basic.gltf',
				'grass.gltf',              'mushroom-boletus.gltf',
				'mushroom-toadstool.gltf', 'obj-chisel.gltf',
				'obj-tablet.gltf',         'obj-timber.gltf',
				'rock-crystal.gltf',       'rock-pillarsmall.gltf',
				'rock-terrassesmall.gltf', 'rocks-sharpsmall.gltf',
				'rocks-small.gltf',        'stone-diamond.gltf',
				'stump.gltf',              'tree-birchtall.gltf',
				'tree-dead.gltf',          'tree-fallenlog.gltf',
				'tree-forest-simple.gltf', 'tree-forest.gltf',
				'tree-oak.gltf',           'tree-old.gltf',
				'tree-park.gltf',          'tree-spruce.gltf',

				'bush-basic.gltf', 'obj-mud.gltf', 'obj-blockmud.gltf', 
			]
			let count=0
			for(let item of loadItems) {
				let obj = await Gob.Create(`/environment/gltf/${item}`, this.babs, childIndex)
				obj.mesh.position.copy(this.vRayGroundHeight(count*4*2 +2, 16 *4 +2))
				count++
			}
		}, 1500)

    }

    terrainData
    landcoverData
    // rawTexture1
    // rawTexture2
    // public groundMesh
    // waterMesh
    // async loadStatics(urlFiles, zone) {

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
        
        // timeReporter.next('Terrain ky.get')
        const fet = await fetch(`${urlFiles}/zone/${zone.id}/elevations`)
        const data = await fet.blob()
        timeReporter.next('Terrain fetch.blob')

        const buff = await data.arrayBuffer()
        // timeReporter.next('Terrain data.arrayBuffer')
        this.terrainData = new Uint8Array(buff)
        // timeReporter.next('Terrain new Uint8Array')

		const nCoordsComponents = 3; // x,y,z
        const verticesRef = geometry.getAttribute('position').array
        for (let i=0, j=0, l=verticesRef.length; i < l; i++, j += nCoordsComponents ) {
            // j + 1 because it is the y component that we modify
			// Wow, 'vertices' is a reference that mutates passed-in 'geometry' in place.  That's counter-intuitive.
            verticesRef[j +1] = this.terrainData[i] * zone.yscale // Set vertex height from elevations data
        }

        timeReporter.next('Terrain DONE')
    }
    async genLandcover(urlFiles, geometry, zone) {
		// old updateLandcover()
        // while(this.terrainData === null) await sleep(100)
        // const lcBuffer = await ky.get(`${urlFiles}/terrain/LANDCOVER.bil`).arrayBuffer()
        // const landcoverData = ndarray(new Uint8Array(lcBuffer), [ZONE.ARR_SIDE_LEN,ZONE.ARR_SIDE_LEN])
        // const [landcoverRGBAs1, landcoverRGBAs2] = await Utils.landcoverGenerate(landcoverData)
        // this.rawTexture1.update(landcoverRGBAs1)
        // this.rawTexture2.update(landcoverRGBAs2)
        // const water = Utils.waterGenerate(landcoverData, ndarray(this.terrainData, [251,251]))
        // if(water) {
        //     water.applyToMesh(this.waterMesh, true)
        // }

		// Get landcover data
		let timeReporter = Utils.createTimeReporter(); timeReporter.next()
        timeReporter.next('Landcover start')
        this.landcoverData = null
        timeReporter.next('Landcover unset')
        
        const fet = await fetch(`${urlFiles}/zone/${zone.id}/landcovers`)
        const data = await fet.blob()
        timeReporter.next('Landcover fetch.blob')

        const buff = await data.arrayBuffer()
        // timeReporter.next('Landcover data.arrayBuffer')
        this.landcoverData = new Uint8Array(buff)
        // timeReporter.next('Landcover new Uint8Array')


		// Vertex colors on BufferGeometry using a non-indexed array
        const verticesRef = geometry.getAttribute('position').array
		const nColorComponents = 3;  // r,g,b
		// const nFaces = WorldSys.ZoneSegments *WorldSys.ZoneSegments *2;            // e.g. 6 for a pyramid (?)
		// const nVerticesPerFace = 3;  // 3 for Triangle faces
		
		// Add color attribute to geometry, so that I can use vertex colors
		geometry.addAttribute( 'color', new Float32BufferAttribute(geometry.getAttribute('position').clone(), nColorComponents))
		const colorsRef = geometry.getAttribute('color').array
		
		const grassColor = new Color().setHSL(98/360, 100/100, 20/100).convertSRGBToLinear()
		const dirtColor = new Color().setHSL(35/360, 40/100, 40/100).convertSRGBToLinear()
		const sandColor = new Color().setHSL(49/360, 37/100, 68/100).convertSRGBToLinear()
		const cliffColor = new Color().setHSL(13/360, 61/100, 24/100).convertSRGBToLinear()
		const waterColor = new Color().setHSL(222/360, 39/100, 34/100).convertSRGBToLinear()
		const shoreColor = new Color().setHSL(51/360, 39/100, 34/100).convertSRGBToLinear()
		const colorFromLc = {
			[this.LANDCOVER[56]]: grassColor,
			[this.LANDCOVER[64]]: dirtColor,
			[this.LANDCOVER[69]]: sandColor,
			[this.LANDCOVER[76]]: cliffColor,
			[this.LANDCOVER[5]]: shoreColor,
			[this.LANDCOVER[6]]: waterColor,
			[this.LANDCOVER[7]]: shoreColor,
			[this.LANDCOVER[8]]: waterColor,
			[this.LANDCOVER[9]]: waterColor,
			[this.LANDCOVER[10]]: waterColor,
			[this.LANDCOVER[11]]: shoreColor,
		}

        timeReporter.next('Landcover loop colors')
        for (let index=0, l=verticesRef.length /nColorComponents; index < l; index++) {
			const lcType = this.LANDCOVER[this.landcoverData[index]]
			// Spread color from this vertex as well as to its +1 forward vertices (ie over the piece, the 40x40ft)
			const gridPointofVerticesIndex = Utils.indexToCoord(index, 26) // i abstracts away color index
			for(let x=0; x<=1; x++) {
				for(let z=0; z<=1; z++) {
					const colorsIndexOfGridPoint = Utils.coordToIndex(gridPointofVerticesIndex.x +x, gridPointofVerticesIndex.z +z, 26, 3)
					
					const color = colorFromLc[lcType]
					if(!color) {
						log.warn('Color not found!', this.landcoverData[index], lcType)
					}
					if(color === grassColor) {
						 // Lighten slightly with elevation // Todo add instead of overwrite?
						 grassColor.setHSL(98/360, 80/100, 0.2 +this.terrainData[index] /1000).convertSRGBToLinear()
					}
					colorsRef[colorsIndexOfGridPoint +0] = color.r
					colorsRef[colorsIndexOfGridPoint +1] = color.g
					colorsRef[colorsIndexOfGridPoint +2] = color.b
				}
			}
        }

        timeReporter.next('Landcover DONE')


		// const target = new Vector3(4, 0, 2)
		// const mudColor = new Color().setHSL(0.095, 0.5, 0.20)
		// colorPiece(target, mudColor)


    }

	vRayGroundHeight(gx, gz) {
		const raycaster = new Raycaster(
			new Vector3(gx, WorldSys.ZoneTerrainMax.y, gz), 
			new Vector3( 0, -1, 0 ), 0, 
			WorldSys.ZoneTerrainMax.y
		)

		const ground = this.babs.scene.children.find(o=>o.name=='ground')
		const [intersect] = raycaster.intersectObject(ground, true)
		return intersect.point
	}

    

}
