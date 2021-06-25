import Stats from 'three/examples/jsm/libs/stats.module'
import { Socket } from './Socket'

export const Ui = function(document) {
    this.document = document
}
/** 
 * @param {'fps'|'mem'} which
 */
Ui.prototype.createStats = function(which) {
    this[which] = Stats()
    this[which].showPanel(which=="fps"?0:2)
    this[which].dom.id = which
    this[which].dom.style = ""
    this.document.body.appendChild(this[which].dom)
    return this
}

export class Uic {
    document
    constructor(document) {
        this.document = document
    }
    /** 
     * @param {'fps'|'mem'} which
     */
    createStats(which) {
        this[which] = Stats()
        this[which].showPanel(which=="fps"?0:2)
        this[which].dom.id = which
        this[which].dom.style = ""
        this.document.body.appendChild(this[which].dom)
        return this
    }
}





