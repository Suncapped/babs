import Stats from 'three/examples/jsm/libs/stats.module'
export class Ui {
	static browser

    document

    constructor(document) {
        this.document = document
		document.getElementById('gameinfo').textContent = document.getElementById('gameinfo').dataset.default

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
    }
    /** 
     * @param {'fps'|'mem'} which
     */
    createStats(which) {
        this[which] = Stats()
        this[which].showPanel(which=="fps"?0:2)
        this[which].dom.id = which
        this[which].dom.style = ""
        this.document.body.appendChild(this[which].dom)
        return this
    }

}





