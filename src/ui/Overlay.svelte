<script>
	import { onMount, afterUpdate } from 'svelte'
	import { toprightText, menuShowLink, menuSelfData, toprightReconnect, topmenuVisible, socketSend, baseDomain, isProd, debugMode } from "../stores.js"
	import Cookies from 'js-cookie'
	import { log } from '../Utils.js'
	import iro from '@jaames/iro'

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
			log('onchange!', color)
			speechColorEl.style.color = color.hexString
		})
		// Save occasionally
		setInterval(() => { // Simpler than a debounce
			if(colorPicker.color.hexString != $menuSelfData.color) {
				$menuSelfData.color = colorPicker.color.hexString
				log.info('save color')
				socketSend.set({
					'savecolor': colorPicker.color.hexString,
				})
			}

			// If they typed into the reason box, save it after a bit
			if(excitedReason !== $menuSelfData.reason) {
				if(excitedReason !== undefined) { // Ignore on first update from server
					log.info('save reason')
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
				<div id="menulink"><a on:click|preventDefault={toggleMenu} href>Meta</a> (esc key)</div>
			{:else}
				{$toprightText}
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
				/>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					placeholder="Password"
				/>
				<button id="charsave" type="submit">Enter</button>
			</form>
		</div>
		<div style="clear:both" />
	</div>

	<div id="picker"></div>
	<div class="topitem" id="topmenu" style="display: {$topmenuVisible ? 'block' : 'none'};">
		<ul>			
			{#if $menuSelfData.nick}
				<li>Known as: {$menuSelfData.nick}</li>
			{/if}
			<li>
				Speech color: <span id="speechColorEl" on:click={clickColor}>&block;&block;&block;</span>
			</li>
			<li>
				<label for="debugMode">Debug Mode?</label><input id="debugMode" type="checkbox" bind:checked={$debugMode}>
			</li>
			<li><a href on:click|preventDefault={()=>movementTips = !movementTips}>Movement Tips</a>
				<div hidden="{!movementTips}">
					<li>To move, hold right-mouse plus:<br/>left, double-left, space, wasd, middle</li>
					<li>Or on laptop touchpad:<br/>Two finger touch, click, swipe, pinch</li>
				</div>
			</li>

			<li>&nbsp;</li>

			<li><b>Account</b></li>
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
		<a target="_new" href="https://discord.gg/f2nbKVzgwm">discord.gg/f2nbKVzgwm</a> <span id="log"></span>
	</div>
	<div id="stats" hidden="{!$debugMode}"></div>
</div>

<style>
	.Overlay {
		position: absolute;
		top: 0px;
		width: 100%;
		pointer-events: none; /* Clicks go through it */
	}
	.Overlay > * {
		pointer-events: auto; /* Everything else receives */
	}
	.topitem {
		background-color: #fdfbd3; /* FFF4BC */
		opacity: 0.8;
		padding: 10px;
		padding-top: 12px;
	}

	/* topitem topleft */
	#topleft input,
	#topleft button {
		font-size: 20px;
		padding: 3px;
		margin: 2px;
	}
	#topleft form {
		display: inline;
	}
	#topleft {
		width: 100%;
	}
	#topleft input[type="email"] {
		width: 25%;
	}
	#topleft input[type="password"] {
		width: 15%;
	}

	/* topitem topright */
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
		background-color: #fff4bc;
		opacity: 0.8;
		width: auto;
		float: right;
	}
	#topmenu ul {
		list-style-type: none;
		padding: 0;
		margin: 10px;
		text-align: right;
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
		background-color:#fff4bc;
		border-left:1px solid white;
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
</style>
