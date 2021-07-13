import Stats from 'three/examples/jsm/libs/stats.module'
import Overlay from './Overlay.svelte'
import { toprightText, menuShowLink } from "../stores.js";

export class Ui {
	static browser

	static toprightTextDefault = 'Designed for Chrome-like browsers'

    static Init() {
		const ui = new Ui
		Ui.browser = (function (agent) {
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
		console.log('Browser is', Ui.browser)

		new Overlay({
			target: document.body,
		})

		toprightText.set(Ui.toprightTextDefault)

		return ui
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
        return this
    }

	static CreateEl(html) {
		const doc = new DOMParser().parseFromString(html, "text/html")
		const el = doc.firstChild
		return el
	}

}





