
import { CameraSys } from '../sys/CameraSys'
import { InputSys } from '../sys/InputSys'
import { Controller } from '../com/Controller'
import { LoaderSys } from '../sys/LoaderSys'
import { log } from '../Utils'
import { Ent } from './Ent'

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

	// References:
	babs

	constructor(arrival, bSelf, babs) {
		super(arrival.id, babs)

		this.babs = babs

		if(arrival.idzip) {
			this.idzip = arrival.idzip
			this.babs.zips.set(arrival.idzip, this.id)
		}

		this.self = bSelf
		if(this.self) {
			this.babs.idSelf = this.id
		}

		Promise.all([ 
			LoaderSys.LoadRig(arrival.char.gender), 
			LoaderSys.LoadAnim(arrival.char.gender, 'idle') 
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

			if(bSelf) {
				// Setup camera and input systems for self
				this.babs.cameraSys = new CameraSys(this.babs.renderSys._camera, this.controller)
				this.babs.inputSys = new InputSys(this.babs, this)
			}
		})

		
		log('New Player:', this)
		
	}

	remove() {
		this.babs.ents.delete(this.id)
		this.babs.zips.delete(this.idzip)

		// const fbx = this.controller.target
		this.babs.scene.remove(this.controller.target) // todo dispose eg https://stackoverflow.com/questions/18357529/threejs-remove-object-from-scene

		log('before', this.babs.comcats.get('controller'))
		this.babs.comcats.set('controller', this.babs.comcats.get('controller').filter(c => c.arrival.id !== this.id))
		log('after', this.babs.comcats.get('controller'))

		// for(let [cat, coms] of this.babs.comcats) {
		// 	for(let com of coms) {
		// 		com.update()
		// 	}
		// }
		
		// this.babs.comcats.forEach(cat => cat.filter(com => com.id !== departer.id))
		// this.babs.ents.delete(departer.id)

	}

}


