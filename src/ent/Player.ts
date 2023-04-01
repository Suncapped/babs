
import { CameraSys } from '@/sys/CameraSys'
import { InputSys } from '@/sys/InputSys'
import { Controller } from '@/comp/Controller'
import { log } from '@/Utils'
import { Ent } from './Ent'
import { EventSys } from '@/sys/EventSys'
import { Object3D, Scene } from 'three'
import { Babs } from '@/Babs'
import type { PlayerArrive } from '@/shared/consts'

// Player Character
export class Player extends Ent {
	// Components:
	// transform
	// appearance
	// movement
	controller :Controller
	animation

	// Properties:
	self :boolean
	idzip
	char
	
	model :Scene

	// References:

	
	/** @private */
	constructor(id, babs) {
		super(id, babs)
	}
	static async Arrive(arrival :PlayerArrive, bSelf :boolean, babs :Babs) {

		const plr = new Player(arrival.id, babs)
		plr.babs = babs
		plr.char = arrival.char
		
		plr.self = bSelf

		// plr.nick = arrival.meta?.nick // Too confusing for players
		plr.setNick(babs.uiSys.nicklist.get(arrival.id))

		log.info('New Player:', plr)

		const [gltfScene] = await Promise.all([ 
			babs.loaderSys.loadRig(plr.char.gender), 
			// babs.loaderSys.loadAnim(plr.char.gender, 'idle') 
		]) as [Object3D]
		gltfScene.name = plr.self ? 'self' : 'player'
		gltfScene.idplayer = arrival.id
		gltfScene.visible = false
		plr.babs.group.add(gltfScene)

		if(plr.self) {
			plr.babs.idSelf = plr.id
		}

		plr.controller = await Controller.Create(arrival, plr.babs, gltfScene)

		EventSys.Dispatch('controller-ready', {
			controller: plr.controller,
			isSelf: plr.self,
		})

		if(plr.self) {
			// Setup camera and input systems for self
			plr.babs.cameraSys = new CameraSys(plr.babs.renderSys._camera, plr.controller, babs)
			plr.babs.inputSys = new InputSys(plr.babs, plr, arrival.meta?.mousedevice)
		}

		if(arrival.idzip) {
			plr.idzip = arrival.idzip
			plr.babs.zips.set(arrival.idzip, plr.id)
		}

		return plr
		
	}

	setNick(newNick) {
		if(this.nick == newNick) return // Only show once, or if undefined == undefined
		this.nick = newNick
		this.babs.uiSys.playerSaid(this.id, this.nick, {journal: false, isname: true}) // Show above head
	}

	remove() {
		this.babs.ents.delete(this.id)
		this.babs.zips.delete(this.idzip)

		if(this.controller?.target) {
			this.babs.group.remove(this.controller.target) 
			// Needed to avoid latency of interval below
		}
		else {
			let waitForMesh = setInterval(() => {
				log('waiting')
				if(player.controller.target) {
					this.babs.group.remove(this.controller.target) 
					clearInterval(waitForMesh)
				}
			}, 200)
		}
		// todo dispose eg https://stackoverflow.com/questions/18357529/threejs-remove-object-from-scene

		this.babs.compcats.set('Controller', this.babs.compcats.get('Controller')?.filter(c => c.arrival.id !== this.id))
		// ^ Does that even work?  Had to do ?filter
		
		// for(let [cat, coms] of this.babs.compcats) {
		// 	for(let com of coms) {
		// 		com.update()
		// 	}
		// }
		
		// this.babs.compcats.forEach(cat => cat.filter(com => com.id !== departer.id))
		// this.babs.ents.delete(departer.id)

	}

}


