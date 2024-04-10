<script>
export let player;
export let currentEnemy;
export let isPlayerTurn;
</script>

<div class="press-turns">
  {#if isPlayerTurn}
    <div class="player-turns">
      <h3>Player Turns</h3>
      {#each Array(player.pressTurns) as _, i}
        <span class="turn-icon"><img class="avatar" src="rubik.gif"></span>
      {/each}
    </div>
  {:else}
    <div class="enemy-turns">
      <h3>Enemy Turns</h3>
      {#each Array(currentEnemy.pressTurns) as _, i}
        <span class="turn-icon"><img class="avatar" src="cube.gif"></span>
      {/each}
    </div>
  {/if}
</div>

<style>
.press-turns {
  position: absolute;
  z-index: 9;
  top: 0;
  left: 0;
  right: 0;
  margin: auto;
  color: #fff;
  text-align: center;
  font-size: 1.2rem;
}
.avatar {
  height: 72px;
}
</style>