// Simpler logging

import { Vector3 } from "three"


let showInfoLogs = false// || import.meta.env.PROD // Always show in prod // Actually no lol, overload!
// showInfoLogs = true
export const log = (function() {
    function log(...params) { 
        console.log(...params)
    }
	log.info = (...params) => {
		if(showInfoLogs) {
			params[0] = '{info} '+params[0]
			console.log(...params)
		}
	}
	log.warn = (...params) => {
		console.warn(...params)
	}
	log.err = (...params) => {
		console.error(...params)
	}

	return log
})() // IIFE


export function clamp(n, min, max){
    return Math.max(Math.min(n, max), min)
}

// export function rand(min:number, max:number):number { // Returns a random number between min (inclusive) and max (exclusive)
//     return Math.random() * (max - min) + min
// }

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// export function lerp (value1:number, value2:number, amount:number) {
// 	amount = amount < 0 ? 0 : amount
// 	amount = amount > 1 ? 1 : amount
// 	return value1 + (value2 - value1) * amount
// }

// export const doAroundDistance = (dist:number, z:number, x:number, min:number, max:number, f:(zj:number, xk:number)=>void):void => {
//     for(let j=-dist; j<=dist; j++) {
//         if(z+j<min||z+j>max) continue
//         for(let k=-dist; k<=dist; k++) {
//             if(x+k<min||x+k>max) continue
//             f(z+j, x+k)
//         }
//     }
// }

// export class EnumHelpers {

//     static getNamesAndValues<T extends number>(e: any) {
//         return EnumHelpers.getNames(e).map(n => ({ name: n, value: e[n] as T }))
//     }

//     static getNames(e: any) {
//         return EnumHelpers.getObjValues(e).filter(v => typeof v === 'string') as string[]
//     }

//     static getValues<T extends number>(e: any) {
//         return EnumHelpers.getObjValues(e).filter(v => typeof v === 'number') as T[]
//     }

//     static getSelectList<T extends number, U>(e: any, stringConverter: (arg: U) => string) {
//         const selectList = new Map<T, string>()
//         this.getValues(e).forEach(val => selectList.set(val as T, stringConverter(val as unknown as U)))
//         return selectList
//     }

//     static getSelectListAsArray<T extends number, U>(e: any, stringConverter: (arg: U) => string) {
//         return Array.from(this.getSelectList(e, stringConverter), value => ({ value: value[0] as T, presentation: value[1] }))
//     }

//     private static getObjValues(e: any): (number | string)[] {
//         return Object.keys(e).map(k => e[k])
//     }
// }

var RATIO_DEGREES = 180 / Math.PI
var RATIO_RADIANS = Math.PI / 180
export function radians (degrees) {
	return degrees * RATIO_RADIANS
}
export function degrees(radians) {
	return radians * RATIO_DEGREES
}

// // Timer:
export function* createTimeReporter() {
    let lastTime = new Date().getTime()
    let marker = 'start'
    while(true){
        const newTime = new Date().getTime()
        log.info(`Time @${marker}: ${newTime - lastTime}ms`)
        lastTime = newTime
        marker = yield null
    }
}


// /* Use like:
// let timeReporter = createTimeReporter(); timeReporter.next()
// timeReporter.next('blue')
// timeReporter.next('green')
// timeReporter.next('end')
// */

// // export async function terrainGenerate(terrainData:Uint8Array, ground:Mesh) {
//     // const terrainDataFloat = Array.from(terrainData).map((ele:number) => ele /ZONE.TR_MULT)
//     // log.info(terrainDataFloat)
//     // ground.position = new Vector3(World.ZoneLength/2, 0, World.ZoneLength/2)
//     // let vertexData = CreateGroundFromArray(World.ZoneLength, World.ZoneLength, ZONE.ZONE_DATUMS, terrainDataFloat)
//     // vertexData.applyToMesh(ground, true)

//     // if(ground2) {
//     //     ground2 = Mesh.CreateGround(`GROUNDGRID ${room.state.zone.terrainFile}`, 1, 1, 1)
//     //     ground2.position = new Vector3(World.ZoneLength/2, -9000 +1, World.ZoneLength/2)
//     //     vertexData.applyToMesh(ground2, true)
//     //     gridmaterial.alpha = 0.5
//     //     ground2.material = gridmaterial
//     //     gridmaterial.majorUnitFrequency = 4
//     //     ground2.visibility = 0
//     // }

//     // return ground
// // }


// // Non-generation stuff:
// // export function getMixMaterial(urlFiles, scene):MixMaterial {

//     // var mixMaterial = new MixMaterial('mix', scene)
//     // mixMaterial.diffuseTexture1 = new Texture(`${urlFiles}/texture/rock.jpg`, scene)
//     // mixMaterial.diffuseTexture2 = new Texture(`${urlFiles}/texture/sand.jpg`, scene)
//     // mixMaterial.diffuseTexture3 = new Texture(`${urlFiles}/texture/dirt-low.jpg`, scene)
//     // mixMaterial.diffuseTexture4 = new Texture(`${urlFiles}/texture/grass.jpg`, scene)
//     // mixMaterial.diffuseTexture5 = new Texture(`${urlFiles}/texture/water.jpg`, scene)
//     // mixMaterial.diffuseTexture6 = new Texture(`${urlFiles}/texture/cliff.jpg`, scene)
//     // mixMaterial.diffuseTexture7 = new Texture(`${urlFiles}/texture/TropicalSunnyDay_nx.jpg`, scene)
//     // mixMaterial.diffuseTexture8 = new Texture(`${urlFiles}/texture/waterbump.png`, scene)
//     // const textureScaleMultiplier = 1
//     // mixMaterial.diffuseTexture1.uScale = mixMaterial.diffuseTexture1.vScale = 
//     //     mixMaterial.diffuseTexture2.uScale = mixMaterial.diffuseTexture2.vScale = 
//     //     mixMaterial.diffuseTexture3.uScale = mixMaterial.diffuseTexture3.vScale = 
//     //     mixMaterial.diffuseTexture4.uScale = mixMaterial.diffuseTexture4.vScale = 
//     //     mixMaterial.diffuseTexture5.uScale = mixMaterial.diffuseTexture5.vScale = 
//     //     mixMaterial.diffuseTexture6.uScale = mixMaterial.diffuseTexture6.vScale = 
//     //     mixMaterial.diffuseTexture7.uScale = mixMaterial.diffuseTexture7.vScale = 
//     //     mixMaterial.diffuseTexture8.uScale = mixMaterial.diffuseTexture8.vScale = ZONE.ZONE_DATUMS * textureScaleMultiplier
//     // // mixMaterial.diffuseTexture1.wrapU = mixMaterial.diffuseTexture1.wrapV = 
//     // //     mixMaterial.diffuseTexture2.wrapU = mixMaterial.diffuseTexture2.wrapV = 
//     // //     mixMaterial.diffuseTexture3.wrapU = mixMaterial.diffuseTexture3.wrapV = 
//     // //     mixMaterial.diffuseTexture4.wrapU = mixMaterial.diffuseTexture4.wrapV = 
//     // //     mixMaterial.diffuseTexture5.wrapU = mixMaterial.diffuseTexture5.wrapV = Texture.WRAP_ADDRESSMODE
//     // mixMaterial.diffuseColor = new Color3(15, 15, 15) // Integrates with Utils.landcoverGenerate const full = 17; 17*15=255
//     // mixMaterial.backFaceCulling = false
//     // // mixMaterial.alpha = 0.8
//     // // mixMaterial.specularColor = new Color3(0.5, 0.5, 0.5)
//     // // mixMaterial.specularPower = 64
//     // return mixMaterial
// // }

// export class Grid3 extends Vector3 {
// 	constructor() {
// 		super()
// 	}
// }
