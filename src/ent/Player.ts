
import { CameraSys } from '@/sys/CameraSys'
import { InputSys } from '@/sys/InputSys'
import { Controller } from '@/comp/Controller'
import { log } from '@/Utils'
import { Ent } from './Ent'
import { EventSys } from '@/sys/EventSys'
import { Object3D, Scene } from 'three'
import { Babs } from '@/Babs'
import type { PlayerArrive } from '@/shared/consts'
import type { FeObject3D } from './Wob'

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

	nick :string
	
	model :Scene

	colorHex :string

	// References:

	
	/** @private */
	constructor(id, babs) {
		super(id, babs)
	}
	static async Arrive(arrival :PlayerArrive, bSelf :boolean, babs :Babs) {

		const plr = new Player(arrival.id, babs)
		plr.colorHex = arrival.color
		plr.babs = babs
		plr.char = arrival.char
		
		plr.self = bSelf

		log.info('New Player:', plr)

		const [playerRig] = await Promise.all([ 
			babs.loaderSys.loadRig(plr.char.gender), 
			// babs.loaderSys.loadAnim(plr.char.gender, 'idle') 
		]) as [FeObject3D]
		playerRig.name = plr.self ? 'self' : 'player'
		playerRig.idplayer = arrival.id
		playerRig.visible = false
		plr.babs.group.add(playerRig)
		
		if(plr.self) {
			plr.babs.idSelf = plr.id
		}

		plr.controller = await Controller.Create(arrival, plr.babs, playerRig)

		plr.nickSetAndDisplay(babs.uiSys.nicklist.get(arrival.id))

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

	nickSetAndDisplay(newNick :string) {
		if(this.nick == newNick) {
			// console.log('nickSetAndDisplay canceling') // Note this happens on Arrive()!  Surprisingly.  It's because it's awaiting rig load, so nicklist gets here first.
			return // Only show once, or if undefined == undefined
		}
		this.nick = newNick
		this.babs.uiSys.aboveHeadChat(this.id, `< ${this.nick} >`, null, this.colorHex) // Show above head // todo include player's chat color?
	}

	remove() {
		this.babs.ents.delete(this.id)
		this.babs.zips.delete(this.idzip)

		if(this.controller?.playerRig) {
			this.babs.group.remove(this.controller.playerRig) 
			// Needed to avoid latency of interval below
		}
		else {
			let waitForMesh = setInterval(() => {
				log('waiting for remove')
				if(this.controller.playerRig) {
					this.babs.group.remove(this.controller.playerRig) 
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


