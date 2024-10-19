// Simpler logging

import { SkinnedMesh, Vector2, Vector3 } from 'three'
import { debugMode } from './stores'
import { get as svelteGet } from 'svelte/store'
import { Mesh } from 'three'
import type { Zone } from './ent/Zone'
import { WorldSys } from './sys/WorldSys'



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

// export const log = (function() {
// 	// Get real line numbers with log() calls https://news.ycombinator.com/item?id=5540716
// 	const log = Function.prototype.bind.call(console.log, console)

// 	// Can't figure out how to get line numbers for sub-objects
// 	log.info = (...params) => { 
// 		if(showInfoLogs) {
// 			console.info(...params)
// 		}
// 	}
// 	return log
// })() // IIFE

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

const RATIO_DEGREES = 180 / Math.PI
const RATIO_RADIANS = Math.PI / 180
export function radians (degreesIn :number) {
	return degreesIn * RATIO_RADIANS
}
export function degrees(radiansIn :number) {
	return radiansIn * RATIO_DEGREES
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

export function objectIsSomeKindOfMesh(object :any) :object is Mesh | SkinnedMesh{
	return object instanceof Mesh || object instanceof SkinnedMesh
}
