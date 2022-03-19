<script>
	import { onMount, afterUpdate } from 'svelte'
	import { socketSend, baseDomain, isProd, rightMouseDown, menuSelfData, inputCmd, nickTargetId } from "../stores.js"
	import Cookies from 'js-cookie'
	import { log } from '../Utils.js'
	import { InputSys } from '../sys/InputSys.js';


</script>

<svelte/>

<div id="Crafting">
	
	<!-- <div contenteditable bind:this={chatbox} id="chatbox"></div> -->
</div>

<style>
	#Crafting {
		position: absolute;
		top: 0px;
		width: 100%;
		height: 100%;
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
        /* font-family: "Nunito", sans-serif; */
		/* font-weight:bold; */
		font-size: 18px;
        /* color: white; */
        /* text-shadow: 0 0 2px black, 0 0 2px black, 0 0 2px black, 0 0 2px black;  */
		/* -webkit-text-stroke: 1px #333; */ /* Actually works on chrome/ff too */
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
		z-index: 40;
	}

	#Ctext [contenteditable]:focus {
    	outline: 0px solid transparent;
	}

</style>
