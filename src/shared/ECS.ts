
// export type Ent = { id :number }

// export type Transform = {
// 	idzone :number,
// 	x :number,
// 	z :number,
// }
// export type Controller = {
// 	email :string,
// 	visitor :boolean,
// 	pass? :string,
// 	session? :string,
// 	socket? :WebSocket,
// }

// export type Player = Ent & Transform & Controller


// export type Com = 
// 	Transform
// 	| Controller
// export type ComName = 'transform' | 'controller'
// type Com = {[K in ComString]?: string}

export type jobject = {[key:string]:any}

export class ECS {

	static ents = new Set<number>()
   
	/** @type {Object.<string, Object[]>} coms - object of types, each type has array of coms */
	static coms = {}
	
	/** 
     * @param {null|number} idEnt entity id to add, or null to create one in db
     * @return {number} entity id
     * */
	static CreateEnt(idEnt :number) :number {
		ECS.ents.add(idEnt)
		return idEnt
	}

	/** 
     * @param {string|null} comName com to get, or null for all
     * @return {null|object} all components of given class
     * */
	static GetComsAll(comName) {
		return comName ? ECS.coms[comName] : ECS.coms
	}

	static GetCom(idEnt, comName :string) :null|jobject {
		if(!ECS.ents.has(idEnt)) return null
		return ECS.coms[comName].find(com => com.idEnt === idEnt)
	}

	static AddCom(idEnt, comName, comData) :null|jobject {
		if(!ECS.ents.has(idEnt)) return null
		ECS.coms[comName] = ECS.coms[comName] || [] // Create if needed
		const length = ECS.coms[comName].push({idEnt, ...comData})
		return ECS.coms[comName][length -1]
	}

}