import Stats from 'three/examples/jsm/libs/stats.module'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import Overlay from '../ui/Overlay.svelte'
import Ctext from '../ui/Ctext.svelte'
import Journal from '../ui/Journal.svelte'
import Container from '../ui/Container.svelte'
import Menu from '../ui/Menu.svelte'
import { toprightText, toprightReconnect, menuSelfData, uiWindows, socketSend } from '../stores'
import { log, v3out } from './../Utils'
import { MathUtils, Vector3 } from 'three'
import { get as svelteGet } from 'svelte/store'
import { YardCoord } from '@/comp/Coord'
import { Zone } from '@/ent/Zone'
import { Wob } from '@/ent/Wob'
import { InputSys } from './InputSys'
import { Babs } from '@/Babs'

export class UiSys {
	babs :Babs
	toprightTextDefault = 'Made for Chrome on Mac/PC <a target="_new" href="https://discord.gg/suncapped">Discord</a>'
	ctext
	labelElements = []
	svJournal
	svMenu
	svContainers = []
	nicklist = new Map()

	static ICON_SIZE = 50

	constructor(babs) {
		this.babs = babs

		new Overlay({
			target: document.body,
		})
		new Ctext({
			target: document.body,
		})

		this.ctext = document.getElementById('Ctext')

		if(this.babs.browser == 'chrome' || this.babs.browser == 'MS Edge Chromium') {
			// this.toprightTextDefault = 'Welcome!  Two finger mouse click to move'
			this.toprightTextDefault = '<span>Movement: Slide or hold two fingers.</span> <a target="_new" href="https://discord.gg/suncapped">Discord</a>'
		}
		toprightText.set(this.toprightTextDefault)
	}

	playerSaid(idPlayer, text, options?) {
		options = {
			color: '#eeeeee',
			italics: false,
			journal: true,
			isname: false,
			show: true, // show above head?
			...options,
		}
		const chatDiv = document.createElement('div')
		chatDiv.classList.add('label')

		if(options.isname) {
			text = `< ${text} >`
		}

		const player = this.babs.ents.get(idPlayer)

		// Set color based on our menu or the color send with chat for other player
		// if(idPlayer === this.babs.idSelf) {
		// 	chatDiv.style.color = svelteGet(menuSelfData).color
		// }
		// else {
		chatDiv.style.color = options.color
		// }

		if(options.italics) chatDiv.style.fontStyle = 'italic'
		
		const chatSpan = document.createElement('span')
		chatSpan.innerText = text
		chatDiv.appendChild(chatSpan)

		if(options.journal) {
			this.svJournal.appendText((player?.nick || options.name || 'Stranger')+': '+text, options.color)
		}

		if(!options.show) {
			return
		}

		// Decide how long to display for
		// 200-300 wpm is normal for high school through adults // https://scholarwithin.com/average-reading-speed
		// But since it's not continuous reading, it takes time to move eyes to it and read.  200 way too fast.
		// Also it's nice to have time to read it 2-3x
		const wpm = 120
		const wps = wpm/60 // 200wpm/60s=3.3wps
		const countWords = text.trim().split(/\s+/).length
		const startingTimeMin = 3 // Give 3 seconds at start for everything (to refocus), then add onto it
		const seconds = countWords / wps + startingTimeMin
		const secondsClamped = MathUtils.clamp(seconds, startingTimeMin, 20)
		
		chatDiv.setAttribute('data-expires', Date.now() + (1000 *secondsClamped))
		chatDiv.setAttribute('data-idPlayer', idPlayer || options.name)
		chatDiv.style.visibility = 'hidden'
		this.labelElements.push(chatDiv)

		const chatLabel = new CSS2DObject(chatDiv)
		chatLabel.name = 'playerSaid'
		const chatStartingHeight = (idPlayer === this.babs.idSelf ? 26 : 29) 
		chatLabel.position.set( 0, chatStartingHeight, 0 )

		const moveUpCheck = () => {
			if(chatDiv.clientHeight !== 0) {
				const newSpanHeight = chatDiv.firstChild.offsetHeight // gets span
				// It's added to DOM; now move everything up and then make this one visible

				// Move older divs upward
				for(let div of this.labelElements) {
					if(parseInt(div.getAttribute('data-idPlayer')) === (idPlayer || options.name)){
						if(chatDiv === div) continue // Skip self
						const currentDistanceUp = Math.abs(parseInt(div.style.top)) || 0
						const pad = 3
						div.style.top = `-${currentDistanceUp +newSpanHeight +pad}px`
					}
				}

				// Indent multiline instead of using hyphens
				const singleLineTypicalHeight = 18
				if(newSpanHeight > singleLineTypicalHeight *1.5) { // *1.5 just in case font change etc
					// chatDiv.style.left = `${chatDiv.offsetWidth * 0.05}px` // % of width
				}

				// Make new one visible finally
				chatDiv.style.visibility = 'visible' 
			}
			else {
				setTimeout(moveUpCheck, 100)
			}
		}
		moveUpCheck()

		if(player?.controller?.target) { 
			// Needed to avoid latency of interval below
			player.controller.target.add(chatLabel)
		}
		else {
			let waitForMesh = setInterval(() => {
				log('waiting')
				if(player?.controller?.target) {
					player.controller.target.add(chatLabel)
					clearInterval(waitForMesh)
				}
			}, 200)
		}
	}


	landSaid(landtarget :{text :string, idzone: number, point: Vector3}) {
		const chatDiv = document.createElement('div')
		chatDiv.classList.add('label')

		// Calculate position
		const zone = this.babs.ents.get(landtarget.idzone) as Zone
		const yardCoord = YardCoord.Create({
			position: landtarget.point,
			babs: this.babs,
		})
		
		let point = zone.rayHeightAt(yardCoord)
		point.setY(point.y +1)

		if(this.babs.debugMode) {
			landtarget.text += `\n${yardCoord}`
			landtarget.text += `\n${v3out(landtarget.point)}`
		}

		log.info('landSaid', landtarget.text)
		
		const chatSpan = document.createElement('span')
		chatSpan.innerText = landtarget.text
		chatDiv.appendChild(chatSpan)
		
		chatDiv.style.color = '#aaaaaa'
		const expiresInSeconds = this.babs.debugMode ? 10 : 3
		chatDiv.setAttribute('data-expires', Date.now() + (1000 *expiresInSeconds))
		this.labelElements.push(chatDiv)

		const chatLabel = new CSS2DObject(chatDiv)
		chatLabel.name = 'landSaid'
		chatLabel.position.copy(point)
		// log('chatLabel targetPos', point, targetPos, targetZone)
		this.babs.group.add(chatLabel) // Adding it to zone.ground doesn't actually changed its position; thus above .add
	}
	serverSaid(text, point) {
		this.svJournal.appendText(`${text}`, '#aaaaaa', 'right')
	}
	clientSaid(text, point) {
		this.svJournal.appendText(`${text}`, '#aaaaaa', 'right')
	}

	wobSaid(text, coord :YardCoord) {
		log.info('wobSaid', text)
		const chatDiv = document.createElement('div')
		chatDiv.classList.add('label')

		const chatSpan = document.createElement('span')
		chatSpan.innerText = text
		// chatSpan.style.backgroundColor = 'black'
		// chatSpan.style.padding = '3px'
		// chatSpan.style.paddingTop = '1px'
		// chatSpan.style.border = `1px solid ${svelteGet(menuSelfData).color || 'white'}`
		// chatSpan.style.border = `1px solid #aaaaaa`
		chatDiv.appendChild(chatSpan)
		
		// chatDiv.style.color = '#aaaaaa'
		// this.svJournal.appendText(`You see: ${text}`, chatDiv.style.color, 'right')

		const expiresInSeconds = this.babs.debugMode ? 10 : 3
		chatDiv.setAttribute('data-expires', Date.now() + (1000 *expiresInSeconds))
		this.labelElements.push(chatDiv)
		
		const chatLabel = new CSS2DObject(chatDiv)
		chatLabel.name = 'wobSaid'
		let point = coord.zone.rayHeightAt(coord)
		log.info('wobSaid point', point, coord)

		point.setY(point.y -1.75) // Lower down
		chatLabel.position.copy(point)

		this.babs.group.add(chatLabel) // todo not ground // OMG this is why there's an offset
	}

	craftSaid(options :Array<string>, wob :Wob) {	
		const chatDiv = document.createElement('div')
		chatDiv.id = 'Crafting'
		const chatLabel = new CSS2DObject(chatDiv)
		chatLabel.name = 'craftSaid'

		const yardCoord = YardCoord.Create(wob)
		let point = wob.zone.rayHeightAt(yardCoord)
		point.setY(point.y +2) // Raise up
		chatLabel.position.copy(point)

		options.forEach(option => {
			const chatButton = document.createElement('button')
			chatButton.innerText = option
			chatButton.id = option
			chatButton.className = 'craftbtn'
			chatButton.style.cssText = 'pointer-events: auto;'
			chatButton.onsubmit = (ev) => ev.preventDefault()
			chatButton.onclick = (ev) => updateWOB(option)

			chatDiv.appendChild(chatButton)

			this.babs.group.add(chatLabel)
		})	
		
		const updateWOB = (opt :string) => {
			log('User selected: ' + opt + ' wobID: ' + wob.id())
			log('parent', chatLabel.parent)
			this.babs.group.remove(chatLabel)

			// Need a way to send an update to the server, will circle back to this
			socketSend.set({
				'action': {
					verb: 'craft',
					noun: wob.id(),
					data: opt,
				}
			})
		}
	}


	offerReconnect(reason) {
		toprightReconnect.set(reason)
		document.getElementById('welcomebar').style.display = 'block' 
		document.getElementById('Overlay').style.zIndex = '1000'
		document.getElementById('topleft').style.display = 'none' 

		this.svJournal.appendText(reason, '#ff0000', 'right')
	}

	/** 
     * @param {'fps'|'mem'} which
     */
	createStats(which) {
		this[which] = Stats()
		this[which].showPanel(which=='fps'?0:1)
		this[which].dom.id = which
		this[which].dom.style = ''

		const waitForReady = () => {
			const el = document.getElementById('stats')
			if(el) {
				el.appendChild(this[which].dom)
			} 
			else {
				setTimeout(waitForReady, 100)
			}
		}
		waitForReady()
	}

	loadUis(uis) {
		for(let ui of uis) {
			if(ui.type === 'journal') {
				this.svJournal = new Journal({
					target: document.body,
					props: {
						ui,
					},
				})
				uiWindows.set([...svelteGet(uiWindows), this.svJournal])
			}
			else if(ui.type === 'menu') {
				this.svMenu = new Menu({
					target: document.body,
					props: {
						ui,
					},
				})
				uiWindows.set([...svelteGet(uiWindows), this.svMenu])
			}
			else if(ui.type === 'container') {
				// this.svContainers = [ // bagtodo temporarily disabled bag!
				// 	...this.svContainers || [],
				// 	new Container({
				// 		target: document.body,
				// 		props: {
				// 			ui,
				// 		},
				// 	})
				// ]
				// uiWindows.set([...svelteGet(uiWindows), this.svContainers[this.svContainers.length -1]])
			}
		}
	}

	oldPos = new Vector3(0,0,0)
	logText = ''
	update() {

		if(this.babs?.idSelf) { // Player is loaded
			const playerPos = this.babs.ents.get(this.babs.idSelf)?.controller?.target?.position
			if(playerPos && !this.oldPos.equals(playerPos)) {
				this.oldPos = playerPos.clone()
			}
		}
		const newLogText = `${Math.floor(this.oldPos.x/4)}.${Math.floor(this.oldPos.y)}.${Math.floor(this.oldPos.z/4)} / d${this.babs.renderSys.renderer.info.render.calls} t${this.babs.renderSys.renderer.info.render.triangles} g${this.babs.renderSys.renderer.info.memory.geometries} x${this.babs.renderSys.renderer.info.memory.textures} p${this.babs.renderSys.renderer.info.programs.length}`
		if(this.logText !== newLogText) {
			this.logText = newLogText
			window.document.getElementById('log').innerText = this.logText
		}

		this.labelElements.forEach(chat => {
			const expires = chat.getAttribute('data-expires') // Could store objects with refs instead
			// const player = this.babs.ents.get(parseInt(idPlayer))
			if(Date.now() > expires) {
				chat.hidden = true
				this.labelElements = this.labelElements.filter(e => !e.hidden)
				chat.remove()
			}
		})


	}

}





