import { menuSelfData, menuShowLink, toprightReconnect, toprightText, socketSend, debugMode, dividerOffset } from "../stores"
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

	movePlayer = (idzip, movestate, a, b, attempts = 0) => {
		// log('attemping to move player, attempt', attempts)
		const idPlayer = this.babs.zips.get(idzip)
		const player = this.babs.ents.get(idPlayer)	
		if(player) {
			if(player.id !== this.babs.idSelf) { // Skip self movements
				// log('finally actually moving player after attept', attempts, idzip)
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
		else { // Player not yet defined; probably still loading // todo check for defuncts
			setTimeout(() => {
				this.movePlayer(idzip, movestate, a, b, attempts +1)
			}, 500)
		}
			


	}

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
			if(!(event.data instanceof ArrayBuffer)) {


				const payload = JSON.parse(event.data)
				this.process(payload)
			}
			else { // Movement
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

					// We're going to need to store these up until the player.controller is loaded.
					// Because after receiving a player arrival, we also start receiving their moves, before we've loaded the model etc.
					// In fact, the Player doesn't even exist yet.  Wait what?
					// Maybe I should be sending moves when the arrivals haven't happened yet?
					// Hmm, we could be receiving both at once in the same tick.
					// Really this is no big deal.  If they're moving, they'll move again.  If they're not...well their location could be wrong though.  So it is a big deal
					// This would apply to objects and stuff too; at least, updates to them.
					// Anything that 'updates' existing stuff, needs to be queued for while that stuff is still loading.
					// I can either make a literal queue, or make some kind of setInterval/await queue, or a virtual object (slow).
					// Literal queue seems cleanest but requires thinking in data instead of functions.
					// setInterval/await queue is easiest to implement but perhaps hard to debug.
					// Literal queue, I could queue the function call and its arg values.
					// For objects, this is going to need to be super efficient.
					// "Once you start moving into the range of 64-128 simultaneous timers, you’re pretty much out of luck in most browsers."
					// Let's try a literal queue.
					// Anyway there's really only two types of updates; player updates, and object updates.
					// Hmm there aren't that many of these happening, just on load, maybe timeouts are okay:
					
					this.movePlayer(idzip, movestate, a, b)
				}
			}
		}
		this.ws.onerror = (event) => {
			log.info('Socket error', event)
			babs.uiSys.offerReconnect('Connection error.')
		}
		this.ws.onclose = (event) => {
			log.info('Socket closed', event)
			babs.uiSys.offerReconnect('Server connection closed.')
		}

		socketSend.subscribe(data => { // Used by eg Overlay.svelte 
			// log('got socketSend.set', data)
			if(Object.keys(data).length === 0) return
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
			console.warn('Cannot send; WebSocket is in CLOSING or CLOSED state')
			this.babs.uiSys.offerReconnect('Cannot reach server.')
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
					
					this.babs.uiSys.offerReconnect('Logged out your other session.  Try again! ->')
					
				break
				case 'load':
					log.info('socket: load', data)
					window.setInterval(() => { // Keep alive through Cloudflare's socket timeout
						this.send({ping:'ping'})
					}, SocketSys.pingSeconds * 1000)

					const loadSelf = data.self
					const zones = data.zones
					const zone = zones.find(z => z.id == loadSelf.idzone)
					log.info('Welcome to', loadSelf.idzone, loadSelf.id, loadSelf.visitor)
					toprightText.set(this.babs.uiSys.toprightTextDefault)
					document.getElementById('topleft').style.visibility = 'visible'

					debugMode.set(loadSelf.debugmode === undefined ? false : loadSelf.debugmode) // Handle meta value creation
					dividerOffset.set(loadSelf.divider)

					if(loadSelf.visitor !== true) {
						document.getElementById('topleft').style.visibility = 'visible'
						document.getElementById('topleft').textContent = 'Waking up...'

						menuShowLink.set(true)

						menuSelfData.set(loadSelf)
					}

					this.babsReady = true
					await this.babs.worldSys.loadStatics(this.babs.urlFiles, zone)
					await this.babs.worldSys.loadObjects(zone)

					if(loadSelf.visitor !== true) {
						document.getElementById('topleft').innerHTML = 'Welcome to First Earth (pre-alpha)'
					}

					// Create player entity
					const bSelf = true
					const playerSelf = await Player.New(loadSelf, bSelf, this.babs)

					// Set up UIs
					this.babs.uiSys.loadUis(data.uis)


					this.send({
						ready: loadSelf.id,
					})


				break
				case 'playersarrive':
					log.info('playersarrive', data)

					// EventSys.Dispatch('players-arrive', data)

					for(let arrival of data) {
						const existingPlayer = this.babs.ents.get(arrival.id)
						log.info('existing player', existingPlayer)
						if(existingPlayer) {
							// If we already have that player, such as self, be sure to update it.
							// This is primarily for getting movestate and .idzip, which server delays to set during tick.
							// Self data is set on 'load'
							existingPlayer.movestate = arrival.movestate

							// This is also where self gets added to zips?
							existingPlayer.idzip = arrival.idzip
							this.babs.zips.set(existingPlayer.idzip, existingPlayer.id)

						}
						else {
							const bSelf = false
							const player = await Player.New(arrival, bSelf, this.babs)
							this.babs.uiSys.svJournal.appendText('You notice '+(player.nick || 'an unfamiliar person')+' nearby.')
						}

					}
				break
				case 'playerdepart':
					const departPlayer = this.babs.ents.get(data)
					log.info('departPlayer', data, departPlayer, this.babs.scene)

					if(departPlayer && departPlayer.id !== this.babs.idSelf) {
						// Could be self departing from a previous session, or person already otherwise departed?
						if(departPlayer.id !== this.babs.idSelf) { // Skip self departs - happens from refreshes sometimes
							this.babs.uiSys.svJournal.appendText((departPlayer.nick || 'An unfamiliar person')+' has departed.')
							departPlayer.remove()

						}

					}
				break
				case 'said':
					const chattyPlayer = this.babs.ents.get(data.id)
					if(chattyPlayer) { // Can be self; self text get put over head, too.
						log.info('said by chattyPlayer', chattyPlayer.id, data.text)
						this.babs.uiSys.playerSaid(chattyPlayer.id, data.text, {color: data.color})
					}
				break
				case 'nicklist':
					log.info('nicklist', data)
					const nicklist = data
					for(let pair of nicklist) {
						const player = this.babs.ents.get(pair.idtarget)
						log.info('nicklist player', player)
						if(player) {
							player.setNick(pair.nick)
						}
						this.babs.uiSys.nicklist.set(pair.idtarget, pair.nick) // Save for later Player.New players
					}
				break
			}
		})
	}


}

