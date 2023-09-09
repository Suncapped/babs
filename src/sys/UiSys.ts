import Stats from 'three/addons/libs/stats.module.js'
import Overlay from '../ui/Overlay.svelte'
import Ctext from '../ui/Ctext.svelte'
import Journal from '../ui/Journal.svelte'
import Container from '../ui/Container.svelte'
import Menu from '../ui/Menu.svelte'
import { toprightText, toprightReconnect, menuSelfData, uiWindows, socketSend } from '../stores'
import { log, v3out } from './../Utils'
import { Color, ColorManagement, DoubleSide, LinearSRGBColorSpace, MathUtils, MeshBasicMaterial, MeshPhongMaterial, MeshStandardMaterial, type Mesh, Vector3, Material } from 'three'
import { get as svelteGet } from 'svelte/store'
import { YardCoord } from '@/comp/Coord'
import { Zone } from '@/ent/Zone'
import { Wob } from '@/ent/Wob'
import { InputSys } from './InputSys'
import { Babs } from '@/Babs'
import type { SharedWob } from '@/shared/SharedWob'
import type { Player } from '@/ent/Player'
import { Text as TroikaText } from 'troika-three-text'
import type { FeWords } from '@/shared/consts'
import { WorldSys } from './WorldSys'

interface TroikaText extends Mesh {
	[key: string]: any
	material :Material // NOTE: This assumes a single material (which is currently true)
}

export class UiSys {
	babs :Babs
	toprightTextDefault = 'Made for Chrome on Mac/PC <a target="_new" href="https://discord.gg/r4pdPTWbm5">Discord</a>'
	ctext
	labelElements = []
	expiringText = Array<any>()
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

	


	

	landSaid(landtarget :{text :string, idzone: number, point: Vector3}) {
		log.info('landSaid', landtarget)
		const yardCoord = YardCoord.Create({
			position: landtarget.point,
			babs: this.babs,
		})

		if(this.babs.debugMode) {
			landtarget.text += `\n${yardCoord}`
			landtarget.text += `\n${v3out(landtarget.point)}`
		}

		this.feWords({
			content: landtarget.text,
			idZone: landtarget.idzone,
			targetLocation: {x: yardCoord.x, z: yardCoord.z},
		})
	}
	wobSaid(content :string, wob :SharedWob) {
		log.info('wobSaid', content, wob)
		this.feWords({
			content: content,
			idZone: wob.idzone,
			idTargetWob: wob.id(),
		})
	}
	
	// aboveHeadStack = Array<TroikaText>()
	aboveHeadChat(idPlayer :number, content :string, journalContent :null|'copy'|string = null, colorHex = '#eeeeee') {
		const player = this.babs.ents.get(idPlayer) as Player
		log.info('aboveHeadChat', idPlayer, content, colorHex, player)
		
		const ttext = this.feWords({
			content: content,
			idZone: player.controller?.playerRig?.zone.id,
			idTargetPlayer: idPlayer,
			colorHex: colorHex,
			journalContent: journalContent,
		})
		ttext.isAboveHead = true

		// console.log('setting ttext.isAboveHead', ttext.isAboveHead, ttext)

		
	}
	belowHeadInfo(idPlayer, content) {

	}

	craftSaid(options :Array<string>, wob :SharedWob, wobZone :Zone) {	
		console.warn('Crafting UI currently in transition', options, wob, wobZone)

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

	feWords(words :FeWords) :TroikaText {
		let colorHex = '#ffffff'
		if(words.isOoc) colorHex = '#aaaaaa'
		if(words.colorHex) colorHex = words.colorHex // If present, overrides normal OOC color

		if(words.journalContent) {
			this.svJournal.appendText(`${words.journalContent === 'copy' ? words.content : words.journalContent}`, colorHex, 'right')
		}

		const zone = this.babs.ents.get(words.idZone) as Zone

		if(words.targetLocation) {
			const yardCoord = YardCoord.Create({
				x: words.targetLocation.x, 
				z: words.targetLocation.z,
				zone: zone,
			})
			let point = zone.rayHeightAt(yardCoord)
			point.setY(point.y +1)

			this.makeTextAt('feWords', words.content, point, 1.375, colorHex)
		}
		else if(words.idTargetWob) {
			// Display at wob location
			const yardCoord = YardCoord.Create({
				x: words.idTargetWob.x, 
				z: words.idTargetWob.z,
				zone: zone,
			})
			let pointCentered = zone.rayHeightAt(yardCoord)
			pointCentered.setY(pointCentered.y +WorldSys.Yard /2)

			// Get the direction of the cameraGroup from pointCentered
			let cameraGroupDirectionOpposite = new Vector3(0, 0, -1)
			this.babs.cameraSys.cameraGroup.getWorldDirection(cameraGroupDirectionOpposite).negate()
			// Move pointCentered toward the camera by 2 units
			// Actually some things are quite offset, so move it 1.75 tiles toward us
			pointCentered.add(cameraGroupDirectionOpposite.multiplyScalar(2 +4 +1)) 

			this.makeTextAt('feWords', words.content, pointCentered, 1.375, colorHex)
		}
		else if(words.idTargetPlayer) {
			const player = this.babs.ents.get(words.idTargetPlayer) as Player
			const yardCoord = YardCoord.Create(player.controller.playerRig)
			let point = zone.rayHeightAt(yardCoord)
			point.setY(point.y +5.8)

			const ttext = this.makeTextAt('feWords', words.content, point, 1.375, colorHex)

			// Place in player object parent, and reposition
			const rigScale = player.controller.playerRig.scale.clone()
			const height = 6
			ttext.position.copy(new Vector3(0, height *(1/rigScale.y), 0))
			ttext.scale.copy(new Vector3(1/rigScale.x, 1/rigScale.y, 1/rigScale.z))

			// ttext.rotation.set(0, Math.PI, 0)
			// We are going to per-frame ensure that it faces the camera, in update()			

			player.controller.playerRig.add(ttext)

			return ttext
		}
		else {
			console.warn('feWords with no target', words)
		}
	}

	makeTextAt(name :string, content :string, worldPos :Vector3, sizeEm :number, colorHex :string = '#ffffff') :TroikaText {
		log.info(name, content)
			
		// Setup
		const ttext = new TroikaText() as TroikaText
		ttext.material.side = DoubleSide
		ttext.name = name
		ttext.text = content
		// ttext.shadows = false // todo not working?
		ttext.font = `${window.FeUrlFiles}/css/neucha-subset.woff`

		// Styling
		ttext.color = new Color(colorHex).convertSRGBToLinear()
		// ^ todo wait for update or figure this out? https://github.com/protectwise/troika/pull/267
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

		// How much time it will display for
		const expiresInSeconds = Math.sqrt(content.length) //this.babs.debugMode ? 10 : 3
		ttext.expires = Date.now() +(1000 *expiresInSeconds)
		this.expiringText.push(ttext)
		// todo use this from before?
		// 	// Decide how long to display for
		// 	// 200-300 wpm is normal for high school through adults // https://scholarwithin.com/average-reading-speed
		// 	// But since it's not continuous reading, it takes time to move eyes to it and read.  200 way too fast.
		// 	// Also it's nice to have time to read it 2-3x
		// 	const wpm = 120
		// 	const wps = wpm/60 // 200wpm/60s=3.3wps
		// 	const countWords = text.trim().split(/\s+/).length
		// 	const startingTimeMin = 3 // Give 3 seconds at start for everything (to refocus), then add onto it
		// 	const seconds = countWords / wps + startingTimeMin
		// 	const secondsClamped = MathUtils.clamp(seconds, startingTimeMin, 20)
		// 	chatDiv.setAttribute('data-expires', (Date.now() + (1000 *secondsClamped)).toString())
		// 	chatDiv.setAttribute('data-idPlayer', idPlayer || options.name)

		// Position in scene
		ttext.position.copy(worldPos)
		this.babs.group.add(ttext)

		// Rotate to camera
		// Make text face the screen flatly, rather than facing the character.
		// So get the normalized direction the cameraGroup is facing in world space, then turn it 180 degrees
		let cameraGroupDirectionOpposite = new Vector3(0, 0, -1)
		this.babs.cameraSys.cameraGroup.getWorldDirection(cameraGroupDirectionOpposite).negate()
		ttext.lookAt(ttext.getWorldPosition(new Vector3()).add(cameraGroupDirectionOpposite))

		ttext.sync()
		// ^ "It's a good idea to call the .sync() method after changing any properties that would affect the text's layout. If you don't, it will be called automatically on the next render frame, but calling it yourself can get the result sooner."
		return ttext
	}

	offerReconnect(reason) {
		toprightReconnect.set(reason)
		document.getElementById('welcomebar').style.display = 'block' 
		document.getElementById('Overlay').style.zIndex = '1000'
		document.getElementById('topleft').style.display = 'none' 

		this.aboveHeadChat(this.babs.idSelf, `<<${reason}>>`, 'copy')
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

	logText = ''
	update() {
		this.labelElements.forEach(chat => {
			const expires = chat.getAttribute('data-expires') // Could store objects with refs instead
			// const player = this.babs.ents.get(parseInt(idPlayer))
			if(Date.now() > expires) {
				chat.hidden = true
				this.labelElements = this.labelElements.filter(e => !e.hidden)
				chat.remove()
			}
		})

		this.expiringText.forEach(ttext => {
			if(Date.now() > ttext.expires) {
				ttext.parent.remove(ttext)
				ttext.dispose()
				this.expiringText = this.expiringText.filter(t => t.id !== ttext.id)
			}
		})


		// Now do things that rely on the playerRig being present; otherwise return
		const selfRig = this.babs.inputSys.playerSelf.controller?.playerRig
		if(!selfRig) return	

		// For aboveHeadStack, set position, rotation, element height in stack
		// We want items that are earlier in the index to be higher up.
		// We can't just multiply by the index, because multiline items have different heights.
		// Instead, we kind of want to go in reverse; start with the last (bottom) item,
		// 	and it has no height modification.  Each item count down the index, goes a little higher.
		const scale = 1/selfRig.scale.y
		const heightStartingPoint = 6 *scale
		let heightAccumPerPlayer = []
		for(let index=this.expiringText.length -1; index >= 0; index--) {
			const ttext = this.expiringText[index]
			if(!ttext.isAboveHead) continue

			const idPlayer = parseInt(ttext.parent.idplayer)
			const heightAccum = heightAccumPerPlayer[idPlayer] || 0
			
			ttext.position.setY(heightStartingPoint +heightAccum)
			
			const height = (ttext.geometry.boundingBox.max.y -ttext.geometry.boundingBox.min.y)
			heightAccumPerPlayer[idPlayer] = heightAccum +(height *scale)

			// Get the direction of the camera from
			let cameraGroupDirectionOpposite = new Vector3(0, 0, -1)
			this.babs.cameraSys.cameraGroup.getWorldDirection(cameraGroupDirectionOpposite).negate()
			ttext.lookAt(ttext.getWorldPosition(new Vector3()).add(cameraGroupDirectionOpposite))
		}



		const oldPos = selfRig?.position
		if(this.babs.debugMode) {
			const newLogText = `zone: ${selfRig?.zone.id}, in-zone xz: (${Math.floor(oldPos.x/4)}, ${Math.floor(oldPos.z/4)}), y: ${Math.floor(oldPos.y)} \n draws: ${this.babs.renderSys.renderer.info.render.calls} tris: ${this.babs.renderSys.renderer.info.render.triangles.toLocaleString()} geoms: ${this.babs.renderSys.renderer.info.memory.geometries} texs: ${this.babs.renderSys.renderer.info.memory.textures} progs: ${this.babs.renderSys.renderer.info.programs.length} \n ents: ${this.babs.ents.size.toLocaleString()} wobs: ${Wob.totalArrivedWobs?.toLocaleString()} fps: ${this.babs.renderSys.fpsDetected}`
			if(this.logText !== newLogText) {
				this.logText = newLogText
				window.document.getElementById('log').innerText = this.logText
			}
			console.log()
		}




	}

}





