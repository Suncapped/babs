
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
	}
	static async New(arrival, bSelf, babs) {

		const plr = new Player(arrival, bSelf, babs)
		plr.babs = babs
		plr.char = arrival.char
		
		plr.self = bSelf

		// plr.nick = arrival.meta?.nick // Too confusing for players
		plr.setNick(babs.uiSys.nicklist.get(arrival.id))

		log.info('New Player:', plr)

		const [gltfScene] = await Promise.all([ 
			babs.loaderSys.loadRig(plr.char.gender), 
			// babs.loaderSys.loadAnim(plr.char.gender, 'idle') 
		])
		gltfScene.name = 'player'
		gltfScene.idplayer = arrival.id
		gltfScene.visible = false
		plr.babs.scene.add(gltfScene)

		plr.controller = await Controller.New(arrival, plr.babs, gltfScene)

		EventSys.Dispatch('controller-ready', {
			controller: plr.controller,
			isSelf: plr.self,
		})

		if(plr.self) {
			// Setup camera and input systems for self
			plr.babs.cameraSys = new CameraSys(plr.babs.renderSys._camera, plr.controller)
			plr.babs.inputSys = new InputSys(plr.babs, plr, arrival.meta?.mousedevice)
		}

		if(arrival.idzip) {
			plr.idzip = arrival.idzip
			plr.babs.zips.set(arrival.idzip, plr.id)
		}
		if(plr.self) {
			plr.babs.idSelf = plr.id
		}

		return plr
		
	}

	// Event(type, data) {
	// 	if(type === 'controller-ready') { 

	// 	}
	// }

	setNick(newNick) {
		if(this.nick == newNick) return // Only show once, or if undefined == undefined
		this.nick = newNick
		this.babs.uiSys.playerSaid(this.id, this.nick, {journal: false, isname: true}) // Show above head
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


