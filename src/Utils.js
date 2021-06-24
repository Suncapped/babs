import ndarray from 'ndarray'
import { Group } from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { BabsSocket } from './Socket'
// import unpack from 'ndarray-unpack' // @ts-ignore


export const ZONE_TEXTURE_GEN_MIPMAPS = false  // gen mipmaps - maybe should be true in the future?
export const ZONE_TEXTURE_INVERTY = false // invertY (flip?)

var RATIO_DEGREES = 180 / Math.PI
var RATIO_RADIANS = Math.PI / 180
export function radians (degrees) {
	return degrees * RATIO_RADIANS
}
export function degrees(radians) {
	return radians * RATIO_DEGREES
}

// Timer:
export function* createTimeReporter() {
    let lastTime = new Date().getTime()
    let marker = 'start'
    while(true){
        const newTime = new Date().getTime()
        console.log(`Time @${marker}: ${newTime - lastTime}ms`)
        lastTime = newTime
        marker = yield null
    }
}


/* Use like:
let timeReporter = createTimeReporter(); timeReporter.next()
timeReporter.next('blue')
timeReporter.next('green')
timeReporter.next('end')
*/

// export async function terrainGenerate(terrainData:Uint8Array, ground:Mesh) {
    // const terrainDataFloat = Array.from(terrainData).map((ele:number) => ele /ZONE.TR_MULT)
    // console.log(terrainDataFloat)
    // ground.position = new Vector3(World.ZoneLength/2, 0, World.ZoneLength/2)
    // let vertexData = CreateGroundFromArray(World.ZoneLength, World.ZoneLength, ZONE.ZONE_DATUMS, terrainDataFloat)
    // vertexData.applyToMesh(ground, true)

    // if(ground2) {
    //     ground2 = Mesh.CreateGround(`GROUNDGRID ${room.state.zone.terrainFile}`, 1, 1, 1)
    //     ground2.position = new Vector3(World.ZoneLength/2, -9000 +1, World.ZoneLength/2)
    //     vertexData.applyToMesh(ground2, true)
    //     gridmaterial.alpha = 0.5
    //     ground2.material = gridmaterial
    //     gridmaterial.majorUnitFrequency = 4
    //     ground2.visibility = 0
    // }

    // return ground
// }


// Non-generation stuff:
// export function getMixMaterial(urlFiles, scene):MixMaterial {

    // var mixMaterial = new MixMaterial('mix', scene)
    // mixMaterial.diffuseTexture1 = new Texture(`${urlFiles}/texture/rock.jpg`, scene)
    // mixMaterial.diffuseTexture2 = new Texture(`${urlFiles}/texture/sand.jpg`, scene)
    // mixMaterial.diffuseTexture3 = new Texture(`${urlFiles}/texture/dirt-low.jpg`, scene)
    // mixMaterial.diffuseTexture4 = new Texture(`${urlFiles}/texture/grass.jpg`, scene)
    // mixMaterial.diffuseTexture5 = new Texture(`${urlFiles}/texture/water.jpg`, scene)
    // mixMaterial.diffuseTexture6 = new Texture(`${urlFiles}/texture/cliff.jpg`, scene)
    // mixMaterial.diffuseTexture7 = new Texture(`${urlFiles}/texture/TropicalSunnyDay_nx.jpg`, scene)
    // mixMaterial.diffuseTexture8 = new Texture(`${urlFiles}/texture/waterbump.png`, scene)
    // const textureScaleMultiplier = 1
    // mixMaterial.diffuseTexture1.uScale = mixMaterial.diffuseTexture1.vScale = 
    //     mixMaterial.diffuseTexture2.uScale = mixMaterial.diffuseTexture2.vScale = 
    //     mixMaterial.diffuseTexture3.uScale = mixMaterial.diffuseTexture3.vScale = 
    //     mixMaterial.diffuseTexture4.uScale = mixMaterial.diffuseTexture4.vScale = 
    //     mixMaterial.diffuseTexture5.uScale = mixMaterial.diffuseTexture5.vScale = 
    //     mixMaterial.diffuseTexture6.uScale = mixMaterial.diffuseTexture6.vScale = 
    //     mixMaterial.diffuseTexture7.uScale = mixMaterial.diffuseTexture7.vScale = 
    //     mixMaterial.diffuseTexture8.uScale = mixMaterial.diffuseTexture8.vScale = ZONE.ZONE_DATUMS * textureScaleMultiplier
    // // mixMaterial.diffuseTexture1.wrapU = mixMaterial.diffuseTexture1.wrapV = 
    // //     mixMaterial.diffuseTexture2.wrapU = mixMaterial.diffuseTexture2.wrapV = 
    // //     mixMaterial.diffuseTexture3.wrapU = mixMaterial.diffuseTexture3.wrapV = 
    // //     mixMaterial.diffuseTexture4.wrapU = mixMaterial.diffuseTexture4.wrapV = 
    // //     mixMaterial.diffuseTexture5.wrapU = mixMaterial.diffuseTexture5.wrapV = Texture.WRAP_ADDRESSMODE
    // mixMaterial.diffuseColor = new Color3(15, 15, 15) // Integrates with BabsUtils.landcoverGenerate const full = 17; 17*15=255
    // mixMaterial.backFaceCulling = false
    // // mixMaterial.alpha = 0.8
    // // mixMaterial.specularColor = new Color3(0.5, 0.5, 0.5)
    // // mixMaterial.specularPower = 64
    // return mixMaterial
// }

/**
 * @constructor
 * @param {string} path
 * @param {string} author
 * @returns {Promise<Group>}
 */
export function loadFbx(path) {
    const loader = new FBXLoader()
    return new Promise( (resolve, reject) => {
        loader.load(
            `${BabsSocket.urlFiles}${path}`, // resource URL
            (group) => { // onLoad callback
                resolve(group)
            },
            (xhr) => { // onProgress callback
                console.log( (xhr.loaded / xhr.total * 100) + '% loaded' )
            },
            (err) => { // onError callback
                console.log( 'An error happened', err )
            }
        )
    }); 
}