<script>
	import { onMount, afterUpdate } from 'svelte'
	import { socketSend, baseDomain, isProd, rightMouseDown, menuSelfData, nickTargetId } from "../stores.js"
	import Cookies from 'js-cookie'
	import { log } from '../Utils.js'
	import { InputSys } from '../sys/InputSys.js'
	import { SocketSys } from '../sys/SocketSys.js'

	let Crafting
	let options = $$props.options
	let wobId = $$props.wobId

	// if(document.getElementById('Crafting')){
	// 	const craftingMenu = document.getElementById('Crafting')
	// 		document.body.removeChild(craftingMenu)
	// 	}
	// function updateWOB(opt) {
	// 	const craftingMenu = document.getElementById('Crafting')
	// 		document.body.removeChild(craftingMenu)
	// 		log("User selected: " + opt + " wobID: " + wobId)

	// 	// Need a way to send an update to the server, will circle back to this
	// 	socketSend.set({
	// 		'action': {
	// 			verb: 'craft',
	// 			noun: wobId,
	// 			data: opt
	// 		}
	// 	})
	// }


</script>

<svelte/>

<!-- <div id="Crafting">
	<ul>
		{#each options as opt}
			<button class="craftbtn" id="{opt}" on:submit={(ev) => ev.preventDefault()} on:mouseup={(ev) => updateWOB(opt)}>{opt}</button>
		{/each}
	</ul>

</div>  -->

<style>

</style>
