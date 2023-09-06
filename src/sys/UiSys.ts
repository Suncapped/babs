import Stats from 'three/examples/jsm/libs/stats.module'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import Overlay from '../ui/Overlay.svelte'
import Ctext from '../ui/Ctext.svelte'
import Journal from '../ui/Journal.svelte'
import Container from '../ui/Container.svelte'
import Menu from '../ui/Menu.svelte'
import { toprightText, toprightReconnect, menuSelfData, uiWindows, socketSend } from '../stores'
import { log, v3out } from './../Utils'
import { Color, ColorManagement, DoubleSide, LinearSRGBColorSpace, MathUtils, MeshBasicMaterial, MeshPhongMaterial, MeshStandardMaterial, SRGBColorSpace, Vector3 } from 'three'
import { get as svelteGet } from 'svelte/store'
import { YardCoord } from '@/comp/Coord'
import { Zone } from '@/ent/Zone'
import { Wob } from '@/ent/Wob'
import { InputSys } from './InputSys'
import { Babs } from '@/Babs'
import type { SharedWob } from '@/shared/SharedWob'
import type { Player } from '@/ent/Player'
import { Text as TroikaText } from 'troika-three-text'

export class UiSys {
	babs :Babs
	toprightTextDefault = 'Made for Chrome on Mac/PC <a target="_new" href="https://discord.gg/r4pdPTWbm5">Discord</a>'
	ctext
	labelElements = []
	textElements = Array<any>()
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
			this.toprightTextDefault = '<span>Movement: Slide or hold two fingers.</span> <a target="_new" href="https://discord.gg/r4pdPTWbm5">Discord</a>'
		}
	}

	makeTextAt(name :string, content :string, worldPos :Vector3, sizeEm :number) {
		log.info(name, content)
			
		// Setup and position
		const ttext = new TroikaText()
		ttext.material.side = DoubleSide
		ttext.name = name
		ttext.text = content
		ttext.position.copy(worldPos)

		// Styling
		ttext.color = new Color(222, 222, 222).convertLinearToSRGB() // todo buggy; white due to bugs // https://github.com/protectwise/troika/pull/267
		ttext.fontSize = sizeEm // 22px // https://nekocalc.com/px-to-em-converter
		ttext.outlineWidth = 0.06180339887
		ttext.outlineColor = 'black'
		ttext.curveRadius = -20
		ttext.letterSpacing = 0.04
		// ttext.strokeWidth = 0.03 // Stroke is inside
		// ttext.strokeColor = 'red'

		// Alignment
		ttext.maxWidth = 18.75 // 300px
		ttext.textAlign = 'center'
		ttext.anchorX = 'center'
		ttext.anchorY = 'bottom'

		// ttext.shadows = false // todo not working?
		ttext.font = `${window.FeUrlFiles}/css/neucha-subset.woff`

		// Add to scene
		const expiresInSeconds = Math.sqrt(content.length) //this.babs.debugMode ? 10 : 3
		ttext.expires = Date.now() +(1000 *expiresInSeconds)
		this.babs.group.add(ttext)

		// Make text face the screen flatly, rather than facing the character.
		// So get the normalized direction the cameraGroup is facing in world space, then turn it 180 degrees
		let cameraGroupDirectionOpposite = new Vector3(0, 0, -1)
		this.babs.cameraSys.cameraGroup.getWorldDirection(cameraGroupDirectionOpposite).negate()
		ttext.lookAt(ttext.getWorldPosition(new Vector3()).add(cameraGroupDirectionOpposite))

		ttext.sync()
		this.textElements.push(ttext)
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

		const player = this.babs.ents.get(idPlayer) as Player

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

		if(player?.controller?.playerRig) { 
			// Needed to avoid latency of interval below
			player.controller.playerRig.add(chatLabel)
		}
		else {
			let waitForMesh = setInterval(() => {
				log('waiting for said')
				if(player?.controller?.playerRig) {
					player.controller.playerRig.add(chatLabel)
					clearInterval(waitForMesh)
				}
			}, 200)
		}
	}


	landSaid(landtarget :{text :string, idzone: number, point: Vector3}) {
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

		this.makeTextAt('landSaid', landtarget.text, point, 1.375) // 22px
	}
	wobSaid(text, coord :YardCoord) {
		let point = coord.zone.rayHeightAt(coord)
		point.setY(point.y +4) // Lower down
		this.makeTextAt('wobSaid', text, point, 1.375) // 22px
	}

	serverSaid(text :string) {
		this.svJournal.appendText(`${text}`, '#aaaaaa', 'right')
	}
	clientSaid(text :string) {
		this.svJournal.appendText(`${text}`, '#aaaaaa', 'right')
	}

	craftSaid(options :Array<string>, wob :SharedWob, wobZone :Zone) {	
		console.warn('Crafting UI currently in transition')

		// const chatDiv = document.createElement('div')
		// chatDiv.id = 'Crafting'
		// const chatLabel = new CSS2DObject(chatDiv)
		// chatLabel.name = 'craftSaid'

		// const yardCoord = YardCoord.Create({
		// 	...wob,
		// 	zone: wobZone,
		// })
		// let point = wobZone.rayHeightAt(yardCoord)
		// point.setY(point.y +2) // Raise up
		// chatLabel.position.copy(point)

		// options.forEach(option => {
		// 	const chatButton = document.createElement('button')
		// 	chatButton.innerText = option
		// 	chatButton.id = option
		// 	chatButton.className = 'craftbtn'
		// 	chatButton.style.cssText = 'pointer-events: auto;'
		// 	chatButton.onsubmit = (ev) => ev.preventDefault()
		// 	chatButton.onclick = (ev) => updateWOB(option)

		// 	chatDiv.appendChild(chatButton)

		// 	this.babs.group.add(chatLabel)
		// })	
		
		// const updateWOB = (opt :string) => {
		// 	log('User selected: ' + opt + ' wobID: ' + wob.id())
		// 	log('parent', chatLabel.parent)
		// 	this.babs.group.remove(chatLabel)

		// 	// Need a way to send an update to the server, will circle back to this
		// 	socketSend.set({
		// 		'action': {
		// 			verb: 'craft',
		// 			noun: wob.id(),
		// 			data: {
		// 				craftName: opt,
		// 			},
		// 		}
		// 	})
		// }
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
		this[which] = new Stats()
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

		let playerSelf :Player
		if(this.babs?.idSelf) { // Player is loaded
			playerSelf = this.babs.ents.get(this.babs.idSelf) as Player
			const playerPos = playerSelf?.controller?.playerRig?.position
			if(playerPos && !this.oldPos.equals(playerPos)) {
				this.oldPos = playerPos.clone()
			}
		}

		if(this.babs.debugMode) {
			const newLogText = `zone: ${playerSelf?.controller?.playerRig.zone.id}, in-zone xz: (${Math.floor(this.oldPos.x/4)}, ${Math.floor(this.oldPos.z/4)}), y: ${Math.floor(this.oldPos.y)} \n draws: ${this.babs.renderSys.renderer.info.render.calls} tris: ${this.babs.renderSys.renderer.info.render.triangles.toLocaleString()} geoms: ${this.babs.renderSys.renderer.info.memory.geometries} texs: ${this.babs.renderSys.renderer.info.memory.textures} progs: ${this.babs.renderSys.renderer.info.programs.length} \n ents: ${this.babs.ents.size.toLocaleString()} wobs: ${Wob.totalArrivedWobs?.toLocaleString()} fps: ${this.babs.renderSys.fpsDetected}`
			if(this.logText !== newLogText) {
				this.logText = newLogText
				window.document.getElementById('log').innerText = this.logText
			}
			console.log()
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

		this.textElements.forEach(ttext => {
			if(Date.now() > ttext.expires) {
				log.info('Removing text', ttext, ttext.id)
				this.babs.group.remove(ttext)
				ttext.dispose()

				this.textElements = this.textElements.filter(t => t.id !== ttext.id)
			}
		})


	}

}





