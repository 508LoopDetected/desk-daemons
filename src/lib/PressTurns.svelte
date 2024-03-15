<script>
  export let player;
  export let currentEnemy;
</script>

<div class="press-turns">
  <div class="player-turns">
    <h3>Player Turns</h3>
    {#each Array(player.pressTurns) as _, i}
      <span class="turn-icon">⚔️</span>
    {/each}
  </div>
  <div class="enemy-turns">
    <h3>Enemy Turns</h3>
    {#each Array(currentEnemy.pressTurns) as _, i}
      <span class="turn-icon">👿</span>
    {/each}
  </div>
</div>

<style>

  .press-turns {
    display: flex;
    justify-content: space-around;
    align-items: center;
    background-color: #000;
    padding: 10px;
  }

  .player-turns,
  .enemy-turns {
    text-align: center;
  }

  .turn-icon {
    font-size: 32px;
    margin: 0 5px;
  }
</style>