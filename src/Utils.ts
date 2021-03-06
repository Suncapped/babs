// Simpler logging

import { Vector2, Vector3 } from 'three'
import { debugMode } from './stores'
import { get as svelteGet } from 'svelte/store'



let showInfoLogs = false
// Get debugMode set as soon as available
const waitDebugMode = () => {
	try {
		showInfoLogs = svelteGet(debugMode)
		debugMode.subscribe(toggle => showInfoLogs = toggle)
	}
	catch {
		setTimeout(waitDebugMode, 10)
	}
}
waitDebugMode()


// ;(async () => {
// 	let { debugMode } = await import('./stores')
// 	console.log('what dbm', debugMode)
// 	debugMode.subscribe(on => {
// 		console.log('setdbm')
// 		showInfoLogs = on
// 	})
// })()

// showInfoLogs = true


// export const log = (function() {
//     function log(...params) { 
//         console.log(...params)
//     }
// 	log.info = (...params) => {
// 		if(showInfoLogs) {
// 			params[0] = '{info} '+params[0]
// 			console.log(...params)
// 		}
// 	}
// 	console.warn = (...params) => {
// 		console.warn(...params)
// 	}
// 	console.error = (...params) => {
// 		console.error(...params)
// 	}

// 	return log
// })() // IIFE

export const log = (function() {
	// Get real line numbers with log() calls https://news.ycombinator.com/item?id=5540716
	const log = Function.prototype.bind.call(console.log, console)

	// Can't figure out how to get line numbers for sub-objects
	log.info = (...params) => { 
		if(showInfoLogs) {
			params[0] = '{info} '+params[0]
			console.log(...params)
		}
	}
	return log
})() // IIFE

// Console props
/*
  var methods = [
      'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
      'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
      'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
      'timeStamp', 'trace', 'warn'
  ];
*/


export function clamp(n, min, max){
	return Math.max(Math.min(n, max), min)
}

export function randIntInclusive(min, max) {
	min = Math.ceil(min)
	max = Math.floor(max)
	return Math.floor(Math.random() * (max - min + 1) + min) //The maximum is inclusive and the minimum is inclusive
}

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


export function coordToIndex(x, z, sideLength, dataLength = 1) {
	return x*dataLength +(z *sideLength *dataLength)
}
export function indexToCoord(i, sideLength) { // Don't currently have a need to remove dataLength
	return {
		x: i %26, 
		z: Math.floor(i /26),
	}
}



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

export function WobAtPosition(ents, gx, gz) {
	// todo make this use an abstracted grid (like server) instead of linear search
	for(let [key, ent] of ents) {
		if(ent.x === gx && ent.z === gz) {
			return ent
		}
	}
	return null

}

export function storageSet(key, value, ms) {
	const now = new Date()
	const item = {
		value,
		expire: now.getTime() + ms,
	}
	localStorage.setItem(key, JSON.stringify(item))
}

export function storageGet(key) {
	const str = localStorage.getItem(key)
	if (!str) return null
	const item = JSON.parse(str)
	if (new Date().getTime() > item.expire) {
		localStorage.removeItem(key)
		return null
	}
	return item.value
}

export function v3out(vector :Vector3) {
	return `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)})v3`
}
