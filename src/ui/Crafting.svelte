<script>
	import { onMount, afterUpdate } from 'svelte'
	import { socketSend, baseDomain, isProd, rightMouseDown, menuSelfData, inputCmd, nickTargetId } from "../stores.js"
	import Cookies from 'js-cookie'
	import { log } from '../Utils.js'
	import { InputSys } from '../sys/InputSys.js'


	let options = $$props.options

	// Move to position of object clicking on.

</script>

<svelte/>

<div id="Crafting">
	<ul>
		{#each options as opt}
			<li>
				{opt}
			</li>
		{/each}
	</ul>

</div>

<style>
	#Crafting {
		position: absolute;
		top: 0px;
		width: 100%;
		height: 100%;
		pointer-events: none; /* Clicks go through it */
		
	}

</style>
