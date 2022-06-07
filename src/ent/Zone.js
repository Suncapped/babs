
import * as Utils from '../Utils'
import { Ent } from './Ent'


export class Zone extends Ent {
	constructor(id, babs) {
		super(id, babs)
	}
	static async Create(zone, babs){
		const context = new Zone(zone.id, babs)
		return context.init(zone)
	}


	ground // ground 3d object (often used for vRayGroundHeight)
	x
	z
	
	async init(data) { // This patterns allows an async new, using `this`
		this.x = data.x
		this.z = data.z
	}



}