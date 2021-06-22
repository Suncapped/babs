export class ZONE {

    public static ZONE_LENGTH = 1000
    public static DATUM_SIZE = 40
    public static ZONE_DATUMS = 1000/ZONE.DATUM_SIZE
    public static ARR_SIDE_LEN = (1000/ZONE.DATUM_SIZE) +1
    public static TR_MULT = 1

    public static WATER_MULT = 1

}

export function clamp(n:number, min:number, max:number){
    return Math.max(Math.min(n, max), min)
}

export function rand(min:number, max:number):number { // Returns a random number between min (inclusive) and max (exclusive)
    return Math.random() * (max - min) + min
}

export const sleep = (ms:number) => new Promise(r => setTimeout(r, ms))

export function lerp (value1:number, value2:number, amount:number) {
	amount = amount < 0 ? 0 : amount
	amount = amount > 1 ? 1 : amount
	return value1 + (value2 - value1) * amount
}

export const doAroundDistance = (dist:number, z:number, x:number, min:number, max:number, f:(zj:number, xk:number)=>void):void => {
    for(let j=-dist; j<=dist; j++) {
        if(z+j<min||z+j>max) continue
        for(let k=-dist; k<=dist; k++) {
            if(x+k<min||x+k>max) continue
            f(z+j, x+k)
        }
    }
}

export class EnumHelpers {

    static getNamesAndValues<T extends number>(e: any) {
        return EnumHelpers.getNames(e).map(n => ({ name: n, value: e[n] as T }))
    }

    static getNames(e: any) {
        return EnumHelpers.getObjValues(e).filter(v => typeof v === 'string') as string[]
    }

    static getValues<T extends number>(e: any) {
        return EnumHelpers.getObjValues(e).filter(v => typeof v === 'number') as T[]
    }

    static getSelectList<T extends number, U>(e: any, stringConverter: (arg: U) => string) {
        const selectList = new Map<T, string>()
        this.getValues(e).forEach(val => selectList.set(val as T, stringConverter(val as unknown as U)))
        return selectList
    }

    static getSelectListAsArray<T extends number, U>(e: any, stringConverter: (arg: U) => string) {
        return Array.from(this.getSelectList(e, stringConverter), value => ({ value: value[0] as T, presentation: value[1] }))
    }

    private static getObjValues(e: any): (number | string)[] {
        return Object.keys(e).map(k => e[k])
    }
}