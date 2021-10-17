import { menuSelfData, menuShowLink, toprightReconnect, toprightText } from "../stores"
import Cookies from "js-cookie"
import { UiSys } from '../sys/UiSys'
import { EventSys } from "./EventSys"
import { WorldSys } from "./WorldSys"
import { LoaderSys } from "./LoaderSys"
import { log } from './../Utils'
import { AnimationMixer, Vector3 } from "three"
import { Controller } from "./../com/Controller"
import { Player } from "../ent/Player"
import { CameraSys } from "./CameraSys"
import { Raycaster } from "three"
import { InputSys } from "./InputSys"

export class SocketSys {

	static ws
	static scene
	static babsReady = false

	static pingSeconds = 30


	static Start(babs) {

		// log('BABS!!!', babs)
		this.babs = babs

		toprightText.set('Connecting...')
		document.getElementById('topleft').style.visibility = 'hidden'
		this.ws = new WebSocket(this.babs.urlSocket)
		this.ws.binaryType = 'arraybuffer'


		this.ws.onopen = (event) => {
			const existingSession = Cookies.get('session')
			log.info('existingSession', existingSession)
			if(existingSession){
				this.Auth(existingSession)
			}
			else { // No cookie, so indicate visitor
				this.Visitor()
			}
		}
		this.ws.onmessage = (event) => {
			log.info('Socket rec:', event.data)


			if(event.data instanceof ArrayBuffer) { // Locations

				// todo make this per-zone
				// We'll have to have server send zone ids 'headers' per zone for a group of ints

				let playerMoves = new Uint32Array(event.data)
				const max = 4

				// Shift the values out from binary data
				for(let move of playerMoves) {
					log.info('socket playerMoves move', move)
					// Binary is 4 bytes / 8 words / 32 bits; in bits: zip 12, state 4, a 8, b 8
					const idzip = 		(move <<0) 	>>>(0 	+(0+8+8+4))
					const movestate = 	(move <<12) >>>(12 	+(0+8+8))
					const a = 			(move <<16) >>>(16 	+(0+8))
					const b = 			(move <<24) >>>(24 	+(0))

					const player = this.babs.scene.children.find(o=>o.feplayer?.idzip==idzip) 
					log.info('socket moveplayer', player?.name, [idzip, movestate, a, b])
					if(player) {
						// player.movestate = movestate
						player.position.setX(a * 4)
						player.position.setZ(b * 4)
					}
				}

			}
			else {
				const payload = JSON.parse(event.data)
				this.Process(payload)
			}
		}
		this.ws.onerror = (event) => {
			log.info('Socket error', event)
			UiSys.OfferReconnect('Connection error.')
		}
		this.ws.onclose = (event) => {
			log.info('Socket closed', event)
			UiSys.OfferReconnect('Server connection closed.')
		}
	}

	static Visitor() {
		this.Send({
			auth: 'visitor'
		})
	}
	static Auth(session) {
		this.Send({
			auth: session
		})
	}
	static Enter(email, pass) {
		this.Send({
			enter: {
				email,
				pass,
				session: Cookies.get('session'),
			}
		})
	}

	static async Send(json) {
		if(!json.ping && !json.move) log.info('Send:', json)
		if(this.ws.readyState === this.ws.OPEN) {
			await this.ws.send(JSON.stringify(json))
		}
		else {
			log.info('Cannot send; WebSocket is in CLOSING or CLOSED state')
			UiSys.OfferReconnect('Cannot reach server.')
		}
	}

	static Process(payload){
		Object.entries(payload).forEach(async ([op, data]) => {
			switch(op) {
				case 'auth':
					document.getElementById('charsave').disabled = false
					// Handle failed login/register here
					if(data === 'userpasswrong') {
						document.getElementById('topleft').style.visibility = 'visible'
						toprightText.set('Username/password does not match.')
					}
					else if(data === 'emailinvalid') {
						document.getElementById('topleft').style.visibility = 'visible'
						toprightText.set('Email is invalid.')
					}
					else if(data === 'accountfailed') {
						document.getElementById('topleft').style.visibility = 'visible'
						toprightText.set('Account creation error.')
					}
					else if(data === 'passtooshort') {
						document.getElementById('topleft').style.visibility = 'visible'
						toprightText.set('Password too short, must be 8.')
					}
				break;
				case 'visitor':
					this.session = data
					Cookies.set('session', this.session, { 
						domain: SocketSys.baseDomain,
						secure: SocketSys.isProd,
						sameSite: 'strict',
					}) // Non-set expires means it's a session cookie only, not saved across sessions
					toprightText.set('Visiting...')
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break;
				case 'session':
					this.session = data
					Cookies.set('session', this.session, { 
						expires: 365,
						domain: SocketSys.baseDomain,
						secure: SocketSys.isProd,
						sameSite: 'strict',
					})
					toprightText.set('Entering...')
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break;
				case 'alreadyin':
					// Just have them repeat the auth if this was their second login device
					
					UiSys.OfferReconnect('Logged out your other session.  Try again! ->')
					
				break;
				case 'load':
					window.setInterval(() => { // Keep alive through Cloudflare's socket timeout
						this.Send({ping:'ping'})
					}, SocketSys.pingSeconds * 1000)

					const pself = data.self
					const zones = data.zones
					const zone = zones.find(z => z.id == pself.idzone)
					log.info('Welcome to', pself.idzone, pself.id, pself.visitor)
					toprightText.set(UiSys.toprightTextDefault)
					document.getElementById('topleft').style.visibility = 'visible'
					
					if(pself.visitor !== true) {
						document.getElementById('topleft').style.visibility = 'visible'
						document.getElementById('topleft').textContent = 'Waking up...'

						menuShowLink.set(true)

						menuSelfData.set(pself)
					}

					this.babsReady = true
					await WorldSys.LoadStatics(this.babs.urlFiles, this.babs.scene, zone)

					if(pself.visitor !== true) {
						document.getElementById('topleft').innerHTML = 'Welcome to First Earth (pre-alpha)'
					}


					// Create player entity
					log.info('pself', pself)
					const playerSelf = new Player(pself.id, this.babs)
					const bSelf = true
					playerSelf.controller = new Controller(pself, bSelf, playerSelf, this.babs) // Loads rig, creates Three stuff
					playerSelf.controller.init()
					this.babs.cameraSys = new CameraSys(this.babs.renderSys._camera, playerSelf.controller)
					this.babs.inputSys = new InputSys(this.babs, playerSelf)

					log('new player self', playerSelf)


					// EventSys.Dispatch('load-self', pself)


					this.Send({
						ready: pself.id,
					})


				break;
				case 'playersarrive':
					log('playersarrive', data)

					// EventSys.Dispatch('players-arrive', data)

					for(let arrival of data) {
						if(this.babs.ents.get(arrival.id)) return // Skip self aka players we already have!
						
						const player = new Player(arrival.id, this.babs)
						player.controller = new Controller(arrival, false, player.id, this.babs)
						player.controller.init()
						log('other player?', player)
						// TODO
						
						const fbx = await LoaderSys.LoadRig(arrival.char.gender)
						this.babs.scene.add(fbx)
						fbx.name = 'player-'+arrival.id
						fbx.feplayer = {
							id: arrival.id,
							idzip: arrival.idzip,
							idzone: arrival.idzone,
							gender: arrival.gender,
						}
		
						// this.contrSys = new Controller(this.renderSys._scene)
		
						// this._target = fbx
						const mixer = new AnimationMixer(fbx)
						const anim = await LoaderSys.LoadAnim(arrival.char.gender, 'idle')
						const clip = anim.animations[0]
						const idleAction = mixer.clipAction(clip)
		
						// this._stateMachine.SetState('idle')
						// const idleAction = this._parent._proxy._animations['idle'].action
						// log.info('idleenter', prevState, idleAction)
						// const mixer = idleAction.getMixer()
						// idleAction.getClip().duration = 5 // via diagnose below
						idleAction.play()
		
						setTimeout(() => {
							mixer.update()
						}, 1000/60)
		
		
						fbx.position.set(arrival.x *4, 3, arrival.z *4)
		
					}


				break
				case 'playerdepart':
					const departer = this.babs.ents.get(data)
					log('playerdepart', data, departer)
					if(departer) { // Could be self departing from a previous session, or person already otherwise departed?
						this.babs.scene.remove(departer) // todo dispose eg https://stackoverflow.com/questions/18357529/threejs-remove-object-from-scene
						
						
						for(let [cat, coms] of this.babs.comcats) {
							for(let com of coms) {
								com.update()
							}
						}
						
						this.babs.comcats.forEach(cat => cat.filter(com => com.id !== departer.id))
						this.babs.ents.delete(departer.id)
					}
				break
			}
		})
	}


}

