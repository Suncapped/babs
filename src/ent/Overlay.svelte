<script>
	import { onMount, afterUpdate } from 'svelte'
	import { toprightText, menuShowLink, menuSelfData, toprightReconnect, topmenuVisible } from "../stores.js";
	import Cookies from 'js-cookie'
	import { SocketSys } from '../sys/SocketSys.js';

	function toggleMenu(ev) {
		if($menuShowLink && (ev.code == 'Escape' || ev.type == 'click')) {
			$topmenuVisible = !$topmenuVisible
		}
	}

	let joinDate, joinMonth, joinYear
	menuSelfData.subscribe(val => {
		joinDate = new Date(Date.parse($menuSelfData.created_at))
		joinMonth = joinDate.toLocaleString('default', { month: 'long' })
		joinYear = joinDate.toLocaleString('default', { year: 'numeric' })
	})

	let inputreason
	let savereason
	async function saveReason(ev) {
		$menuSelfData.reason = inputreason.value
		await SocketSys.Send({
			'savereason': $menuSelfData.reason,
		})
		savereason.innerText = '> Saved!'
		savereason.disabled = true
		setTimeout(() => {
			savereason.innerText = 'Save'
			savereason.disabled = false
		}, 3000)
	}

	function logout(ev) {
		Cookies.remove('session', { 
			domain: SocketSys.baseDomain,
			secure: SocketSys.isProd,
			sameSite: 'strict',
		})
		window.location.reload()
	}

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
	<div class="topitem" id="topmenu" style="display: {$topmenuVisible ? 'block' : 'none'};">
		<ul>
			<li>Mouse click-hold to move, right-click to look.</li>
			<li>F key to build campfire!</li>
			
			<li>&nbsp;</li>
			{#if $menuSelfData.nick}
				<li>Known as: {$menuSelfData.nick}</li>
				<li>&nbsp;</li>
			{/if}
			<li>What are you most excited to do in First Earth?</li>
			<li>
				<textarea bind:this={inputreason} id="inputreason" maxlength="10000">{$menuSelfData.reason}</textarea>
				<button bind:this={savereason} id="savereason" type="submit" on:click|preventDefault={saveReason} >Save</button>
			</li>

			<li>&nbsp;</li>
			<li><b>Account</b></li>
			<li>Joined in <span title="{joinDate}">{joinMonth} {joinYear}</span></li>
			<li>{$menuSelfData.email}</li>
			<li>Credit Months: {$menuSelfData.credits}</li>
			<li>Subscription: Credits</li> <!-- // Free / Credits / Paid / Paid (Credits) -->
			<li>Until: (after release)</li>
			
			<li>&nbsp;</li>
			<li><a id="logout" href on:click|preventDefault={logout}>Logout</a></li>
		</ul>
	</div>
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
</style>
