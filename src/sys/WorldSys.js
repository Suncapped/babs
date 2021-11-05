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
} from 'three'
import { log } from './../Utils'
import { WireframeGeometry } from 'three'
import { LineSegments } from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { debugMode } from "../stores"

import { GUI } from 'three/examples/jsm/libs/dat.gui.module.js'
import { Gob } from '../ent/Gob'
import { EventSys } from './EventSys'

import * as BAS from 'three-bas'

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

	StringifyLandcover = {
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
	WaterTypes = [
		'lake',
		'river',
		'streamsmall',
		'streammedium',
		'streamlarge',
	]
	ShoreTypes = [
		'lakeshore',
		'rivershore',
		'streamshore',
	]

	colorFromLc = {
		grass: new Color().setHSL(98/360, 100/100, 20/100),
		dirt: new Color().setHSL(35/360, 40/100, 40/100),
		sand: new Color().setHSL(49/360, 37/100, 68/100),
		cliff: new Color().setHSL(13/360, 61/100, 24/100),
		lakeshore: new Color().setHSL(51/360, 39/100, 34/100),
		river: new Color().setHSL(222/360, 39/100, 34/100),
		rivershore: new Color().setHSL(51/360, 39/100, 34/100),
		streamsmall: new Color().setHSL(222/360, 39/100, 34/100),
		streammedium: new Color().setHSL(222/360, 39/100, 34/100),
		streamlarge: new Color().setHSL(222/360, 39/100, 34/100),
		streamshore: new Color().setHSL(51/360, 39/100, 34/100),
	}

	waterCubes = []


	
    constructor(renderer, babs, camera) {
		EventSys.Subscribe(this)

		this.babs = babs


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
	Event(type, data) {
		if(type === 'controller-ready') {
			if(!data.isSelf) return // Only add lights for self
			// Directional light
			const playerTarget = data.controller.target//this.babs.ents.get(this.babs.idSelf)?.controller?.target

			// todo have this track not-the-player lol.  Perhaps an origin that doesn't move?  Used to be cube
			this.dirLight = new DirectionalLight(0xffffff, 0)
			this.dirLight.target = playerTarget
			this.babs.scene.add(this.dirLight)
			this.dirLightHelper = new DirectionalLightHelper(this.dirLight, 10)
			this.babs.scene.add(this.dirLightHelper)

			this.dirLight.color.setHSL(45/360, 1, 1).convertSRGBToLinear()
			// this.dirLight.position.set(this.lightShift.x, this.lightShift.y, this.lightShift.z).normalize()
			// this.dirLight.position.multiplyScalar( 3 )
		}
	}

	updateCount = 0
	rand = new Vector3().random()
	waterMatrix = new Matrix4()
	vectorPosition = new Vector3()
	quatRotation = new Quaternion()

    update(dt, camera) {
		
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
		this.dirLight?.position.copy(this.sunPosition.clone().multiplyScalar(10000))

		if(this.dirLight) this.dirLight.intensity = MathUtils.lerp(0.01, 0.75, elevationRatio)
		this.hemiLight.intensity = MathUtils.lerp(0.05, 0.25, elevationRatio)
		// log('intensity', this.dirLight.intensity, this.hemiLight.intensity)

		// Water randomized rotation
		const waveSpeed = 5
		if(this.updateCount % (60 * 1) === 0) {
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
				waveSpeed *this.rand.x *this.waterInstancedRands[i] *dt,
				waveSpeed *this.rand.y *this.waterInstancedRands[i] *dt,
				waveSpeed *this.rand.z *this.waterInstancedRands[i] *dt,
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

		this.updateCount++
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
		// ground.visible= false
        this.babs.scene.add( ground )

		const groundGrid = new LineSegments(new WireframeGeometry(geometry))
		groundGrid.material.color.setHex(0x333333).convertSRGBToLinear()
		this.babs.scene.add(groundGrid)
		debugMode.subscribe(on => {
			groundGrid.visible = on
		})

    }

    async loadObjects(zone) {
        
		// Sampling of objects
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
		const objs = await Promise.all(loadItems.map(item => Gob.Create(`/environment/gltf/${item}`, this.babs, 0)))
		objs.forEach((obj, i) => obj.mesh.position.copy(this.vRayGroundHeight(i*2 +2, 16 +2)))



    }

    terrainData
    landcoverData
	waterInstancedMesh
	waterInstancedRands = []
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
		// const nFaces = WorldSys.ZoneSegments *WorldSys.ZoneSegments *2; // e.g. 6 for a pyramid (?)
		// const nVerticesPerFace = 3; // 3 for Triangle faces
		
		// Add color attribute to geometry, so that I can use vertex colors
		geometry.addAttribute( 'color', new Float32BufferAttribute(geometry.getAttribute('position').clone(), nColorComponents))
		const colorsRef = geometry.getAttribute('color').array
	

		let waterNearbyIndex = new Array(26*26).fill(0)

        timeReporter.next('Landcover loop colors')
        for (let index=0, l=verticesRef.length /nColorComponents; index < l; index++) {
			const lcString = this.StringifyLandcover[this.landcoverData[index]]
			const color = this.colorFromLc[lcString]

			// Spread color from this vertex as well as to its +1 forward vertices (ie over the piece, the 40x40ft)
			const coordOfVerticesIndex = Utils.indexToCoord(index, 26) // i abstracts away color index
			for(let z=0; z<=1; z++) {
				for(let x=0; x<=1; x++) {
					const colorsIndexOfGridPoint = Utils.coordToIndex(coordOfVerticesIndex.x +x, coordOfVerticesIndex.z +z, 26, 3)
					if(!color) {
						console.warn('Color not found!', this.landcoverData[index], lcString)
					}
					if(lcString === 'grass') {
						// Lighten slightly with elevation // Todo add instead of overwrite?
						color.setHSL(98/360, 80/100, 0.2 +this.terrainData[index] /1000).convertSRGBToLinear() // todo copy instead of mutate
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
					if(this.StringifyLandcover[this.landcoverData[offsetIndex]] === 'river') {

						waterNearbyIndex[index]++
					}

				}
			}
        }

		// Water?  Delayed?
		setTimeout(() => {

			const cubeSize = 4 // Must divide into 10
			const waterCubePositions = []
			const waterCubeColors = []

			for (let index=0, l=verticesRef.length /nColorComponents; index < l; index++) {
				const lcString = this.StringifyLandcover[this.landcoverData[index]]
				const coordOfVerticesIndex = Utils.indexToCoord(index, 26) // i abstracts away color index
				// log('gridPointofVerticesIndex', coordOfVerticesIndex)
				// Create cubes on all spots in between
				if(this.WaterTypes.includes(lcString)) {
					const spacing = 1
					for(let z=0; z<10 /cubeSize /Math.round(spacing); z++) {
						for(let x=0; x<10/cubeSize /Math.round(spacing); x++) {

							const rayPosition = this.vRayGroundHeight(coordOfVerticesIndex.x *10 +z*cubeSize *spacing -spacing*4, coordOfVerticesIndex.z *10 +x*cubeSize *spacing -spacing*4)

							if(waterNearbyIndex[index] > 7 && rayPosition) {
								// this.waterCubes.push(this.makeWaterCube(rayPosition, 4 *cubeSize)))
								waterCubePositions.push(rayPosition)

								const riverBaseColor = this.colorFromLc.river.clone()
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
			this.waterInstancedMesh.instanceMatrix.setUsage( DynamicDrawUsage ) // So I don't have to call .needsUpdate
			this.babs.scene.add(this.waterInstancedMesh)


			const bufferAttr = new InstancedBufferAttribute( new Float32Array( waterCubeColors), 3 )
			bufferAttr.needsUpdate = true
			this.waterInstancedMesh.instanceColor = bufferAttr


			for(let i=0, l=waterCubePositions.length; i<l; i++) {
				let matrix = new Matrix4().setPosition(waterCubePositions[i].setY(waterCubePositions[i].y -(cubeSize *4)/2))
				this.waterInstancedMesh.setMatrixAt(i, matrix)
				// this.waterInstancedMesh.setColorAt(i, new Color(0xffffff))
				this.waterInstancedRands[i] = Math.random() - 0.5
			}

		}, 10)

        timeReporter.next('Landcover DONE')

    }

	vRayGroundHeight(gx, gz) { // Return engine height
		const raycaster = new Raycaster(
			new Vector3(gx *4, WorldSys.ZoneTerrainMax.y, gz*4), 
			new Vector3( 0, -1, 0 ), 0, 
			WorldSys.ZoneTerrainMax.y
		)

		const ground = this.babs.scene.children.find(o=>o.name=='ground')
		const [intersect] = raycaster.intersectObject(ground, true)
		if(!intersect) {
			log.info('no ground intersect!', intersect, raycaster, gx, gz)
		}
		return intersect?.point
	}

	// This has been replaced with an InstancedMesh!
	// waterMaterial = new MeshLambertMaterial()
	// waterGeometry
	// makeWaterCube(vPosition, size) {
	// 	if(!this.waterGeometry) this.waterGeometry = new BoxGeometry( size, size, size )
	// 	const cube = new Mesh(this.waterGeometry, this.waterMaterial)
	// 	// log(this.colorFromLc.river)
	// 	cube.material.color = this.colorFromLc.river
	// 	cube.position.copy(vPosition).setY(vPosition.y - size/2) // Sink partway into ground
	// 	// cube.material.castShadow = false
	// 	// cube.material.receiveShadow = false
	// 	// cube.material.disableLighting = true
	// 	cube.randFactor = Math.random()
	// 	this.babs.scene.add(cube)
	// 	return cube
	// }

}
