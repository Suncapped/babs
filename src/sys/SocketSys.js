import { menuSelfData, topmenuAvailable, toprightReconnect, toprightText, socketSend, debugMode, dividerOffset } from "../stores"
import Cookies from "js-cookie"
import { UiSys } from '../sys/UiSys'
import { EventSys } from "./EventSys"
import { WorldSys } from "./WorldSys"
import { LoaderSys } from "./LoaderSys"
import { log, randIntInclusive } from './../Utils'
import { AnimationMixer, MathUtils, Matrix4, Quaternion, Vector3 } from "three"
import { Controller } from "../com/Controller"
import { Player } from "../ent/Player"
import { CameraSys } from "./CameraSys"
import { Raycaster } from "three"
import { InputSys } from "./InputSys"
import { Wob } from "../ent/Wob"
import Crafting from "../ui/Crafting.svelte"

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
				const result = this.processEnqueue(payload)
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

	processQueue = []
	item
	update(dt) {
		const callTasks = async () => {
		  for (const [task, payload] of this.processQueue) {
			await task(this, payload);
		  }
		}
		callTasks()
		this.processQueue = []
	}
	processEnqueue(payload){
		if(payload.load || payload.visitor || payload.session) { // First one happens immediately, to jumpstart babsReady
			this.process(this, payload)
		}
		else {
			this.processQueue.push([this.process, payload])
		}
	}
	async process(context, payload){
		for(const [op, data] of Object.entries(payload)) {
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
					context.session = data
					log('setting cookie, visitor', context.babs.baseDomain, context.babs.isProd)
					Cookies.set('session', context.session, { 
						domain: context.babs.baseDomain,
						secure: context.babs.isProd,
						sameSite: 'strict',
					}) // Non-set expires means it's a session cookie only, not saved across sessions
					toprightText.set('Visiting...')
					window.location.reload() // Simpler than continuous flow for now // context.auth(context.session)
				break
				case 'session':
					context.session = data
					log('setting cookie, session', context.babs.baseDomain, context.babs.isProd)
					const result = Cookies.set('session', context.session, { 
						expires: 365,
						domain: context.babs.baseDomain,
						secure: context.babs.isProd,
						sameSite: 'strict',
					})
					log.info('cookie set', result)
					toprightText.set('Entering...')
					window.location.reload() // Simpler than continuous flow for now // context.auth(context.session)
				break
				case 'alreadyin':
					// Just have them repeat the auth if this was their second login device
					
					context.babs.uiSys.offerReconnect('Closed other session.')
					
				break
				case 'load':
					log.info('socket: load', data)
					window.setInterval(() => { // Keep alive through Cloudflare's socket timeout
						context.send({ping:'ping'})
					}, SocketSys.pingSeconds * 1000)

					const loadSelf = data.self
					const zones = data.zones
					log.info('Welcome to', loadSelf.idzone, loadSelf.id, loadSelf.visitor)
					toprightText.set(context.babs.uiSys.toprightTextDefault)
					document.getElementById('topleft').style.visibility = 'visible'

					debugMode.set(loadSelf.meta.debugmode === undefined ? false : loadSelf.meta.debugmode) // Handle meta value creation
					dividerOffset.set(loadSelf.divider)

					if(loadSelf.visitor !== true) {
						document.getElementById('topleft').style.visibility = 'visible'
						document.getElementById('topleft').textContent = 'Waking up...'

						topmenuAvailable.set(true)

						menuSelfData.set(loadSelf)
					}

					context.babsReady = true


					// Load some things ahead of time

					const fetches = []
					for(let zone of zones) {

						zone.elevationData = fetch(`${context.babs.urlFiles}/zone/${zone.id}/elevations`)
						zone.landcoverData = fetch(`${context.babs.urlFiles}/zone/${zone.id}/landcovers`)

						fetches.push(zone.elevationData, zone.landcoverData)
					}
					await Promise.all(fetches)

					for(let zone of zones) {
						const fet = await zone.elevationData
						const data = await fet.blob()
						const buff = await data.arrayBuffer()
						zone.elevationData = new Uint8Array(buff)

						const fet2 = await zone.landcoverData
						const data2 = await fet2.blob()
						const buff2 = await data2.arrayBuffer()
						zone.landcoverData = new Uint8Array(buff2)
					}

					const promises = []
					for(let zone of zones) {
						promises.push(context.babs.worldSys.loadStatics(context.babs.urlFiles, zone))
					}

					await Promise.all(promises)

					await context.babs.worldSys.stitchElevation(zones)

					const centerzone = zones.find(z => z.id == loadSelf.idzone)



					if(loadSelf.visitor !== true) {
						document.getElementById('welcomebar').style.display = 'none' 
					}

					// Create player entity
					const playerPromise = Player.Arrive(loadSelf, true, context.babs)

					// Set up UIs
					context.babs.uiSys.loadUis(data.uis)

					const wobs = await context.babs.worldSys.loadObjects(context.babs.urlFiles, centerzone)
					// We first load the object data above; then below we know which gltfs to pull
					// Since in the future we might cache them locally.
					// That's why we don't include them in the loadObjects /cache
					const arriveWobsPromise = Wob.ArriveMany(wobs, context.babs, false)

					await Promise.all([playerPromise, arriveWobsPromise])

					context.send({
						ready: loadSelf.id,
					})


				break
				case 'playersarrive':
					log.info('playersarrive', data)

					// EventSys.Dispatch('players-arrive', data)

					for(let arrival of data) {
						const existingPlayer = context.babs.ents.get(arrival.id)
						log.info('existing player', existingPlayer)
						if(existingPlayer) {
							// If we already have that player, such as self, be sure to update it.
							// This is primarily for getting movestate and .idzip, which server delays to set during tick.
							// Self data is set on 'load'
							existingPlayer.movestate = arrival.movestate

							// This is also where self gets added to zips?
							existingPlayer.idzip = arrival.idzip
							context.babs.zips.set(existingPlayer.idzip, existingPlayer.id)

						}
						else {
							const bSelf = false
							const player = await Player.Arrive(arrival, bSelf, context.babs)
							context.babs.uiSys.svJournal.appendText('You notice '+(player.nick || 'a stranger')+' nearby.', null, 'right')
						}

					}
				break
				case 'playerdepart':
					const departPlayer = context.babs.ents.get(data)
					log.info('departPlayer', data, departPlayer, context.babs.scene)

					if(departPlayer && departPlayer.id !== context.babs.idSelf) {
						// Could be self departing from a previous session, or person already otherwise departed?
						if(departPlayer.id !== context.babs.idSelf) { // Skip self departs - happens from refreshes sometimes
							context.babs.uiSys.svJournal.appendText((departPlayer.nick || 'A stranger')+' has departed.', null, 'right')
							departPlayer.remove()

						}

					}
				break
				case 'said':
					const chattyPlayer = context.babs.ents.get(data.id)
					if(chattyPlayer) { // Can be self; self text get put over head, too.
						log.info('said by chattyPlayer', chattyPlayer.id, data.text)
						context.babs.uiSys.playerSaid(chattyPlayer.id, data.text, {color: data.color, show: data.show !== false})
					}
				break
				case 'nicklist':
					log.info('nicklist', data)
					const nicklist = data
					for(let pair of nicklist) {
						const player = context.babs.ents.get(pair.idtarget)
						log.info('nicklist player', player)
						if(player) {
							player.setNick(pair.nick)
						}
						context.babs.uiSys.nicklist.set(pair.idtarget, pair.nick) // Save for later Player.Arrive players
					}
				break
				case 'wobsremove':
					log('wobsremove', data)
					for(let wobRemove of data.wobs) {
						const wobExisting = context.babs.ents.get(wobRemove.id)
						if(wobExisting) {
							const instanced = Wob.WobInstMeshes.get(wobExisting.name)
							instanced.setMatrixAt(wobExisting.instancedIndex, new Matrix4().setPosition(new Vector3(-100,-100,-100))) // todo change from just putting far away, to getting rid of
							instanced.instanceMatrix.needsUpdate = true

							if(wobExisting.attachments?.flame){
								context.babs.scene.remove(wob.attachments.flame.fire)
								delete wob.attachments.flame
							}

							context.babs.ents.delete(wobExisting.id)
						}
					}
				break;
				case 'wobsupdate':
					log('wobsupdate', data)
					await Wob.ArriveMany(data.wobs, context.babs, data.shownames)
				break
				case 'contains':
					log('contains', data)
					// Whether someone else bagged it or you bagged it, it's time to disappear the item from 3d.
					// 	Unless, of course, it was already bagged, and this is a bagtobag transfer!
					for(let wobFresh of data.wobs) {
						const wobExisting = context.babs.ents.get(wobFresh.id)
						if(wobExisting && wobExisting.idzone) { // Wob in zone
							const instanced = Wob.WobInstMeshes.get(wobExisting.name)
							instanced.setMatrixAt(wobExisting.instancedIndex, new Matrix4().setPosition(new Vector3(-100,-100,-100))) // todo change from just putting far away, to getting rid of
							instanced.instanceMatrix.needsUpdate = true
						}
					}
					
					if(data.id === context.babs.idSelf) { // Is your own inventory
						await Wob.ArriveMany(data.wobs, context.babs, false)
					}
				break
				case 'journal':
					log.info('journal', data)
					context.babs.uiSys.serverSaid(data.text)
				break
				case 'serverrestart':
					log('serverrestart', data)
					if(context.babs.isProd) {
						setTimeout(() => {
							context.babs.uiSys.svJournal.appendText('Reconnecting...', '#ff0000', 'right')
						}, 200)
					}
					setTimeout(() => {
						window.location.reload()
					}, context.babs.isProd ? randIntInclusive(5_000, 10_000) : 300)
				break
				case 'energy':
					log('energy', data)
				break
				case 'craftable':
					log('craftable', data)

					const wobId = data.wobId
					const options = data.options
					const craftWob = context.babs.ents.get(wobId)
					let position = context.babs.worldSys.vRayGroundHeight(craftWob.x, craftWob.z)
				
					log(position)
					// Display a list of icons above the wobId wob, list of options available:
					// Create a .svelte file for icons
					// When crafting thing is received, create icons for everything in it.
					// position like: const chatLabel = new CSS2DObject(chatDiv)

					context.babs.uiSys.craftSaid(options, position, wobId)
					
					// new Crafting({
					// 	target: document.body,
					// 	props: {
					// 		options,
					// 		wobId
					// 	},
					// })


				break
				case 'asktarget':
					log('asktarget', data, document.body.style.cursor)

					const wob = context.babs.ents.get(data.sourceWobId)

					context.babs.inputSys.askTarget(data.sourceWobId, wob.name || '')

				break
			}
		}
	}


}

