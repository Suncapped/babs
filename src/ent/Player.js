
import { CameraSys } from '../sys/CameraSys'
import { InputSys } from '../sys/InputSys'
import { Controller } from '../com/Controller'
import { LoaderSys } from '../sys/LoaderSys'
import { log } from '../Utils'
import { Ent } from './Ent'
import { EventSys } from '../sys/EventSys'

// Player Character
export class Player extends Ent {
	// Components:
	// transform
	// appearance
	// movement
	controller
	animation

	// Properties:
	self
	idzip
	char

	// References:
	babs

	constructor(arrival, bSelf, babs) {
		super(arrival.id, babs)

		this.babs = babs

		this.char = arrival.char

		if(arrival.idzip) {
			this.idzip = arrival.idzip
			this.babs.zips.set(arrival.idzip, this.id)
		}

		this.self = bSelf
		if(this.self) {
			this.babs.idSelf = this.id
		}

		Promise.all([ 
			babs.loaderSys.loadRig(this.char.gender), 
			babs.loaderSys.loadAnim(this.char.gender, 'idle') 
		]).then(([fbxGroup, anim]) => {
			fbxGroup.name = 'player-'+arrival.id
			fbxGroup.feplayer = {
				id: arrival.id,
				idzip: arrival.idzip,
				idzone: arrival.idzone,
				gender: arrival.gender,
			}
			fbxGroup.visible = false
			this.babs.scene.add(fbxGroup)

			this.controller = new Controller(arrival, fbxGroup, this.babs)

			EventSys.Dispatch('controller-ready', {
				controller: this.controller,
				isSelf: this.self,
			})

			if(bSelf) {
				// Setup camera and input systems for self
				this.babs.cameraSys = new CameraSys(this.babs.renderSys._camera, this.controller)
				this.babs.inputSys = new InputSys(this.babs, this)
			}
		})

		
		log.info('New Player:', this)
		
	}

	remove() {
		this.babs.ents.delete(this.id)
		this.babs.zips.delete(this.idzip)

		// const fbx = this.controller.target
		this.babs.scene.remove(this.controller.target) // todo dispose eg https://stackoverflow.com/questions/18357529/threejs-remove-object-from-scene

		this.babs.comcats.set('controller', this.babs.comcats.get('controller').filter(c => c.arrival.id !== this.id))

		// for(let [cat, coms] of this.babs.comcats) {
		// 	for(let com of coms) {
		// 		com.update()
		// 	}
		// }
		
		// this.babs.comcats.forEach(cat => cat.filter(com => com.id !== departer.id))
		// this.babs.ents.delete(departer.id)

	}

}


