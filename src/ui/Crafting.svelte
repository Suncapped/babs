<script>
	import { onMount, afterUpdate } from 'svelte'
	import { socketSend, baseDomain, isProd, rightMouseDown, menuSelfData, inputCmd, nickTargetId } from "../stores.js"
	import Cookies from 'js-cookie'
	import { log } from '../Utils.js'
	import { InputSys } from '../sys/InputSys.js'


	let options = $$props.options

	function updateWOB(opt) {
		const craftingMenu = document.getElementById('Crafting')
			document.body.removeChild(craftingMenu)
			console.log("User selected: ",opt)
		// Need a way to send an update to the server, will circle back to this
		// const update = this.babs.socketSys.send({
		// 						action: {
		// 							verb: 'craft',
		// 							noun: opt,
		// 						}
		// 					})
	}

</script>

<svelte/>

<div id="Crafting">
	<ul>
		{#each options as opt}
			<button id="{opt}" on:submit={(ev) => ev.preventDefault()} on:mouseup={(ev) => updateWOB(opt)}>{opt}</button>
		{/each}
	</ul>

</div>

<style>
	#Crafting {
		position: absolute;
		top: 0px;
		width: 100%;
		height: 100%;
	  pointer-events: fill; /* Allows the buttons to be clickable */
	}

</style>
