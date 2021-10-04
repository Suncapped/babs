import Stats from 'three/examples/jsm/libs/stats.module'
import Overlay from '../ent/Overlay.svelte'
import { toprightText, toprightReconnect, menuShowLink } from "../stores.js";
import { log } from './../Utils'

export class UiSys {
	static browser

	static toprightTextDefault = 'Works best in Chrome-like browsers'

	static OfferReconnect(reason) {
		toprightReconnect.set(reason)
	}

    static Start() {
		UiSys.browser = (function (agent) {
			switch (true) {
				case agent.indexOf("edge") > -1: return "MS Edge (EdgeHtml)";
				case agent.indexOf("edg") > -1: return "MS Edge Chromium";
				case agent.indexOf("opr") > -1 && !!window.opr: return "opera";
				case agent.indexOf("chrome") > -1 && !!window.chrome: return "chrome";
				case agent.indexOf("trident") > -1: return "Internet Explorer";
				case agent.indexOf("firefox") > -1: return "firefox";
				case agent.indexOf("safari") > -1: return "safari";
				default: return "other";
			}
		})(window.navigator.userAgent.toLowerCase());
		log.info('Browser is', UiSys.browser)

		new Overlay({
			target: document.body,
		})

		if(UiSys.browser == 'chrome' || UiSys.browser == 'MS Edge Chromium') {
			UiSys.toprightTextDefault = 'Welcome to First Earth!'
		}
		toprightText.set(UiSys.toprightTextDefault)
    }
    /** 
     * @param {'fps'|'mem'} which
     */
    static CreateStats(which) {
        this[which] = Stats()
        this[which].showPanel(which=="fps"?0:2)
        this[which].dom.id = which
        this[which].dom.style = ""
        document.body.appendChild(this[which].dom)
    }

	static CreateEl(html) {
		const doc = new DOMParser().parseFromString(html, "text/html")
		const el = doc.firstChild
		return el
	}

	static UpdateBegin() {
		this['fps']?.begin()
		this['mem']?.begin()
	}
	static UpdateEnd() {

		this['fps']?.end()
		this['mem']?.end()
	}

}





