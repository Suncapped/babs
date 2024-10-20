
import { CameraSys } from '@/sys/CameraSys'
import { InputSys } from '@/sys/InputSys'
import { Controller } from '@/comp/Controller'

import { Ent } from './Ent'
import { EventSys } from '@/sys/EventSys'
import { Object3D, Scene } from 'three'
import { Babs } from '@/Babs'
import type { PlayerArrive } from '@/shared/consts'
import type { FeObject3D } from './Wob'
import { get as svelteGet } from 'svelte/store'
import { settings } from '../stores'
import { SoundSys } from '@/sys/SoundSys'

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
	tribe :string
	
	model :Scene

	colorHex :string

	selfWayfinding = false

	// References:

	
	/** @private */
	constructor(id, babs) {
		super(id, babs)
	}
	static async Arrive(arrival :PlayerArrive, bSelf :boolean, babs :Babs) {

		const plr = new Player(arrival.id, babs)
		plr.colorHex = arrival.meta.color
		plr.babs = babs
		plr.char = arrival.char
		
		plr.self = bSelf

		console.debug('New Player:', plr)

		const [playerRig] = await Promise.all([ 
			babs.loaderSys.loadRig(plr.char.gender, arrival.id), 
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

		const {nick, tribe} = babs.uiSys.nicklist.get(arrival.id) || {}
		const registeredNick = arrival.visitor ? null : 'Stranger'
		const anonNick = 'animal spirit'

		const displayName = (nick || registeredNick || anonNick)
		// For people with no nick, this will be undefined.  Also for self.
		// For those with a nick, it is set at this point.

		// Let's also 
		if(!plr.self) plr.setDisplayNick(displayName, tribe) // Don't name self

		EventSys.Dispatch('controller-ready', {
			controller: plr.controller,
			isSelf: plr.self,
		})

		if(plr.self) {
			// Setup camera and input systems for self
			plr.babs.cameraSys = new CameraSys(plr.babs.renderSys._camera, plr.controller, babs)
			plr.babs.soundSys = new SoundSys(plr.babs.renderSys._camera, babs)
			plr.babs.inputSys = new InputSys(plr.babs, plr, arrival.meta?.mousedevice)
		}

		if(arrival.idzip) {
			plr.idzip = arrival.idzip
			plr.babs.zips.set(arrival.idzip, plr.id)
		}

		return plr
		
	}

	setDisplayNick(nick :string, tribe :string = '', doNotDisplay :'doNotDisplay' = null) {
		// if(!nick) {
		// 	// console.log('setDisplayNick canceling') // Note this happens on Arrive()!  Surprisingly.  It's because it's awaiting rig load, so nicklist gets here first. // To self, I think this means, not so much others.
		// 	return
		// }
		this.nick = nick
		this.tribe = tribe
		this.babs.uiSys.aboveHeadChat(this.id, this.nickWrapped(), null, this.colorHex) // Show above head
	}

	nickWrapped() {
		return `~ ${this.nick || 'Stranger'}${this.tribe?` *${this.tribe}`:''} ~`
	}

	remove() {

		const doRemove = () => {
			this.babs.ents.delete(this.id)
			this.babs.zips.delete(this.idzip)
			this.babs.group.remove(this.controller.playerRig) 
			
			this.babs.compcats.set(Controller.name, this.babs.compcats.get(Controller.name)?.filter((c :Controller) => c.playerRig.id !== this.controller.playerRig.id))
			delete this.controller

			console.debug('comp cats after Player.remove()', this.babs.compcats)

			// todo dispose eg https://stackoverflow.com/questions/18357529/threejs-remove-object-from-scene
		}

		if(this.controller?.playerRig) {
			doRemove()
		}
		else {
			let waitForMesh = setInterval(() => {
				console.log('waiting for remove')
				if(this.controller.playerRig) {
					doRemove()
					clearInterval(waitForMesh)
				}
			}, 200)
		}
	}

}


