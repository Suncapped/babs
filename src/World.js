
import * as Utils from './Utils'
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
} from 'three'

export class World {

    static ZoneLength = 1000

    dirLight
    dirLightHelper

    lightShift = new Vector3((- 1) *30, 0.25 *30, 1 *30) // for re-use

    worldMesh
    constructor (scene) {

        // let renderer = new WebGLRenderer()

        // renderer.shadowMap.enabled = true
        // renderer.shadowMap.type = PCFSoftShadowMap // or any other type of shadowmap

        scene.background = new Color().setHSL( 0.6, 0, 1 )
        scene.fog = new Fog( scene.background, 1, 5000 )

        // LIGHTS

		// this.scene.add( new AmbientLight( 0x222222 ) ) // Maybe?

        const hemiLight = new HemisphereLight( 0xffffff, 0xffffff, 0.2 )
        hemiLight.color.setHSL( 0.6, 1, 0.6 )
        hemiLight.groundColor.setHSL( 0.095, 1, 0.75 )
        hemiLight.position.set( 0, 50, 0 ).normalize()
        // scene.add( hemiLight )
        const hemiLightHelper = new HemisphereLightHelper( hemiLight, 10 )
        // scene.add( hemiLightHelper )

        this.dirLight = new DirectionalLight(0xffffff, 1)
        // this.dirLight.color.setHSL( 0.1, 1, 0.95 )
        this.dirLight.position.set(this.lightShift.x, this.lightShift.y, this.lightShift.z).normalize()
        this.dirLight.position.multiplyScalar( 30 )
        // this.dirLight.target
        scene.add(this.dirLight)
        this.dirLight.castShadow = true
        this.dirLight.shadow.mapSize.width = 2048
        this.dirLight.shadow.mapSize.height = 2048
        const d = 50
        this.dirLight.shadow.camera.left = - d
        this.dirLight.shadow.camera.right = d
        this.dirLight.shadow.camera.top = d
        this.dirLight.shadow.camera.bottom = - d
        this.dirLight.shadow.camera.far = 3500
        this.dirLight.shadow.bias = - 0.0001
        this.dirLightHelper = new DirectionalLightHelper( this.dirLight, 10 )
        scene.add( this.dirLightHelper )

        this.dirLight.visible = true
        hemiLight.visible = false

        // SKYDOME
        const vertexShader = document.getElementById( 'vertexShader' ).textContent
        const fragmentShader = document.getElementById( 'fragmentShader' ).textContent
        const uniforms = {
            "topColor": { value: new Color( 0x0077ff ) },
            "bottomColor": { value: new Color( 0xffffff ) },
            "offset": { value: 33 },
            "exponent": { value: 0.6 }
        }
        uniforms.topColor.value.copy( hemiLight.color )
        scene.fog.color.copy( uniforms[ "bottomColor" ].value )
        const skyGeo = new SphereGeometry( 4000, 32, 15 )
        const skyMat = new ShaderMaterial( {
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: BackSide
        } )
        const sky = new Mesh( skyGeo, skyMat )
        scene.add( sky )

    }

    animate(delta, camera, player) {


        // csm.update(camera.matrix)

        // console.log(playerPosition)


        // this.dirLight.position.set( - 1, 1.75, 1 )
        // let temp = new Vector3()
        // temp.addScaledVector(new Vector3(- 1, 1.75, 1), 30)
        // temp.add(playerPosition)

        // this.dirLight.position.copy(camera.position)
        // const rounded = camera.position.clone().round()
        document.getElementById('log').innerText = `${Math.floor(camera.position.x / 4)}, ${Math.round(camera.position.y)}, ${Math.floor(camera.position.z / 4)}`


        this.dirLight.target.position.set( camera.position.x, camera.position.y + 50, camera.position.z ); // Set cube to camera
        this.dirLight.position.copy( this.dirLight.target.position ).add( this.lightShift )


        // this.dirLight.position.x = camera.position.x - player.cameraStartPosition.x + 20 
        // this.dirLight.position.z = camera.position.z - player.cameraStartPosition.z + 20
        // this.dirLight.target.position.set(( camera.position.x - player.cameraStartPosition.x),0,(camera.position.z - player.cameraStartPosition.z))


        // this.dirLight.position.addScaledVector(new Vector3(- 1, 1.75, 1), 30)
        // this.dirLight.position.multiplyScalar( 30 )

        // let newpos = new Vector3(-1, 1.75, 1)
        // newpos = newpos.multiplyScalar(30)

        // this.dirLight.position.set(newpos) // - 1, 1.75, 1 
    }


    async loadStatics(urlFiles, scene, zone) {
        const geometry = new PlaneGeometry( 1000, 1000, 25, 25 )
        geometry.rotateX( - Math.PI / 2 ); // Make the plane horizontal
        geometry.translate(World.ZoneLength /2, 0, World.ZoneLength /2)

        const material = new MeshPhongMaterial( {side: FrontSide} )
        material.color.setHSL( 0.095, 1, 0.75 )
        const ground = new Mesh( geometry, material )
        ground.name = 'ground'
        ground.castShadow = true
        ground.receiveShadow = true


        await this.updateTerrain(urlFiles, geometry, zone)
        geometry.computeVertexNormals()

        scene.add( ground )
    }

    terrainData = null
    // rawTexture1
    // rawTexture2
    // public groundMesh
    // waterMesh
    // async loadStatics(urlFiles, scene) {

    //     let timeReporter = Utils.createTimeReporter(); timeReporter.next()
    //     timeReporter.next('loadStatics:')

    //     console.log("loading~")
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
    async updateTerrain(urlFiles, geometry, zone) {
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
