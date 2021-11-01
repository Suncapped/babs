<script>
	import { onMount, afterUpdate } from 'svelte'
	import { toprightText, menuShowLink, menuSelfData, toprightReconnect, topmenuVisible, socketSend, baseDomain, isProd, debugMode } from "../stores.js"
	import Cookies from 'js-cookie'
	import { log } from '../Utils.js'
	import iro from '@jaames/iro'

	function toggleMenu(ev) {
		if($menuShowLink && (ev.code == 'Escape' || ev.type == 'click')) {
			$topmenuVisible = !$topmenuVisible

			if(!$topmenuVisible) { // If closing menu, hide picker too
				document.getElementById('picker').style.display = 'none'
			}
		}
	}


	let colorPicker
	onMount(async () => {
		colorPicker = new iro.ColorPicker('#picker');
		colorPicker.on('input:change', function(color) {
			speechColorEl.style.color = color.hexString
		})
		// Save occasionally
		setInterval(() => { // Simpler than a debounce
			if(colorPicker.color.hexString != $menuSelfData.color) {
				$menuSelfData.color = colorPicker.color.hexString
				socketSend.set({
					'savecolor': colorPicker.color.hexString,
				})
			}
		}, 500)
	})

	let joinDate, joinMonth, joinYear
	menuSelfData.subscribe(val => {
		joinDate = new Date(Date.parse($menuSelfData.created_at))
		joinMonth = joinDate.toLocaleString('default', { month: 'long' })
		joinYear = joinDate.toLocaleString('default', { year: 'numeric' })

		// If we got color from socket, or from update and it's different
		if($menuSelfData?.color && colorPicker.color.hexString != $menuSelfData.color) {
			speechColorEl.style.color = $menuSelfData.color
			colorPicker.color.hexString = $menuSelfData.color
		}
	})

	let inputreason
	let savereason
	async function saveReason(ev) {
		$menuSelfData.reason = inputreason.value
		socketSend.set({
			'savereason': $menuSelfData.reason,
		})
		savereason.innerText = '> Saved!'
		savereason.disabled = true
		setTimeout(() => {
			savereason.innerText = 'Save'
			savereason.disabled = false
		}, 3000)

		document.getElementById('picker').style.display = 'none' // Hide color picker in case they're confused about how it saves

	}

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


	let dmCallsCount = 0 // Don't send update on initialization
	debugMode.subscribe(on => {
		log.info('Overlay.svelte debugMode setting', on)
		if(dmCallsCount > 0) {
			socketSend.set({
				'savedebugmode': on,
			})
		}
		dmCallsCount++
	})



</script>

<svelte:window on:keydown={toggleMenu}/>

<div class="Overlay">
	<div class="topitem">
		<div id="topright">
			{#if $toprightReconnect}
				{$toprightReconnect} [<a href on:click|preventDefault={(ev) => window.location.reload()}>Reconnect?</a>]
			{:else if $menuShowLink}
				<div id="menulink"><a on:click|preventDefault={toggleMenu} href>Menu</a> (esc key)</div>
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
			<li>Hold right-mouse plus: left, double-left, space, wasd, middle.</li>
			<li>Touchpad: Two finger touch, click, swipe, pinch.</li>
			
			<li>&nbsp;</li>
			{#if $menuSelfData.nick}
				<li>Known as: {$menuSelfData.nick}</li>
			{/if}
			<li>
				Speech color: <span id="speechColorEl" on:click={clickColor}>&block;&block;&block;</span>
			</li>
			<li>
				<label for="debugMode">Debug Mode?</label><input id="debugMode" type="checkbox" bind:checked={$debugMode}>
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
			<li>What are you most excited to do in First Earth?</li>
			<li>
				<textarea bind:this={inputreason} id="inputreason" maxlength="10000">{$menuSelfData.reason}</textarea>
				<button bind:this={savereason} id="savereason" type="submit" on:click|preventDefault={saveReason} >Save</button>
			</li>
		</ul>
	</div>

	<div id="info" hidden="{!$debugMode}">
		Move: Hold right mouse, two finger press, or touchpad swipe.<br />
		Built build_time (build_info).<br />
		Forum: <a target="_new" href="https://discord.gg/f2nbKVzgwm">discord.gg/f2nbKVzgwm</a>. Pos: <span id="log"></span>
	</div>
	<div id="stats" hidden="{!$debugMode}"></div>
</div>

<style>
	.Overlay {
		position: absolute;
		top: 0px;
		width: 100%;
	}
	.topitem {
		background-color: #fdfbd3; /* FFF4BC */
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
		height: 4em;
		margin-top: 8px;
		margin-right: 0;
		margin-bottom: 0;
		padding: 8px;
	}
	#topmenu #savereason, #topmenu #inputreason {
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
