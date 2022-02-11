<script>
	import { onMount, afterUpdate } from 'svelte'
	import { socketSend, baseDomain, isProd, rightMouseDown, menuSelfData, inputCmd } from "../stores.js"
	import { log } from '../Utils.js'
	import { draggable } from '@neodrag/svelte'

	const DRAG_THRESHOLD = 2
	let Container
	let content

	// Defaults
	let ui = $$props.ui
	ui.w ||= 250
	ui.h ||= 250
	ui.x ||= 0
	ui.y ||= 0
	ui.unfurled = ui.unfurled === undefined ? true : ui.unfurled

	ui.virtx = ui.x // Virtual x, for use here
	ui.virty = ui.y 

	// Set up draggable	
	let options = {
		handle: '#Container > .handle',
		bounds: 'parent',
	}
	log.info('init, options, ui:', options, ui)

	let dragDistance = 0
	let dragOffsetX
	let dragOffsetY
	const dragStart = (ev) => {
		dragDistance = 0
		dragOffsetX = ev.detail.offsetX
		dragOffsetY = ev.detail.offsetY
	}
	const onDrag = (ev) => {
		dragDistance = Math.max(Math.abs(ev.detail.offsetX -dragOffsetX), Math.abs(ev.detail.offsetY -dragOffsetY), dragDistance)
	}
	const dragEnd = (ev) => {
		if(dragDistance > DRAG_THRESHOLD) { // Save new position and set virtual to it
			ui.virtx = ui.x = ev.detail.offsetX
			ui.virty = ui.y = ev.detail.offsetY
			socketSend.set({
				'saveui': ui,
			})
		}
		else { // Retain original
			ui.virtx = ui.x
			ui.virty = ui.y
		}
		setTimeout(() => {
			dragDistance = 0
		}, 10)
	}
	function updateDimensions(ev) {
		Container.style.width = ui.unfurled ? ui.w+'px' : 'auto'
		Container.style.height = ui.unfurled ? ui.h+'px' : 'auto'

		setTimeout(() => {
			const rect = Container.getBoundingClientRect()
			const xOverflow = ui.x +rect.width -window.innerWidth
			const yOverflow = ui.y +rect.height -window.innerHeight
			ui.virtx = ui.x -Math.max(0, xOverflow)
			ui.virty = ui.y -Math.max(0, yOverflow)
		}, 1)
	}

	function setFurl(ev, furl) {
		if(dragDistance > DRAG_THRESHOLD) {
			return // Don't toggle if they were just dragging
		}
		ui.unfurled = furl
		socketSend.set({
			'saveui': ui,
		})
		updateDimensions()
	}

	onMount(() => {
		// Style based on ui input
		updateDimensions()
	})

	let containerName = 'Bag'
	let header
	export function addWob(wob, renderedIcon) {
		log('Container addWob', wob, renderedIcon, this)

		const size = 30
		const p = document.createElement('img')
		p.style.position = 'absolute'
		p.style.width = size+'px'
		p.style.height = size+'px'
		p.style.left =  wob.x+'px'
		p.style.top = (wob.z +header.getBoundingClientRect().height)+'px'
		p.src = renderedIcon
		content.appendChild(p)
	}

</script>

<svelte:window on:resize={updateDimensions} />

<div use:draggable={{...options, position: {x: ui.virtx, y:ui.virty}}} on:neodrag:start={dragStart} on:neodrag={onDrag} on:neodrag:end={dragEnd} on:resize={updateDimensions} bind:this={Container} id="Container" class="card border border-1 border-primary {ui.unfurled ? 'unfurled' : ''}">
	<div bind:this={header} on:contextmenu={(ev) => ev.preventDefault()} class="handle card-header" on:mouseup={(ev) => setFurl(ev, !ui.unfurled)}>{containerName}</div>
	<div bind:this={content} class="content card-body">
	</div>
</div>

<style>
	#Container > .content {
		padding: 0px;
	}

</style>
