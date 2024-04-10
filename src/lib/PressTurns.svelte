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
  top: 12vh;
  left: 4vw;
  color: #fff;
}

.player-turns {
  text-align: left;
}
.enemy-turns {
  text-align: right;
}
.avatar {
  height: 72px;
}
</style>