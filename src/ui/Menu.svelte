<script>
	import { onMount, afterUpdate } from 'svelte'
	import { topmenuUnfurled, socketSend, isProd, menuSelfData, baseDomain, topmenuAvailable, debugMode, settings } from "../stores.js"
	import { log } from '../Utils.js'
	import { draggable } from '@neodrag/svelte'
	import Cookies from 'js-cookie'
	import iro from '@jaames/iro'

	const DRAG_THRESHOLD = 2
	let Menu

	// Defaults
	let ui = $$props.ui
	ui.w ||= 'auto'
	ui.h ||= 'auto'
	ui.x ||= window.innerWidth
	ui.y ||= 0
	ui.unfurled ||= false

	ui.virtx = ui.x // Virtual x, for use here
	ui.virty = ui.y 

	// Set up draggable	
	let options = {
		handle: '#Menu > .handle',
		bounds: 'parent',
	}
	log.info('init, options, ui:', options, ui)

	let dragDistance = 0
	let dragOffsetX
	let dragOffsetY
	const dragStart = (ev) => {
		dragDistance = 0
		dragOffsetX = ev.detail.offsetX
		dragOffsetY = ev.detail.offsetY
	}
	const onDrag = (ev) => {
		dragDistance = Math.max(Math.abs(ev.detail.offsetX -dragOffsetX), Math.abs(ev.detail.offsetY -dragOffsetY), dragDistance)
	}
	const dragEnd = (ev) => {
		if(dragDistance > DRAG_THRESHOLD) { // Save new position and set virtual to it
			ui.virtx = ui.x = ev.detail.offsetX
			ui.virty = ui.y = ev.detail.offsetY
			socketSend.set({
				'saveui': ui,
			})
		}
		else { // Retain original
			ui.virtx = ui.x
			ui.virty = ui.y
		}
		setTimeout(() => {
			dragDistance = 0
		}, 10)
	}
	function updateDimensions(ev) {
		if(!Menu) return
		Menu.style.width = ui.unfurled ? ui.w+'px' : 'auto'
		Menu.style.height = ui.unfurled ? ui.h+'px' : 'auto'

		setTimeout(() => {
			const rect = Menu.getBoundingClientRect()
			const xOverflow = ui.x +rect.width -window.innerWidth
			const yOverflow = ui.y +rect.height -window.innerHeight
			ui.virtx = ui.x -Math.max(0, xOverflow)
			ui.virty = ui.y -Math.max(0, yOverflow)
		}, 1)
	}

	function setFurl(ev, furl) {
		if(ev instanceof KeyboardEvent && ev.key !== 'Escape') {
			return
		}
		if(dragDistance > DRAG_THRESHOLD) {
			return // Don't toggle if they were just dragging
		}
		ui.unfurled = furl

		// Unfurling of menu does not get saved
		// socketSend.set({
		// 	'saveui': ui,
		// })
		updateDimensions()

		$topmenuUnfurled = ui.unfurled
		if(!$topmenuUnfurled) { // If closing menu, hide picker and stuff too
			document.getElementById('picker').style.display = 'none'
			movementTips = false
		}
	}

	let colorPicker
	let joinDate, joinMonth, joinYear
	let dmCallsCount = 0 // Don't send update on initialization
	let excitedReason
	onMount(async () => {
		updateDimensions()

		colorPicker = new iro.ColorPicker('#picker');
		colorPicker.resize(200) // Must use this, not in init options above // todo send a patch?
		colorPicker.on('input:change', function(color) {
			speechColorEl.style.color = color.hexString
		})
		// Save occasionally
		setInterval(() => {
			if(colorPicker.color.hexString != $menuSelfData.color) {
				$menuSelfData.color = colorPicker.color.hexString
				socketSend.set({
					'savecolor': colorPicker.color.hexString,
				})
			}

			// If they typed into the reason box, save it after a bit
			if(excitedReason !== $menuSelfData.reason) {
				if(excitedReason !== undefined) { // Ignore on first update from server
					socketSend.set({
						'savereason': $menuSelfData.reason,
					})
				}
				excitedReason = $menuSelfData.reason
			}
		}, 2000)

		// Watch joindate and color
		menuSelfData.subscribe(val => {
			log.info('menuSelfData change', val)
			joinDate = new Date(Date.parse($menuSelfData.created_at))
			joinMonth = joinDate.toLocaleString('default', { month: 'long' })
			joinYear = joinDate.toLocaleString('default', { year: 'numeric' })

			// If we got color from socket, or from update and it's different
			if($menuSelfData?.color && colorPicker.color.hexString != $menuSelfData.color) {
				speechColorEl.style.color = $menuSelfData.color
				colorPicker.color.hexString = $menuSelfData.color
			}
		})

		// Watch debugMode
		debugMode.subscribe(on => {
			log.info('OverlaydebugMode.subscribe.svelte debugMode setting', dmCallsCount, on)

			// Don't send on init, or on receive first update
			if(on !== undefined && dmCallsCount > 0) { 
				socketSend.set({
					'savedebugmode': on,
				})
			}
			dmCallsCount++
		})
	})

	function logout(ev) {
		log.info('logging out', $baseDomain, $isProd)
		Cookies.remove('session', { 
			domain: $baseDomain,
			secure: $isProd,
			sameSite: 'strict',
		})
		window.location.reload()
	}

	function clickColor(ev) {
		const picker = document.getElementById('picker')
		picker.style.display = picker.style.display === 'block' ? 'none' : 'block'

		const menuRect = Menu.getBoundingClientRect()
		const pickerRect = Menu.getBoundingClientRect()
		picker.style.left = pickerRect.width+'px'

		if(ui.virtx +menuRect.width +pickerRect.width > window.innerWidth) {
			ui.virtx -= ui.virtx +menuRect.width +pickerRect.width -window.innerWidth
		}

	}

	let movementTips = false

	topmenuUnfurled.subscribe(vis => {
		ui.unfurled = vis
		updateDimensions()
	})

</script>

<svelte:window on:resize={updateDimensions} on:keydown={(ev) => setFurl(ev, !ui.unfurled)}/>

	<div use:draggable={{...options, position: {x: ui.virtx, y:ui.virty}}} on:neodrag:start={dragStart} on:neodrag={onDrag} on:neodrag:end={dragEnd} on:resize={updateDimensions} bind:this={Menu} id="Menu" class="card border border-5 border-primary {ui.unfurled ? 'unfurled' : ''}" style="display:{$topmenuAvailable ? 'block' : 'none'}">

		<div on:contextmenu={(ev) => ev.preventDefault()} class="handle card-header" on:mouseup={(ev) => setFurl(ev, !ui.unfurled)}>Menu</div>
		<div class="content card-body">
			<div id="picker"></div>
			<ul>			
			<li>Welcome to First Earth</li>
			<li>
					Speech color: <span id="speechColorEl" on:click={clickColor}>&block;&block;&block;</span>
			</li>
			{#if $menuSelfData.nick}
				<li>Known as: {$menuSelfData.nick}</li>
			{/if}
			<li>
				<fieldset class="form-group">
					<label class="paper-switch">
						<input id="paperSwitch6" name="paperSwitch6" type="checkbox" bind:checked={$debugMode} />
						<span class="paper-switch-slider round"></span>
					</label>
					<label for="paperSwitch6" class="paper-switch-label">
						Debug Mode
					</label>
				</fieldset>
			</li>
			<li>
				<fieldset class="form-group">
					<label for="paperSwitch6" class="paper-switch-label">
						Touchpad
					</label>
					<label class="paper-switch">
						<input id="paperSwitch6" name="paperSwitch6" type="checkbox" on:change={ev => ev.target.checked ? $settings.inputdevice = 'touchpad' : 'mouse'} checked="{$settings?.inputdevice === 'touchpad' ? 'checked':''}" />
						<span class="paper-switch-slider round"></span>
					</label>
					<label for="paperSwitch6" class="paper-switch-label">
						Mouse
					</label>
				</fieldset>
			</li>
			<li><a href on:click|preventDefault={()=> { movementTips = !movementTips; updateDimensions()} }>Movement Tips</a>
				<div hidden="{!movementTips}">
					<li>To move, hold right-mouse plus:<br/>left, double-left, space, wasd, middle</li>
					<li>Or on laptop touchpad:<br/>Two finger touch, click, swipe, pinch</li>
				</div>
			</li>
			<!-- <li>
				{#each $uiWindows as window}
				{/each}
			</li> -->

			<li>&nbsp;</li>

			<li>{$menuSelfData.email}</li>
			<li>{$menuSelfData.credits ? $menuSelfData.credits+' prepaid months' : 'Free Account'}</li> <!-- // Free / Credit Months: 2 / _Monthly Sub_ / _Yearly Sub_ -->
			<li>Joined in <span title="{joinDate}">{joinMonth} {joinYear}</span></li>
			<li><a id="logout" href on:click|preventDefault={logout}>Logout</a></li>
			
			<li>&nbsp;</li>
			
			<li><a target="_new" href="https://discord.gg/f2nbKVzgwm">discord.gg/f2nbKVzgwm</a></li>
			<li>What are you most excited<br/>to do in First Earth?</li>
			<li>
				<textarea id="inputreason" maxlength="10000" bind:value={$menuSelfData.reason} />
			</li>
		</ul>
	</div>
</div>

<style>
	#Menu {
		z-index: 50;
		background-color:rgb(33, 33, 33);
	}
	#Menu > .content {
		padding: 8px;
		padding-left: 12px;
		
		font-size: 20px;
	}

	#Menu ul {
		list-style-type: none;
		padding: 0;
		margin: 10px;
		text-align: right;
	}
	#Menu ul li {
		margin-bottom: 2px;
	}
	#Menu ul li:before{
		content:'';
	}

	#Menu #inputreason {
		width: 90%;
		height: 6em;
		margin-top: 8px;
		margin-right: 0;
		margin-bottom: 0;
		padding: 8px;
	}
	#Menu #inputreason {
		font-size: 18px;
	}

	#picker {
		display: none;
		margin:auto;
		float:right;
		padding:5px;
		background-color:rgb(33, 33, 33);
		position:absolute;
		/* left: 250px; */
	}
	#speechColorEl{
		color: white;
		cursor: default;
	}


	fieldset.form-group{
		margin-bottom: 0px;
		margin-top: 8px;
	}
	fieldset.form-group > * {
		float:right;
	}
	fieldset.form-group > label {
		margin-right: 0;
    	margin-left: 10px;
	}

</style>
