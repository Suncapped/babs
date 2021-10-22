import { menuSelfData, menuShowLink, toprightReconnect, toprightText, socketSend } from "../stores"
import Cookies from "js-cookie"
import { UiSys } from '../sys/UiSys'
import { EventSys } from "./EventSys"
import { WorldSys } from "./WorldSys"
import { LoaderSys } from "./LoaderSys"
import { log } from './../Utils'
import { AnimationMixer, MathUtils, Quaternion, Vector3 } from "three"
import { Controller } from "../com/Controller"
import { Player } from "../ent/Player"
import { CameraSys } from "./CameraSys"
import { Raycaster } from "three"
import { InputSys } from "./InputSys"

export class SocketSys {

	ws
	scene
	babsReady = false

	static pingSeconds = 30

	constructor(babs) {
		this.babs = babs

		toprightText.set('Connecting...')
		document.getElementById('topleft').style.visibility = 'hidden'
		this.ws = new WebSocket(this.babs.urlSocket)
		this.ws.binaryType = 'arraybuffer'

		this.ws.onopen = (event) => {
			// Fix people having earth subdomain cookies from previous versions; todo remove later perhaps
			if(this.babs.isProd) {
				// Cookies.remove('session', { domain: 'earth.suncapped.com' }) 
			// Cookies.remove('session', { domain: 'earth.suncapped.com' }) 
				// Cookies.remove('session', { domain: 'earth.suncapped.com' }) 
				// Cookies.remove('session', { path: '', domain: 'earth.suncapped.com' }) 
			// Cookies.remove('session', { path: '', domain: 'earth.suncapped.com' }) 
				// Cookies.remove('session', { path: '', domain: 'earth.suncapped.com' }) 
				// Cookies.remove('session', { path: '/', domain: 'earth.suncapped.com' })
				Cookies.remove('session') // Well this for some reason deletes session on earth.suncapped.com...
				// so fine, then .get() will get the root one.  .delete() will never delete the root because that's set with domain
			}
			
			// Now this should get root domain instead of earth subdomain
			// https://github.com/js-cookie/js-cookie
			const existingSession = Cookies.get('session')
			log.info('existingSession', existingSession)
			if(existingSession){
				this.auth(existingSession)
			}
			else { // No cookie, so indicate visitor
				this.visitor()
			}
		}
		this.ws.onmessage = (event) => {
			log.info('Socket rec:', event.data)


			if(event.data instanceof ArrayBuffer) { // Movement

				// todo make this per-zone
				// We'll have to have server send zone ids 'headers' per zone for a group of ints

				let playerMoves = new Uint32Array(event.data)

				// Shift the values out from binary data
				for(let move of playerMoves) {
					// Binary is 4 bytes / 8 words / 32 bits; in bits: zip 12, state 4, a 8, b 8
					const idzip = 		(move <<0) 	>>>(0 	+(0+8+8+4))
					const movestate = 	(move <<12) >>>(12 	+(0+8+8))
					const a = 			(move <<16) >>>(16 	+(0+8))
					const b = 			(move <<24) >>>(24 	+(0))

					const idPlayer = this.babs.zips.get(idzip)
					const player = this.babs.ents.get(idPlayer)
					log.info('socket moveplayer', idPlayer, player, [idzip, movestate, a, b])
					if(player && player.id !== this.babs.idSelf) { // Skip self movements
						const movestateName = Object.entries(Controller.MOVESTATE).find(e => e[1] == movestate)[0].toLowerCase()

						if(movestateName === 'run' || movestateName == 'walk') {
							player.controller.setDestination(new Vector3(a, 0, b), movestateName)
						}
						else if(movestateName === 'jump') {
							player.controller.jump(Controller.JUMP_HEIGHT)
						}
						else if(movestateName === 'rotate') {
							const degrees = Controller.ROTATION_ANGLE_MAP[a] -45 // Why?  Who knows! :p
							const quat = new Quaternion()
							quat.setFromAxisAngle(new Vector3(0,1,0), MathUtils.degToRad(degrees))
							player.controller.setRotation(quat)
						}
					}
				}

			}
			else {
				const payload = JSON.parse(event.data)
				this.process(payload)
			}
		}
		this.ws.onerror = (event) => {
			log.info('Socket error', event)
			babs.uiSys.OfferReconnect('Connection error.')
		}
		this.ws.onclose = (event) => {
			log.info('Socket closed', event)
			babs.uiSys.OfferReconnect('Server connection closed.')
		}

		socketSend.subscribe(data => { // Used by eg Overlay.svelte 
			if(Object.keys(data).length === 0) return
			log('subscribe Send', data)
			this.send(data)
		})
	}

	visitor() {
		this.send({
			auth: 'visitor'
		})
	}
	auth(session) {
		this.send({
			auth: session
		})
	}
	enter(email, pass) {
		this.send({
			enter: {
				email,
				pass,
				session: Cookies.get('session'),
			}
		})
	}

	async send(json) {
		if(!json.ping && !json.move) log.info('Send:', json)
		if(this.ws.readyState === this.ws.OPEN) {
			await this.ws.send(JSON.stringify(json))
		}
		else {
			log.warn('Cannot send; WebSocket is in CLOSING or CLOSED state')
			this.babs.uiSys.OfferReconnect('Cannot reach server.')
		}
	}

	process(payload){
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
				break
				case 'visitor':
					this.session = data
					log('setting cookie, visitor', this.babs.baseDomain, this.babs.isProd)
					Cookies.set('session', this.session, { 
						domain: this.babs.baseDomain,
						secure: this.babs.isProd,
						sameSite: 'strict',
					}) // Non-set expires means it's a session cookie only, not saved across sessions
					toprightText.set('Visiting...')
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break
				case 'session':
					this.session = data
					log('setting cookie, session', this.babs.baseDomain, this.babs.isProd)
					const result = Cookies.set('session', this.session, { 
						expires: 365,
						domain: this.babs.baseDomain,
						secure: this.babs.isProd,
						sameSite: 'strict',
					})
					log.info('cookie set', result)
					toprightText.set('Entering...')
					window.location.reload() // Simpler than continuous flow for now // this.auth(this.session)
				break
				case 'alreadyin':
					// Just have them repeat the auth if this was their second login device
					
					this.babs.uiSys.OfferReconnect('Logged out your other session.  Try again! ->')
					
				break
				case 'load':
					window.setInterval(() => { // Keep alive through Cloudflare's socket timeout
						this.send({ping:'ping'})
					}, SocketSys.pingSeconds * 1000)

					const arrivalSelf = data.self
					const zones = data.zones
					const zone = zones.find(z => z.id == arrivalSelf.idzone)
					log.info('Welcome to', arrivalSelf.idzone, arrivalSelf.id, arrivalSelf.visitor)
					toprightText.set(this.babs.uiSys.toprightTextDefault)
					document.getElementById('topleft').style.visibility = 'visible'
					
					if(arrivalSelf.visitor !== true) {
						document.getElementById('topleft').style.visibility = 'visible'
						document.getElementById('topleft').textContent = 'Waking up...'

						menuShowLink.set(true)

						menuSelfData.set(arrivalSelf)
					}

					this.babsReady = true
					await this.babs.worldSys.loadStatics(this.babs.urlFiles, this.babs.scene, zone)

					if(arrivalSelf.visitor !== true) {
						document.getElementById('topleft').innerHTML = 'Welcome to First Earth (pre-alpha)'
					}

					// Create player entity
					log.info('loadSelf', arrivalSelf)
					const bSelf = true
					const playerSelf = new Player(arrivalSelf, bSelf, this.babs)

					// EventSys.Dispatch('load-self', arrivalSelf)

					this.send({
						ready: arrivalSelf.id,
					})


				break
				case 'playersarrive':
					log('playersarrive', data)

					// EventSys.Dispatch('players-arrive', data)

					for(let arrival of data) {
						const existingPlayer = this.babs.ents.get(arrival.id)
						if(existingPlayer) {
							// If we already have that player, such as self, be sure to update it.
							// This is primarily for getting movestate and .idzip, which server delays to set during tick.
							existingPlayer.movestate = arrival.movestate

							// This is also where self gets added to zips?
							existingPlayer.idzip = arrival.idzip
							this.babs.zips.set(existingPlayer.idzip, existingPlayer.id)

						}
						else {
							const bSelf = false
							const player = new Player(arrival, bSelf, this.babs)
						}

					}
				break
				case 'playerdepart':
					const departPlayer = this.babs.ents.get(data)
					log('departPlayer', data, departPlayer, this.babs.scene)

					if(departPlayer && departPlayer.id !== this.babs.idSelf) {
						// Could be self departing from a previous session, or person already otherwise departed?
						if(departPlayer.id !== this.babs.idSelf) { // Skip self departs - happens from refreshes sometimes
							departPlayer.remove()
						}

					}
				break
				case 'said':
					const chattyPlayer = this.babs.ents.get(data.id)
					if(chattyPlayer) { // Can be self; self text get put over head, too.
						log('said by chattyPlayer', chattyPlayer.id, data.text)
					}
				break
			}
		})
	}


}

