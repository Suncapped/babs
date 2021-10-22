<script>
	import { onMount, afterUpdate } from 'svelte'
	import { topmenuVisible, socketSend, baseDomain, isProd, rightMouseDown } from "../stores.js"
	import Cookies from 'js-cookie'
	import { log } from '../Utils.js'

	let chatbox

	document.addEventListener('keydown', chatKeydown);

	topmenuVisible.subscribe(val => {
		log('topMenuVisible', val)
	})

	// const bannedKeys = [
	// 	'Shift',
	// 	'Control',
	// 	'Meta',
	// 	'Alt',
	// 	'',
	// 	'',
	// ]
	const sendChat = () => {
		if(!chatbox.textContent) return
		socketSend.set({
			'chat': {
				text: chatbox.textContent
			},
		})
		chatbox.textContent = ''
	}
	function chatKeydown(ev) {
		log('chatKeydown', $rightMouseDown, ev)

		if($rightMouseDown) return

		// Don't add anything if they are manually editing the div
		if(ev.target.id === 'chatbox') {
			// Except if they hit enter; then send it
			if(ev.code === 'Enter') {
				sendChat()
				// No return, so that style visibility gets updated
			}
			else if(ev.code === 'Escape') {
				// If editing and you hit escape, defocus chat
				// Not needed!
			}
			else { // Skip all character keys when manually editing
				return
			}
		}
		

		if(ev.target !== document.body) return // Only active if on main game window, not login forms etc
		
		// Only enter keys that are talking keys
		// const firstThree = ev.code.substring(0,3)
		const singleCharacter = ev.key.length === 1
		log('singleCharacter', singleCharacter, ev.code.length)
		// if(firstThree !== 'Key' && firstThree !== ' ') { // Not a normal key or spacebar
		if(singleCharacter) { // Normal key or spacebar
			chatbox.textContent += ev.key // .innerText didn't work with ' '
		}
		else { // Not a normal key
			if(ev.key === 'Backspace') { // Except backspace, which shall backspace properly
				log('back', ev)
				chatbox.textContent = chatbox.textContent.slice(0, -1)
			}
			else if(ev.key === 'Enter') { // Enter submits instead of other stuff
				sendChat()
			}
			else { // Skip control keys like Control, Meta, etc
				return
			}
		}

		chatbox.style.display = chatbox.textContent ? 'block' : 'none'

		document.getElementById('info').style.display = chatbox.style.display === 'block' ? 'none' : 'block' // Hide debug stuff
		document.getElementById('fps').style.display = chatbox.style.display === 'block' ? 'none' : 'block' // Hide debug stuff
		document.getElementById('mem').style.display = chatbox.style.display === 'block' ? 'none' : 'block' // Hide debug stuff

		
		// ev.preventDefault()
	}

</script>

<svelte/>

<div id="Ctext">
	
	<div contenteditable bind:this={chatbox} id="chatbox"></div>
</div>

<style>
	#Ctext {
		position: absolute;
		top: 0px;
		width: 100%;
		height: 100%;
		z-index: 1;
		pointer-events: none; /* Clicks go through it */
	}
	
	#Ctext > .label{
		
	}

	#Ctext > .chatbubble{

	}

	#chatbox{
		/* height: 100px; */
		width: 100%;
		background-color:white;
		position:absolute;
		bottom:0px;
		left:0px;
		display: none;
		pointer-events: auto; /* Clicks affect it */

		padding: 5px 10px;
		opacity: 0.8;
	}

	#Ctext [contenteditable]:focus {
    	outline: 0px solid transparent;
	}

</style>
