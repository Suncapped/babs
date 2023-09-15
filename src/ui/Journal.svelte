<script>
	import { onMount, afterUpdate } from 'svelte'
	import { socketSend, baseDomain, isProd, rightMouseDown, menuSelfData, topmenuUnfurled } from "../stores"
	import { log } from '@/Utils'
	import { draggable } from '@neodrag/svelte'

	const DRAG_THRESHOLD = 2
	let Journal
	let content

	// Defaults
	let ui = $$props.ui
	ui.w ||= 250
	ui.h ||= 250
	ui.x ||= window.innerWidth
	ui.y ||= window.innerHeight
	ui.unfurled = ui.unfurled === undefined ? true : ui.unfurled

	ui.virtx = ui.x // Virtual x, for use here
	ui.virty = ui.y 

	// Set up draggable	
	let options = {
		handle: '#Journal > .handle',
		bounds: 'parent',
		axis: 'none', // Disable drag
	}
	log.info('init, options, ui:', options, ui)

	let dragDistance = 0
	let dragOffsetX
	let dragOffsetY
	const dragStart = (ev) => {
		// dragDistance = 0
		// dragOffsetX = ev.detail.offsetX
		// dragOffsetY = ev.detail.offsetY
	}
	const onDrag = (ev) => {
		// dragDistance = Math.max(Math.abs(ev.detail.offsetX -dragOffsetX), Math.abs(ev.detail.offsetY -dragOffsetY), dragDistance)
	}
	const dragEnd = (ev) => {
		// if(dragDistance > DRAG_THRESHOLD) { // Save new position and set virtual to it
		// 	ui.virtx = ui.x = ev.detail.offsetX
		// 	ui.virty = ui.y = ev.detail.offsetY
		// 	socketSend.set({
		// 		'saveui': ui,
		// 	})
		// }
		// else { // Retain original
		// 	ui.virtx = ui.x
		// 	ui.virty = ui.y
		// }
		// setTimeout(() => {
		// 	dragDistance = 0
		// }, 10)
	}
	function updateDimensions(ev) {
		Journal.style.width = ui.unfurled ? ui.w+'px' : 'auto'
		Journal.style.height = ui.unfurled ? ui.h+'px' : 'auto'

		setTimeout(() => {
			const rect = Journal.getBoundingClientRect()
			// const xOverflow = ui.x +rect.width -window.innerWidth
			// const yOverflow = ui.y +rect.height -window.innerHeight
			// ui.virtx = ui.x -Math.max(0, xOverflow)
			// ui.virty = ui.y -Math.max(0, yOverflow)

			ui.virtx = 0
			ui.virty = window.innerHeight -rect.height
		}, 1)
	}

	// function setFurl(ev, furl) {
	// 	if(dragDistance > DRAG_THRESHOLD) {
	// 		return // Don't toggle if they were just dragging
	// 	}
	// 	ui.unfurled = furl
	// 	socketSend.set({
	// 		'saveui': ui,
	// 	})
	// 	updateDimensions()
	// }


	
	onMount(() => {
		// Style based on ui input
		updateDimensions()

		topmenuUnfurled.subscribe(vis => {
			ui.unfurled = vis
			updateDimensions()
		})
	})

	export function appendText(text, color, align) {
		const textNode = document.createTextNode(text)
		const p = document.createElement('p')
		p.appendChild(textNode)
		p.style.color = color
		p.style.textAlign = align
		content.appendChild(p)
		content.scrollTop = content.scrollHeight
	}

</script>

<svelte:window on:resize={updateDimensions} />

<div style="cursor:default;" use:draggable={{...options, position: {x: ui.virtx, y:ui.virty}}} on:neodrag:start={dragStart} on:neodrag={onDrag} on:neodrag:end={dragEnd} on:resize={updateDimensions} bind:this={Journal} id="Journal" class="card border border-1 border-primary {ui.unfurled ? 'unfurled' : ''}">
	{#if $topmenuUnfurled}
		<div role="presentation" on:contextmenu={(ev) => ev.preventDefault()} class="handle card-header">Journal</div>
	{/if}
	<div bind:this={content} class="content card-body"></div>
</div>

<style>
	#Journal {
		z-index: 30;
		background-color:rgba(12, 12, 12, 0.8);
	}
	#Journal > .content {
		padding: 8px;
		padding-left: 12px;	

		font-size: 18px;
		user-select: text;
		overflow-y: scroll;
		scrollbar-width:none;
	}
	#Journal > .content::-webkit-scrollbar {
		display: none; /* for Chrome, Safari, and Opera */
	}
	:global #Journal p { /* Global needed since p's are inserted by ui? */
		z-index: 50;
		margin:0;
		padding:0;
	}

</style>
