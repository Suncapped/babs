
export class ECS {
    /** @type {Set} ents */
    static ents = new Set()
    
    /** 
     * @return {number} entity id
     * */
     static CreateEnt(idEnt) {
        ECS.ents.add(idEnt)
        return idEnt
    }

    /** @type {Object.<string, Com[]>} coms - object of types, each type has array of coms */
    static coms = {}
    
    /** 
     * @param {Com|null} clCom class to get, or null for all
     * @return {Com[]} all components of given class
     * */
    static GetComsAll(clCom) {
        return clCom ? ECS.coms[clCom.sType] : ECS.coms
    }

    /** 
     * @return {null|Com} component of given class on entity, if exists
     * */
    static GetCom(clCom, idEnt) {
        if(!ECS.ents.has(idEnt)) return null
        return ECS.coms[clCom.sType].find(com => com.idEnt === idEnt)
    }

    /** 
     * @return {null|Com} component of given class on entity, if exists
     * */
    static AddCom(clCom, idEnt, props) {
        if(!ECS.ents.has(idEnt)) return null
        ECS.coms[clCom.sType] = ECS.coms[clCom.sType] || [] // Create if needed
        const length = ECS.coms[clCom.sType].push(clCom.Create(idEnt, props))
        return ECS.coms[clCom.sType][length -1]
    }

}