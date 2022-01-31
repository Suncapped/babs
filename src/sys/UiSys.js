import Stats from 'three/examples/jsm/libs/stats.module'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import Overlay from '../ui/Overlay.svelte'
import Ctext from '../ui/Ctext.svelte'
import Journal from '../ui/Journal.svelte'
import { toprightText, toprightReconnect, menuSelfData, uiWindows } from "../stores.js"
import { log } from './../Utils'
import { MathUtils, Vector3 } from 'three'
import { get as svelteGet } from 'svelte/store'

export class UiSys {
	babs
	toprightTextDefault = 'Made for Chrome on Mac/PC <a target="_new" href="https://discord.gg/f2nbKVzgwm">discord.gg/f2nbKVzgwm</a>'
	ctext
	labelElements = []
	svJournal
	nicklist = new Map()

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
			this.toprightTextDefault = 'Welcome! <a target="_new" href="https://discord.gg/f2nbKVzgwm">discord.gg/f2nbKVzgwm</a>'
		}
		toprightText.set(this.toprightTextDefault)
    }

	playerSaid(idPlayer, text, options) {
		options = {
			color: 0xEEEEEE,
			journal: true,
			isname: false,
			...options,
		}
		const chatDiv = document.createElement('div')
		chatDiv.classList.add('label')

		if(options.isname) {
			text = `< ${text} >`
		}

		const player = this.babs.ents.get(idPlayer)

		// Set color based on our menu or the color send with chat for other player
		if(idPlayer === this.babs.idSelf) {
			chatDiv.style.color = svelteGet(menuSelfData).color
		}
		else {
			chatDiv.style.color = options.color
		}
		
		const chatSpan = document.createElement('span')
		chatSpan.innerText = text
		chatDiv.appendChild(chatSpan)

		if(options.journal) {
			this.svJournal.appendText((player.nick || 'Stranger')+': "'+text+'"', options.color)
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
		chatDiv.setAttribute('data-idPlayer', idPlayer)
		chatDiv.style.visibility = 'hidden'
		this.labelElements.push(chatDiv)

		const chatLabel = new CSS2DObject( chatDiv )
		const chatStartingHeight = (idPlayer === this.babs.idSelf ? 26 : 29) 
		chatLabel.position.set( 0, chatStartingHeight, 0 )

		const moveUpCheck = () => {
			if(chatDiv.clientHeight !== 0) {
				const newSpanHeight = chatDiv.firstChild.offsetHeight // gets span
				// It's added to DOM; now move everything up and then make this one visible

				// Move older divs upward
				for(let div of this.labelElements) {
					if(parseInt(div.getAttribute('data-idPlayer')) === idPlayer){
						if(chatDiv === div) continue // Skip self
						const currentDistanceUp = Math.abs(parseInt(div.style.top)) || 0
						const pad = 3
						div.style.top = `-${currentDistanceUp +newSpanHeight +pad}px`
					}
				}

				// Indent multiline instead of using hyphens
				const singleLineTypicalHeight = 18
				if(newSpanHeight > singleLineTypicalHeight *1.5) { // *1.5 just in case font change etc
					chatDiv.style.left = `${chatDiv.offsetWidth * 0.05}px` // % of width
				}

				// Make new one visible finally
				chatDiv.style.visibility = 'visible' 
			}
			else {
				setTimeout(moveUpCheck, 10)
			}
		}
		moveUpCheck()

		if(player.controller?.target) { 
			// Needed to avoid latency of interval below
			player.controller.target.add(chatLabel)
		}
		else {
			let waitForMesh = setInterval(() => {
				log('waiting')
				if(player.controller.target) {
					player.controller.target.add(chatLabel)
					clearInterval(waitForMesh)
				}
			}, 200)
		}
	}


	landSaid(text, point) {
		const chatDiv = document.createElement('div')
		chatDiv.classList.add('label')

		const chatSpan = document.createElement('span')
		chatSpan.innerText = text
		chatDiv.appendChild(chatSpan)
		
		chatDiv.style.color = '#aaaaaa'
		this.svJournal.appendText(`You see: ${text}`, chatDiv.style.color, 'right')

		const expiresInSeconds = 3
		chatDiv.setAttribute('data-expires', Date.now() + (1000 *expiresInSeconds))
		this.labelElements.push(chatDiv)

		const chatLabel = new CSS2DObject( chatDiv )

		chatLabel.position.copy(point.setY(point.y +1))

		this.babs.worldSys.ground.add(chatLabel)
	}


	offerReconnect(reason) {
		toprightReconnect.set(reason)
	}

    /** 
     * @param {'fps'|'mem'} which
     */
    createStats(which) {
        this[which] = Stats()
        this[which].showPanel(which=="fps"?0:2)
        this[which].dom.id = which
        this[which].dom.style = ""

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
		}
	}

	oldPos = new Vector3(0,0,0)
	logText = ''
	updateBegin() {
		this['fps']?.begin()
		this['mem']?.begin()

		if(this.babs?.idSelf) { // Player is loaded
			const playerPos = this.babs.ents.get(this.babs.idSelf)?.controller?.target?.position
			if(playerPos && !this.oldPos.equals(playerPos)) {
				// window.document.getElementById('log').innerText = `${Math.floor(playerPos.x/4)}.${Math.floor(playerPos.y/4)}.${Math.floor(playerPos.z/4)} / ${this.babs.renderSys.renderer.info.render.calls}d ${this.babs.renderSys.renderer.info.render.triangles}t ${this.babs.renderSys.renderer.info.memory.geometries}g ${this.babs.renderSys.renderer.info.memory.textures}x ${this.babs.renderSys.renderer.info.programs.length}p`
				this.oldPos = playerPos.clone()
			}
		}
		const newLogText = `${Math.floor(this.oldPos.x/4)}.${Math.floor(this.oldPos.y/4)}.${Math.floor(this.oldPos.z/4)} / d${this.babs.renderSys.renderer.info.render.calls} t${this.babs.renderSys.renderer.info.render.triangles} g${this.babs.renderSys.renderer.info.memory.geometries} x${this.babs.renderSys.renderer.info.memory.textures} p${this.babs.renderSys.renderer.info.programs.length}`
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
	updateEnd() {
		this['fps']?.end()
		this['mem']?.end()
	}

}





