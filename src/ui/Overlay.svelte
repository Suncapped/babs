<script>
	import { onMount, afterUpdate } from 'svelte'
	import { toprightText, menuShowLink, menuSelfData, toprightReconnect, topmenuVisible, socketSend, baseDomain, isProd, debugMode, dividerOffset, urlFiles } from "../stores.js"
	import Cookies from 'js-cookie'
	import { log } from '../Utils.js'
	import iro from '@jaames/iro'
	import { MathUtils } from 'three';
	import { debounce } from 'debounce'

	function toggleMenu(ev) {
		if($menuShowLink && (ev.code == 'Escape' || ev.type == 'click')) {
			$topmenuVisible = !$topmenuVisible

			if(!$topmenuVisible) { // If closing menu, hide picker and stuff too
				document.getElementById('picker').style.display = 'none'
				movementTips = false
			}
		}
	}


	let colorPicker
	let joinDate, joinMonth, joinYear
	let dmCallsCount = 0 // Don't send update on initialization
	let excitedReason
	onMount(async () => {
		colorPicker = new iro.ColorPicker('#picker');
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

			// Don't send on init, and don't send on player arrival data either
			if(dmCallsCount >= 2) { 
				socketSend.set({
					'savedebugmode': on,
				})
			}
			dmCallsCount++
		})



		// Divider panel things
		let isResizing = false
		let container = document.getElementById('container')
		let left = document.getElementById('canvas')
		let right = document.getElementById('right_panel')
		let handle = document.getElementById('drag')

		handle.addEventListener('mousedown', function (e) {
			isResizing = true;
		})
		document.addEventListener('mouseup', function (e) {
			isResizing = false
		})

		const doResize = (offsetRight) => {
			log.info('doResize', offsetRight, window.innerWidth)

			if(offsetRight > window.innerWidth /2) {
				dividerOffset.set(window.innerWidth /2)
				return // Will get called again on update to continue with new width
			}

			left.style.right = offsetRight+'px'
			right.style.width = offsetRight+'px'
			left.style.width = (window.innerWidth -offsetRight) +'px'
			left.style.height = window.innerHeight+'px'
		}
		document.addEventListener('mousemove', function (ev) {
			if(!isResizing) return // we don't want to do anything if we aren't resizing.
			ev.preventDefault()

			const containerWidth = parseFloat(getComputedStyle(container, null).width)
			var offsetRight = containerWidth -(ev.clientX -container.getBoundingClientRect().left)

			offsetRight = MathUtils.clamp(offsetRight, 5, window.innerWidth /2)
			dividerOffset.set({save: offsetRight})
		})
		window.addEventListener('resize', (ev) => {
			doResize($dividerOffset)
		}, false)
		dividerOffset.subscribe(offsetOrObj => {
			log.info('subscribed offsetOrObj is', offsetOrObj)
			if(offsetOrObj === undefined) { // First time or too big
				dividerOffset.set(window.innerWidth /4) // default
			}
			else if(offsetOrObj.save) { // Actually resized by player, or received
				socketSend.set({
					'savedivider': offsetOrObj.save, // Sends to server on first set ugh
				})
				dividerOffset.set(offsetOrObj.save)
			}
			// setTimeout(() => doResize(offsetOrObj), 1) // hax // no longer needed?
			doResize(offsetOrObj)
		})

		right.style.backgroundImage = `url(${$urlFiles}/icon/knotlight.png)`
		right.style.backgroundRepeat = 'repeat-y'
		right.style.backgroundSize = '9px'
		right.style.backgroundPositionX = '0px'
		right.style.overflow = 'visible'
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
	}

	let movementTips = false

</script>

<svelte:window on:keydown={toggleMenu}/>

<div class="Overlay">
	<div class="topitem">
		<div id="topright">
			{#if $toprightReconnect}
				{$toprightReconnect} [<a href on:click|preventDefault={(ev) => window.location.reload()}>Reconnect?</a>]
			{:else if $menuShowLink}
				<div id="menulink"><a on:click|preventDefault={toggleMenu} href>Menu (esc key)</a></div>
			{:else}
				{@html $toprightText}
			{/if}
		</div>
		<div id="topleft">
			<span>Character Save:</span>
			<form method="post">
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					placeholder="Email - no spam"
					class="border border-2 border-primary"
				/>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					placeholder="Password"
					class="border border-4 border-primary"
				/>
				<button id="charsave" type="submit">Enter</button>
			</form>
		</div>
		<div style="clear:both" />
	</div>

	<div id="picker"></div>
	<div class="topitem border border-5 border-primary" id="topmenu" style="display: {$topmenuVisible ? 'block' : 'none'};" >
		<ul>			
			{#if $menuSelfData.nick}
				<li>Known as: {$menuSelfData.nick}</li>
			{/if}
			<li>
				Speech color: <span id="speechColorEl" on:click={clickColor}>&block;&block;&block;</span>
			</li>
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
			<li><a href on:click|preventDefault={()=>movementTips = !movementTips}>Movement Tips</a>
				<div hidden="{!movementTips}">
					<li>To move, hold right-mouse plus:<br/>left, double-left, space, wasd, middle</li>
					<li>Or on laptop touchpad:<br/>Two finger touch, click, swipe, pinch</li>
				</div>
			</li>
			<li><a target="_new" href="https://discord.gg/f2nbKVzgwm">discord.gg/f2nbKVzgwm</a></li>

			<li>&nbsp;</li>

			<li><b>Account:</b></li>
			<li>Joined in <span title="{joinDate}">{joinMonth} {joinYear}</span></li>
			<li>{$menuSelfData.email}</li>
			<li>Credit Months: {$menuSelfData.credits}</li>
			<li>Subscription: Credits</li> <!-- // Free / Credits / Paid / Paid (Credits) -->
			<li>Until: (after release)</li>
			<li><a id="logout" href on:click|preventDefault={logout}>Logout</a></li>
			
			<li>&nbsp;</li>

			<li>What are you most excited<br/>to do in First Earth?</li>
			<li>
				<textarea id="inputreason" maxlength="10000" bind:value={$menuSelfData.reason} />
				<!-- <button bind:this={savereason} id="savereason" type="submit" on:click|preventDefault={saveReason} >Save</button> -->
			</li>
		</ul>
	</div>


	<div id="info" hidden="{!$debugMode}">
		Move: Hold right mouse, two finger press, or touchpad swipe.<br />
		Built build_time (build_info).<br />
		<span id="log"></span>
	</div>
	<div id="stats" hidden="{!$debugMode}"></div>

	
</div>

<style>
	.Overlay {
		position: absolute;
		top: 0px;
		width: 100%;
		pointer-events: none; /* Clicks go through it */
		z-index: 1;
	}
	.Overlay > * {
		pointer-events: auto; /* Everything else receives */
	}
	.topitem {
		background-color: rgb(33, 33, 33); /* #fdfbd3; */ /* FFF4BC */
		padding: 10px;
		padding-top: 9px;
		padding-bottom:0px;
	}

	/* topitem topleft */
	#topleft input,
	#topleft button {
		font-size: 20px;
		padding: 3px;
		margin: 2px;
		padding-top:6px;
	}
	#topleft form {
		display: inline;
		top: -4px;
		position:relative;
	}
	#topleft {
		width: 100%;
	}
	#topleft > *, #topleft > form > * {
		float: left;
		margin-right: 6px;
	}
	#topleft input[type="email"] {
		width: 250px;
	}
	#topleft > span {
		padding-top:2px;
	}
	#topright {
		float: right;
		position: absolulte;
		right: 0px;
		margin-top: 5px;
	}
	#topright #menulink {
		position: relative;
		top: -5px;
	}

	/* topmenu modal */
	#topmenu {
		display: none;
		background-color: rgb(33, 33, 33);
		/* border: 2px solid white; */
		/* border-top: none; */
		width: auto;
		float: right;
		font-size: 20px;
		color:inherit;
	}
	#topmenu ul {
		list-style-type: none;
		padding: 0;
		margin: 10px;
		text-align: right;
	}
	#topmenu ul li {
		margin-bottom: 2px;
	}
	#topmenu ul li:before{
		content:'';
	}

	#topmenu #inputreason {
		width: 90%;
		height: 6em;
		margin-top: 8px;
		margin-right: 0;
		margin-bottom: 0;
		padding: 8px;
	}
	#topmenu #inputreason {
		font-size: 18px;
	}
	
	#picker {
		display: none;
		margin:auto;
		float:right;
		padding:5px;
		background-color:rgb(33, 33, 33);
		/* border-left:1px solid white; */
	}
	#speechColorEl{
		color: white;
		cursor: default;
	}

	/* Debug things */
	:global #fps, :global #mem { /* Inserted by UiSys */
		position: absolute;
		top: 63px;
		left: 10px;
	}
	:global #mem {
		top: 111px;
	}
	#info {
		position: absolute;
		top: 68px;
		left: 100px;
		text-align:left;
	}
	#info{
		color:black;
	}

	
	/* Divider panel things */
	:global #container {
		width: 100%;
		height: 100%;
	}
	:global #canvas {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		right: 100px;
		background: grey;
	}

	:global #right_panel {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		/* width: 200px; */
		color:#ddd;
		background: black;
	}
	:global #drag {
		position: absolute;
		left: -1px;
		top: 0;
		bottom: 0;
		width: 12px;
		cursor: w-resize;
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
