import { Box2, Camera, Color, InstancedMesh, PerspectiveCamera, Quaternion, Raycaster, SkinnedMesh, Vector3 } from 'three'
import { FeInstancedMesh, Wob } from '@/ent/Wob'
import { topmenuUnfurled, rightMouseDown, debugMode, nickTargetId, dividerOffset, settings } from '../stores'
import { get as svelteGet } from 'svelte/store'
import { log } from './../Utils'
import { MathUtils } from 'three'
import { PlaneGeometry } from 'three'
import { MeshBasicMaterial } from 'three'
import { Mesh } from 'three'
import { DoubleSide } from 'three'
import { Matrix4 } from 'three'
import { Vector2 } from 'three'
import { Controller } from '@/comp/Controller'
import { WorldSys } from './WorldSys'
import * as Utils from './../Utils'
import { UiSys } from './UiSys'
import { YardCoord } from '@/comp/Coord'
import { Babs } from '@/Babs'
import { Player } from '@/ent/Player'
import { Zone } from '@/ent/Zone'
import type { WobId } from '@/shared/consts'
import { FastWob } from '@/shared/SharedZone'

// Stateful tracking of inputs
// 0=up(lifted), false=off, 1=down(pressed), true=on, 
const LIFT = 0
const OFF = false
const PRESS = 1
const ON = true

const MOUSE_LEFT_CODE = 0
const MOUSE_RIGHT_CODE = 2

type PickedObject = {
	instanced :FeInstancedMesh,
	instancedBpid :string,
	isIcon? :boolean,
	instancedIndex? :number,
	instancedPosition? :Vector3,
	yardCoord? :YardCoord,
}

export class InputSys {

	static NickPromptStart = '> Name for'

	mouse :{[key :string] :boolean|number|Raycaster|Record<any,any>|any} = {
		left: OFF,
		right: OFF,
		middle: OFF, // Mouse wheel button
		// back: OFF, // Doesn't work on my modified macos external mouse
		// forward: OFF, // Doesn't work also
		x: OFF, // Position // OFF is offscreen
		y: OFF,
		dx: 0, // Position delta since last frame (including during pointer lock)
		dy: 0,
		accumx: 0, // Accumulation of deltas, for angle snapped rotation
		// accumy: 0,
		ldouble: false, // Double click, managed manually
		// rdouble: false,
		scrolldx: 0, // Gesture/scroll, browser accumulates and decays it, so it's a bit weird
		scrolldy: 0,
		// scrollaccumx: 0,
		scrollaccumy: 0, // Manual scroll rate tracking, for gesture touchmove
		device: undefined, // mouse, touchpad, fingers
		zoom: 0,

		// Finger handling
		isfingers: false, // certain; whether it's a finger touch device such as a phone or tablet
		fingerlastx: 0,
		fingerlasty: 0,
		finger2downstart: 0,

		ray: new Raycaster(new Vector3(), new Vector3(), 0, WorldSys.Acre * 2),
		xy: new Vector2(0, 0),

		movetarget: undefined,
		landtarget: {
			text: '',
			idzone: null,
			point: new Vector3(0, 0, 0),
		},

	}
	keys :{[key:string]:boolean|number} = {
		w: OFF,
		a: OFF,
		s: OFF,
		d: OFF,
		up: OFF,
		left: OFF,
		down: OFF,
		right: OFF,
		space: OFF,
		sleft: OFF,
		sright: OFF,
		cleft: OFF,
		cright: OFF,
		aleft: OFF,
		aright: OFF,
		mleft: OFF,
		mright: OFF,
		escape: OFF,
		enter: OFF,
		// Actually, keys default to undefined, so I don't need to set OFF for F, etc. 
		// Maybe not for anything above; but, it's nice to see them enumerated.
	}

	characterControlMode = false // Mode that means we're controlling the character movement/rotation
	mouseAccumThreshold = 80 // Degrees at which mouse left/right movement causes a character rotation
	headTurnMaxDegrees = 45 // Determines at what point the view will snap turn
	doubleClickMs = 400 // MS was 500ms
	movelock = false // Autorun
	touchmove :boolean|number|'auto' = 0 // Touchpad movement gesture state. -1 (back), 0 (stop), 1 (forward), 'auto' (autorun)
	runmode = true // Run mode, as opposed to walk mode
	arrowHoldStartTime = 0 // left/right arrow rotation repeat delay tracker
	topMenuVisibleLocal

	isAfk = false
	babs :Babs
	playerSelf :Player
	canvas :HTMLElement



	constructor(babs :Babs, player :Player, mousedevice) {



		this.babs = babs
		this.playerSelf = player
		this.canvas = document.getElementById('canvas')

		this.setMouseDevice(mousedevice || 'mouse') 
		// ^^ Default to mouse; because touchpad user has to figure out two finger touch either way.

		// Map JS key codes to my InputSys keys state array
		const inputCodeMap = {
			'ArrowUp': 'up',
			'ArrowLeft': 'left',
			'ArrowDown': 'down',
			'ArrowRight': 'right',
			'Space': 'space',
			'ShiftLeft': 'sleft',
			'ShiftRight': 'sright',
			'ControlLeft': 'cleft',
			'ControlRight': 'cright',
			'AltLeft': 'aleft',
			'AltRight': 'aright',
			'MetaLeft': 'mleft',
			'MetaRight': 'mright',
			'Escape': 'esc',
			'Enter': 'return',
			'Backspace': 'backspace',
		}
		// Special case: 'KeyW' style letter events
		'abcdefghijklmnopqrstuvwxyz'.split('').forEach(letter => {
			inputCodeMap[`Key${letter.toUpperCase()}`] = letter
		})

		document.addEventListener('keydown', async ev => {
			this.activityTimestamp = Date.now()
			log.info('keydown:', ev.code)
			// OS-level key repeat keeps sending down events; 
			if (this.keys[inputCodeMap[ev.code]] !== ON) { // stop that from turning into presses
				if (ev.target.id !== 'chatbox') { // Except do it allow it when editing chatbox
					this.keys[inputCodeMap[ev.code]] = PRESS
				}
			}

			if (this.characterControlMode) {
				if (this.mouse.right) {
					// Jump on spacebar if mouse right held
					if (this.keys.space === PRESS) {
						this.playerSelf.controller.jump(Controller.JUMP_HEIGHT)
					}

					// ev.stopImmediatePropagation() // Doesn't work to prevent Ctext.svelte chatbox from receiving this event
				}

				// If arrows are used for movement, it breaks out of movelock or touchmove
				if (this.keys.up === PRESS || this.keys.down === PRESS) {
					this.movelock = false
					this.touchmove = false
				}

				// If pressing left or right arrows it immediately turns
				if (this.keys.left === PRESS || this.keys.right === PRESS) {
					this.arrowHoldStartTime = 0 // Zero will trigger it immediately
				}
			}


			// Chat shortcut combos // Todo see about these on Windows - need OS detection?
			// Select all
			if (this.keys.mleft && this.keys.a) {
				const box = document.getElementById('chatbox')
				box.textContent = box.textContent.slice(0, -1) // remove 'a' :-P
				box.focus()
			}
			if (this.keys.aleft && this.keys.backspace) {
				let el = document.getElementById('chatbox')
				el.focus()
				let range = document.createRange()
				let sel = window.getSelection()

				if (el.childNodes?.[0]) {
					range.setStart(el.childNodes[0], el.textContent.length)
					range.collapse(true)
				}

				sel.removeAllRanges()
				sel.addRange(range)
			}

			// Testing commands
			if (this.keys.cleft) {


				// Spawn test character
				if (this.keys.n === PRESS) {
					

				}

				// Instant Forest
				if (this.keys.b === PRESS) {
					const [treesPerAxis, spacing] = [100, 2] // Just tons of trees
					// const [treesPerAxis, spacing] = [5, 50] // Property (5 plots) posts
					let count=0
					let wobTrees = []
					for(let a=0; a<treesPerAxis; a++) {
						for(let b=0; b<treesPerAxis; b++) {
							count++
							wobTrees.push({
								id: Utils.randIntInclusive(1_000_000, 1_000_000_000),
								idzone: 1883840645,
								x: a*spacing,
								z: b*spacing,
								name: 'lodgepole simple',
								color: '0xff0000',
							})
						}
					}
					log('Created '+count+' client side items')

					// const uniqueGltfs = new Set(wobTrees.map(tree => tree.name))
					// console.log('uniqueGltfs', uniqueGltfs)


					// console.time('first')
					// await Promise.all(Wob.ArriveMany([wobTrees[0]], this.babs, false))
					// console.timeEnd('first')

					console.time('all')
					const res = await Wob.ArriveMany(wobTrees, this.babs, false)
					console.timeEnd('all')
					console.log('res', res)

				}
				if (this.keys.m === PRESS) {
					// One scroll (there were reasons!)
					// const wobScroll = {
					// 	id: Utils.randIntInclusive(1_000_000, 1_000_000_000),
					// 	idzone: 899279496,
					// 	x: 4,
					// 	z: 4,
					// 	name: 'scroll',
					// 	color: '0xff0000',
					// }
					// log('Created scroll at 4,4')
					// await Wob.ArriveMany([wobScroll], this.babs, false)
					log('m', this.babs.ents, this.babs.ents.size)

					// Show zones
					for (const [key, value] of this.babs.ents.entries()) {
						console.log(key, value)
					}
				}
			}

		})

		document.addEventListener('keyup', ev => {
			this.keys[inputCodeMap[ev.code]] = LIFT

			// Turning-keys repeat-delay reset
			if (this.keys.left === LIFT || this.keys.right === LIFT) {
				this.arrowHoldStartTime = 0
			}
		})

		/*
			When alt tabbing, meta (cmd) key was staying stuck down since the windows in the bakcground
			and never receiving a keyup.
			Solution: When window blurs, let's set all keys to off
		*/
		window.addEventListener('blur', () => {
			this.keys.cleft = LIFT
			this.keys.cright = LIFT
			this.keys.aleft = LIFT
			this.keys.aright = LIFT
			this.keys.mleft = LIFT
			this.keys.mright = LIFT
		})

		// No 'click' handling; we do it manually via mousedown/mouseup for more control
		// document.addEventListener( 'click', mouseOnClick )

		// This fails to detect window switches, and we don't want window switch auto-afk anyway
		// document.addEventListener("visibilitychange", (ev) => {
		// 	log('vis change', ev)
		// })

		const touchHandler = (event) => {
			this.setMouseDevice('fingers')  // Only finger devices should fire these touch events
			if (event.target.id !== 'canvas') return
			event.preventDefault()

			// log(event)
			// let touches = event.changedTouches

			let finger1 = event.changedTouches[0]
			let finger2 = event.changedTouches[1]
			let type = ''
			switch (event.type) {
			case 'touchstart': type = 'mousedown'; break
			case 'touchmove': type = 'mousemove'; break
			case 'touchend': type = 'mouseup'; break
			default: return
			}
			const newEvent = new MouseEvent(type, {
				bubbles: true,
				cancelable: true,
				view: window,
				detail: 1,
				screenX: finger1?.screenX || this.mouse.fingerlastx,
				screenY: finger1?.screenY || this.mouse.fingerlasty,

				clientX: finger1?.clientX || this.mouse.fingerlastx,
				clientY: finger1?.clientY || this.mouse.fingerlasty,
				ctrlKey: false,
				shiftKey: false,
				metaKey: false,
				altKey: false,
				button: finger2 ? MOUSE_RIGHT_CODE : MOUSE_LEFT_CODE,
				relatedTarget: null,

			})

			// Two finger touch to look
			if (event.touches.length === 2) {
				// Simulate delta like mouseevents?  Or use onwheel simulation like touchpad?  
				// Probably like touchpad.
				if (event.type === 'touchstart' || event.type === 'touchend') {
					this.mouse.fingerlastx = event.touches[0].clientX
					this.mouse.fingerlasty = event.touches[0].clientY
				}
				// Oh dear, axes movement is flipped because it's a "drag" concept rather than a touchpad "direction" concept.
				// But, since user should use fingers below character, like a record player, regular x axis should be ok!
				// Actually, feels more intuitive if they drag in the direction of camera movement.
				this.mouse.scrolldx += event.touches[0].clientX - this.mouse.fingerlastx
				this.mouse.fingerlastx = event.touches[0].clientX

				// If turning, don't move forward/back as easily
				const sidewaysMovementLots = 5 // Tested on iPad
				const moveMultiplierMax = 20
				const moveLerp = MathUtils.lerp(moveMultiplierMax, 0, Math.min(1, Math.abs(this.mouse.scrolldx) / sidewaysMovementLots))
				// log(`${this.mouse.scrolldx}, ${moveLerp}`)
				this.mouse.scrolldy -= moveLerp * (event.touches[0].clientY - this.mouse.fingerlasty)
				this.mouse.fingerlasty = event.touches[0].clientY
			}

			// Handle double finger double tap
			if (event.type === 'touchstart' && event.touches.length === 2) {
				if (Date.now() - this.mouse.finger2downstart < this.doubleClickMs) { // Quick down them up, autorun
					// log('finger2 runmode')
					this.movelock = !this.movelock
					this.mouse.finger2downstart = Date.now() - this.doubleClickMs * 3 // Make made change impossible for a second
				}
				else {
					this.mouse.finger2downstart = Date.now()
				}
			}
			if (event.type === 'touchend' && event.touches.length === 1) { // Second finger removed, first finger remains
				// log('touchend')
			}
			// todo zoom for jump etc, like .onwheel

			// Or maybe treat like mouse?
			// newEvent.movementX = finger1.clientX -this.mouse.x
			// newEvent.movementY = finger1.clientY -this.mouse.y
			// finger2?.target.dispatchEvent(newEvent)
			// document.dispatchEvent(newEvent)
		}
		document.addEventListener('touchstart', touchHandler, {passive:false})
		document.addEventListener('touchmove', touchHandler, {passive:false})
		document.addEventListener('touchend', touchHandler, {passive:false})
		document.addEventListener('touchcancel', touchHandler, {passive:false})

		this.lastMoveHoldPicked
		this.carrying = null
		document.addEventListener('mousemove', async ev => { // :MouseEvent
			this.mouse.movetarget = ev.target
			this.activityTimestamp = Date.now()
			// log('mousemove', ev.target.id, ev.offsetX, ev.movementX)

			// Note I get MULTIPLE mousemove calls of this func in between a single update frame!
			// Thus, setting this.mouse.dy =, doesn't work as it loses ones in between frames.
			// Instead, I should either do accumx here, or sum the deltas here instead of add, then wipe them at update.
			// Done.  What I notice is, with devtools open, events come in a lot faster than updates() (RAFs)

			// Mouse movement since last frame (including during pointer lock)
			// These are set by browser during real mouse move, but not by touchpad or touch events.
			// Touchpad instead uses .onwheel for gestures.
			this.mouse.dx += ev.movementX || ev.mozMovementX || ev.webkitMovementX || 0
			this.mouse.dy += ev.movementY || ev.mozMovementY || ev.webkitMovementY || 0

			// Mouse position (unchanging during pointer lock or gestures)
			// 'offsetX' means offset from screen origin, not offset from last event/frame
			this.mouse.x = ev.offsetX || ev.mozOffsetX || ev.webkitOffsetX || 0
			this.mouse.y = ev.offsetY || ev.mozOffsetY || ev.webkitOffsetY || 0
			// Actually, offsetX is based on current div!  So for canvas it applies to game, but for bag it applies to bag child!

			// From threejs:
			// calculate mouse position in normalized device coordinates
			// (-1 to +1) for both components
			this.mouse.xy.x = (ev.clientX / parseInt(this.canvas.style.width)) * 2 - 1
			this.mouse.xy.y = - (ev.clientY / parseInt(this.canvas.style.height)) * 2 + 1

			if (ev.target.classList.contains('container-body')) {

				// There's another problem: Transparent corner of one png will overlap another, preventing mousemove target!
				// What if I extract the coords within the parent, then check every child there for transparency, sorted by updated?
				// Alright, so 1. get all items under mouse by looking through the bag!
				for (const item of ev.target.childNodes) {
					const itemBox = new Box2(
						new Vector2(parseInt(item.style.left), parseInt(item.style.top)),
						new Vector2(parseInt(item.style.left) + parseInt(item.style.width), parseInt(item.style.top) + parseInt(item.style.height))
					)
					// log(ev.offsetX, ev.offsetY, itemBox)
					if (itemBox.containsPoint(new Vector2(ev.offsetX, ev.offsetY))) {
						// Mouse is within image bounds
						if (this.babs.debugMode) item.style.border = '1px solid white'
						// 2. Check whether over transparency 
						const wobId = parseInt(item.id.split('-')[2])
						const wob = this.babs.ents.get(wobId)
						let instanced = Wob.InstancedMeshes.get(wob.name)
						// log(wob,  Wob.InstancedMeshes, this.babs.ents)

						// if(instanced) {
						const pixels = (await instanced.renderedIcon()).pixels
						const colorChannels = 4
						const mouseImageX = ev.offsetX - itemBox.min.x
						const mouseImageY = ev.offsetY - itemBox.min.y
						let index = Utils.coordToIndex(mouseImageX, mouseImageY, UiSys.ICON_SIZE, colorChannels)
						const alphaChannel = pixels[index + 3] // r,g,b,a, so +3 is alpha
						// log(alphaChannel) // Noramlly it's 255, but sometimes like 191 etc on the borders
						// }
						if (alphaChannel > 0) { // We are on top of non-transparency
							// log('solid!', wob.name, wobId)
							item.style.filter = 'brightness(200%)'

							// Instanced things like wobjects, water, trees, etc unless caught above
							const instanced = Wob.InstancedMeshes.get(wob.name)
							// const index = this.mouseRayTargets[i].instanceId
							// const position = Wob.GetPositionFromIndex(instanced, index)

							// log('instanced?', wob)



							this.pickedObject = {
								instanced: instanced,
								instancedBpid: wob.name,
								isIcon: true,
							}
						}
						else {
							// log('notsolid', wob.name)
							item.style.filter = 'none'
							this.pickedObject = undefined
						}

					}
					else {
						if (this.babs.debugMode) item.style.border = 'none'
					}

				}

			}


			// Determine if dragging a wobject
			if (!this.carrying) { // Not already carrying something
				if (this.mouse.left || ev.buttons === 1) {
					let isSameAsPrevious

					if (this.mouse.left) { // Holding down, in canvas (mouse.left doesn't get activated otherwise)
						isSameAsPrevious = this.lastMoveHoldPicked?.instanced?.uuid === this.pickedObject?.instanced?.uuid // Ensures it's comparable object
							&& this.lastMoveHoldPicked?.instancedPosition.equals(this.pickedObject?.instancedPosition)
					}
					else if (ev.buttons === 1) { // Holding down left mouse (buttonS because in mousemove), in UI
						isSameAsPrevious = this.lastMoveHoldPicked?.id === this.pickedObject?.id // fasttodo
						// log('isSameAsPrevious', isSameAsPrevious, !this.lastMoveHoldPicked, this.pickedObject)
					}

					if (this.pickedObject?.instanced && (isSameAsPrevious || !this.lastMoveHoldPicked)) {
						// Over a wob in the world, and if already over a wob, it must be the same wob
						this.lastMoveHoldPicked = this.pickedObject // Save that wob
					}
					else { // Holding down not over a wob, or over a different wob than the one previously saved
						// log('else')
						if (this.lastMoveHoldPicked) { // And there is one previously saved
							// Now we could lift that dragged wob
							this.carrying = this.lastMoveHoldPicked
							this.lastMoveHoldPicked = null
							// Now in update, we'll keep carrying on the mouse intersect to ground
						}
					}
				}
			}
			else {
				this.lastMoveHoldPicked = null
			}


		})

		document.addEventListener('mousedown', async ev => {
			log.info('mouseOnDown', ev.button, ev.target.id)

			// Close top menu if it's open
			if (ev.target.id === 'canvas' && this.topMenuVisibleLocal) {
				topmenuUnfurled.set(false)
			}

			if (!this.topMenuVisibleLocal && (ev.target.id === 'canvas')) {
				this.characterControlMode = true

				if (ev.button === MOUSE_LEFT_CODE) {
					this.mouse.left = PRESS

					if (this.mouse.right) {
						// Modern touchpads don't have both buttons to click at once; it's a mouse
						this.setMouseDevice('mouse')
					}

					// Turn off movelock if hitting left (while right) after a delay
					if (this.mouse.right && this.movelock && Date.now() - this.mouse.ldouble > this.doubleClickMs) {
						this.movelock = false
					}

					// Single click
					if (this.mouse.ldouble === false) { // First click
						if(this.isAskingTarget) { // In target selection mode
							// todo make work for non-instanced things, and ground, players, etc.
							const coord = this.pickedObject?.yardCoord
							if(!coord) {
								this.babs.uiSys.playerSaid(this.babs.idSelf, 'There is no effect.', {journal: false, color: '#cccccc', italics: true})
							}

							const zone = coord.zone
							const wob = zone.getWob(coord.x, coord.z)
							if(!wob) {
								this.babs.uiSys.playerSaid(this.babs.idSelf, 'Target not found.', {journal: false, color: '#cccccc', italics: true})
							}
							else {
								this.babs.socketSys.send({
									action: {
										verb: 'used',
										noun: this.askTargetSourceWob.id(),
										data: {
											target: wob.id(),
										},
									}
								})
							}
							document.body.style.cursor = 'auto'
							this.isAskingTarget = false
							this.askTargetSourceWob = null

						}
						else {
							if (this.pickedObject?.type === 'SkinnedMesh') {
								// Single click player, get their name or nick
								const player = this.babs.ents.get(this.pickedObject.parent.parent.idplayer)
								this.babs.uiSys.playerSaid(player.id, player.nick || 'Stranger', { journal: false, isname: true })
							}
							else if (this.pickedObject?.instanced) {
								let debugStuff = ''
								// Single click instanced
								// const wob = this.babs.ents.get(this.pickedObject?.id) as Wob
								const yardCoord = this.pickedObject?.yardCoord


								if(this.babs.debugMode) {
									const pos = this.pickedObject?.instancedPosition
									log('this.pickedObject', this.pickedObject, pos)
									debugStuff += `\n${yardCoord}\n^${Math.round(pos.y)}ft\nii=`+this.pickedObject?.instancedIndex
								}


								
								log.info('picked', this.pickedObject, yardCoord)
								this.babs.uiSys.wobSaid(this.pickedObject?.instancedBpid +debugStuff, yardCoord)
							}
	
							if (this.mouse.landtarget.text) { // Clicked while mouse on a terrain intersect
								this.babs.uiSys.landSaid(this.mouse.landtarget)
							}
	
	
							this.mouse.ldouble = Date.now()
						}

					} // Double click
					else if (Date.now() - this.mouse.ldouble <= this.doubleClickMs) { // Double click within time
						this.mouse.ldouble = 0
						if (this.pickedObject?.type === 'SkinnedMesh') {
							const player = this.babs.ents.get(this.pickedObject.parent.parent.idplayer)
							nickTargetId.set(player.id)

							const box = document.getElementById('chatbox')
							box.textContent = `${InputSys.NickPromptStart} ${player.nick || 'stranger'}: `
							box.style.display = 'block'
							box.focus()
						}
						else if (this.mouse.landtarget.text) {  // && this.pickedObject?.name === 'ground'
							log.info('landclick', this.mouse.landtarget, this.mouse.landtarget.text, this.mouse.landtarget.point)

							const zone = this.babs.ents.get(this.mouse.landtarget.idzone) as Zone
							const yardCoord = YardCoord.Create({
								position: this.mouse.landtarget.point,
								babs: this.babs,
							})

							this.babs.socketSys.send({
								action: {
									verb: 'used',
									noun: 'ground',
									data: {
										point: {x: yardCoord.x, z: yardCoord.z},
										idzone: zone.id,
									},
								}
							})

						} else {//} if(this.mouse.landtarget.text) {  // && this.pickedObject?.name === 'ground'

							log('wobclick', this.mouse, this.pickedObject)

							if(this.pickedObject) {
								const coord = this.pickedObject?.yardCoord
								const wob = coord.zone.getWob(coord.x, coord.z)
	
								this.babs.socketSys.send({
									action: {
										verb: 'used',
										noun: wob.id(),
									}
								})
							}

						}
					}

				}

				if (ev.button === MOUSE_RIGHT_CODE) {
					this.mouse.right = PRESS

					rightMouseDown.set(true)

					if (this.mouse.left) {
						// Modern touchpads don't have both buttons to click at once; it's a mouse
						this.setMouseDevice('mouse')
					}

					// Right+left mouse during movelock, stops movement
					if (this.mouse.left && this.movelock) {
						this.movelock = false
					}

					if (this.mouse.device === 'touchpad') {
						// Two-finger click on touchpad toggles touchmove (similar to movelock)
						if (this.touchmove === 0) {
							this.touchmove = 'auto'
						}
						else {
							this.touchmove = 0
							this.mouse.scrollaccumy = 0
						}
					}
					else {
						// If not touchpad, do pointer lock.  Touchpad doesn't need it because look is via gestures

						try{
							await this.canvas.requestPointerLock()
						}
						catch(e) {
							log('PointerLock Exception', e)
						}
						// this.canvas.style.cursor = 'none'

						// If you started pressing w before mouse, chat now has annoying 'w's in it; clear them.
						const box = document.getElementById('chatbox')
						if (box.textContent === 'w' || box.textContent?.[1] === 'w') {
							box.textContent = ''
						}
					}
				}

				// Middle mouse toggles autorun
				if (ev.button == 1) {
					// PS it's a mouse
					this.setMouseDevice('mouse')
					this.mouse.middle = PRESS
					this.movelock = !this.movelock
				}

			}
		})

		document.addEventListener('mouseup', ev => {
			// log.info('mouseOnUp', ev.button, ev.target.id)
			if (ev.button === MOUSE_LEFT_CODE) {
				this.mouse.left = LIFT

				this.lastMoveHoldPicked = null
				// Handle carry drop
				if (this.carrying) {

					log.info('carry drop', this.mouse.movetarget, this.carrying, this.mouse.landtarget, this.pickedObject)
					if (this.mouse.movetarget?.parentElement?.id === `container-for-${this.babs.idSelf}`
						&& this.mouse.movetarget.classList.contains('container-body') // Is body of bag, not title etc
					) { // UI main bag
						log('Main bag drop', this.mouse.movetarget)
						const point = new Vector3(this.mouse.x, 0, this.mouse.y)
						const wob = this.babs.ents.get(this.carrying.id) 
							|| Utils.findWobByInstance(this.babs.ents, this.carrying.instancedIndex, this.carrying.instancedName)
						log.info('Found', wob, this.carrying)
						this.babs.socketSys.send({
							action: {
								verb: 'contained',
								noun: wob.id,
								data: {
									point,
									container: this.babs.idSelf,
								},
							}
						})

					}
					else if (this.mouse.landtarget?.text) {  // && this.pickedObject?.name === 'ground' // Land
						log.info('landdrop', this.mouse.landtarget)
						const coordDest = YardCoord.Create({
							position: this.mouse.landtarget.point,
							babs: this.babs,
						})
						// Todo put distance limits, here and server
						// const wobContained = this.babs.ents.get(this.carrying.id) // bagtodo
						// const wobInstanced = Utils.findWobByInstance(this.babs.ents, this.carrying.instancedIndex, this.carrying.instancedName)
						// const wob = wobContained || wobInstanced
						const wobDest = coordDest.zone.getWob(coordDest.x, coordDest.z)

						const coordSource = this.carrying.yardCoord
						const wobSource = coordSource.zone.getWob(coordSource.x, coordSource.z)

						log.info('Found', wobSource?.id(), wobDest?.id(), this.carrying, coordDest)
						this.babs.socketSys.send({
							action: {
								verb: 'moved',
								noun: wobSource.id(),
								data: {
									point: {x: coordDest.x, z: coordDest.z},
									idzone:coordDest.zone.id,
								},
							}
						})
					}
					else { // Something else - cancel drop // Will be partly replaced with stacking and piling in the future. 
						// Seems to handle mouse leaving window and letting go there, because windows still gets mouse up, cool.
						log.info('Other drop', this.carrying)
						this.babs.uiSys.clientSaid(`Cannot place ${this.carrying.instancedBpid} there.`)
					}

					this.carrying = null
					document.body.style.cursor = 'auto'
				}


			}
			if (ev.button === MOUSE_RIGHT_CODE) {
				this.mouse.right = LIFT

				rightMouseDown.set(false)

				this.mouse.ldouble = 0

				document.exitPointerLock?.()
				this.canvas.style.cursor = 'inherit'
			}
			if (ev.button == 1) {
				this.mouse.middle = LIFT
			}
		})

		this.canvas.addEventListener('wheel', ev => {
			ev.preventDefault()

			// https://medium.com/@auchenberg/detecting-multi-touch-trackpad-gestures-in-javascript-a2505babb10e
			if (ev.ctrlKey) {
				// Doesn't actually require control keypress!  It's a hack that enables pinch zoom
				this.setMouseDevice('touchpad') // Only a touchpad would use zoom.
				this.mouse.zoom -= ev.deltaY
			} else {
				if (ev.deltaX) this.setMouseDevice('touchpad') // Only a touchpad would use x scrolling.
				this.mouse.scrolldx -= ev.deltaX

				if (this.mouse.device !== 'mouse') { // Do not move on wheel, if we know it's a mouse.
					// this.mouse.scrolldy += ev.deltaY
					// Disabling touchpad vertical scroll to move.  Instead, use code similar to mouse

					// log(this.mouse.scrolldy)
					// if (ev.deltaY < 0 || !this.babs.cameraSys.gh ||this.babs.cameraSys.idealOffset?.y > this.babs.cameraSys.gh?.y + 4) {
					// Only increase offsetHeight if camera is above ground, or moving camera up
					if(!this.topMenuVisibleLocal) {
						this.babs.cameraSys.offsetHeight -= ev.deltaY * 0.05
					}
					// }

				}
			}

			if (this.mouse.device === 'mouse') {
				if (ev.deltaY < 0) {
					this.runmode = true
				}
				else if (ev.deltaY > 0) {
					this.runmode = false
				}
			}

		}, {passive: false})

		topmenuUnfurled.subscribe(vis => { // Menu becomes visible
			this.topMenuVisibleLocal = vis

			if (vis) {
				this.characterControlMode = false
				document.exitPointerLock?.()
				this.canvas.style.cursor = 'inherit'
			}
			else {
				// Doesn't go back to this.characterControlMode until they mouse-right-hold
			}
		})
		settings.subscribe(sets => { // Menu becomes visible

			for (const key in sets) {
				if (key === 'inputdevice') {
					this.setMouseDevice(sets[key])
				}
			}

		})

		this.activityTimestamp = Date.now()

		return this
	}


	mouseRayTargets = []
	displayDestinationMesh

	pickedObject :PickedObject|null
	pickedObjectSavedColor
	pickedObjectSavedMaterial
	lastMoveHoldPicked :PickedObject|null
	carrying :PickedObject|null

	async update(dt, scene) {

		if (!this.isAfk && Date.now() - this.activityTimestamp > 1000 * 60 * 5) { // 5 min
			this.isAfk = true
		}
		// if(this.isAfk) { // todo let's send it to server, then have server notify zone
		// 	this.player.controller.target.children[0].material.transparent = true
		// 	this.player.controller.target.children[0].material.opacity = 0.2
		// }

		if (this.pickedObject
			&& !this.pickedObject.isIcon) { // Don't unpick when it's dragged from bag icon
			if (this.pickedObject.instanced) { // InstancedMesh picks
				this.pickedObject.instanced.setColorAt(this.pickedObject.instancedIndex, new Color(1, 1, 1))
				this.pickedObject.instanced.instanceColor.needsUpdate = true
			}
			else if (this.pickedObjectSavedMaterial) { // For everything else using mega color material
				this.pickedObject.material = this.pickedObjectSavedMaterial
				this.pickedObjectSavedMaterial = undefined
			}
			else { // non-mega color materials?  Should there even be any anymore? :)
				this.pickedObject.material.emissive.copy(this.pickedObjectSavedColor)
			}
			this.pickedObject = undefined
		}
		if (this.mouse.landtarget.text) {
			this.mouse.landtarget = {
				text: '',
				idzone: null,
				point: new Vector3(0,0,0),
			}
		}

		// log('mt', this.mouse.movetarget)
		if (this.mouse.movetarget?.id === 'canvas' // Only highlight things in canvas, not css ui
			&& !this.mouse.right // And not when mouselooking
		) {
			this.mouse.ray.setFromCamera(this.mouse.xy, this.babs.cameraSys.camera)
			this.mouseRayTargets = []
			this.mouse.ray.intersectObjects(scene.children, true, this.mouseRayTargets)

			// if(this.mouseRayTargets.length > 1) {
			// 	log(this.mouseRayTargets)
			// }

			// Ensure ground is last.  It was getting in the way of objects on the ground
			for (let i = 0, l = this.mouseRayTargets.length; i < l; i++) {
				if (this.mouseRayTargets[i].object?.name === 'ground') {
					const temp = this.mouseRayTargets[this.mouseRayTargets.length - 1]
					this.mouseRayTargets[this.mouseRayTargets.length - 1] = this.mouseRayTargets[i]
					this.mouseRayTargets[i] = temp
				}
			}
			for (let i = 0, l = this.mouseRayTargets.length; i < l; i++) { // Nearest object last

				if (this.mouseRayTargets[i].object?.type === 'LineSegments' // Wireframe
					|| this.mouseRayTargets[i].object?.name === 'destinationmesh' // debug dest mesh
					|| this.mouseRayTargets[i].object?.name === 'three-helper' // debug dest mesh
					|| this.mouseRayTargets[i].object?.parent?.name === 'three-helper' // debug dest mesh
					|| this.mouseRayTargets[i].object?.name === 'water' // water cubes IM
					// || this.mouseRayTargets[i].object?.name === 'farzone' // zonetodo
					|| this.mouseRayTargets[i].object?.name === 'camerahelper' // zonetodo
					|| this.mouseRayTargets[i].object?.name === 'flame') { // flame effect
					continue // Skip
				}


				else if (this.mouseRayTargets[i].object?.type instanceof SkinnedMesh) { // Player
					// log('skinnedmesh')

				}
				else if (this.mouseRayTargets[i].object instanceof InstancedMesh) { // couldn't use "?.type ===" because InstanceMesh.type is "Mesh"!
					// Instanced things like wobjects, water, trees, etc unless caught above
					const name = this.mouseRayTargets[i].object.name
					const instanced = Wob.InstancedMeshes.get(name) as FeInstancedMesh
					const index = this.mouseRayTargets[i].instanceId
					const position = instanced.coordFromIndex(index)

					const yard = YardCoord.Create({position: position, babs: this.babs})

					// log('mouse name', this.mouseRayTargets[i].object, name, instanced, index, position, yard)
					this.pickedObject = {
						instanced: instanced,
						instancedBpid: name,
						instancedIndex: index,
						instancedPosition: position,
						yardCoord: yard,
					}

				}
				else if (this.mouseRayTargets[i].object instanceof Mesh) { // Must go after more specific mesh types


					if (this.mouseRayTargets[i].object?.name === 'player_bbox') {
						if(!this.mouseRayTargets[i].object?.clickable) {
							continue
						}
						// Player bounding box, not in first person view
						const temp = this.mouseRayTargets[i].object
						// Here we switch targets to highlight the PLAYER when its bounding BOX is intersected!
						// log('player_bbox', this.pickedObject)
						this.pickedObject = temp.parent.children[0].children[1]  // gltf loaded
					}
					else if (this.mouseRayTargets[i].object?.name === 'ground') { // Mesh?
						if(this.playerSelf.controller.selfZoningWait) continue // don't deal with ground intersects while zoning
						
						const ground = this.mouseRayTargets[i].object
						const zone = ground.zone
						const pos = this.mouseRayTargets[i].point
						const yardCoord = YardCoord.Create({
							position: pos,
							babs: this.babs,
						})

						
						const landcoverData = yardCoord.zone.landcoverData
						// const newEngCoord = yardCoord.toEngineCoord()
						// todo use actual PlotCoord
						const plotCoord = new Vector3(Math.floor(yardCoord.x /10), pos.y, Math.floor(yardCoord.z /10))
						const index = Utils.coordToIndex(plotCoord.x, plotCoord.z, 26)
						
						const lcString = this.babs.worldSys.StringifyLandcover[landcoverData[index]]

						this.mouse.landtarget = {
							text: lcString,
							idzone: zone.id,
							point: this.mouseRayTargets[i].point,
						}

						// log('idzone', this.mouse.landtarget.idzone, this.mouse.landtarget.point.x, this.mouse.landtarget.point.z)

						// Also, maybe we should highlight this square or something?  By editing index color
					}
					else if (this.mouseRayTargets[i].object?.name === 'daysky') { // Sky
						// log('ray to sky')
					}
					else if (this.mouseRayTargets[i].object?.name === 'nightsky') { // Sky
						// log('ray to skybox')
					}
					else if (this.mouseRayTargets[i].object?.name === 'flame') { // Flame
						// log('ray to flame')
					}
					else { // All other meshes
						log('Uncaught mosueRayTarget', this.mouseRayTargets[i])
						this.pickedObject = this.mouseRayTargets[i].object
					}
				}
				else { // Everything else

					log('ray to unknown:', this.mouseRayTargets[i].object)
				}

				if (this.pickedObject) { // We've set a picked object in ifs above

					if (this.pickedObject.instanced) { // InstancedMesh 
						let oldColor = new Color()
						this.pickedObject.instanced.getColorAt(this.pickedObject.instancedIndex, oldColor)
						let hsl = new Color() // This indirection prevents accumulation across frames
						oldColor.getHSL(hsl)
						const highlight = hsl.multiplyScalar(3)

						this.pickedObject.instanced.setColorAt(this.pickedObject.instancedIndex, highlight)
						this.pickedObject.instanced.instanceColor.needsUpdate = true
					}
					else {
						// Dang it.  I can't use material here for highlight, because everything shares one material!  lol
						// We can clone the material temporarily?
						if (this.pickedObject.material.name === 'megamaterial') {
							this.pickedObjectSavedMaterial = this.pickedObject.material
							this.pickedObject.material = this.pickedObject.material.clone()
						}

						// Save old color and set new one
						if (this.pickedObject.material.emissive?.r) { // Handle uninit emissive color
							this.pickedObject.material.emissive = new Color(0, 0, 0)
						}
						this.pickedObjectSavedColor = this.pickedObject.material.emissive.clone() // Unused for megamaterial above
						this.pickedObject.material.emissive.setHSL(55 / 360, 100 / 100, 20 / 100).convertSRGBToLinear()
					}
				}

				break // Only run loop once (except for continues)
			}
		}

		if (this.carrying) {
			log.info('update carrying')
			if (!document.body.style.cursor || document.body.style.cursor === 'auto') {
				const riImage = (await this.carrying.instanced.renderedIcon()).image
				document.body.style.cursor = `url(${riImage}) ${UiSys.ICON_SIZE / 2} ${UiSys.ICON_SIZE / 2}, auto`
			}

		}

		if (!this.topMenuVisibleLocal) {
			// Swipe up progresses thorugh: walk -> run -> jump.  Down does the reverse
			// Tested on Mac touchpads; not sure how it will do on PC
			if (this.mouse.zoom > 40) {
				this.mouse.zoom = -this.mouse.zoom / 4
				if (!this.runmode) {
					this.runmode = true
				}
				else { // If ready in runmode, jump!
					this.playerSelf.controller.jump(Controller.JUMP_HEIGHT)
				}
			}
			else if (this.mouse.zoom < -40) {
				this.mouse.zoom = -this.mouse.zoom / 4
				this.runmode = false
			}

			if (this.mouse.right) {
				const mouseSensitivityPercent = 30 // hmm isn't this the same as just changing this.mouseAccumThreshold?
				this.mouse.accumx += this.mouse.dx * (0.5 * (mouseSensitivityPercent / 100)) //(mouseSensitivityPercent * )
			}
			else {
				// this.mouse.accumx = this.mouse.accumy = 0
				// Let's actually not snap after release; more intuitive.
			}

			if (this.mouse.scrolldx) { // If getting a touchpad two-finger touch (not press) move event
				this.mouse.accumx += this.mouse.scrolldx

			}
			if (this.mouse.scrolldy) {
				this.mouse.scrollaccumy += this.mouse.scrolldy / 12
			}

			// touchmove
			if (this.mouse.scrollaccumy / 2 > 10) {
				this.touchmove = 1
			}
			else if (this.mouse.scrollaccumy / 2 < -10) {
				this.touchmove = -1
			}
			else if (this.touchmove !== 'auto') {
				this.touchmove = 0
			}


			// Delta accumulation for angle rotation snap
			if (Math.abs(this.mouse.accumx) > this.mouseAccumThreshold) {
				const gCurrentPosition = this.playerSelf.controller.target.position.clone().multiplyScalar(1 / 4).floor()
				const eCurrentPositionCentered = gCurrentPosition.clone().multiplyScalar(4).addScalar(2)

				// const eDiff = eCurrentPositionCentered.clone().sub(this.player.controller.target.position) // Distance from CENTER
				// const characterNearMiddle = Math.abs(eDiff.x) < 1 && Math.abs(eDiff.z) < 1
				// log.info('characterNearMiddle', characterNearMiddle, eDiff)
				// There's some interaction with turning fast and `if(characterNearMiddle)`.  Might be related to head rotation setting; putting it first changed things.  But might be something else.
				// So just leave that off for now.
				const characterNearMiddle = true

				if (characterNearMiddle) {
					const _Q = new Quaternion()
					const _A = new Vector3()
					const _R = this.playerSelf.controller.idealTargetQuaternion.clone()

					_A.set(0, this.mouse.accumx > 0 ? -1 : 1, 0)
					_Q.setFromAxisAngle(_A, MathUtils.degToRad(45))
					_R.multiply(_Q)
					this.playerSelf.controller.setRotation(_R)

					log.info('InputSys: call controller.setRotation')

					// After character snap rotate, bring head (camera) back to roughly where it was before (2.2 magic number)
					this.mouse.accumx = -this.mouseAccumThreshold * (2.2 / 3) * Math.sign(this.mouse.accumx)
				}

			}

		}

		// Keep head rotation going even when menu is not visible, but it has to be placed here
		// The reason for doing head rotation is to visually indicate to the player when their character is about to turn
		this.playerSelf.controller.setHeadRotationX((this.mouse.accumx / this.mouseAccumThreshold) / 100 * this.headTurnMaxDegrees)

		// Vertical mouse look
		if (!this.topMenuVisibleLocal && this.mouse.right) {
			// log('dz', this.mouse.dy)

			// const _Q = new Quaternion()
			// const _A = new Vector3()
			// const _R = this.babs.cameraSys.camera.quaternion.clone()
			// // Naive version
			// _A.set(1, 0, 1) //this.mouse.dy > 0 ? -1 : 1
			// _Q.setFromAxisAngle(_A, Math.PI * dt * this.player.controller.rotationSpeed)
			// _R.multiply(_Q)
			// this.babs.camera.quaternion.setRotation(_R)

			// const minPolarAngle = 0; // radians
			// const maxPolarAngle = Math.PI; // radians

			// From PointerLockControls
			// const _euler = new Euler( 0, 0, 0, 'YXZ' )
			// _euler.setFromQuaternion( this.babs.camera.quaternion )
			// _euler.y -= mouse.dx * 0.002
			// _euler.x -= mouse.dy * 0.002
			// _euler.x = Math.max( _PI_2 - scope.maxPolarAngle, Math.min( _PI_2 - scope.minPolarAngle, _euler.x ) )
			// this.babs.camera.quaternion.setFromEuler( _euler )

			// This kinda works but maybe let's not even have this?
			// Might need it for mountains, later.

			// const gh = this.babs.worldSys.vRayGroundHeight(Math.round(idealOffset.x/4), Math.round(idealOffset.z/4))
			// idealOffset.setY(Math.max(idealOffset.y, gh.y +4))
			// if(this.babs.cameraSys.gh.y > groundBelowCamera)

			// if (this.mouse.dy > 0 || !this.babs.cameraSys.gh || this.babs.cameraSys.idealOffset?.y > this.babs.cameraSys.gh?.y + 4) {
			// Only increase offsetHeight if camera is above ground, or moving camera up
			this.babs.cameraSys.offsetHeight += this.mouse.dy * 0.05
			// }
			// Above is matched to touchpad similar code
		}

		// Handle arrow keys turns // Move above keys with mouse stuff?
		if (!this.topMenuVisibleLocal && (this.keys.left || this.keys.right)) {
			if (!this.arrowHoldStartTime || Date.now() - this.arrowHoldStartTime > this.doubleClickMs) {
				this.arrowHoldStartTime = Date.now()

				// Rotate player
				const _Q = new Quaternion()
				const _A = new Vector3()
				const _R = this.playerSelf.controller.idealTargetQuaternion.clone()

				// Naive version
				_A.set(0, this.keys.right ? -1 : 1, 0)
				// _Q.setFromAxisAngle(_A, Math.PI * dt * this.player.controller.rotationSpeed)
				_Q.setFromAxisAngle(_A, MathUtils.degToRad(45))
				_R.multiply(_Q)
				this.playerSelf.controller.setRotation(_R)
			}
		}

		// Runs every frame, selecting grid position for setDestination
		if ((this.movelock || this.touchmove ||
			(!this.topMenuVisibleLocal &&
				((this.mouse.right && (this.keys.w || this.keys.s || this.mouse.left)) //  || this.keys.a || this.keys.d
					|| this.keys.up || this.keys.down
					|| this.movelock

				)
			)
			&& !this.playerSelf.controller.selfZoningWait // Except while waiting for zonein.  Then it doesn't run.  :p
		)) {
			
			log.info(this.keys.w ? 'w' : '-', this.keys.s ? 's' : '-', this.keys.a ? 'a' : '-', this.keys.d ? 'd' : '-')

			let tempMatrix = new Matrix4().makeRotationFromQuaternion(this.playerSelf.controller.idealTargetQuaternion)
			let vector = new Vector3().setFromMatrixColumn(tempMatrix, 0)  // get X column of matrix
			// log.info('vector!', tempMatrix, vector)

			if (this.keys.w || this.keys.up || this.mouse.left || this.keys.s || this.keys.down || this.movelock || this.touchmove) {
				vector.crossVectors(this.playerSelf.controller.target.up, vector) // camera.up
			}

			// Get direction
			vector.round()
			if (this.keys.w || this.keys.up || this.mouse.left || this.movelock || this.touchmove === 1 || this.touchmove === 'auto') {
				vector.negate() // Why is negate needed?
			}

			// Okay, that was direction.  Now get distance
			let gCurrentPos = this.playerSelf.controller.target.position.clone()
			const gCurrentPosDivided = gCurrentPos.clone().multiplyScalar(1 / 4)
			const gCurrentPosFloored = gCurrentPosDivided.clone().floor()
			log.info('InputSys: update, gCurrentPos', `(${gCurrentPos.x.toFixed(2)}, ${gCurrentPos.z.toFixed(2)}) ~ (${gCurrentPosDivided.x.toFixed(2)}, ${gCurrentPosDivided.z.toFixed(2)}) ~ (${gCurrentPosFloored.x.toFixed(2)}, ${gCurrentPosFloored.z.toFixed(2)})`)

			gCurrentPos = gCurrentPosFloored
			gCurrentPos.setY(0) // Y needs a lot of work in this area...(8 months later: or does it? :D)

			const dest = gCurrentPos.clone().add(vector)
			// dest.clamp(WorldSys.ZoneTerrainMin, WorldSys.ZoneTerrainMax)

			// Send to controller
			log.info('InputSys: call controller.setDestination()', dest)
			this.playerSelf.controller.setDestination(dest, this.runmode ? 'run' : 'walk') // Must round floats

			// Let's show a square in front of the player?  Their destination target square :)
			if (this.babs.debugMode) {
				if (!this.displayDestinationMesh) {
					const geometry = new PlaneGeometry(4, 4)
					const material = new MeshBasicMaterial({ color: 0xffaaaa, side: DoubleSide })
					geometry.rotateX(- Math.PI / 2) // Make the plane horizontal
					this.displayDestinationMesh = new Mesh(geometry, material)
					this.displayDestinationMesh.name = 'destinationmesh'
					scene.add(this.displayDestinationMesh)
				}
				this.displayDestinationMesh.position.copy(dest).multiplyScalar(4).addScalar(2)
				const easyRaiseAbove = 0.1
				this.displayDestinationMesh.position.add(new Vector3(0, this.playerSelf.controller.target.position.y - 2 + easyRaiseAbove, 0))
			}
			else {
				this.displayDestinationMesh?.position.setY(-1000)
			}
		}


		// Decay some stuff down over time
		[this.mouse.scrollaccumy, this.mouse.zoom] = new Vector2(this.mouse.scrollaccumy, this.mouse.zoom)
			.lerp(new Vector2(0, 0), dt)
			.toArray()

		// Reset per-frame deltas
		this.mouse.dx = this.mouse.dy = 0
		this.mouse.scrolldx = this.mouse.scrolldy = 0

		// Track double click timing
		if (this.mouse.ldouble !== false && Date.now() - this.mouse.ldouble > this.doubleClickMs) {
			this.mouse.ldouble = false
		}

		// Move PRESS states into ON states, and LIFT into OFF
		for (const key in this.keys) { // Update key states after press/lift
			if (this.keys[key] === PRESS) this.keys[key] = ON
			else if (this.keys[key] === LIFT) this.keys[key] = OFF
		}
	}


	setMouseDevice(newDevice) {
		if (newDevice === 'fingers') { // Exception hax, show more screen on mobile devices
			if (window.innerWidth < 1000) { // Small screen, like a phone, smaller than ipad
				document.getElementById('Journal').style.display = 'none'
				dividerOffset.set(5)
			}
		}

		if (this.mouse.device === newDevice) return // Only detect new device if device is changing

		log('Device detected: ', newDevice)
		// Device has changed.


		if (this.mouse.device === 'mouse') { // Switching away from mouse
			this.movelock = false // Stop mouse autorun

		}
		else if (this.mouse.device === 'touchpad') { // If switching away from touch
			// disable touchmove. Otherwise there's no way to stop moving hah!
			this.touchmove = 0
		}

		this.babs.socketSys.send({
			savemousedevice: newDevice,
		})

		this.mouse.device = newDevice
		settings.set({
			...svelteGet(settings),
			inputdevice: this.mouse.device,
		})
	}

	isAskingTarget = false
	askTargetSourceWob :FastWob
	askTarget(fwob :FastWob) {
		this.askTargetSourceWob = fwob
		this.isAskingTarget = true
		document.body.style.cursor = `url(${this.babs.urlFiles}/icon/cursor-aim.png) ${32/2} ${32/2}, auto`
		this.babs.uiSys.playerSaid(this.babs.idSelf, `What would you like to use this ${fwob.name} on?`, {journal: false, color: '#cccccc', italics: true})
	}


}
