import { menuSelfData, topmenuAvailable, toprightReconnect, toprightText, socketSend, debugMode, dividerOffset } from '../stores'
import Cookies from 'js-cookie'
import { UiSys } from '@/sys/UiSys'
import { EventSys } from './EventSys'
import { WorldSys } from './WorldSys'
import { LoaderSys } from './LoaderSys'
import { log, randIntInclusive, sleep } from './../Utils'
import { AnimationMixer, Int8BufferAttribute, Loader, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { Controller } from '@/comp/Controller'
import { Player } from '@/ent/Player'
import { CameraSys } from './CameraSys'
import { Raycaster } from 'three'
import { InputSys } from './InputSys'
import { Wob } from '@/ent/Wob'
import { Zone } from '@/ent/Zone'
import { Babs } from '@/Babs'
import { YardCoord } from '@/comp/Coord'
import { SharedWob } from '@/shared/SharedWob'
import type { SendCraftable, SendLoad, SendWobsUpdate, SendFeTime, Zoneinfo, SendPlayersArrive, SendZoneIn, SendAskTarget, SendNickList } from '@/shared/consts'
import type { WobId } from '@/shared/SharedWob'
import { DateTime } from 'luxon'
import { Flame } from '@/comp/Flame'
import { get as svelteGet } from 'svelte/store'
import type { Sendable } from '@/shared/consts'

export class SocketSys {
	static pingSeconds = 30

	babsReady = false
	session :string
	ws :WebSocket

	constructor(
		private babs :Babs,
	) {

		const lookForFeExistingSession = () => {
			setTimeout(() => {
				if(!window.FeExistingSession) {
					// console.log('Looking for window.FeExistingSession...')
					lookForFeExistingSession() // Keep trying
				}
				else {
					// console.log('Found window.FeExistingSession', window.FeExistingSession, window.FeWs)
					if(window.FeWs) {
						this.ws = window.FeWs
						this.finishSocketSetup(window.FeExistingSession)
					}
					else {
						this.ws = new WebSocket(babs.urlSocket)
						// console.log('inner socket launched with', babs.urlSocket)
						this.ws.onopen = (event) => {
							this.finishSocketSetup(window.FeExistingSession)
						}
					}
				}
			}, 100)
		}
		lookForFeExistingSession()
	}

	finishSocketSetup(existingSession :string) {
		toprightText.set('Connecting...')
		this.ws.binaryType = 'arraybuffer'

		// this.ws.onopen = (event) => {
		// 	// Fix people having earth subdomain cookies from previous versions; todo remove later perhaps
		// 	if(this.babs.isProd) {
		// 		// Cookies.remove('session') // Well this for some reason deletes session on earth.suncapped.com...
		// 		// so fine, then .get() will get the root one.  .delete() will never delete the root because that's set with domain
		// 	}
			
		this.send({
			auth: existingSession
		})

		this.ws.onmessage = (event) => {
			log.info('Socket rec:', event.data)
			if(!(event.data instanceof ArrayBuffer)) {
				const payload = JSON.parse(event.data) as Sendable
				this.processEnqueue(payload)
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
			this.babs.uiSys.offerReconnect('Connection error.')
		}
		this.ws.onclose = (event) => {
			log.info('Socket closed', event)
			this.babs.uiSys.offerReconnect('Server connection closed.')
		}

		socketSend.subscribe(data => { // Used by eg Overlay.svelte 
			// log('got socketSend.set', data)
			if(Object.keys(data).length === 0) return
			this.send(data)
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
	update() {
		const callTasks = async () => {
			for (const payload of this.processQueue) {
				await this.process(payload) // do them one at a time, in order
			}
		}
		callTasks()
		this.processQueue = [] // todo could this potentially have a problem where update() gets called twice and parts of the queue get double processed?
	}
	async processEnqueue(payload :Sendable){
		const command = Object.keys(payload)[0]

		if('load' in payload || 'visitor' in payload || 'session' in payload) { 
			// babsReady isn't true until after load, so babs isn't calling update() on this sys yet.  So run manually for these.
			await this.process(payload)
		}
		else {
			this.processQueue.push(payload)
		}
	}
	async process(payload :Sendable){
		if('auth' in payload) {
			(document.getElementById('charsave') as HTMLButtonElement).disabled = false
			// Handle failed login/register here
			if(payload.auth === 'userpasswrong') {
				document.getElementById('topleft').style.visibility = 'visible'
				toprightText.set('Username/password does not match.')
			}
			else if(payload.auth === 'emailinvalid') {
				document.getElementById('topleft').style.visibility = 'visible'
				toprightText.set('Email is invalid.')
			}
			else if(payload.auth === 'accountfailed') {
				document.getElementById('topleft').style.visibility = 'visible'
				toprightText.set('Account creation error.')
			}
			else if(payload.auth === 'passtooshort') {
				document.getElementById('topleft').style.visibility = 'visible'
				toprightText.set('Password too short, must be 8.')
			}
		}
		else if('visitor' in payload) {
			console.warn('Somehow skipped initial html (slow) visitor', payload)
			// this.session = payload.visitor
			// log('setting cookie, visitor', this.babs.baseDomain, this.babs.isProd)
			// Cookies.set('session', this.session, { 
			// 	domain: this.babs.baseDomain,
			// 	secure: this.babs.isProd,
			// 	sameSite: 'strict',
			// }) // Non-set expires means it's a session cookie only, not saved across sessions
			toprightText.set('Visiting...')
			// window.location.reload() // Simpler than continuous flow for now // context.auth(context.session)
		}
		else if('session' in payload) {
			log('setting cookie, session', this.babs.baseDomain, this.babs.isProd)
			this.session = payload.session
			const result = Cookies.set('session', this.session, { 
				expires: 365,
				domain: this.babs.baseDomain,
				secure: this.babs.isProd,
				sameSite: 'strict',
			})
			log.info('cookie set', result)
			toprightText.set('Entering...')
			window.location.reload() // Simpler than continuous flow for now // context.auth(context.session)
		}
		else if('alreadyin' in payload) {
			// Just have them repeat the auth if this was their second login device
			this.babs.uiSys.offerReconnect('Disconnected from other tab.')
		}
		else if('load' in payload) {

			this.babs.loaderSys = new LoaderSys(this.babs)

			const load = payload.load
			log.info('socket: load', payload.load)
			window.setInterval(() => { // Keep alive through Cloudflare's socket timeout
				this.send({ping:'ping'})
			}, SocketSys.pingSeconds * 1000)

			log.info('Welcome to', load.self.idzone, load.self.id, load.self.visitor)
			toprightText.set(this.babs.uiSys.toprightTextDefault)
			document.getElementById('topleft').style.visibility = 'visible'

			debugMode.set(load.self.meta.debugmode === undefined ? false : load.self.meta.debugmode) // Handle meta value creation
			dividerOffset.set(load.self.divider)

			if(load.self.visitor !== true) {
				document.getElementById('topleft').style.visibility = 'visible'
				document.getElementById('topleft').textContent = 'Waking up...'

				topmenuAvailable.set(true)

				menuSelfData.set(load.self)
			}

			let farZones = load.farZones.map(zone => new Zone(this.babs, zone.id, zone.x, zone.z, zone.y, zone.yscale, new Uint8Array, new Uint8Array))
			// let nearZones = load.nearZones.map(zone => new Zone(this.babs, zone.id, zone.x, zone.z, zone.y, zone.yscale, new Uint8Array, new Uint8Array))
			// const nearbyZoneIds = new Set(load.nearZones.map(zoneinfo => zoneinfo.id))

			// Fetch from cache in pail
			const dekaTerrain = await LoaderSys.CachedDekazoneFiles
			const dekaFarwobs = await LoaderSys.CachedDekafarwobsFiles

			const fetches = []
			for(let zone of farZones) {
				if(dekaTerrain) { // Only true when babs.usePail is set on terrain
					// console.log(`deka elevations/${zone.key()}.bin`, dekazone[`elevations/${zone.key()}.bin`], dekazone)
					zone.elevationData = await (dekaTerrain[`elevations/${zone.key()}.bin`]).async('arraybuffer')
					zone.landcoverData = await (dekaTerrain[`landcovers/${zone.key()}.bin`]).async('arraybuffer')
				}
				else {
					zone.elevationData = fetch(`${this.babs.urlFiles}/zone/${zone.id}/elevations.bin`)
					zone.landcoverData = fetch(`${this.babs.urlFiles}/zone/${zone.id}/landcovers.bin`)
				}
				if(dekaFarwobs) {
					zone.farLocationData = await (dekaFarwobs[zone.key()]).async('arraybuffer')
				}
				else {
					zone.farLocationData = fetch(`${this.babs.urlFiles}/zone/${zone.id}/farlocations.bin`)
				}
				fetches.push(zone.elevationData, zone.landcoverData)
			}
			await Promise.all(fetches)

			for(const zone of farZones) {
				if(dekaTerrain) {
					zone.elevationData = new Uint8Array(await zone.elevationData)
					zone.landcoverData = new Uint8Array(await zone.landcoverData)
				}
				else {
					zone.elevationData = new Uint8Array(await (await (await zone.elevationData).blob()).arrayBuffer())
					zone.landcoverData = new Uint8Array(await (await (await zone.landcoverData).blob()).arrayBuffer())
				}

				if(dekaFarwobs) {
					zone.farLocationData = new Uint8Array(await zone.farLocationData)
				}
				else {
					const farBlob = await (await zone.farLocationData).blob()
					if(farBlob.size == 2) {  // hax on size (for `{}`) // todo simplify, have it return something that's ==0?
						zone.farLocationData = new Uint8Array()
					}
					else {
						zone.farLocationData = new Uint8Array(await farBlob.arrayBuffer())
					}
				}
			}
			
			const pStatics = []
			for(const zone of farZones) {
				const isLoadinZone = zone.id == load.self.idzone
				pStatics.push(this.babs.worldSys.loadStatics(this.babs.urlFiles, zone, isLoadinZone))
			}
			// player.controller.zoneIn()
			// console.time('stitch')
			await Promise.all(pStatics)

			log.info('Statics loaded:', farZones.length)
			// console.timeEnd('stitch') // 182ms for 81 zones

			Zone.loadedZones = farZones

			await this.babs.worldSys.stitchElevation(farZones)

			// Set up UIs
			this.babs.uiSys.loadUis(load.uis)

			// Note: Set up shiftiness now, but this won't affect instanced things loaded here NOR in wobsupdate.
			// I was trying to do this after LoadInstancedWobs, but that was missing the ones in wobsupdate.
			const startingZone = this.babs.ents.get(load.self.idzone) as Zone
			this.babs.worldSys.shiftEverything(-startingZone.x *1000, -startingZone.z *1000, true)

			// Create player entity
			await Player.Arrive(load.self, true, this.babs)
			
			for(const zone of farZones) {
				zone.applyBlueprints(new Map(Object.entries(load.blueprints))) // LoadFarwobGraphics will need blueprints to get visible comp info
			}

			const player = this.babs.ents.get(load.self.id) as Player
			const enterZone = this.babs.ents.get(load.self.idzone) as Zone
			const exitZone = null//this.babs.ents.get(player.controller.target.zone.id) as Zone

			player.controller.zoneIn(player, enterZone, exitZone)

			if(load.self.visitor !== true) {
				document.getElementById('welcomebar').style.display = 'none' 
			}
			
			this.babsReady = true // Starts update()s
		}
		else if('playersarrive' in payload) {
			log.info('playersarrive', payload.playersarrive)

			for(let arrival of payload.playersarrive) {
				const existingPlayer = this.babs.ents.get(arrival.id) as Player
				log.info('existing player', existingPlayer)
				if(existingPlayer) {
					// If we already have that player, such as self, be sure to update it.
					// This is primarily for getting .idzip, which server delays to set during tick.
					// Self data is set on 'load'

					// This is also where self gets added to zips?
					existingPlayer.idzip = arrival.idzip
					this.babs.zips.set(existingPlayer.idzip, existingPlayer.id)

				}
				else {
					const bSelf = false
					const player = await Player.Arrive(arrival, bSelf, this.babs)
					this.babs.uiSys.svJournal.appendText('You notice '+(player.nick || 'a stranger')+' nearby.', null, 'right')
				}

			}
		}
		else if('playerdepart' in payload) {
			const departPlayer = this.babs.ents.get(payload.playerdepart) as Player
			log.info('departPlayer', payload.playerdepart, departPlayer, this.babs.scene)

			if(departPlayer && departPlayer.id !== this.babs.idSelf) {
				// Could be self departing from a previous session, or person already otherwise departed?
				if(departPlayer.id !== this.babs.idSelf) { // Skip self departs - happens from refreshes sometimes
					this.babs.uiSys.svJournal.appendText((departPlayer.nick || 'A stranger')+' has departed.', null, 'right')
					departPlayer.remove()

				}
			}
		}
		else if('zonein' in payload) { // Handle self or others switching zones
			const player = this.babs.ents.get(payload.zonein.idplayer) as Player
			const enterZone = this.babs.ents.get(payload.zonein.idzone) as Zone
			const exitZone = this.babs.ents.get(player.controller.target.zone.id) as Zone // player.controller.target.zone ?
			const playerIsSelf = player.id === this.babs.idSelf

			await player.controller.zoneIn(player, enterZone, exitZone)
		}
		else if('said' in payload) {
			const said = payload.said
			const chattyPlayer = this.babs.ents.get(said.id) as Player
			log.info('said by chattyPlayer', chattyPlayer?.id, said.name, said.text)
			// chattyPlayer can be undefined (if they've signed off but this is a recent chat being sent).  
			// In that case, data.name is set to their name.
			this.babs.uiSys.playerSaid(chattyPlayer?.id, said.text, {color: said.color, show: said.show !== false, name: said.name})
		}
		else if('nicklist' in payload) {
			log.info('nicklist', payload.nicklist)
			for(let pair of payload.nicklist) {
				const player = this.babs.ents.get(pair.idtarget) as Player
				log.info('nicklist player', player)
				player?.setNick(pair.nick)
				this.babs.uiSys.nicklist.set(pair.idtarget, pair.nick) // Save for later Player.Arrive players
				if(player?.id === this.babs.idSelf) {
					menuSelfData.set({
						...svelteGet(menuSelfData),
						nick: pair.nick,
					})
				}
			}
		}
		else if('wobsupdate' in payload) {
			log.info('wobsupdate', payload.wobsupdate)

			/*
			Currently we are:
				setting zone stuff like applyLocationsToGrid
				...then also...
				generating a bunch of SharedWob{} and sending them to LoadInstancedWobs(), where graphics get created.
			Could I simplify by creating graphics during setWob, set locations etc?  Yes I suppose.  But instance management then gets weird.  And slower?
			So the purpose of LoadInstancedWobs is to load the graphics, pretty much.
			*/
			const zone = this.babs.ents.get(payload.wobsupdate.idzone) as Zone
			log.info('wobsupdate locationdata ', payload.wobsupdate.locationData.length)
			const sharedWobs = zone.applyLocationsToGrid(new Uint8Array(payload.wobsupdate.locationData), true)

			await Wob.LoadInstancedWobs(sharedWobs, this.babs, payload.wobsupdate.shownames)
		}
		else if('contains' in payload) {
			// log.info('contains', payload.contains)
			// // Whether someone else bagged it or you bagged it, it's time to disappear the item from 3d.
			// // 	Unless, of course, it was already bagged, and this is a bagtobag transfer!
			// for(let wobFresh of payload.contains.wobs) {
			// 	const wobExisting = this.babs.ents.get(wobFresh.id)
			// 	if(wobExisting && wobExisting.idzone) { // Wob in zone
			// 		const instanced = Wob.InstancedMeshes.get(wobExisting.name)
			// 		instanced.setMatrixAt(wobExisting.instancedIndex, new Matrix4().setPosition(new Vector3(-100,-1000,-100))) // todo change from just putting far away, to getting rid of
			// 		instanced.instanceMatrix.needsUpdate = true
			// 	}
			// }
				
			// if(payload.contains.id === this.babs.idSelf) { // Is your own inventory
			// 	await Wob.LoadInstancedWobs(payload.contains.wobs, this.babs, false)
			// }
		}
		else if('journal' in payload) {
			log.info('journal', payload.journal)
			this.babs.uiSys.serverSaid(payload.journal.text)
		}
		else if('serverrestart' in payload) {
			log('serverrestart', payload.serverrestart)
			const babs = this.babs
			if(babs.isProd) {
				setTimeout(() => {
					babs.uiSys.svJournal.appendText('Reconnecting... (or try a refresh)', '#ff0000', 'right')
				}, 2000)
			}
			setTimeout(() => {
				window.location.reload()
			}, babs.isProd ? randIntInclusive(5_000, 10_000) : 300)
		}
		else if('energy' in payload) {
			log.info('energy', payload.energy)

		}
		else if('craftable' in payload) {
			const wobId = payload.craftable.wobId
			const options = payload.craftable.options
			const coord = YardCoord.Create({...wobId, babs: this.babs})
			const wob = coord.zone.getWob(coord.x, coord.z)

			// Display a list of icons above the wobId wob, list of options available:
			// Create a .svelte file for icons
			// When crafting thing is received, create icons for everything in it.
			// position like: const chatLabel = new CSS2DObject(chatDiv)

			this.babs.uiSys.craftSaid(options, wob, coord.zone)
				
			// new Crafting({
			// 	target: document.body,
			// 	props: {
			// 		options,
			// 		wobId
			// 	},
			// })
		}
		else if('asktarget' in payload) {
			log('asktarget', payload.asktarget, document.body.style.cursor)

			const wobId = payload.asktarget.sourceWobId as WobId

			if(wobId) {
				const coord = YardCoord.Create({...wobId, babs: this.babs})
				const fwob = coord.zone.getWob(coord.x, coord.z)
				this.babs.inputSys.askTarget(fwob)
			}
			else {

				this.babs.inputSys.askTarget()
			}
		}
		else if('fetime' in payload) {
			log.info('fetime', payload.fetime)

			this.babs.worldSys.localTimeWhenGotProximaTime = DateTime.utc()
			this.babs.worldSys.proximaSecondsSinceHour = payload.fetime.secondsSinceHour
			// context.babs.worldSys.proximaSecondsSinceHour = 2400 // night
			// context.babs.worldSys.proximaSecondsSinceHour = 2400 +(60 *25) // dawn
			this.babs.worldSys.proximaSecondsSinceHour = 2400 +(60 *30) // day
			// this.babs.worldSys.proximaSecondsSinceHour += +(60 *47) // Flip daytime&nighttime
		}
		else if('creatures' in payload) {
			// log.info('creatures', payload.creatures)

			// const creatures = data as SendCreatures['creatures']
			// const {idzone, type, x, z, created_at} = creatures[0]

			// const zone = this.babs.ents.get(idzone) as Zone
			// const wob = zone.getWob(x, z)

			// // Must find diff between server creatures and client creatures

			// Flame.Create(wob, zone, this.babs, 6, 4)
		}
		else {
			log('unknown command: ', payload)
		}
	}

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


}

