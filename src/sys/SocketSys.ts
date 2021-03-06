import { menuSelfData, topmenuAvailable, toprightReconnect, toprightText, socketSend, debugMode, dividerOffset } from '../stores'
import Cookies from 'js-cookie'
import { UiSys } from '@/sys/UiSys'
import { EventSys } from './EventSys'
import { WorldSys } from './WorldSys'
import { LoaderSys } from './LoaderSys'
import { log, randIntInclusive } from './../Utils'
import { AnimationMixer, Int8BufferAttribute, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { Controller } from '@/comp/Controller'
import { Player } from '@/ent/Player'
import { CameraSys } from './CameraSys'
import { Raycaster } from 'three'
import { InputSys } from './InputSys'
import { Wob } from '@/ent/Wob'
import Crafting from '../ui/Crafting.svelte'
import { Zone } from '@/ent/Zone'
import { Babs } from '@/Babs'
import { YardCoord } from '@/comp/Coord'
import { FastWob } from '@/shared/SharedZone'
import type { SendCraftable, SendLoad, SendWobsUpdate, SendFeTime, WobId, Zoneinfo } from '@/shared/consts'
import { DateTime } from 'luxon'

export class SocketSys {

	ws
	scene
	babsReady = false
	babs :Babs

	static pingSeconds = 30

	movePlayer = (idzip, movestate, a, b, attempts = 0) => {
		log.info('movePlayer', idzip, a, b)
		// log('attemping to move player, attempt', attempts)
		const idPlayer = this.babs.zips.get(idzip)
		const player = this.babs.ents.get(idPlayer)	as Player
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
			let tryCount = 0
			setTimeout(() => {
				tryCount++
				if(tryCount < 2) {
					this.movePlayer(idzip, movestate, a, b, attempts +1)
				}
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
					// "Once you start moving into the range of 64-128 simultaneous timers, you???re pretty much out of luck in most browsers."
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
	async process(context :SocketSys, payload){
		for(const [op, data] of Object.entries(payload)) {
			switch(op) {
			case 'auth': {
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
			}
			case 'visitor': {
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
			}
			case 'session': {
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
			}
			case 'alreadyin': {
				// Just have them repeat the auth if this was their second login device
					
				context.babs.uiSys.offerReconnect('Closed other session.')
					
				break
			}
			case 'load': {
				const load = data as (SendLoad['load'])
				log('socket: load', data)
				window.setInterval(() => { // Keep alive through Cloudflare's socket timeout
					context.send({ping:'ping'})
				}, SocketSys.pingSeconds * 1000)

				const zonedatas = load.zones
				log.info('Welcome to', load.self.idzone, load.self.id, load.self.visitor)
				toprightText.set(context.babs.uiSys.toprightTextDefault)
				document.getElementById('topleft').style.visibility = 'visible'

				debugMode.set(load.self.meta.debugmode === undefined ? false : load.self.meta.debugmode) // Handle meta value creation
				dividerOffset.set(load.self.divider)

				if(load.self.visitor !== true) {
					document.getElementById('topleft').style.visibility = 'visible'
					document.getElementById('topleft').textContent = 'Waking up...'

					topmenuAvailable.set(true)

					menuSelfData.set(load.self)
				}

				context.babsReady = true

				let zones = new Array<Zone>()
				for(let zi of zonedatas) {
					zones.push(new Zone(context.babs, zi.id, zi.x, zi.z, zi.y, zi.yscale, new Uint8Array, new Uint8Array))
				}

				// Load some things ahead of time
				const fetches = []
				for(let zone of zones) {
					zone.elevationData = fetch(`${context.babs.urlFiles}/zone/${zone.id}/elevations.bin`)
					zone.landcoverData = fetch(`${context.babs.urlFiles}/zone/${zone.id}/landcovers.bin`)
					zone.locationData = fetch(`${context.babs.urlFiles}/zone/${zone.id}/locations.bin`)

					fetches.push(zone.elevationData, zone.landcoverData, zone.locationData)
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

					const fet3 = await zone.locationData
					const data3 = await fet3.blob()
					if(data3.size == 2) {  // hax on size (for `{}`)
						zone.locationData = new Uint8Array()
					}
					else {
						const buff3 = await data3.arrayBuffer()
						zone.locationData = new Uint8Array(buff3)
					}
				}

				const pStatics = []
				for(let zone of zones) {
					const isStartingZone = zone.id == load.self.idzone
					pStatics.push(context.babs.worldSys.loadStatics(context.babs.urlFiles, zone, isStartingZone))
				}
				// console.time('stitch')
				await Promise.all(pStatics)
				// console.timeEnd('stitch') // 182ms for 81 zones

				await context.babs.worldSys.stitchElevation(zones)

				// Create player entity
				const playerPromise = Player.Arrive(load.self, true, context.babs)
					
				// Set up UIs
				context.babs.uiSys.loadUis(load.uis)


				// Note: Set up shiftiness now, but this won't affect instanced things loaded here NOR in wobsupdate.
				// I was trying to do this after ArriveMany, but that was missing the ones in wobsupdate.
				const startingZone = this.babs.ents.get(load.self.idzone) as Zone
				context.babs.worldSys.shiftEverything(-startingZone.x *1000, -startingZone.z *1000, true)

				// let pObjects = []
				// for(let zone of zones) {
				// 	pObjects.push(context.babs.worldSys.loadObjects(context.babs.urlFiles, zone))
				// }
				// const wobs = (await Promise.all(pObjects)).flat()
				// // We first load the object data above; then below we know which gltfs to pull
				// // Since in the future we might cache them locally.
				// // That's why we don't include them in the loadObjects /cache
				// // and since different zones also have different wobs anyway, this must be pull, not push.

				// // (However (sk), we can do a mass file request; see in ArriveMany)
				// const arriveWobsPromise = Wob.ArriveMany(wobs, context.babs, false)


				// Get the new, faster wobs locations array
				// let fastWobLocationsPromises = new Array<Promise<Uint8Array>>(zones.length)
				// for(let zone of zones) {
				// 	zone.applyBlueprints(load.blueprints)
					
				// 	const locations = context.babs.worldSys.loadWobLocations(context.babs.urlFiles, zone)
				// 	fastWobLocationsPromises.push(locations)
				// }
				// const fastWobLocations = await Promise.all(fastWobLocationsPromises)

				let fWobs :Array<FastWob> = []
				for(const zone of zones) {
					zone.applyBlueprints(load.blueprints)
					const fastWobs = zone.applyLocationsToGrid(zone.locationData, true)
					fWobs.push(...fastWobs)
				}
				const arriveFastwobsPromise = Wob.ArriveMany(fWobs, context.babs, false)

				await Promise.all([playerPromise, arriveFastwobsPromise])


				context.send({
					ready: load.self.id,
				})

				if(load.self.visitor !== true) {
					document.getElementById('welcomebar').style.display = 'none' 
				}


				break
			}
			case 'playersarrive': {
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
			}
			case 'playerdepart': {
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
			}
			case 'zonein': {
				// Handle self or others switching zones
				const player = context.babs.ents.get(data.idplayer) as Player
				const zone = context.babs.ents.get(data.idzone) as Zone

				player.controller.zoneIn(player, zone)


				break
			}
			case 'said': {
				const chattyPlayer = context.babs.ents.get(data.id) as Player
				log.info('said by chattyPlayer', chattyPlayer?.id, data.name, data.text)
				// chattyPlayer can be undefined (if they've signed off but this is a recent chat being sent).  
				// In that case, data.name is set to their name.
				context.babs.uiSys.playerSaid(chattyPlayer?.id, data.text, {color: data.color, show: data.show !== false, name: data.name})
				break
			}
			case 'nicklist': {
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
			}
			case 'wobsupdate': {
				const wobsupdate = data as SendWobsUpdate['wobsupdate']
				log.info('wobsupdate', data)

				/*
				Currently we are:
					setting zone stuff like applyLocationsToGrid
					...then also...
					generating a bunch of FastWob{} and sending them to ArriveMany(), where graphics get created.
				Could I simplify by creating graphics during setWob, set locations etc?  Yes I suppose.  But instance management then gets weird.  And slower?
				So the purpose of ArriveMany is to load the graphics, pretty much.
				*/
				const zone = context.babs.ents.get(wobsupdate.idzone) as Zone
				// if(wobsupdate.blueprints) zone.applyBlueprints(wobsupdate.blueprints)
				const fastWobs = zone.applyLocationsToGrid(new Uint8Array(wobsupdate.locationData), true)

				await Wob.ArriveMany(fastWobs, context.babs, wobsupdate.shownames)
				break
			}
			case 'contains': {
				log.info('contains', data)
				// Whether someone else bagged it or you bagged it, it's time to disappear the item from 3d.
				// 	Unless, of course, it was already bagged, and this is a bagtobag transfer!
				for(let wobFresh of data.wobs) {
					const wobExisting = context.babs.ents.get(wobFresh.id)
					if(wobExisting && wobExisting.idzone) { // Wob in zone
						const instanced = Wob.InstancedMeshes.get(wobExisting.name)
						instanced.setMatrixAt(wobExisting.instancedIndex, new Matrix4().setPosition(new Vector3(-100,-1000,-100))) // todo change from just putting far away, to getting rid of
						instanced.instanceMatrix.needsUpdate = true
					}
				}
					
				if(data.id === context.babs.idSelf) { // Is your own inventory
					await Wob.ArriveMany(data.wobs, context.babs, false)
				}
				break
			}
			case 'journal': {
				log.info('journal', data)
				context.babs.uiSys.serverSaid(data.text)
				break
			}
			case 'serverrestart': {
				log('serverrestart', data)
				if(context.babs.isProd) {
					setTimeout(() => {
						context.babs.uiSys.svJournal.appendText('Reconnecting... (or try a refresh)', '#ff0000', 'right')
					}, 2000)
				}
				setTimeout(() => {
					window.location.reload()
				}, context.babs.isProd ? randIntInclusive(5_000, 10_000) : 300)
				break
			}
			case 'energy': {
				log('energy', data)
				break
			}
			case 'craftable': {
				log('craftable', data)
				
				const craftable = data as SendCraftable['craftable']

				const wobId = craftable.wobId
				const options = craftable.options
				const coord = YardCoord.Create({...wobId, babs: context.babs})
				const wob = coord.zone.getWob(coord.x, coord.z)

				// Display a list of icons above the wobId wob, list of options available:
				// Create a .svelte file for icons
				// When crafting thing is received, create icons for everything in it.
				// position like: const chatLabel = new CSS2DObject(chatDiv)

				context.babs.uiSys.craftSaid(options, wob)
					
				// new Crafting({
				// 	target: document.body,
				// 	props: {
				// 		options,
				// 		wobId
				// 	},
				// })


				break
			}
			case 'asktarget': {
				log('asktarget', data, document.body.style.cursor)

				const wobId = data.sourceWobId as WobId

				const coord = YardCoord.Create({...wobId, babs: context.babs})
				const fwob = coord.zone.getWob(coord.x, coord.z)

				context.babs.inputSys.askTarget(fwob)

				break
			}
			case 'fetime': {
				log('fetime', data)

				const fetime = data as SendFeTime['fetime']

				const feTime = DateTime.fromISO(fetime).toUTC()
				console.log('fetime utc iso' ,feTime.toISO())

				context.babs.worldSys.feTime = feTime.plus({hours: 8})

				break
			}
			}
		}
	}


}

