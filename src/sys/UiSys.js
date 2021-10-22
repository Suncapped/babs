import Stats from 'three/examples/jsm/libs/stats.module'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import Overlay from '../ui/Overlay.svelte'
import Ctext from '../ui/Ctext.svelte'
import { toprightText, toprightReconnect, menuShowLink } from "../stores.js"
import { log } from './../Utils'
import { MathUtils, Vector3 } from 'three'

export class UiSys {
	babs
	toprightTextDefault = 'Works best in Chrome-like browsers'
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

	playerSaid(idPlayer, text) {
		const chatDiv = document.createElement('div')
		// this.ctext.appendChild(chatDiv)
		chatDiv.className = 'label'
		// chatDiv.style.width = '200px'
		
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
		this.labelElements.push(chatDiv)

		const chatLabel = new CSS2DObject( chatDiv )
		chatLabel.position.set( 0, 80, 0 )

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
        document.body.appendChild(this[which].dom)
    }

	oldPos = new Vector3()
	updateBegin() {
		this['fps']?.begin()
		this['mem']?.begin()

		if(this.babs?.idSelf) { // Player is loaded
			const playerPos = this.babs.ents.get(this.babs.idSelf)?.controller?.target?.position
			if(playerPos && !this.oldPos.equals(playerPos)) {
				window.document.getElementById('log').innerText = `${Math.floor(playerPos.x/4)}, ${Math.floor(playerPos.y/4)}, ${Math.floor(playerPos.z/4)}`
				this.oldPos = playerPos.clone()
			}
		}

		this.labelElements.forEach(chat => {
			const expires = chat.getAttribute('data-expires') // Could store objects with refs instead
			// const player = this.babs.ents.get(parseInt(idPlayer))
			if(Date.now() > expires) {
				chat.innerText = ''
			}
		})

	}
	updateEnd() {

		this['fps']?.end()
		this['mem']?.end()
	}

}





