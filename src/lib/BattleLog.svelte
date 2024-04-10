<script>
  import { player, battleLog } from './stores.js';
  export let currentEnemy;
  export let isPlayerTurn;

  $: reversedBattleLog = [...$battleLog].reverse();
</script>

<div class="battle-log">
  {#each reversedBattleLog as logEntry}
    <p class={logEntry.type}>
      {#if logEntry.type === 'player-action'}
        <span class="player-name">{$player.name}</span> {logEntry.message}
      {:else if logEntry.type === 'enemy-action'}
        <span class="enemy-name">{currentEnemy.name}</span> {logEntry.message}
      {:else if logEntry.type === 'calculation'}
        <pre>{logEntry.message}</pre>
      {:else}
        {logEntry.message}
      {/if}
    </p>
  {/each}
</div>

<style>
  .battle-log-section {
    height: 100%;
  }

  .battle-log {
    display: flex;
    flex-direction: column-reverse;
    padding: 10px;
    background-color: #111;
    height: 90px;
    font-family: 'Courier New', monospace;
    font-size: 1.5rem;
    overflow-y: hidden;
    position: relative;
  }

  .battle-log:after {
    width: 100%;
    height: 70%;
    content: '';
    top: 0;
    left: 0;
    z-index: 2;
    display: block;
    position: absolute;
    background: linear-gradient(rgba(0,0,0,1),rgba(0,0,0,0));
  }

  :global(.battle-log p.player-action) {
    background-color: #1b5e20;
    color: #c8e6c9;
    padding: 10px;
    margin: 15px 0;
  }

  :global(.battle-log p.enemy-action) {
    background-color: #b71c1c;
    color: #ffcdd2;
    padding: 10px;
    margin: 15px 0;
  }

  :global(.battle-log p.status-effect) {
    background-color: #6b1cb7;
    color: #d5cdff;
    padding: 10px;
    margin: 15px 0;
  }

  :global(.battle-log p.system-message) {
    background-color: #424242;
    color: #e0e0e0;
    text-align: center;
    font-weight: bold;
    padding: 10px;
    margin: 15px 0;
  }

  .player-name {
    font-weight: bold;
    color: #c8e6c9;
  }

  .enemy-name {
    font-weight: bold;
    color: #ffcdd2;
  }
  .player-actions-section {
    grid-column: 1 / 3;
  }

  .player-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }
</style>