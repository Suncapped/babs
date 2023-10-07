<script>
	import { onMount, afterUpdate } from 'svelte'
	import { socketSend, baseDomain, isProd, menuSelfData } from "../stores"
	import { log } from '@/Utils'
	import { draggable } from '@neodrag/svelte'
	import { UiSys } from '@/sys/UiSys';

	const DRAG_THRESHOLD = 2
	let Container
	let content
	
	// Defaults
	let ui = $$props.ui
	ui.w ||= 250
	ui.h ||= 250
	ui.x ||= window.innerWidth -ui.w *2
	ui.y ||= window.innerHeight
	ui.unfurled = ui.unfurled === undefined ? false : ui.unfurled

	ui.virtx = ui.x // Virtual x, for use here
	ui.virty = ui.y

	// Set up draggable	
	let options = {
		handle: '.Container > .handle',
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
		log.info('Container addWob', wob, renderedIcon)

		const size = UiSys.ICON_SIZE
		const p = document.createElement('img')
		p.id = 'contained-wob-'+wob.id
		p.classList.add('contained-wob')
		p.style.position = 'absolute'
		p.style.left =  (wob.x -size/2)+'px'
		p.style.top = (wob.z -size/2)+'px'
		p.style.width = size+'px'
		p.style.height = size+'px'
		p.src = renderedIcon.image
		content.appendChild(p)
	}

	export function delWob(wobId) {
		log('Container delWob', wobId)
		const item = document.getElementById('contained-wob-'+wobId)
		if(item) {
			content.removeChild(item)
		}
	}


</script>

<svelte:window on:resize={updateDimensions} />

<div 
	use:draggable={{...options, position: {x: ui.virtx, y:ui.virty}}} 
	on:neodrag:start={dragStart} 
	on:neodrag={onDrag} 
	on:neodrag:end={dragEnd} 
	on:resize={updateDimensions} 
	bind:this={Container} 
	id="container-for-{ui.idobject}" 
	class="Container card border border-1 border-primary {ui.unfurled ? 'unfurled' : ''}"
	>
	<div 
		role="presentation"
		bind:this={header} 
		on:contextmenu={(ev) => ev.preventDefault()} 
		class="handle card-header" 
		on:mouseup={(ev) => {
			if(document.body.style.cursor === 'auto' || !document.body.style.cursor) { // Not carrying
				setFurl(ev, !ui.unfurled)
			}
		}}
		>
		{containerName}
	</div>
	<div 
		bind:this={content} 
		class="content card-body container-body"
		>
	</div>
</div>

<style>
	.Container {
		z-index: 40;
		background-color:rgba(12, 12, 12, 0.8);	
	}
	.Container > .content {
		padding: 0px;
		position: relative;
	}
	:global .Container > .content > img {
		pointer-events:none; /* Object interaction handled by InputSys */
	}


</style>
