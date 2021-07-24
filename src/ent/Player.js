
import { log } from '../Utils'
import { Ent } from './Ent'

// Player Character
export class Player extends Ent {
	transform
	appearance
	movement
	controller
	self

	constructor(id, babs) {
		super(id, babs)
	}

}


