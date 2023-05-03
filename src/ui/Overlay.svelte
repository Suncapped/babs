<script>
	import { onMount, afterUpdate } from 'svelte'
	import { toprightText, toprightReconnect, socketSend, baseDomain, isProd, debugMode, dividerOffset, urlFiles, uiWindows } from "../stores"
	import { log } from '@/Utils'
	import { MathUtils } from 'three';



	onMount(async () => {

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
				dividerOffset.set(100)// (window.innerWidth /4) // default
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

		urlFiles.subscribe(urlFiles => {
			if(!urlFiles) return
			// console.log('svelte urlfiles', urlFiles)
			right.style.backgroundImage = `url(${urlFiles}/icon/knotlight.png)`
			right.style.backgroundRepeat = 'repeat-y'
			right.style.backgroundSize = '9px'
			right.style.backgroundPositionX = '0px'
			right.style.overflow = 'visible'
		})
	})

</script>

<svelte/>

<div id="Overlay">
	<div class="topitem" id="welcomebar">
		<div id="topright">
			{#if $toprightReconnect}
				<div>{$toprightReconnect} [<a href on:click|preventDefault={(ev) => window.location.reload()}>Reconnect?</a>]</div>
			{:else}
				{@html $toprightText}
			{/if}
		</div>
		<div id="topleft">
			<span>Join:</span>
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

	<div id="info" hidden="{!$debugMode}">
		Built build_time (build_info).<br />
		<span id="log"></span>
	</div>
	<div id="stats" hidden="{!$debugMode}"></div>
	
</div>

<style>
	#Overlay {
		position: absolute;
		top: 0px;
		width: 100%;
		pointer-events: none; /* Clicks go through it */
		z-index: 40;
	}
	#Overlay > * {
		pointer-events: auto; /* Everything else receives */
	}
	.topitem {
		background-color: rgb(33, 33, 33); /* #fdfbd3; */ /* FFF4BC */
		padding: 6px;
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
		padding-top:4px;
	}
	#topright {
		float: right;
		/* position: absolute; */
		right: 0px;
		margin-top: 5px;
	}
	#topright > div {
		position: relative;
		top: -5px;
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
		background-color: white;
		opacity: 0.75;
		padding: 7px;
		padding-bottom: 2px;
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
		z-index: 20;
	}
	:global #drag {
		position: absolute;
		left: -1px;
		top: 0;
		bottom: 0;
		width: 12px;
		cursor: w-resize;
	}

	:global ul li:before { /* Prevent papercss from clobbering list items, like menu and dat.gui */
		content: "";
	}

	:global div.dg.ac { /* Move dat.gui down */
		top: 40px;
	}

</style>
