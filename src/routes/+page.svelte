<script>
  import Battle from '$lib/Battle.svelte';

</script>

<main>
  <Battle
    playerModel="player"
    enemyModels={['female_secretary']}
    objectModels={['PC']}
  />
</main>

<style type="text/css">
  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>