<script>
	import { onMount, afterUpdate } from 'svelte'
	import { isAwayUiDisplayed, socketSend, isProd, menuSelfData, baseDomain, topmenuAvailable, debugMode, settings, isFullscreen } from "../stores"
	
	import { draggable } from '@neodrag/svelte'
	import Cookies from 'js-cookie'
	import iro from '@jaames/iro'

	const DRAG_THRESHOLD = 2
	let Menu
	let ResumeButton

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
	console.debug('init, options, ui:', options, ui)

	let dragDistance = 0
	let dragOffsetX
	let dragOffsetY
	const dragStart = (ev) => {
		// dragDistance = 0
		// dragOffsetX = ev.detail.offsetX
		// dragOffsetY = ev.detail.offsetY
	}
	const onDrag = (ev) => {
		// dragDistance = Math.max(Math.abs(ev.detail.offsetX -dragOffsetX), Math.abs(ev.detail.offsetY -dragOffsetY), dragDistance)
	}
	const dragEnd = (ev) => {
		// if(dragDistance > DRAG_THRESHOLD) { // Save new position and set virtual to it
		// 	ui.virtx = ui.x = ev.detail.offsetX
		// 	ui.virty = ui.y = ev.detail.offsetY
		// 	socketSend.set({
		// 		'saveui': ui,
		// 	})
		// }
		// else { // Retain original
		// 	ui.virtx = ui.x
		// 	ui.virty = ui.y
		// }
		// setTimeout(() => {
		// 	dragDistance = 0
		// }, 10)
	}
	function updateDimensions(ev) {
		if(!Menu) return
		Menu.style.width = ui.unfurled ? ui.w+'px' : 'auto'
		Menu.style.height = ui.unfurled ? ui.h+'px' : 'auto'

		setTimeout(() => {
			const rect = Menu.getBoundingClientRect()
			// const xOverflow = ui.x +rect.width -window.innerWidth
			// const yOverflow = ui.y +rect.height -window.innerHeight
			// ui.virtx = ui.x -Math.max(0, xOverflow)
			// ui.virty = ui.y -Math.max(0, yOverflow)
			ui.virtx = window.innerWidth -rect.width
			ui.virty = window.innerHeight -rect.height
		}, 1)

		ResumeButton.style.position = 'absolute'
		ResumeButton.style.padding = '10px'
		ResumeButton.style.visibility = 'hidden' // Hide until it's resized
		setTimeout(() => {
			const rect = ResumeButton.getBoundingClientRect()
			ResumeButton.style.visibility = 'visible'
			ResumeButton.style.top = (window.innerHeight /2 -rect.height/2)+'px'
			ResumeButton.style.left = (window.innerWidth /2 -rect.width/2)+'px'
		}, 1)
	}

	// function setFurl(ev, furl) {
	// 	if(ev instanceof KeyboardEvent && ev.key !== 'Escape') {
	// 		return
	// 	}
	// 	if(dragDistance > DRAG_THRESHOLD) {
	// 		return // Don't toggle if they were just dragging
	// 	}
	// 	ui.unfurled = furl

	// 	updateDimensions()

	// 	$isAwayUiDisplayed = ui.unfurled
	// 	if(!$isAwayUiDisplayed) { // If closing menu, hide picker and stuff too
	// 		document.getElementById('picker').style.display = 'none'
	// 		movementTips = true
	// 	}
	// }

	let colorPicker
	let joinDate, joinMonth, joinYear
	let dmCallsCount = 0 // Don't send update on initialization
	onMount(async () => {
		updateDimensions()

		colorPicker = new iro.ColorPicker('#picker')
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
		}, 2000)

		// Watch joindate and color

		let excitedReason
		menuSelfData.subscribe((val) => {
			console.debug('menuSelfData change', val)
			joinDate = new Date(Date.parse($menuSelfData.created_at))
			joinMonth = joinDate.toLocaleString('default', { month: 'long' })
			joinYear = joinDate.toLocaleString('default', { year: '2-digit' })

			// If we got color from socket, or from update and it's different
			if($menuSelfData?.color && colorPicker.color.hexString != $menuSelfData.color) {
				speechColorEl.style.color = $menuSelfData.color
				colorPicker.color.hexString = $menuSelfData.color
			}
			const reason = document.getElementById('inputreason')
			const tempReason = val.reason
			setTimeout(() => {
				if($menuSelfData.reason === tempReason) {
					// console.log('going to send savereason', ) // todo this still gets run at launch!
					socketSend.set({
						'savereason': $menuSelfData.reason,
					})
					reason.style.borderColor = 'green'
					setTimeout(() => {
						reason.style.removeProperty('border-color')
					}, 1500)
				}
				
			}, 2000)
		})

		// Watch debugMode
		debugMode.subscribe(on => {
			console.debug('OverlaydebugMode.subscribe.svelte debugMode setting', dmCallsCount, on)

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
		console.debug('logging out', $baseDomain, $isProd)
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

	let movementTips = true

	isAwayUiDisplayed.subscribe(vis => {
		ui.unfurled = vis
		updateDimensions()
	})

	let inputChecked = false
	settings.subscribe((sets) => {
		for (const key in sets) {
			if (key === 'inputdevice') {
				inputChecked = sets[key] === 'touchpad'
			}
		}
	})

	function inputDeviceChange(ev) {
		if(ev.target.checked) {
			$settings.inputdevice = 'touchpad'
		}
		else {
			$settings.inputdevice = 'mouse'
		}
	}


	let graphicsChecked = Cookies.get('graphics') === 'quality'
	function graphicsChange(ev) {
		const graphics = ev.target.checked ? 'quality' : 'performance'

		Cookies.set('graphics', graphics, { 
			domain: $baseDomain,
			secure: $isProd,
			sameSite: 'strict',
		})

		setTimeout(() => {
			// this.babs.renderSys.renderer.antialias = true // Can't set here
			// Reload and RenderSys etc will get data from babs, which sets from cookie in babs.graphics.Quality
			window.location.reload()
		}, 100)

	}

	function toggleFullscreen(ev) {
		if(document.fullscreenElement) {
			document.exitFullscreen()
		}
		else {
			document.documentElement.requestFullscreen()
		}
	}

</script>

<svelte:window on:resize={updateDimensions}/>

<button class:hide="{!$isAwayUiDisplayed}" bind:this={ResumeButton} id="ResumeButton" class="card border border-5 border-primary" style="pointer-events:none; text-align:center;">- Away -<br/>Click to Resume First Earth</button>

<div class:hide="{!$isAwayUiDisplayed}" use:draggable={{...options, position: {x: ui.virtx, y:ui.virty}}} on:neodrag:start={dragStart} on:neodrag={onDrag} on:neodrag:end={dragEnd} on:resize={updateDimensions} bind:this={Menu} id="Menu" class="card border border-5 border-primary" style="cursor:default;">

	<!-- <div role="presentation" on:contextmenu={(ev) => ev.preventDefault()} class="handle card-header">Menu</div> -->
	<div class="content card-body">
		<div id="picker"></div>
		<ul style="text-align:left;">			
			<li style="text-align:center;">Welcome to First Earth!</li>
			<li style="text-align:center;">
				{$menuSelfData.email || ''} <a id="logout" href on:click|preventDefault={logout}>Logout</a>
			</li>
			<li id="menuVrArea" style="display:none; margin-top:10px;"></li>
			<li style="margin-top:10px;">&bull; Two fingers on mouse to move.</li>
			<li>&bull; Type a capital letter to chat, <br/>or hold space for voice->text.</li>
			<li>&bull; Double click someone to name.</li>
			<li>&bull; Ctrl + j to keep journal open.</li>
			<li style="text-align:right; margin-top:10px;">
					Speech color: <span role="presentation" id="speechColorEl" on:click={clickColor} on:keydown={null}>&block;&block;&block;</span>
			</li>
			<li style="text-align:right;">
				<fieldset class="form-group">
					<label for="paperSwitch2" class="paper-switch-label">
						Touchpad
					</label>
					<label class="paper-switch">
						<input id="paperSwitch2" name="paperSwitch2" type="checkbox" on:change={inputDeviceChange} bind:checked={inputChecked} />
						<span class="paper-switch-slider round"></span>
					</label>
					<label for="paperSwitch2" class="paper-switch-label">
						Mouse
					</label>
				</fieldset>
			</li>
			<li style="text-align:right;">
				<fieldset class="form-group">
					<label for="paperSwitch1" class="paper-switch-label">
						Fullscreen
					</label>
					<label class="paper-switch">
						<input id="paperSwitch1" name="paperSwitch1" type="checkbox" on:change={toggleFullscreen} bind:checked={$isFullscreen} />
						<span class="paper-switch-slider round"></span>
					</label>
					<label for="paperSwitch1" class="paper-switch-label">
						Windowed
					</label>
				</fieldset>
			</li>
			<li style="text-align:right;">
				<fieldset class="form-group">
					<label for="paperSwitch3" class="paper-switch-label">
						Quality
					</label>
					<label class="paper-switch">
						<input id="paperSwitch3" name="paperSwitch3" type="checkbox" on:change={graphicsChange} bind:checked={graphicsChecked} />
						<span class="paper-switch-slider round"></span>
					</label>
					<label for="paperSwitch3" class="paper-switch-label">
						Performance
					</label>
				</fieldset>
			</li>
			<li style="text-align:right;">
				<fieldset class="form-group">
					<label for="paperSwitch5" class="paper-switch-label">
						Debug
					</label>
					<label class="paper-switch">
						<input id="paperSwitch5" name="paperSwitch5" type="checkbox" bind:checked={$debugMode} />
						<span class="paper-switch-slider round"></span>
					</label>
					<label for="paperSwitch5" class="paper-switch-label">
						Normal
					</label>
				</fieldset>
			</li>
			<!-- <li>&nbsp;</li> -->

			<!-- <li>{$menuSelfData.credits ? $menuSelfData.credits+' prepaid months' : 'Free Account'}</li> -->
			<li style="text-align:center; margin-top:10px; margin-bottom: 10px;">
				<a href="https://discord.gg/YSzu2eYVpK" target="_blank">Discord</a> <a href="https://suncapped.com/blog" target="_blank">Blog</a> <a href="https://github.com/Suncapped/babs" target="_blank">Github</a> <a href="https://github.com/Suncapped/babs/blob/prod/CREDITS.md" target="_blank">Credits</a>
			</li>
			<li style="text-align:center;">What are you excited to do in FE?</li>
			<li style="text-align:center;">
				<textarea style="width: 240px; height: 80px;" id="inputreason" maxlength="10000" bind:value={$menuSelfData.reason} />
			</li>
		</ul>
	</div>
</div>

<style>
	#Menu {
		z-index: 50;
		background-color:rgba(12, 12, 12, 0.8);	
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

	#Menu #inputreason {
		width: 96%;
		height: 6em;
		padding: 0px;
		margin:auto;
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
