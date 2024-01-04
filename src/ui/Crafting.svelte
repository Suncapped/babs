<script>
	import { onMount, afterUpdate } from 'svelte'
	import Cookies from 'js-cookie'
	
	import { InputSys } from '@/sys/InputSys'
	import { SocketSys } from '@/sys/SocketSys'

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
	// 		console.log("User selected: " + opt + " wobID: " + wobId)

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
