import { Comp } from "./Comp"
import { CompControllable } from "./CompControllable"

export class Ent{
    /** @type {number} */ 
    id
    static Create(id) {
        const ent = new Ent
        ent.id = id
        return ent
    }
}