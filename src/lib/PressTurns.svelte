<script>
  export let player;
  export let currentEnemy;
</script>

<div class="press-turns">
  <div class="player-turns">
    <h3>Player Turns</h3>
    {#each Array(player.pressTurns) as _, i}
      <span class="turn-icon"><img class="avatar" src="rubik.gif"></span>
    {/each}
  </div>
  <div class="enemy-turns">
    <h3>Enemy Turns</h3>
    {#each Array(currentEnemy.pressTurns) as _, i}
      <span class="turn-icon"><img class="avatar" src="cube.gif"></span>
    {/each}
  </div>
</div>

<style>

  .press-turns {
    display: flex;
    justify-content: space-around;
    align-items: center;
    background-color: #000;
    color: #fff;
  }

  .player-turns,
  .enemy-turns {
    text-align: center;
    height: 125px;
  }
</style>