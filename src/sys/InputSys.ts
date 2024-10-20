/* eslint-disable no-mixed-spaces-and-tabs */
import { Box2, BufferGeometry, Camera, Color, InstancedMesh, Line, LineBasicMaterial, Material, PerspectiveCamera, Quaternion, Raycaster, SkinnedMesh, Vector3, Object3D, ArrowHelper, MeshStandardMaterial, Euler } from 'three'
import { Wob, type FeObject3D } from '@/ent/Wob'
import { isAwayUiDisplayed, rightMouseDown, debugMode, settings } from '../stores'
import { get as svelteGet } from 'svelte/store'

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
import { type WobId, SharedWob, type RotationCardinal, ImpossibleWeight } from '@/shared/SharedWob'
import type { InstancedWobs } from '@/ent/InstancedWobs'
import { Text as TroikaText } from 'troika-three-text'
import * as KeyCode from 'keycode-js'
import { CameraSys } from './CameraSys'
import { InstancedSkinnedMesh } from '@/ent/InstancedSkinnedMesh'
import { degToRad, radToDeg } from 'three/src/math/MathUtils.js'
import { coordToIndex } from '@/shared/consts'


// import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh' // bvh
// BufferGeometry.prototype.computeBoundsTree = computeBoundsTree // bvh
// BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree // bvh
// Mesh.prototype.raycast = acceleratedRaycast // bvh
// ^ Unfortunately is slower due to the simplicity of my meshes.

// Stateful tracking of inputs
// 0=up(lifted), false=off, 1=down(pressed), true=on, 
const LIFT = 0
const OFF = false
const PRESS = 1
const ON = true

const MOUSE_LEFT_CODE = 0
const MOUSE_RIGHT_CODE = 2

const DEBUG_LOGGING = false

type PickedType = 'wob' | 'player' | 'land'
type PickedObject = { // Note that um sometimes a SkinnedMesh gets forced onto this :-P
	poid :string|object|number,
	pickedType :PickedType,
	feim? :InstancedWobs,
	instancedBpid? :string,
	// instancedIndex? :number,
	// instancedPosition? :Vector3,
	yardCoord? :YardCoord,
	material? :Material|MeshStandardMaterial,
	type? :string,
	parent? :Object3D,
	savedEmissiveColor? :any,
	poHoverTime? :number,
	poMousedownTime? :number, // po prefix because these go onto a SkinnedMesh :S
	landcoverString? :string,
	landPoint? :Vector3,
	rotationCardinal? :RotationCardinal,
}

export class InputSys {

	static NickPromptStart = '>> Enter new name for'

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
		// fingerlastx: 0,
		// fingerlasty: 0,
		// finger2downstart: 0,

		ray: new Raycaster(new Vector3(), new Vector3(), 0, WorldSys.Acre),
		xy: new Vector2(0, 0),

		movetarget: undefined,

		insidewindow: null,

	}
	keyboard :{[key:string]:boolean|number} = {
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
	autorun = false // Autorun
	touchmove :boolean|number|'auto' = 0 // Touchpad movement gesture state. -1 (back), 0 (stop), 1 (forward), 'auto' (autorun)
	runmode = true // Run mode, as opposed to walk mode
	topMenuVisibleLocal
	recheckMouseIntersects = false
	runmult = 1

	isAfk = false
	babs :Babs
	playerSelf :Player
	canvas :HTMLElement

	mediaStream :MediaStream
	mediaStreamStartTime :number
	mediaRecorder :MediaRecorder
	mediaMimeType :string
	recordedChunks :Blob[] = []
	mediaHasListener = false

	activityTimestamp :number

	customcursor :HTMLElement
	chatbox :HTMLElement
	chatboxOpen :boolean = false
	nickTargetId :number

	isPointerLocked = false
	usePermanentPointerLock = false

	constructor(babs :Babs, player :Player, mousedevice) {
		this.babs = babs
		this.playerSelf = player
		this.canvas = document.getElementById('canvas')

		this.setMouseDevice(mousedevice || 'undetermined') 
		// ^^ Default to mouse; because touchpad user has to figure out two finger touch either way.

		this.customcursor = document.getElementById('customcursor')

		document.addEventListener('pointerlockchange', (ev) => {
			this.recheckMouseIntersects = true
			if(DEBUG_LOGGING) console.debug('pointerlockchange', ev)
			if (document.pointerLockElement) {
				this.isPointerLocked = true
				if(DEBUG_LOGGING) console.debug('PointerLock: locked')
				if(this.usePermanentPointerLock) {
					this.customcursor.style.display = 'block'
					this.customcursor.style.transform = `translate(${this.mouse.x}px, ${this.mouse.y}px)`
				}
			} else {
				this.isPointerLocked = false
				if(DEBUG_LOGGING) console.debug('PointerLock: unlocked')
				if(this.usePermanentPointerLock) {
					this.customcursor.style.display = 'none'
					this.babs.uiSys.awayGame() // We might not get esc key event?  Also makes it clearer they're out.
				}
			}
		}, false)
		document.documentElement.addEventListener('mouseleave', (ev) => {
			if(DEBUG_LOGGING) console.debug('mouseleave')
			this.mouse.insidewindow = false
			this.raycastSetPickedObject(false, 'forceUnpick') // Force to unpick object, so it doesn't stay highlighted and tag
			if(this.pickedObject) {
				this.pickedObject.poHoverTime = null // A bit hax; prevents long hover tag on mouse exiting screen above picked
			}
		})
		document.documentElement.addEventListener('mouseenter', (ev) => {
			if(DEBUG_LOGGING) console.debug('mouseenter')
			this.mouse.insidewindow = true
		})

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


		this.chatbox = document.getElementById('chatbox')
		
		// start/open chatbox on everything except lower alpha keys or space
		// const chatboxStartValues = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./'.split('') 
		// const chatableValues = chatboxStartValues.concat(' abcdefghijklmnopqrstuvwxyz'.split('')) // ASCII ev.key values
		// start/open chatbox on everything except wasd or space
		const chatboxStartValues = 'ABCDEFGHIJKLMNOPQRSTUVWXYZbcefghijklmnopqrtuvxyz1234567890!@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./'.split('') 
		const chatableValues = chatboxStartValues.concat(' wasd'.split('')) // ASCII ev.key values

		document.addEventListener('keydown', async ev => {
			this.activityTimestamp = Date.now()
			if(DEBUG_LOGGING) console.debug('keydown:', ev.key, ev.code, ev.repeat)
			// OS-level key repeat keeps sending down events; 
			if (!this.chatboxOpen && !ev.repeat) { // stop that from turning into presses
				this.keyboard[inputCodeMap[ev.code]] = PRESS
			}
			// console.log('keyboard codes', Object.entries(this.keyboard).filter(([k, v]) => v).map(([k, v]) => `${k}: ${v}`))

			// We probably need to use a mixture of ev.code (keyboard-key/OS based) and ev.key (output/browser based)
			// For .key: https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
			// For .code: https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
			// Also I have no idea how mobile/iOS works for this, but I assume .key will be safer.
			// 	It does seem to worry pretty well on mobile!

			// Perhaps let's try using .key primarily.

			if(chatboxStartValues.includes(ev.key)
				&& !(ev.ctrlKey || ev.metaKey || ev.altKey) // Not a command of any kind
			) { // Goes last so ctrl+letters are caught first
				this.chatboxOpen = true // Needed to allow letter to be captured
				// this.chatbox.style.display = 'block' // Not needed, will happen on chatboxSetContent()
				// this.chatbox.focus() // I'm going to try doing this without focus.  Because managing focus seems worse.
			}

			if((ev.ctrlKey || ev.metaKey) && ev.key === 'v') { // Paste (even with chat closed)
				const text = await navigator.clipboard.readText()
				this.chatboxSetContent(this.chatbox.textContent + text)
				ev.stopPropagation()
			}
			
			if(this.chatboxOpen) {

				// Force movement keys not to activate when first opening chat (eg typing 'What?')
				this.keyboard.w = null
				this.keyboard.a = null
				this.keyboard.s = null
				this.keyboard.d = null

				if(chatableValues.includes(ev.key) // Text input
					&& !(ev.ctrlKey || ev.metaKey || ev.altKey) // Not a command of any kind
				) {
					// if(!this.mediaStream) { // Don't put spaces in chat while doing audio
					// Workaround is just using trimming

					this.chatboxSetContent(this.chatbox.textContent + ev.key)
				}
				else if(ev.key === KeyCode.VALUE_ESCAPE) {
					this.chatboxSetContent('')
					ev.stopPropagation()
				}
				else if((ev.ctrlKey || ev.metaKey) && ev.key === 'x') { // Cut (meta is cmd on mac, win on windows)
					navigator.clipboard.writeText(this.chatbox.textContent)

					this.chatboxSetContent('')
					ev.stopPropagation()
				}
				else if((ev.ctrlKey || ev.metaKey) && ev.key === 'c') { // Copy (meta is cmd on mac, win on windows)
					navigator.clipboard.writeText(this.chatbox.textContent)
					ev.stopPropagation()
				}
				else if(ev.key === KeyCode.VALUE_BACK_SPACE) {
					// If control (Windows) or option (Mac) is held, delete whole word
					if(ev.ctrlKey || ev.altKey) { // Todo make this per-OS?
						// Backspace whole word
						// Find last character that is not space
						this.chatbox.textContent = this.chatbox.textContent.trim() // Remove any trailing spaces first
						let lastSpaceIndex = this.chatbox.textContent.lastIndexOf(' ') // Find previous word
						if(lastSpaceIndex === -1) lastSpaceIndex = 0
						const lastpart = this.chatbox.textContent.slice(0, lastSpaceIndex).trim()
						this.chatboxSetContent(lastpart ? lastpart+' ' : '') 
						// ^ hax, in reality MacOS leaves any remaining whitespace
						
					}
					else { // Backspace single character

						this.chatboxSetContent(this.chatbox.textContent.slice(0, -1))
					}
				}
				else if(ev.key === KeyCode.VALUE_ENTER) {
					// Send chat
					if(this.chatbox.textContent) { // Only send if there's content
						if(this.chatbox.textContent.startsWith(InputSys.NickPromptStart)) { // Naming someone
							const nickparts = this.chatbox.textContent.split(':')
							nickparts.shift() // Remove and discard prefix
							this.babs.socketSys.send({
								savenick: {
									idplayer: this.nickTargetId,
									nick: nickparts.join(':').trim(),
								},
							})
						}
						else { // Regular chat
							this.babs.socketSys.send({
								chat: {
									text: this.chatbox.textContent,
								},
							})
						}

						this.chatboxSetContent('')
					}
				}
			}
			else { // !this.chatboxOpen
				if(ev.ctrlKey && ev.key === 'j') {
					this.babs.uiSys.svJournal.toggleFurl()
					ev.preventDefault()
				}
				if(ev.ctrlKey && ev.key === 'g') {
					this.runmult = this.runmult === 1 ? 6 : 1
					ev.preventDefault()
				}
				if(ev.key === KeyCode.VALUE_ESCAPE) {
					if(!this.babs.uiSys.isGameAway) {
						this.babs.uiSys.awayGame()
					}
				}
			}


			if(this.characterControlMode) {
				if(this.mouse.right) {
					// Jump on spacebar if mouse right held
					// if (this.keys.space === PRESS) {
					// 	this.playerSelf.controller.jump(Controller.JUMP_HEIGHT)
					// }

					// ev.stopImmediatePropagation() // Doesn't work to prevent Ctext.svelte chatbox from receiving this event
				}

				// If arrows are used for movement, it breaks out of autorun or touchmove
				if (this.keyboard.up === PRESS || this.keyboard.down === PRESS
					|| this.keyboard.w === PRESS || this.keyboard.s === PRESS) {
					this.autorun = false
					this.touchmove = false
				}

			}

			// Commands, for testing
			if (this.keyboard.cleft || this.keyboard.cright) {

				if (this.keyboard.f === PRESS) {
					Wob.InstancedWobs.forEach((feim, bpid) => {
					})
					console.log(this.babs.renderSys.renderer.info.render.triangles.toLocaleString())
				}
				
				// if (this.keyboard.g === PRESS) {
				// 	// Output player controller mesh debug information
				// 	console.log(this.playerSelf.controller.playerRig)
				// }

				if (this.keyboard.l === PRESS) {
					Wob.InstancedWobs.forEach((feim, bpid) => {
						if(bpid == 'sneezeweed') {
							console.log('sneezeweed feim.getLoadedCount() (reallocateLargerBuffer COUNTS)', feim.getLoadedCount())
						}
					})
				}

				// Instant Forest
				if (this.keyboard.o === PRESS) {
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
					console.log('Created '+count+' client side items')

					console.time('all')
					const res = await Wob.LoadInstancedWobs (wobTrees, this.babs, false)
					console.timeEnd('all')
					console.log('res', res)

				}
				if (this.keyboard.y === PRESS) {

					function countTrianglesInGeometry(geometry) {
						if (geometry.index) {
							return geometry.index.count / 3
						} else {
							return geometry.attributes.position.count / 3
						}
					}

					function findInstancedMeshesAndTriangleCounts(object) {
						const instancedMeshes = []

						object.traverse((child) => {
							if (child instanceof InstancedMesh) {
								const triangleCount = countTrianglesInGeometry(child.geometry) * child.count
								instancedMeshes.push({
									mesh: child,
									triangleCount: triangleCount,
									trisPer: countTrianglesInGeometry(child.geometry),
									countOf: child.count,
								})
							}
						})

						return instancedMeshes
					}

					function sortInstancedMeshesByTriangleCount(instancedMeshes) {
						return instancedMeshes.sort((a, b) => b.triangleCount - a.triangleCount)
					}

					// Usage
					const instancedMeshesAndTriangleCounts = findInstancedMeshesAndTriangleCounts(this.babs.scene)
					const sortedInstancedMeshes = sortInstancedMeshesByTriangleCount(instancedMeshesAndTriangleCounts)

					console.log('total tris, blueprint, (tris per * number of):')
					const out = sortedInstancedMeshes.map(im => `${im.triangleCount}, ${im.mesh.name}, (${im.trisPer} * ${im.countOf})\n`)
					console.log(out.join(''))

				}

				{
					// List all materials in scene
					// const materials = new Set()
					// const scene = this.babs.scene
					// scene.traverse( function( object :any ) {
					// 	if ( object.material ) materials.add( object.material );
					// })
					// console.log(materials)

					// List all InstancedMesh in scene
					// const ims = new Set()
					// const scene = this.babs.scene
					// scene.traverse( function( object :any ) {
					// 	if ( object instanceof InstancedMesh ) ims.add( object )
					// })
					// console.log(ims)

				}



			}


		})

		document.addEventListener('keyup', ev => {
			this.keyboard[inputCodeMap[ev.code]] = LIFT
		})

		/*
			When alt tabbing, meta (cmd) key was staying stuck down since the windows in the bakcground
			and never receiving a keyup.
			Solution: When window blurs, let's set all keys to off
		*/
		window.addEventListener('blur', () => {
			this.keyboard.cleft = LIFT
			this.keyboard.cright = LIFT
			this.keyboard.aleft = LIFT
			this.keyboard.aright = LIFT
			this.keyboard.mleft = LIFT
			this.keyboard.mright = LIFT
		})

		// document.addEventListener( 'click', mouseOnClick )
		// No 'click' handling; we do it manually via mousedown/mouseup for more control

		// document.addEventListener("visibilitychange", (ev) => {
		// 	console.log('vis change', ev)
		// })
		// This fails to detect window switches, and we don't want window switch auto-afk anyway

		const touchHandler = (ev) => {
			console.log('touchhandler')
			this.setMouseDevice('fingers')  // Only finger devices should flame these touch events

			// this.babs.uiSys.aboveHeadChat(this.playerSelf.id, 'touchHandler: ' + ev.target?.id + ', '+ev.type)
			
			if(ev.target?.id === 'canvas') { // Only on canvas, to allow clicking on html (this was done for the Quest 2 so you could tap login)
				ev.preventDefault() // Prevent text selection over entire thing (iOS on long press)
			}

			// Since we switched from pointerdown back to mousedown, these may be necessary?  No, instead we'll handle it using pointerdown since the event is more similar and easier to pass on.
		}
		document.addEventListener('touchstart', touchHandler, {passive:false})
		document.addEventListener('touchmove', touchHandler, {passive:false})
		document.addEventListener('touchend', touchHandler, {passive:false})
		document.addEventListener('touchcancel', touchHandler, {passive:false})

		// this.lastMoveHoldPicked
		interface FePointerEvent extends PointerEvent { 
			target: HTMLElement,
			webkitForce?: number,
		}
		document.addEventListener('pointermove', async (e :PointerEvent) => {
			const ev = e as FePointerEvent
			// console.log('pointermove', ev.pointerId, ev.pointerType, ev.target.id, ev.clientX, ev.movementX, this.mouse.dx)
			
			// this.babs.uiSys.aboveHeadChat(this.playerSelf.id, 'pointermove: ' + ev.pointerType + ', '+this.mouse.device+', '+this.mouse.right+', '+this.mouse.left)

			this.recheckMouseIntersects = true
			

			e.stopPropagation() // Speed up event handling, especially around css fake cursor `customcursor`

			if(ev.pointerType === 'touch') {
				this.setMouseDevice('fingers')
				// this.babs.uiSys.aboveHeadChat(this.playerSelf.id, 'pmt ' + ev.movementX + ', '+this.mouse.right)
			}
			else if(ev.webkitForce > 1) { // (On Chrome, it's undefined.)  For a non-touchpad mouse click, it's exactly 1 for down, 0 for up/move.  Anything >1 indicates a force touchpad.
				// console.log('pointermove ev.webkitForce', ev.webkitForce)
				this.setMouseDevice('touchpad')
			}

			this.mouse.movetarget = ev.target
			this.activityTimestamp = Date.now()

			// Note I get MULTIPLE pointermove calls of this func in between a single update frame!
			// Thus, setting this.mouse.dy =, doesn't work as it loses ones in between frames.
			// Instead, I should either do accumx here, or sum the deltas here instead of add, then wipe them at update.
			// Done.  What I notice is, with devtools open, events come in a lot faster than updates() (RAFs)
			// 2 years later, ohhh it's this: https://nolanlawson.com/2019/08/11/high-performance-input-handling-on-the-web/
			// In Chrome, pointermove is actually supposed to align/throttle to requestAnimationFrame automatically, but there is a bug where it behaves differently with Dev Tools open.
			// https://bugs.chromium.org/p/chromium/issues/detail?id=992954

			// Mouse movement since last frame (including during pointerlock)
			// These are set by browser during real mouse move, but not by touchpad or touch events.
			// Touchpad instead uses .onwheel for gestures.
			// Doing this solves the above multiple events issues for my uses:
			if(this.mouse.right) {
				this.mouse.dx += ev.movementX || 0
				this.mouse.dy += ev.movementY || 0
			}
			else {
				this.mouse.dx = ev.movementX || 0
				this.mouse.dy = ev.movementY || 0
			}
			
			// https://stackoverflow.com/questions/6073505/
			// (most useful) client is visible part of the page
			// offset is relative to parent container (useful if no weird parent offset)
			// page is relative without considering scrolling
			// (not useful) screen includes window position on monitor

			// Mouse position (unchanging during pointer lock or gestures)
			// 'offsetX' means offset from screen origin, not offset from last event/frame
			this.mouse.x = ev.clientX// || ev.mozOffsetX || ev.webkitOffsetX || 0
			this.mouse.y = ev.clientY// || ev.mozOffsetY || ev.webkitOffsetY || 0
			// Actually, offsetX is based on current div!  So for canvas it applies to game, but for bag it applies to bag child!

			if(this.usePermanentPointerLock && this.isPointerLocked && !this.mouse.right) {
				const [xOldPos, yOldPos] = this.customcursor.style.transform.replace('translate(', '').split(', ').map(s => parseInt(s))
				// console.log('OldPos', xOldPos, yOldPos)

				this.mouse.x = xOldPos +this.mouse.dx
				this.mouse.y = yOldPos +this.mouse.dy

				// Release mouse if it goes well outside the window
				const margin = parseInt(this.canvas.style.width) *0.10
				if(this.mouse.x < 0 -margin || this.mouse.x > window.innerWidth +margin || this.mouse.y < 0 -margin || this.mouse.y > window.innerHeight +margin) {
					document.exitPointerLock()
				}

				// Speedy update of fake cursor
				// https://www.paulirish.com/2012/why-moving-elements-with-translate-is-better-than-posabs-topleft/
				// https://stackoverflow.com/questions/16868122/mousemove-very-laggy
				this.customcursor.style.transform = `translate(${this.mouse.x}px, ${this.mouse.y}px)`
			}

			// From threejs: calculate mouse position in normalized device coordinates.  (-1 to +1) for both coords.  One use is during raycast.
			// Is all this really necessary?
			this.mouse.xy.x = (this.mouse.x / parseInt(this.canvas.style.width)) * 2 - 1
			this.mouse.xy.y = - (this.mouse.y / parseInt(this.canvas.style.height)) * 2 + 1

		})

		// document.addEventListener('webkitmouseforcewillbegin', (ev) => { // Safari only; not useful, just 1
		// 	console.log('webkitmouseforcewillbegin', ev.webkitForce)
		// 	this.setMouseDevice('touchpad')
		// })
		document.addEventListener('webkitmouseforcechanged', (e) => { // Safari only
			const ev = e as FePointerEvent
			// console.log('webkitmouseforcechanged', ev.webkitForce)
			if(ev.webkitForce > 1) { // Safari only 
				// console.log('ev.webkitForce', ev.webkitForce)
				this.setMouseDevice('touchpad')
			}
		})

		const buttonDownHandler = (e) => {
			const ev = e as FePointerEvent
			if(DEBUG_LOGGING) console.debug('buttonDownHandler')
			// this.babs.uiSys.aboveHeadChat(this.playerSelf.id, 'bdown ' + ev.button + ', '+ev.target?.id)

			if(ev.webkitForce > 1) { // Safari only
				// console.log('ev.webkitForce', ev.webkitForce)
				this.setMouseDevice('touchpad')
			}

			// Set mouse position; copied from 'pointermove':
			if(this.usePermanentPointerLock && this.isPointerLocked && !this.mouse.right) { // pointerlocked
				const [xOldPos, yOldPos] = this.customcursor.style.transform.replace('translate(', '').split(', ').map(s => parseInt(s))
				this.mouse.x = xOldPos +this.mouse.dx
				this.mouse.y = yOldPos +this.mouse.dy
			}
			else { // Non pointerlocked
				this.mouse.x = ev.clientX
				this.mouse.y = ev.clientY
			}
			this.mouse.xy.x = (this.mouse.x / parseInt(this.canvas.style.width)) * 2 - 1
			this.mouse.xy.y = - (this.mouse.y / parseInt(this.canvas.style.height)) * 2 + 1

			if (ev.target.id === 'canvas' || ev.target === null || ev.target === document.body) {
				this.characterControlMode = true

				if (ev.button === MOUSE_LEFT_CODE) {
					this.mouse.left = PRESS


					if (this.mouse.right) {
						// Modern touchpads don't have both buttons to click at once; so this must be a mouse
						this.setMouseDevice('mouse')

						// Turn off autorun if hitting left (while right) after a delay
						if(this.autorun && Date.now() - this.mouse.ldouble > this.doubleClickMs) {
							this.autorun = false
						}
					}
					else { // Normal left click on canvas

						if(!this.babs.uiSys.isGameAway) {
							this.raycastSetPickedObject() // Needed for fingers	on press
							// this.babs.uiSys.aboveHeadChat(this.playerSelf.id, 'mousedown '+ ev.button +', '+ ev.target.id +', '+ this.pickedObject?.poid)
	
	
							// Single click
							if (this.mouse.ldouble === false) { // First click
								if(this.isAskingTarget) { // In target selection mode
									// todo make work for non-instanced things, and ground, players, etc.
									const coord = this.pickedObject?.yardCoord
									if(!coord) {
										this.babs.uiSys.aboveHeadChat(this.babs.idSelf, '<<no effect>')
									}
									else {
										const wob = coord.zone.getWob(coord.x, coord.z)
										if(!wob) {
											this.babs.uiSys.aboveHeadChat(this.babs.idSelf, '<<no such target>>')
										}
										else {
											this.babs.socketSys.send({
												action: {
													verb: 'used',
													noun: this.askTargetSourceWob?.idObj(),
													data: {
														target: wob.idObj(),
													},
												}
											})
										}
										document.body.style.cursor = 'auto'
										this.isAskingTarget = false
										this.askTargetSourceWob = null
									}
	
	
								}
								else { // First click (and not in target selection mode)
									
									if(this.pickedObject) {
										this.mousedownPickedObject = this.pickedObject
										this.mousedownPickedObject.poMousedownTime = Date.now()
										// this.babs.uiSys.aboveHeadChat(this.playerSelf.id, 'mousedown pickedObject ' + this.mousedownPickedObject.poid)
	
									}
			
									this.mouse.ldouble = Date.now()
								}
	
							} // Double click
							else if (Date.now() - this.mouse.ldouble <= this.doubleClickMs) { // Double click within time
								this.mouse.ldouble = 0

								console.log('Double click on ', this.pickedObject)

								if (this.pickedObject?.pickedType === 'player') {
									console.log('player double click', this.pickedObject, this.pickedObject.parent.parent)
									const pickedPlayer = this.babs.ents.get((this.pickedObject.parent.parent as FeObject3D).idplayer) as Player
									// this.nickTargetId = pickedPlayer.id
									// Double click hack; remove naming text
									if(this.chatbox.textContent.startsWith(InputSys.NickPromptStart)){
										this.chatboxSetContent('')
									}
									
									// Start following
									this.babs.inputSys.playerSelf.controller.selfFollowTargetId = pickedPlayer.id
									// Say above head that we're following them
									this.babs.uiSys.aboveHeadChat(this.playerSelf.id, `~ you are following ${pickedPlayer.nick} ~`)
								} 
								
							}
						}
						
						this.babs.uiSys.leftClickCanvas(ev)

						
						
					}

				}

				if (ev.button === MOUSE_RIGHT_CODE) {
					this.mouse.right = PRESS

					rightMouseDown.set(true)

					if (this.mouse.left) {
						// Modern touchpads don't have both buttons to click at once; it's a mouse
						this.setMouseDevice('mouse')
						
						// Right+left mouse during autorun, stops movement
						if(this.autorun) {
							this.autorun = false
						}
					}
					else { // Normal right click on canvas

						if(this.babs.renderSys.documentHasFocus) { // Only counts if window has focus
							this.babs.uiSys.rightClickCanvas(ev)
						}
					}


					if (this.mouse.device === 'touchpad') {
						// Two-finger click on touchpad toggles touchmove (similar to autorun)
						if (this.touchmove === 0) {
							this.touchmove = 'auto'
						}
						else {
							this.touchmove = 0
							this.mouse.scrollaccumy = 0
						}
					}

					if(this.mouse.device === 'mouse') {
						if(this.babs.renderSys.documentHasFocus) { // Only counts if window has focus
							// console.log('trying quick mouse lock')
							document.body.requestPointerLock()
						}
					}
				}

				// Middle mouse toggles autorun
				if (ev.button == 1 || ev.button == 4) {
					// PS it's a mouse
					this.setMouseDevice('mouse')
					this.mouse.middle = PRESS
					this.autorun = !this.autorun
				}

			}
			else { // Click is on HTML I guess
				if (ev.button === MOUSE_LEFT_CODE) {
					this.babs.uiSys.leftClickHtml(ev)
				}
			}


		}
		document.addEventListener('pointerdown', (e) => { // Note, standard probably says this gets flamed before mousedown :)
			if(e.pointerType === 'touch') {
				this.setMouseDevice('fingers')
				buttonDownHandler(e)
			}
		})
		// Well, pointerdown doesn't flame on multiple mouse buttons *rolleyes* so it's not really equivalent to mousedown.
		// I see why they do it but I need those mouse buttons unless I want to track that all in the pointer event.
		// How else can I know a second button is down, except by looking at mousedown itself?
		document.addEventListener('mousedown', buttonDownHandler)

		const buttonUpHandler = (ev) => {
			if(DEBUG_LOGGING) console.debug('buttonUpHandler')
			// this.recheckMouseIntersects = true // Especially needed for fingers.  Here too on up?
			
			if (ev.button === MOUSE_LEFT_CODE) {
				this.mouse.left = LIFT

				// Handle carry drop
				if (this.liftedObject) { // set in update

					console.debug('carry drop', this.mouse.movetarget, this.liftedObject, this.pickedObject)
					// if (this.mouse.movetarget?.parentElement?.id === `container-for-${this.babs.idSelf}`
					// 	&& this.mouse.movetarget.classList.contains('container-body') // Is body of bag, not title etc
					// ) { // UI main bag
					// 	console.log('Main bag drop', this.mouse.movetarget)
					// 	const point = new Vector3(this.mouse.x, 0, this.mouse.y)
					// 	// @ts-ignore
					// 	const wob = this.babs.ents.get(this.liftedObject.id) || Utils.findWobByInstance(this.babs.ents, this.liftedObject.instancedIndex, this.liftedObject.instancedName)
					// 	console.debug('Found', wob, this.liftedObject)
					// 	this.babs.socketSys.send({
					// 		action: {
					// 			verb: 'contained',
					// 			noun: wob.id,
					// 			data: {
					// 				point,
					// 				container: this.babs.idSelf,
					// 			},
					// 		}
					// 	})

					// }
					// else 

					const coordSource = this.liftedObject.yardCoord
					const wobSource = coordSource.zone.getWob(coordSource.x, coordSource.z)
					
					if(wobSource) { // In case source has changed since pickup // Todo check that it's the same by id?
						if (this.pickedObject?.pickedType === 'land'
							|| this.pickedObject?.pickedType === 'wob'
						) {
							if(this.pickedObject?.pickedType === 'land') {
								console.debug('dropped onto empty land', this.pickedObject, this.liftedObject.rotationCardinal)
								
								// Todo put distance limits, here and server
								// const wobContained = this.babs.ents.get(this.liftedObject.id) // bagtodo
								// const wobInstanced = Utils.findWobByInstance(this.babs.ents, this.liftedObject.instancedIndex, this.liftedObject.instancedName)
								// const wob = wobContained || wobInstanced

								// const wobDest = coordDest.zone.getWob(coordDest.x, coordDest.z)
								const coordDest = YardCoord.Create({
									position: this.pickedObject.landPoint,
									babs: this.babs,
								})
								
								this.babs.socketSys.send({  // Intention is to move it
									action: {
										verb: 'moved',
										noun: wobSource.idObj(),
										data: {
											point: {x: coordDest.x, z: coordDest.z},
											rotation: this.liftedObject.rotationCardinal,
											idzone: coordDest.zone.id,
										},
									}
								})

							}
							else if(this.pickedObject?.pickedType === 'wob') {
								console.debug('dropped onto another wob (aka a place with a wob, picked)', this.pickedObject, this.liftedObject, this.liftedObject.rotationCardinal)

								const coordDest = this.pickedObject.yardCoord

								if(this.pickedObject.poid === this.liftedObject.poid) {
									console.log('dropped where it was lifted from')
									// Nothing happens...except wait!  It might need to be rotated!
									this.babs.socketSys.send({
										action: {
											verb: 'moved',
											noun: wobSource.idObj(),
											data: {
												point: {x: coordDest.x, z: coordDest.z},
												rotation: this.liftedObject.rotationCardinal,
												idzone: coordDest.zone.id,
											},
										}
									})
								}
								else { // Intention is to merge it
									console.log('dropped onto a merge')
									this.babs.socketSys.send({
										action: {
											verb: 'merged',
											noun: wobSource.idObj(),
											data: {
												point: {x: coordDest.x, z: coordDest.z},
												idzone:coordDest.zone.id,
											},
										}
									})
								}
							}
						}
						else if(this.pickedObject?.pickedType === 'player') {
							console.log(this.pickedObject.poid, 'vs', this.liftedObject.poid)
							if(this.pickedObject.poid === this.babs.idSelf) {
								console.debug('dropped onto self player', this.pickedObject, this.liftedObject)
							}
							else {
								console.debug('dropped onto other player', this.pickedObject, this.liftedObject)
							}
						}
						else { // Something else - cancel drop // Will be partly replaced with stacking and piling in the future. 
							// Seems to handle mouse leaving window and letting go there, because windows still gets mouse up, cool.
							console.debug('dropped onto somewhere unknown', this.pickedObject, this.liftedObject)
							this.babs.uiSys.aboveHeadChat(this.playerSelf.id, `~ you aren't able to place ${this.liftedObject.instancedBpid} there ~`)
						}


						// Revert it to its original position; successful drop will have the server update it soon, and failed drop needs it reverted anyway.
						const liftedYardCoord = this.liftedObject.yardCoord
						const liftedIndex = liftedYardCoord.zone.coordToInstanceIndex[liftedYardCoord.x+','+liftedYardCoord.z]
						let liftedEngPos = liftedYardCoord.toEngineCoordCentered('withCalcY')
						liftedEngPos = this.liftedObject.feim.heightTweak(liftedEngPos)
						// liftedEngPos.add(new Vector3(-this.babs.worldSys.shiftiness.x, 0, -this.babs.worldSys.shiftiness.z)) // todo shiftiness
						const matrixLiftedEngPos = new Matrix4().setPosition(liftedEngPos)

						this.liftedObject.feim.instancedMesh.setMatrixAt(liftedIndex, matrixLiftedEngPos)
						// console.log('setMatrixAt buttonup', liftedIndex)
						this.liftedObject.feim.instancedMesh.instanceMatrix.needsUpdate = true

					}
					else {
						console.warn('No source wob found for drop', this.liftedObject)
					}

					// Either way, on fail or success, it's no longer lifted
					this.liftedObject = null
					document.body.style.cursor = 'auto'
				}
				else { // Not carrying

					// If you mouseup before an object is picked up, then it's considered a 'use'.
					const mouseupBeforePickup = !this.mousedownPickedObject || Date.now() -this.mousedownPickedObject.poMousedownTime <400
					const pickedHasntChanged = this.mousedownPickedObject?.poid === this.pickedObject?.poid
					if(mouseupBeforePickup && pickedHasntChanged) { // mousedownPickedObject would be null after 400ms pickup time

						if (this.pickedObject?.pickedType === 'player') {
							console.log('playeruse', this.pickedObject, this.pickedObject.parent.parent)
							const pickedPlayer = this.babs.ents.get((this.pickedObject.parent.parent as FeObject3D).idplayer) as Player
							this.nickTargetId = pickedPlayer.id

							const isSelf = pickedPlayer.id === this.babs.idSelf // Don't name self
							const content = isSelf ? '' : `${InputSys.NickPromptStart} ${pickedPlayer.nick || 'stranger'}: `
							this.chatboxSetContent(content)
						
						} 
						else if (this.pickedObject?.pickedType === 'wob'){
	
							console.debug('wobuse', this.mouse, this.pickedObject)
	
							if(this.pickedObject) {
								const coord = this.pickedObject?.yardCoord
								const wob = coord.zone.getWob(coord.x, coord.z)
	
								this.babs.socketSys.send({
									action: {
										verb: 'used',
										noun: wob.idObj(),
									}
								})
							}
	
						}
						else if (this.pickedObject?.pickedType === 'land') {
							console.debug('landuse', this.pickedObject)
	
							const zone = this.babs.ents.get(this.pickedObject.yardCoord.zone.id) as Zone
							const yardCoord = YardCoord.Create({
								position: this.pickedObject.landPoint,
								babs: this.babs,
							})
							// Currently has no action on server, but nice to have for debugging:
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

							if(this.babs.debugMode) { // In debug, show details of land
								this.babs.uiSys.landSaid({text: this.pickedObject.landcoverString, idzone: zone.id, point: this.pickedObject.landPoint})
							}
							else {
								// Show type only
								this.babs.uiSys.landSaid({text: WorldSys.LandcoverStringToEnglish[this.pickedObject.landcoverString], idzone: zone.id, point: this.pickedObject.landPoint})
							}
						}
						else {
							// Nothing picked, just a random mouseup
						}
					}

				}

				if(this.mousedownPickedObject) {
					// this.babs.uiSys.aboveHeadChat(this.playerSelf.id, 'mouseup on this.mousedownPickedObject' + this.mousedownPickedObject.poid)
					this.mousedownPickedObject = null
				}


			}
			if (ev.button === MOUSE_RIGHT_CODE) {
				this.mouse.right = LIFT

				rightMouseDown.set(false)

				this.mouse.ldouble = 0

				document.exitPointerLock()
				this.canvas.style.cursor = 'inherit'
			}
			if (ev.button == 1) {
				this.mouse.middle = LIFT
			}
		}
		document.addEventListener('pointerup', (e) => {
			if(e.pointerType === 'touch') {
				this.setMouseDevice('fingers')
				buttonUpHandler(e)
			}
		})
		document.addEventListener('mouseup', buttonUpHandler)

		this.canvas.addEventListener('wheel', ev => { // Aka touchpad two finger scrolls
			// console.log('on wheel', ev.deltaX, ev.deltaY)
			ev.preventDefault()
			this.recheckMouseIntersects = true // So that laptop mouselook highlights wobs still

			// https://medium.com/@auchenberg/detecting-multi-touch-trackpad-gestures-in-javascript-a2505babb10e
			if (ev.ctrlKey) {
				// Doesn't actually require control keypress!  It's a hack that enables pinch zoom
				this.setMouseDevice('touchpad') // Only a touchpad would use zoom.
				this.mouse.zoom -= ev.deltaY
				// console.debug('in a pinch')
			} else {
				if (ev.deltaX) this.setMouseDevice('touchpad') // Only a touchpad would use x scrolling.
				
				this.mouse.scrolldx -= ev.deltaX /2 // Smoother / less sensitive

				if (this.mouse.device !== 'mouse' && this.mouse.device !== 'undetermined') { // Do not move on wheel, if we know it's a mouse.
					// this.mouse.scrolldy += ev.deltaY
					// Disabling touchpad vertical scroll to move.  Instead, use code similar to mouse

					// console.log(this.mouse.scrolldy)
					// if (ev.deltaY < 0 || !this.babs.cameraSys.gh ||this.babs.cameraSys.idealOffset?.y > this.babs.cameraSys.gh?.y + 4) {
					// Only increase offsetHeight if camera is above ground, or moving camera up
					if(!this.topMenuVisibleLocal) {
						this.babs.cameraSys.offsetHeight = Math.min(CameraSys.OffsetHeightLimit, this.babs.cameraSys.offsetHeight -(ev.deltaY * 0.03))
					}
					// }

				}
			}

			// Wheel swaps between run and walk
			if (this.mouse.device === 'mouse' || this.mouse.device === 'undetermined') {
				if (ev.deltaY < 0) {
					this.runmode = true
				}
				else if (ev.deltaY > 0) {
					this.runmode = false
				}
			}

		}, {passive: false})

		// isAwayUiDisplayed.subscribe(vis => { // Menu becomes visible
		// 	this.topMenuVisibleLocal = vis

		// 	if (vis) {
		// 		this.characterControlMode = false
		// 		document.exitPointerLock?.()
		// 		this.canvas.style.cursor = 'inherit'
		// 	}
		// 	else {
		// 		// Doesn't go back to this.characterControlMode until they mouse-right-hold
		// 	}
		// })
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

	pickedObject :PickedObject|null // An object that is at the mouse raycast; the player hasn't interacted with it yet beyond hovering.
	mousedownPickedObject :PickedObject|null // The player has down a mousedown on a pickedObject.
	liftedObject :PickedObject|null = null // An object that the player did a long mousedown on, and is now carrying around on their cursor.

	update(dt) { // Do NOT make update()s async!  I learned it can result in outdated info while future updates() run.
		if (!this.isAfk && Date.now() - this.activityTimestamp > 1000 * 60 * 5) { // 5 min
			this.isAfk = true
			this.babs.uiSys.awayGame()
		}

		if(!this.babs.uiSys.isGameAway && this.recheckMouseIntersects) {
			this.raycastSetPickedObject()
		}


		if(this.mousedownPickedObject?.poMousedownTime && Date.now() -this.mousedownPickedObject.poMousedownTime > this.doubleClickMs) {
			if(this.mousedownPickedObject.pickedType === 'wob') {
				// console.log('this.mousedownPickedObject', this.mousedownPickedObject)
				// Detect if it's too weighty
				// Get wob from zone
				const {x, z, zone} = this.mousedownPickedObject.yardCoord
				const wob = zone.getWob(x, z)

				if(!wob) {
					console.warn('No wob on mousedownPickedObject', this.mousedownPickedObject, zone)
					this.mousedownPickedObject = null
				} 
				else {
					// Get required weight from weighty bluest, if any
					const weightToLift = wob?.bluests?.weighty?.strengthToLift || 0
					const playerStrength = 10 // todo
					if(weightToLift > playerStrength) {
						console.debug(`${wob.blueprint_id} too weighty to lift: ${weightToLift} > ${playerStrength}`)
						if(weightToLift >= ImpossibleWeight) {
							this.babs.uiSys.aboveHeadChat(this.playerSelf.id, `~ ${wob.blueprint_id} is impossible to move ~`)
						}
						else if(Math.abs(playerStrength -weightToLift) < 20) { // Almost can lift
							this.babs.uiSys.aboveHeadChat(this.playerSelf.id, `~ you can't quite lift ${wob.blueprint_id} ~`)
						}
						else {
							this.babs.uiSys.aboveHeadChat(this.playerSelf.id, `~ ${wob.blueprint_id} is too heavy for you ~`)
						}
						this.mousedownPickedObject = null
					}
					else {
						// Mouse was held down on a wob, and it's been long enough to lift it
						this.liftedObject = this.mousedownPickedObject
						// this.babs.uiSys.aboveHeadChat(this.playerSelf.id, 'liftedObject ' + this.liftedObject.poid)
						this.mousedownPickedObject = null
						this.raycastSetPickedObject(true)
					}
				}
			}
		}
		if(!this.babs.uiSys.isGameAway && this.pickedObject?.poHoverTime && Date.now() -this.pickedObject.poHoverTime > this.doubleClickMs *2) {
			// console.log('hovering over', this.pickedObject)
			this.pickedObject.poHoverTime = null // Unset so this only triggers once (a bit hax)

			if (this.pickedObject.pickedType === 'player') {
				// Long hover player, get their name or nick
				const pl = this.pickedObject.parent.parent as FeObject3D
				const player = this.babs.ents.get(pl.idplayer) as Player
				// Display name about head when you hover a player (not yourself)
				const isSelf = player.id === this.babs.idSelf
				if(!isSelf) this.babs.uiSys.aboveHeadChat(player.id, player.nickWrapped(), null, player.colorHex)
			}
			else if (this.pickedObject.pickedType === 'wob') {
				let debugStuff = ''
				// Long hover instanced
				// const wob = this.babs.ents.get(this.pickedObject?.id) as Wob
				const yardCoord = this.pickedObject?.yardCoord

				if(this.babs.debugMode) {
					const pos = yardCoord.toEngineCoordCentered('withCalcY') // Y is for debugStuff
					// const index = yardCoord.zone.coordToInstanceIndex[yardCoord.x, yardCoord.z]

					const wob = yardCoord.zone.getWob(yardCoord.x, yardCoord.z)
					const index = yardCoord.zone.coordToInstanceIndex[yardCoord.x+','+yardCoord.z]

					if(wob) { // On delete, sometimes wob is gone before this gets here
						console.debug('this.pickedObject', this.pickedObject, pos)
						debugStuff += ` (locid ${wob.locid})\n${yardCoord}\nii=`+index+`, feim x,z=`+(this.pickedObject?.feim.instancedMesh.instanceMatrix.array[(index *16) +12])+','+(this.pickedObject?.feim.instancedMesh.instanceMatrix.array[(index *16) +14] + '\n' + this.pickedObject?.feim.glbUpdatedAt)
						// debugStuff += `\nengineHeightAt: ${yardCoord.zone.engineHeightAt(yardCoord)}`
					}

				}

				const wob = yardCoord.zone.getWob(yardCoord.x, yardCoord.z)

				if(!wob) { // Maybe repro and handle this error better?  Happens on double click of wob that disappears (eg eaten)
					console.debug('No wob on hover', this.pickedObject, wob, yardCoord)
				}
				else {
					console.debug('hovered wob, this.pickedObject', this.pickedObject, yardCoord)
					if(!this.liftedObject) {
						if(this.pickedObject?.instancedBpid !== 'footpath') {
							this.babs.uiSys.wobSaid(this.pickedObject?.instancedBpid +debugStuff, wob)
						}
					}
				}
				
			}
			else if (this.pickedObject.pickedType === 'land') {
				const idzone = this.pickedObject.yardCoord.zone.id
				// Long hover ground
				// Label the wob at the location!
				const zone = this.babs.ents.get(idzone) as Zone
				const coord = YardCoord.Create({
					position: this.pickedObject.landPoint,
					babs: this.babs,
				})
				const wobAtCoord = zone.getWob(coord.x, coord.z)
				if(wobAtCoord && !this.liftedObject) {
					if(wobAtCoord.blueprint_id !== 'footpath') {
						this.babs.uiSys.wobSaid(wobAtCoord.name, wobAtCoord)
					}
				}
			}

		}

		if(this.mouse.right === PRESS) {
			if(this.usePermanentPointerLock && this.isPointerLocked) {
				// Hide cursor while controlling character right rightmouse hold
				this.babs.inputSys.customcursor.style.display = 'none'
			}
		}
		if(this.mouse.right === LIFT) {
			if(this.usePermanentPointerLock && this.isPointerLocked) {
				// Show cursor while controlling character right rightmouse hold
				this.babs.inputSys.customcursor.style.display = 'block'
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
				this.mouse.accumx += this.mouse.dx * (0.5 * (mouseSensitivityPercent / 100))
			}
			else if(this.mouse.device === 'fingers') {
				if(this.mouse.left) {
					const mouseSensitivityPercent = 200
					this.mouse.accumx += this.mouse.dx * mouseSensitivityPercent / 100
					this.mouse.scrollaccumy -= this.mouse.dy
				}
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

			// Keyboard smooth movement
			if(this.keyboard.left || this.keyboard.right || this.keyboard.a || this.keyboard.d) {
				const sign = this.keyboard.left || this.keyboard.a ? -1 : 1
				// console.log('keyboard', this.mouse.accumx, sign)
				this.mouse.accumx += dt *300 *sign
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
				const _Q = new Quaternion()
				const _A = new Vector3()
				const _R = this.playerSelf.controller.idealTargetQuaternion.clone()

				_A.set(0, this.mouse.accumx > 0 ? -1 : 1, 0)
				_Q.setFromAxisAngle(_A, MathUtils.degToRad(45))
				_R.multiply(_Q)
				this.playerSelf.controller.setRotation(_R)

				console.debug('InputSys: call controller.setRotation')

				// After character snap rotate, bring head (camera) back to roughly where it was before (2.2 magic number)
				this.mouse.accumx = -this.mouseAccumThreshold * (2.2 / 3) * Math.sign(this.mouse.accumx)
			}

		}

		// Keep head rotation going even when menu is not visible, but it has to be placed here
		// The reason for doing head rotation is to visually indicate to the player when their character is about to turn
		this.playerSelf.controller.setHeadRotationX((this.mouse.accumx / this.mouseAccumThreshold) / 100 * this.headTurnMaxDegrees)

		// Vertical mouse look
		if (!this.topMenuVisibleLocal && this.mouse.right) {
			// console.log('dz', this.mouse.dy)

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
			this.babs.cameraSys.offsetHeight = Math.min(CameraSys.OffsetHeightLimit, this.babs.cameraSys.offsetHeight +(this.mouse.dy * 0.05))
			// }
			// Above is matched to touchpad similar code
		}

		// Runs every frame, selecting grid position for setDestination
		if (this.autorun || this.touchmove
			|| (!this.topMenuVisibleLocal
				&& (
					(this.keyboard.w || this.keyboard.s || (this.mouse.right && this.mouse.left)) //  || this.keys.a || this.keys.d
					|| this.keyboard.up || this.keyboard.down
					|| this.autorun
				)
			)
		) {
			
			// console.debug(this.keys.w ? 'w' : '-', this.keys.s ? 's' : '-', this.keys.a ? 'a' : '-', this.keys.d ? 'd' : '-')

			let tempMatrix = new Matrix4().makeRotationFromQuaternion(this.playerSelf.controller.idealTargetQuaternion)
			let vector = new Vector3().setFromMatrixColumn(tempMatrix, 0)  // get X column of matrix
			// console.debug('vector!', tempMatrix, vector)

			if (this.keyboard.w || this.keyboard.up || this.mouse.left || this.keyboard.s || this.keyboard.down || this.autorun || this.touchmove) {
				vector.crossVectors(this.playerSelf.controller.playerRig.up, vector) // camera.up
			}

			// Get direction
			vector.round()
			const isMouseLeftButNoKeyboardS = this.mouse.left && !this.keyboard.s // While holding a wob with mouse left, S on keyboard should still move you backwards
			if (this.keyboard.w || this.keyboard.up || isMouseLeftButNoKeyboardS || this.autorun || this.touchmove === 1 || this.touchmove === 'auto') {
				vector.negate() // Why is negate needed?
			}

			// Okay, that was direction.  Now get distance
			let gCurrentPos = this.playerSelf.controller.playerRig.position.clone()
			const gCurrentPosDivided = gCurrentPos.clone().multiplyScalar(1 / 4)
			const gCurrentPosFloored = gCurrentPosDivided.clone().floor()
			gCurrentPos = gCurrentPosFloored
			const dest = gCurrentPos.clone().add(vector)

			// Send to controller
			// console.debug('InputSys: call controller.setDestination', dest)
			this.playerSelf.controller.setDestination(dest, this.runmode ? 'run' : 'walk') // Must round floats
			// Stop following
			if(this.playerSelf.controller.selfFollowTargetId) {
				this.playerSelf.controller.selfFollowTargetId = null
				this.babs.uiSys.aboveHeadChat(this.playerSelf.id, `~ you stopped following ~`)
			}
			// Stop wayfinding
			if(this.babs.inputSys.playerSelf.selfWayfinding) {
				console.debug('Input stopping wayfinding')
				this.babs.socketSys.send({
					wayfound: false,
				})
			}

			// Let's show a square in front of the player?  Their destination target square :)
			const isZoning = this.playerSelf.controller.selfWaitZoningExitZone
			if (this.babs.debugMode && !isZoning) {
				if (!this.displayDestinationMesh) {
					const geometry = new PlaneGeometry(4, 4)
					const material = new MeshBasicMaterial({ color: 0xffaaaa, side: DoubleSide })
					geometry.rotateX(- Math.PI / 2) // Make the plane horizontal
					this.displayDestinationMesh = new Mesh(geometry, material)
					this.displayDestinationMesh.name = 'debugdestinationmesh'
					this.babs.group.add(this.displayDestinationMesh)
				}
				this.displayDestinationMesh.position.copy(dest).multiplyScalar(4).addScalar(2)
				const yardCoord = YardCoord.Create({
					...dest, // Ahh, this is failing because dest can be for a +zone that doesn't exist.  Hmm.  Bit of a hack: used isZoning here to avoid the race condition, but this could pop up again when creating yardCoords in update() loops, especially using engine coords I guess.
					zone: this.playerSelf.controller.playerRig.zone,
				})
				const engineHeight = this.playerSelf.controller.playerRig.zone.engineHeightAt(yardCoord)
				// console.log('engineHeight', dest, yardCoord, engineHeight)
				this.displayDestinationMesh.position.setY(engineHeight +0.1)
				// const easyRaiseAbove = 0.1 -6
				// this.displayDestinationMesh.position.add(new Vector3(0, this.playerSelf.controller.playerRig.position.y - 2 + easyRaiseAbove, 0))
			}
			else {
				this.displayDestinationMesh?.position.setY(-1000)
			}

		}


		// Voice
		if(this.keyboard.space === PRESS) {
			// Okay, let's just be silly and jump!
			this.playerSelf.controller.jump(Controller.JUMP_HEIGHT)

			/* // Start recording?
			
			// Request access to the user's microphone:
			if(!this.mediaRecorder) { // Note this is less throttled by this and more by not being able to press space while <<>> messages are up in chatbox.
				(async () => {
					try {
						console.debug('getUserMedia()')
						this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
						this.mediaStreamStartTime = Date.now()

						this.chatboxSetContent(this.chatbox.textContent + ' <<listening>>')

					} catch (err) {
						console.error('Error accessing microphone:', err)
					}

					// Create a MediaRecorder instance and start recording:
					// Check browser support for preferred format
					let isSafari = false
					this.mediaMimeType = 'audio/webm;codecs=opus'
					if (!MediaRecorder.isTypeSupported(this.mediaMimeType)) {
						console.log('this.mediaMimeType NOT supported 1:', this.mediaMimeType)
						// Try for Safari
						isSafari = true
						this.mediaMimeType = 'audio/mp4;codecs=mp4a'
						if (!MediaRecorder.isTypeSupported(this.mediaMimeType)) {
							console.error('this.mediaMimeType NOT supported 2:', this.mediaMimeType)
							this.chatbox.textContent = this.chatbox.textContent.replace('<<listening>>', '').replace('<<adding>>', '')
							return
						}
					}
					this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: this.mediaMimeType })
					// Collect recorded chunks
					this.mediaRecorder.addEventListener('dataavailable', (event) => {
						console.debug('dataavailable', event, event.data.size, this.mediaRecorder?.state)
						if (event.data.size > 0) {
							this.recordedChunks.push(event.data)
						}
						else {
							// return // Safari gets a couple of these with no data before the real one with all the data :/
							// We don't want to set this.mediaRecorder to null before that real one happens.
							// It's worse: Safari has buggy behavior around this.  Solution was mediaRecorder.start(1000)
						}

						if(this.mediaRecorder.state != 'recording') { // After it's totally finished (final blob, after .stop() call)

							// Release access so that the browser removes the recording icon
							// On Safari, it's much faster to not reset all this.  

							if(!isSafari) {
								this.mediaStream.getTracks()[0].stop()
								this.mediaStream.removeTrack(this.mediaStream?.getTracks()[0])
								console.debug('Not Safari; mediaStream to null', this.mediaStream.getTracks(), this.mediaRecorder)
								this.mediaStream = null
							}

							const blob = new Blob(this.recordedChunks, { type: this.mediaMimeType.split(';')[0] })
							this.recordedChunks = [] // Clear recorded chunks for next recording

							// // Download the blob as an mp4 file
							// const url = URL.createObjectURL(blob)
							// const a = document.createElement('a')
							// a.href = url
							// a.download = 'test.mp4'
							// document.body.appendChild(a)
							// a.click()
							// setTimeout(() => {
							// 	document.body.removeChild(a)
							// 	window.URL.revokeObjectURL(url)
							// }, 100)
						
							// You can now send this blob to your server or process it further
							this.mediaRecorder = null

							const timeElapsed = Date.now() - this.mediaStreamStartTime
							this.mediaStreamStartTime = null
							console.debug('mediaStreamStartTime timeElapsed', timeElapsed, 'ms')
							const minMsToGetGoodAnswer = 300

							if(timeElapsed >= minMsToGetGoodAnswer) { 

								this.chatboxSetContent(this.chatbox.textContent + ' <<adding>>')

								;(async (blob :Blob) => {
									const formData = new FormData()
									formData.append('audio', blob, 'audio.'+this.mediaMimeType.split(';')[0].split('/')[1])
									try {
										const response = await fetch(`${this.babs.urlFiles}/voice`, {
											method: 'POST',
											body: formData,
										})
									
										if (!response.ok) {
											throw new Error(`HTTP error ${response.status}`)
										}
									
										const data = await response.json()
										const text = data.text
										console.debug('Audio converted successfully:', data.text)

										if(text.toLowerCase().trim() === 'you') { // When it doesn't get good audio, it does 'you' lol
											console.debug('Audio result was "you", skipping')
										}
										else {
											
											this.babs.socketSys.send({
												chat: {
													text: text,
												},
											})
										}

									} catch(e) {
										console.warn('error posting audio', e)
									}
									finally {

										this.chatboxSetContent(this.chatbox.textContent.replace('<<listening>>', '').replace('<<adding>>', ''))
									}
								})(blob)
							}
						}
					})
					this.mediaRecorder.start(1000)

				})()
			}
			*/
		}
		if(this.keyboard.space === LIFT) {

			if(this.mediaStream) { // Note this can happen while they're typing into chatbox...weird scenario though.

				this.chatboxSetContent(this.chatbox.textContent.replace('<<listening>>', ''))

				if(this.mediaRecorder?.state == 'recording') {
					console.debug('mediaRecorder.stop()')
					this.mediaRecorder.stop() // This starts the blob+upload process via 'dataavailable' & state != 'recording'
					// this.mediaRecorder = null // Do only after it generates a blob
				}
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
		for (const key in this.keyboard) { // Update key states after press/lift
			if (this.keyboard[key] === PRESS) this.keyboard[key] = ON
			else if (this.keyboard[key] === LIFT) this.keyboard[key] = OFF
		}
		for (const key in this.mouse) { // Update key states after press/lift
			if(!(key==='left' || key==='right' || key==='middle')) continue
			if (this.mouse[key] === PRESS) this.mouse[key] = ON
			else if (this.mouse[key] === LIFT) this.mouse[key] = OFF
		}
	}

	raycastSetPickedObject(forcePickChanged = false, forceUnpick :'forceUnpick' = null) { // Raycast to set or unset this.pickedObject
		let newPickedObject :PickedObject = null

		// Only highlight things in canvas, not css ui
		if ((this.mouse.movetarget?.id === 'canvas' || this.mouse.movetarget === document.body || this.mouse.left === PRESS // mouse.left is for fingers
				|| forceUnpick) // Allow running when outside window, to clear picked on mouseleave event
			&& !this.mouse.right // And not when mouselooking
		) {
			this.recheckMouseIntersects = false // Unset; we only re-raycast below when this gets explicity set, eg on pointermove.

			const raycaster = this.mouse.ray as Raycaster
			raycaster.setFromCamera(this.mouse.xy, this.babs.cameraSys.camera)		
			
			// Good arrow:
			// this.babs.scene.add(new ArrowHelper( raycaster.ray.direction, raycaster.ray.origin, 100, Math.random() * 0xffffff ))

			this.mouseRayTargets.length = 0

			const logTime = false
			
			if(logTime) console.time('intersectObjects')
			if(logTime) console.timeLog('intersectObjects', this.babs.group.children.length)
			// intersectObjects is 10% of xperformance.  Maybe don't do children? Works, below improves performance
			const excluded = [Wob.FarwobName, 'groundgrid', 'LineSegments', 'debugdestinationmesh', 'three-helper', 'farzone', 'camerahelper', 'fire', 'feWords', 'nightsky', 'daysky', 'dirlight', 'firelight', 'hemilight', ] // 'water'
			let filteredChildren = this.babs.group.children.filter(c=>!excluded.includes(c.name))
			// Well, filtering out 'tree twotris' does help a lot with framerate.
			if(logTime) console.timeLog('intersectObjects', 'filteredChildren', filteredChildren.length)

			// It can't intersect a group (without a recursive raycast) because a group doesn't have geometry!
			// So for anything contained by a Group (Object3D), we need to manually raise it to the top level?
			let groups = this.babs.group.children.filter(c=>c.type=='Group')
			groups.forEach(g => {
				const childrenInGroup = g.children.filter(c=>!excluded.includes(c.name))
				filteredChildren.push(...childrenInGroup)
			})
			if(logTime) console.timeLog('intersectObjects', 'filteredChildren', filteredChildren.length)

			// Then remove the groups themselves
			filteredChildren = filteredChildren.filter(c=>c.type!=='Group')

			// Filter InstancedSkinnedMesh // Didn't help with speed
			// filteredChildren = filteredChildren.filter(c=>!(c instanceof InstancedSkinnedMesh))

			const currentZone = this.babs.inputSys.playerSelf.controller.playerRig.zone
			const idsZonesNearby = currentZone.getZonesAround(Zone.loadedZones, 1).map(z=>z.id)
			filteredChildren = filteredChildren.filter((c :FeObject3D) => {
				// Filter out far away zones
				if(c.name !== 'ground') return true
				if(idsZonesNearby.includes(c.zone.id)) return true
				return false
			})

			// console.log(filteredChildren.filter(c=>(c instanceof InstancedMesh || c instanceof InstancedSkinnedMesh) && (c.count > 1000 )).map(c=>c.count))

			// raycaster.firstHitOnly = true // BVH thing
			raycaster.intersectObjects(filteredChildren, false, this.mouseRayTargets)
			if(logTime) console.timeEnd('intersectObjects')

			// console.log('mouseRayTargets', this.mouseRayTargets.length, filteredChildren)

			for (let i = 0, l = this.mouseRayTargets.length; i < l; i++) { // Nearest object last

				const objectMaybe = this.mouseRayTargets[i].object
				if (objectMaybe?.parent?.name === 'three-helper') { // Special case since it's parent name instead of name
					continue // Skip
				}
				else if (objectMaybe instanceof InstancedMesh || objectMaybe instanceof InstancedSkinnedMesh) {
					// Instanced things like wobjects, water, trees, etc unless caught above
					const name = objectMaybe.name
					const feim = Wob.InstancedWobs.get(name)
					const index = this.mouseRayTargets[i].instanceId

					// Wob currently lifted is excluded based on its index vs above index
					if(this.liftedObject && this.liftedObject.pickedType === 'wob') {
						const liftedIndex = this.liftedObject.yardCoord.zone.coordToInstanceIndex[this.liftedObject.yardCoord.x+','+this.liftedObject.yardCoord.z]
						if(index === liftedIndex) {
							continue
						}
					}

					const position = feim.matrixEngCoordFromIndex(index)
					const yardCoord = YardCoord.Create({position: position, babs: this.babs})
					const wob = yardCoord.zone.getWob(yardCoord.x, yardCoord.z)
					if(wob) { // False is like if it's been deleted from under the mouse
						newPickedObject = { // wob
							pickedType: 'wob',
							poid: JSON.stringify(wob.idObj()),
							feim: feim,
							instancedBpid: name,
							yardCoord: yardCoord,
							poHoverTime: Date.now(),
						}
					}


				}
				else if(objectMaybe?.name === 'player_bbox') {
					if(!objectMaybe?.clickable) {
						continue
					}
					const temp = objectMaybe
					// Here we switch targets to highlight the PLAYER when its bounding BOX is intersected!
					newPickedObject = temp.parent.children[0].children[0]  // player // gltf loaded
					// temp.parent.traverse(child => Utils.objectIsSomeKindOfMesh(child) ? newPickedObject = child : null)
					// Player is currently special, different from other imports; can count on structure above.

					newPickedObject.pickedType = 'player'
					newPickedObject.poid = temp.parent.idplayer
					newPickedObject.poHoverTime = Date.now()
				}
				else if (objectMaybe instanceof Mesh) { // Must go after more specific mesh types
					if (objectMaybe?.name === 'ground') { // The Ground
						const ground = objectMaybe as FeObject3D
						const zone = ground.zone
						// const pos = this.mouseRayTargets[i].point
						const yardCoord = YardCoord.Create({
							position: this.mouseRayTargets[i].point,
							babs: this.babs,
						})

						// Highlight and label wob at location
						const wobAtCoord = zone.getWob(yardCoord.x, yardCoord.z)
						if(wobAtCoord) {
							const feim = Wob.InstancedWobs.get(wobAtCoord.blueprint_id)
							if(feim) {
								// console.log('feim', feim.blueprint_id, yardCoord)
								const index = feim.matrixIndexFromYardCoord(yardCoord)
								const position = feim.matrixEngCoordFromIndex(index)
								if(position) { // Ensure feim and wobs have been loaded
									// console.log('index', index, position)
									newPickedObject = { // wob on tile
										pickedType: 'wob',
										poid: JSON.stringify(wobAtCoord.idObj()),
										feim: feim,
										instancedBpid: wobAtCoord.blueprint_id,
										yardCoord: yardCoord,
										poHoverTime: Date.now(),
									}
								}
							}
						}
						else {
							const centerPointInPlot = WorldSys.ZONE_DATUM_SIZE /WorldSys.Yard

							// Land target
							const landcoverData = yardCoord.zone.landcoverData
							const plotCoord = new Vector3(Math.floor(yardCoord.x /centerPointInPlot), this.mouseRayTargets[i].point.y, Math.floor(yardCoord.z /centerPointInPlot))
							const index = coordToIndex(plotCoord.x, plotCoord.z, WorldSys.ZONE_ARR_SIDE_LEN)
							const lcString = WorldSys.StringifyLandcover[landcoverData[index]]
							// this.mouse.landtarget = {
							// 	text: lcString,
							// 	idzone: zone.id,
							// 	point: this.mouseRayTargets[i].point,
							// }
							newPickedObject = { // land
								pickedType: 'land',
								poid: `land-${zone.id}:${yardCoord.x},${yardCoord.z}`,
								yardCoord: yardCoord,
								poHoverTime: Date.now(),
								landcoverString: lcString,
								landPoint: this.mouseRayTargets[i].point,
							}
							// console.log('Setting land target landPoint', this.mouseRayTargets[i].point.x.toFixed(0), this.mouseRayTargets[i].point.z.toFixed(0))
						}


						// Also, maybe we should highlight this square or something?  By editing index color

					}
					else if (objectMaybe?.name === 'daysky') { // Sky
						// console.log('ray to sky')
					}
					else if (objectMaybe?.name === 'nightsky') { // Sky
						// console.log('ray to skybox')
					}
					else if (objectMaybe?.name === 'fire') { // Fire
						// console.log('ray to fire')
					}
					else if (objectMaybe instanceof TroikaText) { // Troika text
						console.warn('ray to troika text')
						console.log(objectMaybe)
					}
					else { // All other meshes
						console.warn('Uncaught Mesh mouseRayTarget', this.mouseRayTargets[i])
					}
				}
				else { // Everything else

					console.warn('ray to unknown:', objectMaybe)
				}



				break // Only run loop once (except for continues)
			}


			// Set colors
			if (newPickedObject) { // We've set a picked object in ifs above, so set its colors
				if (newPickedObject.pickedType === 'wob') { // InstancedMesh 
					const index = newPickedObject.yardCoord.zone.coordToInstanceIndex[newPickedObject.yardCoord.x+','+newPickedObject.yardCoord.z]

					let oldColor = new Color()
					newPickedObject.feim.instancedMesh.getColorAt(index, oldColor)
					let hsl = new Color() // This indirection prevents accumulation across frames
					// @ts-ignore
					oldColor.getHSL(hsl)
					const highlight = hsl.multiplyScalar(3)

					newPickedObject.feim.instancedMesh.setColorAt(index, highlight)
					newPickedObject.feim.instancedMesh.instanceColor.needsUpdate = true
				}
				else if(newPickedObject.pickedType === 'player'){ // Player bbox
					// Save old color and set new one
					if ((newPickedObject.material as MeshStandardMaterial).emissive?.r) { // Handle uninit emissive color
						(newPickedObject.material as MeshStandardMaterial).emissive = new Color(0, 0, 0)
					}
					newPickedObject.savedEmissiveColor = (newPickedObject.material as MeshStandardMaterial).emissive.clone() 
					;(newPickedObject.material as MeshStandardMaterial).emissive.setHSL(55 / 360, 100 / 100, 20 / 100).convertSRGBToLinear()
				}
				else if(newPickedObject.pickedType === 'land') {
					// console.log('land', newPickedObject)
				}

			}

			// Remove colors from old picked object if needed
			const poidsEqual = this.pickedObject?.poid === newPickedObject?.poid
			const newPickedChangedFromOld = this.pickedObject && newPickedObject && !poidsEqual
			const oldPickedAndNoLonger = (this.pickedObject && !newPickedObject) || (this.pickedObject && forceUnpick)

			// console.log('newPickedChangedFromOld', newPickedChangedFromOld, 'oldPickedAndNoLonger', oldPickedAndNoLonger)

			const movedOutFromExistingPick = newPickedChangedFromOld || oldPickedAndNoLonger
			// There's another situation here now: The locomoted eg butterfly moves out from under you!  
			// We can have it recheckMouseIntersects=true, but I suppose we also need to update pickedObject to the new data?
			if(movedOutFromExistingPick) {

				// Reset colors on old pickedObject
				if (this.pickedObject.pickedType === 'wob') { // InstancedMesh picks
					const index = this.pickedObject.yardCoord.zone.coordToInstanceIndex[this.pickedObject.yardCoord.x+','+this.pickedObject.yardCoord.z]

					this.pickedObject.feim.instancedMesh.setColorAt(index, new Color(1, 1, 1))
					this.pickedObject.feim.instancedMesh.instanceColor.needsUpdate = true

					// Cancel double click
					this.mouse.ldouble = false
				}
				else if(this.pickedObject.pickedType === 'player') { 
					// @ts-ignore
					this.pickedObject.material.emissive.copy(this.pickedObject.savedEmissiveColor)
				}
				else if(this.pickedObject.pickedType === 'land') {
					// Land type
				} 
				else {
					console.warn('unknown pickedType', this.pickedObject)
				}
			}


			const pickedAndChanged = !(this.pickedObject && newPickedObject && poidsEqual)
			if(pickedAndChanged || forcePickChanged) {
				// console.log('pickedAndChanged', this.pickedObject, newPickedObject)
				this.pickedObject = newPickedObject // Update it to new one or to null


				// Every time picked===land changes && lifted
				if(this.liftedObject?.pickedType === 'wob' && this.pickedObject && this.pickedObject?.pickedType !== 'player') {
					// console.log('pickedAndChanged land', this.pickedObject, this.liftedObject)

					/* Try 3 */
					// The bottom line is that we can setMatrixAt to change where the lifted wob appears visually, without affecting any other data.
					// Here is the useful way to go from index->wobcoord: feim.instanceIndexToWob.get(index)
					// Here is the useful way to from coord->index: wob.zone.coordToInstanceIndex[wob.x+','+wob.z]

					const liftedYardCoord = this.liftedObject.yardCoord
					const liftedIndex = liftedYardCoord.zone.coordToInstanceIndex[liftedYardCoord.x+','+liftedYardCoord.z]

					let pickedEngPos = this.pickedObject.yardCoord.toEngineCoordCentered('withCalcY')
					pickedEngPos = this.liftedObject.feim.heightTweak(pickedEngPos)
					// pickedEngPos.add(new Vector3(-this.babs.worldSys.shiftiness.x, 0, -this.babs.worldSys.shiftiness.z)) // todo shiftiness

					// Get the original / data-based Y rotation
					const wobOriginal = this.liftedObject.feim.instanceIndexToWob.get(liftedIndex)
					if(wobOriginal) {

						const wobrCardinal = wobOriginal.r
						const wobrDegreesCardinal = SharedWob.ROTATION_CARDINAL_TO_DEGREES[wobrCardinal]
						
						// Get the current rotation and direction from getMatrixAt()
						const currentTransform = new Matrix4()
						this.liftedObject.feim.instancedMesh.getMatrixAt(liftedIndex, currentTransform)
						const lastRotation = new Quaternion()
						const lastPosition = new Vector3()
						currentTransform.decompose(lastPosition, lastRotation, new Vector3())

						// Compare pickedEngPos with lastPosition, and determine rotation direction based on direction the avatar is moving it
						const deltaPosition = pickedEngPos.clone().sub(lastPosition)
						// console.log('deltaPosition', pickedEngPos.x+','+pickedEngPos.z, '-', lastPosition.x+','+lastPosition.z, '=', deltaPosition.x+','+deltaPosition.z)

						// Use the old rotation unless the position has changed
						let newRotationDegrees = wobrDegreesCardinal
						const hasPositionChanged = deltaPosition.length() > 0.01
						if(hasPositionChanged) {
							// Calculate the angle in radians
							let angleRadians = Math.atan2(deltaPosition.z, deltaPosition.x)
							// Flip angle 180 degrees so you're dragging north-facing things from behind
							angleRadians += Math.PI

							// Convert to degrees, normalize and snap to cardinals
							newRotationDegrees = SharedWob.DegreesToCardinalDegrees(radToDeg(angleRadians))

							// console.log('degreesToRotate', newRotationDegrees)
						}
						this.liftedObject.rotationCardinal = SharedWob.ROTATION_ROUNDDEGREES_TO_CARDINAL[newRotationDegrees]

						// Set transform
						let pickedTransform = new Matrix4()
						pickedTransform.makeRotationY(degToRad(newRotationDegrees))
						pickedTransform.setPosition(pickedEngPos)
						// console.debug('liftedObject visual update', liftedIndex, pickedEngPos, 'on', this.liftedObject.feim.instancedMesh.name, wobrCardinal, 'to', wobrDegrees, 'to', degToRad(wobrDegrees))
						
						// Set matrix
						this.liftedObject.feim.instancedMesh.setMatrixAt(liftedIndex, pickedTransform)
						this.liftedObject.feim.instancedMesh.instanceMatrix.needsUpdate = true
						// console.log('setMatrixAt down/update', liftedIndex)
					}
					else {
						console.warn('wobOriginal not found', this.liftedObject, liftedIndex)
					}
				}

			}
			// else, we keep the existing pickedObject (so we can time its hover/click length)

		}
	}

	setMouseDevice(newDevice :string) {

		if (this.mouse.device === newDevice) return // Only detect new device if device is changing

		// Hax, show more screen on mobile devices when they first load
		if (window.innerWidth < 800) { // Small screen, like a phone, smaller than ipad
			// this.babs.uiSys.svJournal.toggleFurl() // Done at default
			// document.getElementById('Menu').style.display = 'none'
			document.getElementById('topleft').style.display = 'none' // todo ui, make this more dynamic or something
			document.getElementById('topright').style.paddingBottom = '12px'
			// dividerOffset.set(0)
		}

		console.log('Device detected: ', newDevice, `(was ${this.mouse.device})`)
		// Device has changed.

		if(newDevice === 'fingers') {
			// this.babs.renderSys.renderer.shadowMap.enabled = false // todo quest vs mobile
		}

		if(this.mouse.device === undefined && newDevice === 'mouse') {
			// Joined the game with saved mouse device; mouse gets set so we need them to click to pointerlock.
			// this.babs.uiSys.awayGame()
		}


		if (this.mouse.device === 'mouse' || this.mouse.device === 'undetermined') { // Switching away from mouse
			this.autorun = false // Stop mouse autorun

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
	askTargetSourceWob :SharedWob
	askTarget(fwob :SharedWob = null) {
		this.askTargetSourceWob = fwob
		this.isAskingTarget = true
		document.body.style.cursor = `url(${this.babs.urlFiles}/cursors/cursor-aim.png) ${32/2} ${32/2}, auto`
		this.babs.uiSys.aboveHeadChat(this.babs.idSelf, `<<${fwob?.name || 'action'}'s target?>>`)
	}


	chatboxSetContent(text :string) {
		// Remove trailing whitespaces (except one) if there are more than one
		this.chatbox.textContent = text.replace(/\s{3,}/g, ' ')

		if(this.chatbox.textContent.trim()) { // Not all whitespace
			this.chatboxOpen = true
			this.chatbox.style.display = 'block'
		}
		else {
			this.chatboxOpen = false
			this.chatbox.style.display = 'none'
			this.chatbox.textContent = ''
		}
	}


}
