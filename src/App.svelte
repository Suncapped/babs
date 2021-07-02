<!-- App.svelte -->
<script>
	import {onMount} from 'svelte';
	let count = 0;
	onMount(() => {
	  const interval = setInterval(() => count++, 1000);
	  return () => {
		clearInterval(interval);
	  };
	});
</script>
<style>
  /* css will go here */
</style>
<div class="App">
  <header class="App-header">
    <a class="App-link" href="https://svelte.dev" target="_blank" rel="noopener noreferrer">
      Learn Svelte
    </a>
	<p>&nbsp;</p>

	<p>Page has been open for <code>{count}</code> seconds.</p>
  </header>
</div>