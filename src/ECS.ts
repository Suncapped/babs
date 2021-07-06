export type jobject = {[key:string]:any}

export class ECS {

    static ents = new Set<number>()
   
	/** @type {Object.<string, Object[]>} coms - object of types, each type has array of coms */
    static coms = {}
	
    /** 
     * @param {null|number} idEnt entity id to add, or null to create one in db
     * @return {number} entity id
     * */
     static AddEnt(idEnt :number) :number {
        ECS.ents.add(idEnt)
        return idEnt
    }
	// No to below, let's instead use uuids for local entities? Or maybe a separate entity array?
    // /** 
    //  * @return {number} entity id
    //  * */
    //  static CreateEnt() :number {
	// 	 let idEnt
	// 	 for(let i=0; i<10; i++) {
	// 		idEnt = window.crypto.getRandomValues(new Uint32Array(1))
	// 		if(ECS.ents.has(idEnt)) { // Collision
	// 			continue // Keep trying
	// 		}
	// 		ECS.ents.add(idEnt[0])
	// 		return idEnt[0]
	// 	 }
    // }

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