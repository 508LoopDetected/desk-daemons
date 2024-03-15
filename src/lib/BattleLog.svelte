<script>
  import { player, battleLog } from './stores.js';
  export let currentEnemy;

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
    border: 2px solid #444;
    padding: 10px;
    background-color: #000;
    max-height: 60vh;
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    overflow-y: scroll;
  }

  :global(.battle-log p.player-action) {
    background-color: #1b5e20;
    color: #c8e6c9;
    padding: 10px;
    margin: 5px 0;
  }

  :global(.battle-log p.enemy-action) {
    background-color: #b71c1c;
    color: #ffcdd2;
    padding: 10px;
    margin: 5px 0;
  }

  :global(.battle-log p.status-effect) {
    background-color: #6b1cb7;
    color: #d5cdff;
    padding: 10px;
    margin: 5px 0;
  }

  :global(.battle-log p.system-message) {
    background-color: #424242;
    color: #e0e0e0;
    text-align: center;
    font-weight: bold;
    padding: 10px;
    margin: 5px 0;
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