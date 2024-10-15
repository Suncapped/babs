import { menuSelfData, topmenuAvailable, toprightReconnect, toprightText, socketSend, debugMode } from '../stores'
import Cookies from 'js-cookie'
import { UiSys } from '@/sys/UiSys'
import { EventSys } from './EventSys'
import { WorldSys } from './WorldSys'
import { LoaderSys } from './LoaderSys'
import { randIntInclusive, sleep } from './../Utils'
import { AnimationMixer, Int8BufferAttribute, Loader, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { Controller, type MovestateNames } from '@/comp/Controller'
import { Player } from '@/ent/Player'
import { CameraSys } from './CameraSys'
import { Raycaster } from 'three'
import { InputSys } from './InputSys'
import { Wob } from '@/ent/Wob'
import { Zone } from '@/ent/Zone'
import { Babs } from '@/Babs'
import { YardCoord } from '@/comp/Coord'
import { SharedBlueprint, SharedWob } from '@/shared/SharedWob'
import { type SendCraftable, type SendLoad, type SendWobsUpdate, type SendFeTime, type Zoneinfo, type SendPlayersArrive, type SendZoneIn, type SendAskTarget, type SendNickList, type SendReposition, type BabsSendable, type ProximaSendable, type SendAuth, type SendFirelink, typedKeys } from '@/shared/consts'
import type { blueprint_id, SharedBlueprintWithBluests, SharedBluestClasses, WobId } from '@/shared/SharedWob'
import { DateTime } from 'luxon'
import { get as svelteGet } from 'svelte/store'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { SharedFentity } from '@/shared/SharedFecs'

export class SocketSys {
	static pingSeconds = 30

	babsRunUpdate = false
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
						// This can come from index.html as: There's an existing session already, so it didn't create a WS.
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

	getUrlSylna() {
		const urlParts = window.location.pathname.split('/')
		const sylna = urlParts[1] === 'fire' ? urlParts[2] : null
		return sylna
	}

	finishSocketSetup(existingSession :string) {
		// Note: Needs to be able to handle a situation where existingSession exists but isn't valid (eg doesn't exist on the server)

		toprightText.set('Connecting...')
		this.ws.binaryType = 'arraybuffer'

		// this.ws.onopen = (event) => {
		// 	// Fix people having earth subdomain cookies from previous versions; todo remove later perhaps
		// 	if(this.babs.isProd) {
		// 		// Cookies.remove('session') // Well this for some reason deletes session on earth.suncapped.com...
		// 		// so fine, then .get() will get the root one.  .delete() will never delete the root because that's set with domain
		// 	}

		// Check the url for 'fire/{sylna}' and send that as a 'sylna' to the server
		const sylna = this.getUrlSylna()

		// Remove everything from the url after and including the first slash, rewrite history 
		// We'll keep it if they're a visitor, but remove if they're registered.  That must be done after they get 'load' info.

		const existingSessionAsSendAuth = {
			auth: {
				session: existingSession,
				sylna: sylna,
			}
		} as SendAuth // Force string to be a SendAuth
		this.send(existingSessionAsSendAuth)

		this.ws.onmessage = (event) => {
			// console.log('finishSocketSetup socket rec:', event.data)
			if(!(event.data instanceof ArrayBuffer)) {
				const payload = JSON.parse(event.data) as ProximaSendable
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
			console.debug('Socket error', event)
			this.babs.uiSys.offerReconnect('Connection error.')
		}
		this.ws.onclose = (event) => {
			console.debug('Socket closed', event)
			this.babs.uiSys.offerReconnect('Server connection closed.')
		}

		socketSend.subscribe(data => { // Used by eg Overlay.svelte, for like savecolor, savereason, savedebugmode, commanded, chat, saveui
			// console.log('got socketSend.set', data)
			this.send(data as any) // Just letting it happen untyped :p
		})
	}

	enter(email :string, pass :string) {
		this.send({
			enter: {
				email,
				pass,
				session: Cookies.get('session'),
			}
		})
	}

	async send(json :BabsSendable) { // todo add :Sendable and set up client sendables
		if(Object.keys(json).length === 0) return
		const isPingOrMove = json.hasOwnProperty('ping') || json.hasOwnProperty('move')
		if(!isPingOrMove) console.debug('Send:', json) // Log everything but pings and moves
		if(this.ws.readyState === this.ws.OPEN) {
			this.ws.send(JSON.stringify(json))
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
	async processEnqueue(payload :ProximaSendable){
		const command = Object.keys(payload)[0]

		if('load' in payload || 'visitor' in payload || 'session' in payload) { 
			// babsRunUpdate isn't true until after load, so babs isn't calling update() on this sys yet.  So run manually for these.
			await this.process(payload)
		}
		else {
			this.processQueue.push(payload)
		}
	}
	async process(payload :ProximaSendable){
		if('auth' in payload) {
			(document.getElementById('charsave') as HTMLButtonElement).disabled = false
			// Handle failed login/register here
			if(payload.auth.session === 'userpasswrong') {
				document.getElementById('topleft').style.visibility = 'visible'
				toprightText.set('Username/password does not match.')
			}
			else if(payload.auth.session === 'emailinvalid') {
				document.getElementById('topleft').style.visibility = 'visible'
				toprightText.set('Email is invalid.')
			}
			else if(payload.auth.session === 'accountfailed') {
				document.getElementById('topleft').style.visibility = 'visible'
				toprightText.set('Account creation error.')
			}
			else if(payload.auth.session === 'passtooshort') {
				document.getElementById('topleft').style.visibility = 'visible'
				toprightText.set('Password too short, must be 8.')
			}
		}
		else if('visitor' in payload) {
			// console.warn('Somehow skipped initial html (slow) visitor', payload)
			// The (only) valid way to get here is when the client cookie session id was sent to the server,
			//		But was invalid (eg didn't exist/match any on the server). 
			//		And that's why the server sent 'visitor' back; it considers the client a new visitor.

			Cookies.set('session', payload.visitor, { 
				domain: window.FeBaseDomain,
				secure: window.FeIsProd,
				sameSite: 'strict',
			})

			toprightText.set('Visiting...')
			window.location.reload() // Simpler than continuous flow for now
		}
		else if('session' in payload) {
			console.log('setting cookie, session', this.babs.baseDomain, this.babs.isProd)
			this.session = payload.session
			const result = Cookies.set('session', this.session, { 
				expires: 365,
				domain: this.babs.baseDomain,
				secure: this.babs.isProd,
				sameSite: 'strict',
			})
			console.debug('cookie set', result)
			toprightText.set('Entering...')
			window.location.reload() // Simpler than continuous flow for now // context.auth(context.session)
		}
		else if('alreadyin' in payload) {
			// Just have them repeat the auth if this was their second login device
			this.babs.uiSys.offerReconnect('Disconnected due to other tab; refresh to reconnect.')
		}
		else if('load' in payload) {
			this.babs.loaderSys = new LoaderSys(this.babs)

			const load = payload.load
			console.debug('socket: load', payload.load)
			window.setInterval(() => { 
				// Keep alive through Cloudflare's socket timeout.  See server notes.
				this.send({ping:'ping'})
			}, SocketSys.pingSeconds * 1000)

			const isRegistered = !load.self.visitor
			if(this.getUrlSylna() && isRegistered) {
				window.history.replaceState(null, '', '/')
			}

			console.debug('Welcome to', load.self.idzone, load.self.id, load.self.visitor)
			toprightText.set(this.babs.uiSys.toprightTextDefault)
			document.getElementById('topleft').style.visibility = 'visible'

			// Move button to menu
			if(this.babs.vrSupported) {
				const vrButton = VRButton.createButton(this.babs.renderSys.renderer)
				document.body.appendChild(vrButton)
				setTimeout(() => {
					vrButton.style.left = 'unset'
					vrButton.style.right = '20px'
				}, 100)

				if(!load.self.visitor) {
					const tryMoveVrButton = () => { 
						setTimeout(() => {
							// console.log('trying to move')
							const vrButton2 = document.getElementById('VRButton')
							const menuVrArea = document.getElementById('menuVrArea')
							if(!vrButton2 || !menuVrArea) {
								tryMoveVrButton()
								return
							}
							vrButton2.style.left = 'unset'
							vrButton2.style.right = 'unset'
							vrButton2.style.position = 'relative'
							vrButton2.style.bottom = '0px'
							menuVrArea.style.display = 'block'
							menuVrArea.style.textAlign = 'center'
							// menuVrArea.style.textAlign = 'center'
							menuVrArea.appendChild(vrButton2)
						}, 300) 
					}
					tryMoveVrButton()
				}
			}



			debugMode.set(load.self.meta.debugmode === undefined ? false : load.self.meta.debugmode) // Handle meta value creation
			debugMode.set(load.self.meta.debugmode === undefined ? false : load.self.meta.debugmode) // Handle meta value creation
			// dividerOffset.set(load.self.divider)

			if(load.self.visitor !== true) {
				document.getElementById('topleft').style.visibility = 'visible'
				document.getElementById('topleft').textContent = 'Waking up...'

				topmenuAvailable.set(true)

				menuSelfData.set({
					...load.self,
					color: load.self.meta.color, // Kind of a hax; need to extract it from meta so we can ...spread and such.
				})
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
			
			let enterZone = this.babs.ents.get(load.self.idzone) as Zone

			const pStatics = []
			for(const zone of farZones) {
				const isLoadinZone = zone.id == enterZone.id
				try {
					pStatics.push(this.babs.worldSys.loadStatics(this.babs.urlFiles, zone, isLoadinZone))
				} catch (error) {
					console.error('Failed to load statics 1', error)
				}
			}

			// Shouldn't their Y be *relative* to 0,0's Y?  Or starting zone's?
			for(const zone of farZones) {
				zone.geometry.translate(0, zone.y -enterZone.y, 0)
			}
			// this.babs.loadEnterZoneY = enterZone.y

			// console.time('stitch')
			try {
				await Promise.all(pStatics)
			} catch (error) {
				console.error('Failed to load statics 2', error)
			}

			console.debug('Statics loaded:', farZones.length)
			// console.timeEnd('stitch') // 182ms for 81 zones

			Zone.loadedZones = farZones

			await this.babs.worldSys.stitchElevation(farZones)

			// Set up UIs
			this.babs.uiSys.loadUis(load.uis)


			// Apply globally instead of to every zone, yay
			const blueprints = new Map(Object.entries(load.blueprints)) as Map<blueprint_id, SharedBlueprintWithBluests>

			// NOTE: See Proxima @"Babs SocketSys.ts"
			for(const blueprintsWithBluests of blueprints.values()) {
				typedKeys(blueprintsWithBluests?.bluests).forEach((bluestKey) => { // bluestKey is eg 'weighty'
					const thisBlueprintId = blueprintsWithBluests.blueprint_id // eg 'map'
					const dataForThisBluestBlueprint = blueprintsWithBluests.bluests[bluestKey] // eg { strengthToLift: 1 }
					delete dataForThisBluestBlueprint['blueprint_id'] // unset if it exists; we don't need it in the data object
	
					const existingBluestaticMap = this.babs.allBluestaticsBlueprintsData.get(bluestKey)
					if(!existingBluestaticMap) {
						const bluestaticMap = new Map<blueprint_id, SharedBluestClasses[keyof SharedBluestClasses]>()
						bluestaticMap.set(thisBlueprintId, dataForThisBluestBlueprint)
						this.babs.allBluestaticsBlueprintsData.set(bluestKey, bluestaticMap)
					}
					else {
						const existingBlueprintMap = existingBluestaticMap.get(thisBlueprintId)
						if(!existingBlueprintMap) { // Not already set
							existingBluestaticMap.set(thisBlueprintId, dataForThisBluestBlueprint)
						}
					}
				})
			}

			for(const zone of farZones) {
				zone.applyBlueprints(blueprints) // LoadFarwobGraphics will need blueprints to get visible blust info
			}

			const player = await Player.Arrive(load.self, true, this.babs) // Create player entity
			this.babs.worldSys.shiftEverything(-enterZone.x *WorldSys.ZONE_LENGTH_FEET, -enterZone.z *WorldSys.ZONE_LENGTH_FEET)//, true) // Set offset
			await Zone.LoadZoneWobs(enterZone, null) // Load zones
			await Zone.LoadZoneFootsteps(enterZone, null)
			player.controller.selfWaitZoningExitZone = null

			if(load.self.visitor !== true) {
				document.getElementById('welcomebar').style.display = 'none' 
			}
			
			this.babsRunUpdate = true // Starts update()s
		}
		else if('playersarrive' in payload) {
			console.debug('playersarrive', payload.playersarrive)

			let strangerColors = []
			for(let arrival of payload.playersarrive) {
				const existingPlayer = this.babs.ents.get(arrival.id) as Player
				console.debug('existing player', existingPlayer)
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

					if(player.nick) {
						this.babs.uiSys.aboveHeadChat(this.babs.idSelf, `<${player.nick} is around>`, 'copy', player.colorHex)
					}
					else {
						strangerColors.push(player.colorHex)
					}
				}

			}
			
			if(strangerColors.length) {
				const strangersText = strangerColors.length === 1 ? 'a stranger is around' : `${strangerColors.length} strangers are around`
				this.babs.uiSys.aboveHeadChat(this.babs.idSelf, `<${strangersText}>`, 'copy', strangerColors[0])
			}

		}
		else if('playerdepart' in payload) {
			const departPlayer = this.babs.ents.get(payload.playerdepart) as Player
			console.debug('departPlayer', payload.playerdepart, departPlayer, this.babs.scene)

			if(departPlayer && departPlayer.id !== this.babs.idSelf) {
				this.babs.uiSys.aboveHeadChat(this.babs.idSelf, '<'+(departPlayer.nick || 'a stranger')+' departs>', 'copy', departPlayer.colorHex)
				departPlayer.remove()
			}
		}
		else if('zonein' in payload) { // Handle self or others switching zones
			const player = this.babs.ents.get(payload.zonein.idplayer) as Player
			const enterZone = this.babs.ents.get(payload.zonein.idzone) as Zone

			if(player.id === this.babs.idSelf) {
				const exitZone = player.controller.selfWaitZoningExitZone || player.controller.playerRig.zone
				
				await Zone.LoadZoneWobs(enterZone, exitZone) // Only for self
				await Zone.LoadZoneFootsteps(enterZone, exitZone) // Only for self
				player.controller.selfWaitZoningExitZone = null
			}
				
			player.controller.playerRig.zone = enterZone // This re-applies to self, but for others, this is the only place it's set
		}
		else if('said' in payload) {
			const said = payload.said
			const chattyPlayer = this.babs.ents.get(said.id) as Player
			console.debug('said by chattyPlayer', chattyPlayer?.id, said.name, said.text)
			// chattyPlayer can be undefined (if they've signed off but this is a recent chat being sent).  
			// In that case, data.name is set to their name.
			// this.babs.uiSys.playerSaid(chattyPlayer?.id, said.text, {color: said.color, show: said.show !== false, name: said.name})

			if(chattyPlayer && chattyPlayer.colorHex !== said.color) {
				chattyPlayer.colorHex = said.color // Update their color
				const isSelf = chattyPlayer.id === this.babs.idSelf // Don't name self
				if(!isSelf) chattyPlayer.setDisplayNick(chattyPlayer.nick, chattyPlayer.tribe)
				// ^ In future, could send a color change event, but with text chat isn't too bad.
			}
			
			this.babs.uiSys.aboveHeadChat(chattyPlayer?.id, said.text, `${chattyPlayer?.nick || 'Stranger'}: ${said.text}`, said.color)
		}
		else if('nicklist' in payload) {
			console.debug('nicklist', payload.nicklist)
			for(let pair of payload.nicklist) {
				this.babs.uiSys.nicklist.set(pair.idtarget, {nick: pair.nick, tribe: pair.tribe}) // Save for later Player.Arrive players

				const player = this.babs.ents.get(pair.idtarget) as Player
				if(!player) continue // If no player, skip display stuff.  
				// Note, that can happen when 'load' is still awaiting rig download etc, so socketsys moved on to nicklist.

				// console.log('nicklist item', pair.nick, pair.tribe)

				const isSelf = player?.id === this.babs.idSelf
				player?.setDisplayNick(isSelf?'You':pair.nick, pair.tribe, 'doNotDisplay')// Don't show self, but do store it
				
				// Also...I don't understand why this part is working to fill in menu name, if player is false? // Later: Ohh, race condition? Anyway, removed name in menu.
				// if(player?.id === this.babs.idSelf) {
				// 	menuSelfData.set({
				// 		...svelteGet(menuSelfData),
				// 		nick: pair.nick,
				// 	})
				// }
			}
		}
		else if('wobsupdate' in payload) {
			console.debug('wobsupdate', payload.wobsupdate)

			/*
			Currently we are:
				setting zone stuff like applyLocationsToGrid
				...then also...
				generating a bunch of SharedWob{} and sending them to LoadInstancedWobs(), where graphics get created.
			Could I simplify by creating graphics during setWob, set locations etc?  Yes I suppose.  But instance management then gets weird.  And slower?
			So the purpose of LoadInstancedWobs is to load the graphics, pretty much.
			*/
			const wobsZone = this.babs.ents.get(payload.wobsupdate.idzone) as Zone
			console.debug('wobsupdate locationdata ', payload.wobsupdate.locationData?.length)
			
			
			{ // Nearwobs
				// Determine if this zone is !far, and if so, add the nearwobs
				const playerZone = this.babs.inputSys.playerSelf.controller.playerRig.zone as Zone
				const playerNearZones = playerZone.getZonesAround(Zone.loadedZones, 1)
				const isNearWobs = playerNearZones.includes(wobsZone)
				console.debug('wobsupdate are nearwobs too?', isNearWobs)
				if(isNearWobs) { // Is nearwobs, so update in addition to farwobs
					const sharedNearWobs = wobsZone.applyLocationsToGrid(new Uint8Array(payload.wobsupdate.locationData), { returnWobs: true, doApply: true, isFarWobs: false })
					if(sharedNearWobs.length) await Wob.LoadInstancedWobs(sharedNearWobs, this.babs, payload.wobsupdate.shownames)
				}
			}

			// We're going to update farwobs regardless.  If they're near, we also update that.
			{ // Farwobs
				// Although actually, we only want to update farwobs when the wobs have bluests.visible?
				// Yeah normally, getting farlocations from server (.bin or zip) limits them by a DB query, so they're already filtered.
				// But from proxima-wide updates like this, we're getting ones that shouldn't be shown.  Need to filter them.
				// We do this in LoadInstancedWobs.
				const sharedFarWobs = wobsZone.applyLocationsToGrid(new Uint8Array(payload.wobsupdate.locationData), { returnWobs: true, doApply: true, isFarWobs: true })
				if(sharedFarWobs.length) await Wob.LoadInstancedWobs(sharedFarWobs, this.babs, false, 'asFarWobs')
			}

		}
		else if('wobmove' in payload) {
			// console.debug('wobmove', payload.wobmove)
			const wobMove = payload.wobmove
			// It's a single wob.
			// Goal here vs wobsupdate is to:
			// Not set matrix to destination; don't update matrix at all

			// Not remove graphic at origin, nor create graphic at dest
			// Do update anything that would be related to graphic state though (member vars?)

			// Do remove grid/etc from origin
			// Do set grid/etc to destination
			// Do update any reference tracking vars on the zone
			// Do update any global babs state
			// Do update any components!  And Fire, Audible, etc?  // todo for movable components

			/* swapWobsAtIndexes seems relevant here?:
				const sourceWobAnyZone = feim.instanceIndexToWob.get(sourceIndex)
				sourceWobAnyZone.zone.coordToInstanceIndex[sourceWobAnyZone.x+','+sourceWobAnyZone.z] = targetIndex
				sourceWobAnyZone.zone.farCoordToInstanceIndex[sourceWobAnyZone.x+','+sourceWobAnyZone.z] = targetIndex
				feim.instanceIndexToWob.set(sourceIndex, targetWobAnyZone)
				if(doDeleteSource) {
					feim.instanceIndexToWob.delete(sourceIndex)
					targetWobAnyZone.zone.coordToInstanceIndex[targetWobAnyZone.x+','+targetWobAnyZone.z] = null
				feim.babs.ents.set(sourceWobAnyZone.zone.id, sourceWobAnyZone.zone) // necessary?
			*/


			// First get current wob stuff
			const originZone = this.babs.ents.get(wobMove.origin.idzone) as Zone
			const destZone = this.babs.ents.get(wobMove.dest.idzone) as Zone
			// const wob = originZone.getWob(wobMove.origin.x, wobMove.origin.z) // No, let's fetch Wob instead of SharedWob, below
			const feim = Wob.InstancedWobs.get(wobMove.origin.blueprint_id)
			const wobIndex = originZone.coordToInstanceIndex[wobMove.origin.x+','+wobMove.origin.z]
			const wob = feim.instanceIndexToWob.get(wobIndex)

			if(!wob) {
				// Can happen on first load when server is quickly sending events before client has loaded the wob
				// If this is happening, may be a significant situation; index out of sync means it can't find the wob anymore!  Fragile.
				console.debug('Hmm: wobmove: No wob found for move', wobMove, wobIndex, wob)
				return
			}

			// Update based on new coords
			originZone.coordToInstanceIndex[wobMove.origin.x+','+wobMove.origin.z] = null
			destZone.coordToInstanceIndex[wobMove.dest.x+','+wobMove.dest.z] = wobIndex
			originZone.farCoordToInstanceIndex[wobMove.origin.x+','+wobMove.origin.z] = null
			destZone.farCoordToInstanceIndex[wobMove.dest.x+','+wobMove.dest.z] = wobIndex
			// We do not need to update feim.instanceIndexToWob, since the index doesn't change; IMs are global across zones
			// feim.instanceIndexToWob.set(wobIndex, new Wob(this.babs, wob.idzone, wob.x, wob.z, wob.r, new SharedBlueprint(wob.blueprint_id
			feim.instanceIndexToWob.set(wobIndex, wob)

			// Update grids of zones
			// Let's assume there's nothing at the destination point.  // todo catch this
			const originGridIndex = wob.x + wob.z * 250
			const destGridIndex = wobMove.dest.x + wobMove.dest.z * 250
			// Copy over
			destZone.wobIdRotGrid[destGridIndex] = originZone.wobIdRotGrid[originGridIndex]
			destZone.farWobIdRotGrid[destGridIndex] = originZone.farWobIdRotGrid[originGridIndex]
			// Unset
			originZone.wobIdRotGrid[originGridIndex] = 0
			originZone.farWobIdRotGrid[originGridIndex] = 0
			
			{ // Update wob's bluestatics (update ids by deleting and adding) 
				// Update bluestatics (delete)
				// console.log('wob.bluests', wob.bluests)
				const oldEntity = new SharedFentity(wob)
				for(let bluestKey in wob.bluests) {
					const bluestatic = originZone.bluestatics.get(bluestKey as keyof SharedBluestClasses)
					bluestatic.entityIds.delete(oldEntity.id)
				}

				// Update wob itself
				wob.x = wobMove.dest.x
				wob.z = wobMove.dest.z
				wob.idzone = wobMove.dest.idzone

				// Update bluestatics (add)
				const newEntity = new SharedFentity(wob)
				for(let bluestKey in wob.bluests) {
					const bluestatic = destZone.bluestatics.get(bluestKey as keyof SharedBluestClasses)
					bluestatic.entityIds.add(newEntity.id)
				}
			}

			// Update pickedObject
			const yc = YardCoord.Create({x: wobMove.dest.x, z: wobMove.dest.z, zone: destZone})
			const poid = JSON.stringify(wob.idObj())
			if(this.babs.inputSys.pickedObject?.poid === poid) {
				this.babs.inputSys.pickedObject.yardCoord = yc
				this.babs.inputSys.pickedObject.poid = poid
			}
			if(this.babs.inputSys.liftedObject?.poid === poid) {
				this.babs.inputSys.liftedObject.yardCoord = yc
				this.babs.inputSys.liftedObject.poid = poid
			}
			if(this.babs.inputSys.mousedownPickedObject?.poid === poid) {
				this.babs.inputSys.mousedownPickedObject.yardCoord = yc
				this.babs.inputSys.mousedownPickedObject.poid = poid
			}

			// todo for zones, for when it's coming in fresh, ie it doesn't previously exist in the zone, we WILL need to load the graphic.
			// And if it's going out, we'll need to actually remove the graphic etc.

			// We currently get a wobMove.locomote speed number, but we're going to ignore that since currently wobmove is by definition locomoted, and speed is in the bluests
		}
		else if('contains' in payload) {
			// console.debug('contains', payload.contains)
			// // Whether someone else bagged it or you bagged it, it's time to disappear the item from 3d.
			// // 	Unless, of course, it was already bagged, and this is a bagtobag transfer!
			// for(let wobFresh of payload.contains.wobs) {
			// 	const wobExisting = this.babs.ents.get(wobFresh.id)
			// 	if(wobExisting && wobExisting.idzone) { // Wob in zone
			// 		const instanced = Wob.InstancedMeshes.get(wobExisting.name)
			// 		instanced.setMatrixAt(wobExisting.instancedIndex, new Matrix4().setPosition(new Vector3(-100,-1000,-100))) // change from just putting far away, to getting rid of
			// 		instanced.instanceMatrix.needsUpdate = true
			// 	}
			// }
				
			// if(payload.contains.id === this.babs.idSelf) { // Is your own inventory
			// 	await Wob.LoadInstancedWobs (payload.contains.wobs, this.babs, false)
			// }
		}
		else if('fewords' in payload) {
			const fewords = payload.fewords
			console.debug('server fewords', fewords)

			if(fewords.idTargetPlayer) {
				this.babs.uiSys.aboveHeadChat(fewords.idTargetPlayer, fewords.content, fewords.journalContent, fewords.colorHex)
			}
			else {
				this.babs.uiSys.feWords(fewords)
			}
		}
		else if('serverrestart' in payload) {
			console.log('serverrestart', payload.serverrestart)
			const babs = this.babs
			if(babs.isProd) {
				setTimeout(() => {
					babs.uiSys.aboveHeadChat(this.babs.idSelf, '<<Reconnecting... (or try a refresh)>>', 'copy')
				}, 2000)
			}
			setTimeout(() => {
				window.location.reload()
			}, babs.isProd ? randIntInclusive(5_000, 10_000) : 1200)
		}
		else if('energy' in payload) {
			// console.debug('energy', payload.energy)

		}
		else if('craftable' in payload) {
			const wobId = payload.craftable.wobId
			const options = payload.craftable.options
			const coord = YardCoord.Create({...wobId, babs: this.babs})
			const wob = coord.zone.getWob(coord.x, coord.z)

			// Display a list of icons above the wobId wob, list of options available:
			// Create a .svelte file for icons
			// When crafting thing is received, create icons for everything in it.

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
			console.debug('asktarget', payload.asktarget, document.body.style.cursor)

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
			console.debug('fetime', payload.fetime)

			this.babs.worldSys.snapshotTimestamp = DateTime.utc()
			const addRealMinutes = parseInt(import.meta.env.DAYNIGHT_ADD_REAL_MINUTES) || 0
			const proximaTime = payload.fetime.rlSecondsSinceHour
			this.babs.worldSys.snapshotRealHourFraction = (proximaTime /60 /60) +(addRealMinutes/60)
			// this.babs.worldSys.snapshotRealHourFraction = 100000 // night?
			// this.babs.worldSys.snapshotRealHourFraction = 2400 +(60 *21) // dawnx
			// this.babs.worldSys.snapshotRealHourFraction = 60*20
			// this.babs.worldSys.snapshotRealHourFraction += +(60 *40) // Flip daytime&nighttime?
		}
		else if('creatures' in payload) {
			// console.debug('creatures', payload.creatures)

			// const creatures = data as SendCreatures['creatures']
			// const {idzone, type, x, z, created_at} = creatures[0]

			// const zone = this.babs.ents.get(idzone) as Zone
			// const wob = zone.getWob(x, z)

			// // Must find diff between server creatures and client creatures

			// Fire.Create(wob, zone, this.babs, 6, 4)
		}

		else if('reposition' in payload) {
			const reposition = payload.reposition
			// Reposition self
			// const currentZone = this.babs.inputSys.playerSelf.controller.playerRig.zone
			// const idsZonesNearby = currentZone.getZonesAround(Zone.loadedZones, 1).map(z=>z.id)
			// const zoneIsNearby = idsZonesNearby.includes(reposition.idzone)
			// if(zoneIsNearby) {

			// }
			// else {
			window.location.reload()
			// }
		}
		else if('firelink' in payload) {
			const firelink = payload.firelink

			// Put above head (and in journal) that a firelink has been created
			const firelinkHostOnly = `${window.location.host}${firelink}`
			this.babs.uiSys.aboveHeadChat(this.babs.idSelf, '⧉ '+firelinkHostOnly, firelinkHostOnly)

			// Copy to clipboard
			const firelinkWithScheme = `${window.location.origin}${firelink}`
			navigator.clipboard.writeText(firelinkWithScheme)
		}
		else if('wayfind' in payload) {
			const wayfind = payload.wayfind
			console.warn('wayfind', wayfind)

			if(wayfind) {
				// Go to the wayfind location
				const coord = YardCoord.Create({...wayfind, babs: this.babs})
				console.log('coord', coord)
				// const wob = coord.zone.getWob(coord.x, coord.z)

				// const vector = new Vector3(coord.x, 0, coord.z)
				// let gCurrentPos = this.babs.inputSys.playerSelf.controller.playerRig.position.clone()
				// const gCurrentPosDivided = gCurrentPos.clone().multiplyScalar(1 / 4)
				// const gCurrentPosFloored = gCurrentPosDivided.clone().floor()
				// gCurrentPos = gCurrentPosFloored
				// const dest = vector.clone().sub(gCurrentPos)

				// No, don't make the position relative to current position.  Just go to the position.
				// But do make the position zone-relative.
				const dest = new Vector3(coord.x, 0, coord.z)

				const engineTarget = coord.toEngineCoordCentered()
				const gridTarget = engineTarget.clone().multiplyScalar(1 / 4).floor()
				

				// this.babs.inputSys.playerSelf.controller.setDestination(dest, 'run')
				// this.babs.inputSys.playerSelf.controller.setDestination(new Vector3(coord.x, 0, coord.z), 'run')
				this.babs.inputSys.playerSelf.controller.setDestination(gridTarget, 'run')

				this.babs.inputSys.playerSelf.selfWayfinding = true
			}
			else {
				console.debug('Ending wayfind')
				this.babs.inputSys.playerSelf.selfWayfinding = false
				return
			}
		}
		else {
			console.log('unknown command: ', payload)
		}
	}

	movePlayer = (idzip, movestate, a, b, attempts = 0) => {
		// console.debug('movePlayer', idzip, a, b)
		// console.log('attemping to move player, attempt', attempts)
		const idPlayer = this.babs.zips.get(idzip)
		const player = this.babs.ents.get(idPlayer)	as Player
		if(player) {
			const movestateName = (Controller.MovestateIdName[movestate] || 'idle') as MovestateNames
			const isSelf = player.id === this.babs.idSelf
			if(!isSelf) { // Don't do self movements
				// console.log('finally actually moving player after attept', attempts, idzip)
				const isFollowTarget = player.id == this.babs.inputSys.playerSelf.controller.selfFollowTargetId

				if(movestateName === 'run' || movestateName == 'walk') {
					const gDest = new Vector3(a, 0, b)

					if(isFollowTarget) { // If we're following them...
						// this.babs.inputSys.playerSelf.controller.setDestination(new Vector3(a, 0, b), movestateName)
						// Rather than follow, we actually want to 'mirror' their movement.
						// So we get their own relative movement to themselves, and apply it to ourself.
						
						const targetOldDest = player.controller.gDestination.clone()
						const targetDestDelta = targetOldDest.sub(gDest)

						// If there's a huge difference, they zoned.  Subtract that.
						// OMG, this works amazingly!
						if(Math.abs(targetDestDelta.x) > 100) {
							targetDestDelta.x -= (WorldSys.ZONE_MOVEMENT_EXTENT +1) * Math.sign(targetDestDelta.x)
						}
						if(Math.abs(targetDestDelta.z) > 100) {
							targetDestDelta.z -= (WorldSys.ZONE_MOVEMENT_EXTENT +1) * Math.sign(targetDestDelta.z)
						}

						const selfOldDest = this.babs.inputSys.playerSelf.controller.gDestination.clone()
						const selfNewDest = selfOldDest.sub(targetDestDelta)

						this.babs.inputSys.playerSelf.controller.setDestination(selfNewDest, movestateName)
					}

					player.controller.setDestination(gDest, movestateName)
				}
				else if(movestateName === 'jump') {
					player.controller.jump(Controller.JUMP_HEIGHT)

					// if(isFollowTarget) this.babs.inputSys.playerSelf.controller.jump(Controller.JUMP_HEIGHT) // Ideally, we'd jump when they did, not now
				}
				else if(movestateName === 'rotate') {
					const degrees = Controller.ROTATION_ANGLE_MAP[a] -45 // Why?  Who knows! :p
					const quat = new Quaternion()
					quat.setFromAxisAngle(new Vector3(0,1,0), MathUtils.degToRad(degrees))
					player.controller.setRotation(quat)

					if(isFollowTarget) this.babs.inputSys.playerSelf.controller.setRotation(quat)
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

