<script>
	import { onMount, afterUpdate } from 'svelte'
	import { socketSend, baseDomain, isProd, rightMouseDown, menuSelfData } from "../stores"
	import Cookies from 'js-cookie'
	
	import { InputSys } from '@/sys/InputSys'

	let chatbox

	// document.addEventListener('keydown', chatKeydown);

	const sendChat = () => {
		if(!chatbox.textContent) return

		if(chatbox.textContent.startsWith('/')) { // Slash command
			const command = chatbox.textContent.substring(1)
			socketSend.set({
				action: {
					verb: 'commanded',
					noun: command,
				}
			})

		}
		else if(chatbox.textContent.startsWith(InputSys.NickPromptStart)) { //Naming someone
			const nickparts = chatbox.textContent.split(':')
			nickparts.shift()
			socketSend.set({
				// savenick: {
				// 	idplayer: $nickTargetId,
				// 	nick: nickparts.join(':'),
				// },
			})
		}
		else { // Regular chat
			if(chatbox.textContent !== 'w') {
				socketSend.set({
					chat: {
						text: chatbox.textContent
					},
				})
			}
		}
		chatbox.textContent = ''
	}
	function chatKeydown(ev) {
		// console.log('chatKeydown', $rightMouseDown, ev)

		// if($rightMouseDown) return

		// Don't add anything if they are manually editing the div
		if(ev.target.id === 'chatbox') {
			// Except if they hit enter; then send it
			if(ev.code === 'Enter') {
				// sendChat()
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
			chatbox.style.display = chatbox.textContent ? 'block' : 'none' // Needed because next return catches in-box edits
		}

		if(ev.target !== document.body) return // Only active if on main game window, not login forms etc
		
		// Only enter keys that are talking keys
		const singleCharacter = ev.key.length === 1
		if(singleCharacter) { // Normal key or spacebar

			if(ev.key === 'w' && chatbox.textContent === 'w') {
				return // Skip held down W
			}

			chatbox.textContent += ev.key // .innerText didn't work with ' '
		}
		else { // Not a normal key
			if(ev.key === 'Backspace') { // Except backspace, which shall backspace properly
				chatbox.textContent = chatbox.textContent.slice(0, -1)
			}
			else if(ev.key === 'Enter') { // Enter submits instead of other stuff
				// sendChat()
			}
			else { // Skip control keys like Control, Meta, etc
				return
			}
		}

		// console.log('chatbox.textContent', chatbox.textContent)
		chatbox.style.display = chatbox.textContent ? 'block' : 'none'

		// document.getElementById('info').style.display = chatbox.style.display === 'block' ? 'none' : 'block' // Hide debug stuff
		// document.getElementById('fps').style.display = chatbox.style.display === 'block' ? 'none' : 'block' // Hide debug stuff
		// document.getElementById('mem').style.display = chatbox.style.display === 'block' ? 'none' : 'block' // Hide debug stuff
	}
	

	menuSelfData.subscribe((val) => {
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
		pointer-events: none; /* Clicks go through it */
		
	}
	
	#chatbox{
		background-color:rgba(0, 0, 0, 0.75);
		/* height: 100px; */
		width: 100%;
		/* background-color:white; */
		position:absolute;
		bottom:0px;
		left:0px;
		display: none;
		pointer-events: auto; /* Clicks affect it */

		padding: 5px 10px;
		padding-top:10px;
		z-index: 40;

		white-space: pre-wrap;
		pointer-events: none;
		user-select: none;
	}
	#chatbox::selection { background: transparent; } /* Hide visible selection during select-all */

	#Ctext [contenteditable]:focus {
    	outline: 0px solid transparent;
	}

</style>
