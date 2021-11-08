<script>
	import { onMount, afterUpdate } from 'svelte'
	import { topmenuVisible, socketSend, baseDomain, isProd, rightMouseDown, menuSelfData, inputCmd } from "../stores.js"
	import Cookies from 'js-cookie'
	import { log } from '../Utils.js'

	let chatbox

	document.addEventListener('keydown', chatKeydown);

	const sendChat = () => {
		if(!chatbox.textContent) return

		if(chatbox.textContent.startsWith('/')) { // Slash command
			const cmd = chatbox.textContent.substring(1)
			inputCmd.set(cmd)
		}
		else { // Regular chat
			socketSend.set({
				'chat': {
					text: chatbox.textContent
				},
			})
		}
		chatbox.textContent = ''
	}
	function chatKeydown(ev) {
		// log('chatKeydown', $rightMouseDown, ev)

		if($rightMouseDown) return

		// Don't add anything if they are manually editing the div
		if(ev.target.id === 'chatbox') {
			// Except if they hit enter; then send it
			if(ev.code === 'Enter') {
				sendChat()
				// No return, so that style visibility gets updated
				ev.preventDefault()
			}
			else if(ev.code === 'Escape') {
				// If editing and you hit escape, defocus chat
				// Not needed!
			}
			else { // Skip all character keys when manually editing
				return
			}
			chatbox.style.display = chatbox.textContent ? 'block' : 'none' // Needed because next return catchines in-box edits
		}

		if(ev.target !== document.body) return // Only active if on main game window, not login forms etc
		
		// Only enter keys that are talking keys
		const singleCharacter = ev.key.length === 1
		if(singleCharacter) { // Normal key or spacebar
			chatbox.textContent += ev.key // .innerText didn't work with ' '
		}
		else { // Not a normal key
			if(ev.key === 'Backspace') { // Except backspace, which shall backspace properly
				chatbox.textContent = chatbox.textContent.slice(0, -1)
			}
			else if(ev.key === 'Enter') { // Enter submits instead of other stuff
				sendChat()
			}
			else { // Skip control keys like Control, Meta, etc
				return
			}
		}

		// log('chatbox.textContent', chatbox.textContent)
		chatbox.style.display = chatbox.textContent ? 'block' : 'none'

		// document.getElementById('info').style.display = chatbox.style.display === 'block' ? 'none' : 'block' // Hide debug stuff
		// document.getElementById('fps').style.display = chatbox.style.display === 'block' ? 'none' : 'block' // Hide debug stuff
		// document.getElementById('mem').style.display = chatbox.style.display === 'block' ? 'none' : 'block' // Hide debug stuff
	}
	

	menuSelfData.subscribe(val => {
		if(chatbox && val?.color) {
			chatbox.style.color = val.color
		}
	})

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
	
	:global #Ctext > #labelRenderer > .label{
		width: 300px;
		text-align: center;
		/* vertical-align: top; */
		/* position:absolute; */
		/* top: 100px; */

		/* background-color:red; opacity: 0.5; */
		/* border: 2px solid green; */
		
	}
	:global #Ctext > #labelRenderer > .label > span{
        display: inline-block;
		text-align: left;
		/* hyphens: auto;
		-webkit-hyphens: auto; */
		margin-top:-50%; /* hmm; bottom-align paragraphs */

		/* background-color:blue; opacity: 0.5; */
		/* border:1px solid red; */
	}

	#chatbox, :global #Ctext > #labelRenderer > .label { /* Font settings, basically */
        font-family: "Nunito", sans-serif;
		font-weight:bold;
		font-size: 16px;
        color: white;
        /* text-shadow: 0 0 2px black, 0 0 2px black, 0 0 2px black, 0 0 2px black;  */
		-webkit-text-stroke: 1px #333; /* Actually works on chrome/ff too */
		position: absolute; /* UiSys counts on this for placement */
		/* background-color:green; */
	}

	#chatbox{
		/* height: 100px; */
		width: 100%;
		/* background-color:white; */
		position:absolute;
		bottom:0px;
		left:0px;
		display: none;
		pointer-events: auto; /* Clicks affect it */

		padding: 5px 10px;
	}

	#Ctext [contenteditable]:focus {
    	outline: 0px solid transparent;
	}

</style>
