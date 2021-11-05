import Stats from 'three/examples/jsm/libs/stats.module'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import Overlay from '../ui/Overlay.svelte'
import Ctext from '../ui/Ctext.svelte'
import { toprightText, toprightReconnect, menuSelfData } from "../stores.js"
import { log } from './../Utils'
import { MathUtils, Vector3 } from 'three'
import { get as svelteGet } from 'svelte/store'

export class UiSys {
	babs
	toprightTextDefault = 'Made for Chrome on Mac/PC'
	ctext
	labelElements = []

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
			this.toprightTextDefault = 'Welcome to First Earth!'
		}
		toprightText.set(this.toprightTextDefault)
    }

	playerSaid(idPlayer, text, color) {
		const chatDiv = document.createElement('div')

		chatDiv.classList.add('label')

		// Set color based on our menu or the color send with chat for other player
		if(idPlayer === this.babs.idSelf) {
			chatDiv.style.color = svelteGet(menuSelfData).color
		}
		else {
			chatDiv.style.color = color
		}
		
		const chatSpan = document.createElement('span')
		chatSpan.innerText = text
		chatDiv.appendChild(chatSpan)

		// Decide how long to display for
		// 200-300 wpm is normal for high school through adults // https://scholarwithin.com/average-reading-speed
		// But since it's not continuous reading, it takes time to move eyes to it and read.  200 way too fast.
		// Also it's nice to have time to read it 2-3x
		const wpm = 75
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
		const chatStartingHeight = idPlayer === this.babs.idSelf ? 85 : 110
		chatLabel.position.set( 0, chatStartingHeight, 0 )

		const moveUpCheck = () => {
			if(chatDiv.clientHeight !== 0) {
				const newDivHeight = chatDiv.firstChild.offsetHeight // gets span
				// It's added to DOM; now move everything up and then make this one visible

				for(let div of this.labelElements) {
					if(parseInt(div.getAttribute('data-idPlayer')) === idPlayer){
						if(chatDiv === div) continue // Skip self

						const pad = 5
						const extraDistanceUp = newDivHeight*2 +pad // *2 why?  Vertical centering perhaps?

						const currentPaddingBottom = parseInt(div.style.paddingBottom) || 0
						log(extraDistanceUp, newDivHeight, div.clientHeight, div.style.paddingBottom, currentPaddingBottom)
						div.style.paddingBottom = `${currentPaddingBottom +extraDistanceUp}px`

						// todo there is still a bug with very long texts fast in a row, stacking badly.
					}
				}

				chatDiv.style.visibility = 'visible' // Make new one visible
			}
			else {
				setTimeout(moveUpCheck, 10)
			}
		}
		moveUpCheck()

		const player = this.babs.ents.get(idPlayer)
		player.controller.target.add( chatLabel )

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
				chat.innerText = '' // todo dispose (and in renderer) and use a pool 
				this.labelElements = this.labelElements.filter(e => e.innerText !== '')
			}
		})

	}
	updateEnd() {

		this['fps']?.end()
		this['mem']?.end()
	}

}





