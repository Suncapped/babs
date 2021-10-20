import Stats from 'three/examples/jsm/libs/stats.module'
import Overlay from '../ent/Overlay.svelte'
import { toprightText, toprightReconnect, menuShowLink } from "../stores.js"
import { log } from './../Utils'

export class UiSys {
	babs
	toprightTextDefault = 'Works best in Chrome-like browsers'

	OfferReconnect(reason) {
		toprightReconnect.set(reason)
	}

    constructor(babs) {
		this.babs = babs



		new Overlay({
			target: document.body,
		})

		if(this.babs.browser == 'chrome' || this.babs.browser == 'MS Edge Chromium') {
			this.toprightTextDefault = 'Welcome to First Earth!'
		}
		toprightText.set(this.toprightTextDefault)
    }
    /** 
     * @param {'fps'|'mem'} which
     */
    CreateStats(which) {
        this[which] = Stats()
        this[which].showPanel(which=="fps"?0:2)
        this[which].dom.id = which
        this[which].dom.style = ""
        document.body.appendChild(this[which].dom)
    }

	CreateEl(html) {
		const doc = new DOMParser().parseFromString(html, "text/html")
		const el = doc.firstChild
		return el
	}

	updateBegin() {
		this['fps']?.begin()
		this['mem']?.begin()

		if(this.babs?.idSelf) { // Player is loaded
			const playerPos = this.babs.ents.get(this.babs.idSelf)?.controller?.target?.position
			if(playerPos) {
				window.document.getElementById('log').innerText = `${Math.round(playerPos.x)}, ${Math.round(playerPos.y)}, ${Math.round(playerPos.z)}`
			}
		}

	}
	updateEnd() {

		this['fps']?.end()
		this['mem']?.end()
	}

}





