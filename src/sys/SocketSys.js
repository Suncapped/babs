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
						player.controller.setDestination(new Vector3(a, 0, b), movestateName)
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

					const arrivalSelf = data.self
					const zones = data.zones
					const zone = zones.find(z => z.id == arrivalSelf.idzone)
					log.info('Welcome to', arrivalSelf.idzone, arrivalSelf.id, arrivalSelf.visitor)
					toprightText.set(UiSys.toprightTextDefault)
					document.getElementById('topleft').style.visibility = 'visible'
					
					if(arrivalSelf.visitor !== true) {
						document.getElementById('topleft').style.visibility = 'visible'
						document.getElementById('topleft').textContent = 'Waking up...'

						menuShowLink.set(true)

						menuSelfData.set(arrivalSelf)
					}

					this.babsReady = true
					await WorldSys.LoadStatics(this.babs.urlFiles, this.babs.scene, zone)

					if(arrivalSelf.visitor !== true) {
						document.getElementById('topleft').innerHTML = 'Welcome to First Earth (pre-alpha)'
					}

					// Create player entity
					log('loadSelf', arrivalSelf)
					const bSelf = true
					const playerSelf = new Player(arrivalSelf, bSelf, this.babs)

					// const fbx = await LoaderSys.LoadRig(arrivalSelf.char.gender)
					// playerSelf.controller = new Controller(arrivalSelf, bSelf, this.babs) // Loads rig, creates Three stuff
					// playerSelf.controller.init(fbx)


					log('new player self', playerSelf)

					// EventSys.Dispatch('load-self', arrivalSelf)

					this.Send({
						ready: arrivalSelf.id,
					})


				break;
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
			}
		})
	}


}

