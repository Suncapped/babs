<script>
	import { onMount, afterUpdate } from 'svelte'
	import { topmenuVisible, socketSend, baseDomain, isProd, rightMouseDown, menuSelfData, inputCmd } from "../stores.js"
	import { log } from '../Utils.js'
	import { draggable } from 'svelte-drag'




	let Journal
	let content

	// Defaults
	let ui = $$props.ui
	ui.w ||= 250
	ui.h ||= 250
	ui.x ||= window.innerWidth -ui.w
	ui.y ||= 2000
	ui.unfurled ||= true
	// If doesn't fit in window, snap to edge at least.  Maybe don't need to update ui.
	// This can't be done in resize, since it is defaultPosition which only works on init in svelte-drag
	if(ui.x  +(ui.w)  > window.innerWidth) ui.x = window.innerWidth -(ui.w)
	if(ui.y  +(ui.h)  > window.innerHeight) ui.y = window.innerHeight -(ui.h)

	// Set up draggable	
	let options = {
		handle: '#Journal > .handle',
		bounds: 'parent', // It will recalc due to update()
		defaultPosition: {x: ui.x, y: ui.y},
	}
	log.info('init, options, ui:', options, ui)


	const dragEnd = (ev) => {
		ui.x = ev.detail.offsetX
		ui.y = ev.detail.offsetY
		socketSend.set({
			'saveui': ui,
		})
	}

	onMount(() => {
		// Style based on ui input
		Journal.style.width = ui.w+'px'
		Journal.style.height = 	ui.h+'px'
	})

	export function appendText(text, color) {
		const textNode = document.createTextNode(text)
		const p = document.createElement('p')
		p.appendChild(textNode)
		p.style.color = color
		content.appendChild(p)
		content.scrollTop = content.scrollHeight
	}
	

</script>

<svelte/>

<div bind:this={Journal} id="Journal" use:draggable={options} on:svelte-drag:end={dragEnd} class="card border border-1 border-primary">
	<div class="handle card-header">Journal</div>
	<div bind:this={content} class="content card-body"></div>
</div>

<style>
	#Journal {
		position: absolute;
		top: 0px;
		height: 200px;

		/* background-color: green; */
	}
	#Journal > .handle {
		padding: 6px 8px;
		padding-bottom:4px;
		font-size: 22px;

		/* background-color: red; */
	}
	#Journal > .content {
		padding: 8px;
		padding-left: 12px;
		font-size: 18px;
		user-select: text;
		
		overflow-y: scroll;
		scrollbar-width:none;

		/* border: 1px solid #333; */

		/* background-color: #000; */
	}
	#Journal > .content::-webkit-scrollbar {
		display: none; /* for Chrome, Safari, and Opera */
	}

	:global #Journal p {
		margin:0;
		padding:0;
	}

</style>
