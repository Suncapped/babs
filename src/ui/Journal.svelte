<script>
	import { onMount, afterUpdate } from 'svelte'
	import { topmenuVisible, socketSend, baseDomain, isProd, rightMouseDown, menuSelfData, inputCmd } from "../stores.js"
	import { log } from '../Utils.js'
	import { draggable } from 'svelte-drag'




	let Journal
	let content

	// Defaults
	let ui = $$props.ui
	ui.w ||= 300
	ui.h ||= 300
	ui.x ||= window.innerWidth -ui.w
	ui.y ||= 60
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
		appendText(ev.detail.offsetX +','+ ev.detail.offsetY)
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

	export function appendText(text) {
		const textNode = document.createTextNode(text)
		const p = document.createElement('p')
		p.appendChild(textNode)
		content.appendChild(p)
		content.scrollTop = content.scrollHeight
	}
	

</script>

<svelte/>

<div bind:this={Journal} id="Journal" use:draggable={options} on:svelte-drag:end={dragEnd}>
	<div class="handle">Journal</div>
	<div bind:this={content} class="content"></div>
</div>

<style>
	#Journal {
		position: absolute;
		top: 0px;
		height: 200px;

		background-color: green;
	}
	#Journal > .handle {
		background-color: red;
	}
	#Journal > .content {
		background-color: gray;
		overflow: auto;
		height: 100%;
	}

	:global #Journal p {
		/* line-height: 0; */
		margin:0;
		padding:0;
	}

</style>
