<script>
  import { player, battleLog } from './stores.js';
  import { scale } from 'svelte/transition';
  import { onDestroy } from 'svelte';

  export let currentEnemy;

  let fadeOutTimer;

  $: reversedBattleLog = [...$battleLog].reverse();
  $: latestMessage = reversedBattleLog[0];
  $: remainingMessages = reversedBattleLog.slice(1);

  function startFadeOutTimer(node) {
    clearTimeout(fadeOutTimer);
    node.style.opacity = 1;
    fadeOutTimer = setTimeout(() => {
      node.style.opacity = 0;
    }, 2000); // Fade out after 3 seconds
  }

  onDestroy(() => {
    clearTimeout(fadeOutTimer);
  });
</script>

<div class="battle-log">
  {#each remainingMessages as logEntry}
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

<div id="latestMessage">
  {#key latestMessage}
    {#if latestMessage}
      <p class={latestMessage.type} class:flash={true} in:scale={{ start: 0.5, duration: 500 }} use:startFadeOutTimer>
        {#if latestMessage.type === 'player-action'}
          <span class="player-name">{$player.name}</span> {latestMessage.message}
        {:else if latestMessage.type === 'enemy-action'}
          <span class="enemy-name">{currentEnemy.name}</span> {latestMessage.message}
        {:else if latestMessage.type === 'calculation'}
          <pre>{latestMessage.message}</pre>
        {:else}
          {latestMessage.message}
        {/if}
      </p>
    {/if}
  {/key}
</div>

<style>

  .battle-log {
    /*display: flex;
    flex-direction: column-reverse;*/
    display: none;
  }

  #latestMessage {
    font-size: 2rem;
    overflow-y: hidden;
    position: relative;
  }

  #latestMessage p {
    text-align: center;
    padding: 20px 15px;
    margin: 0 auto;
    opacity: 1;
    display: block;
    transition: opacity 1s ease-in-out;
    position: relative;
    max-width: 850px;
    z-index: 1;
    border: 5px solid rgba(0,0,0,0.7);
  }
  #latestMessage p:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    z-index: -1;
    opacity: 0.5;

  }

  #latestMessage p.flash {
    animation: wobble 0.5s ease-in-out;
  }

  @keyframes wobble {
    0% {
      transform: scale(1);
    }
    25% {
      transform: scale(1.1);
    }
    50% {
      transform: scale(0.9);
    }
    75% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }

  :global(#latestMessage p.player-action:after) {
    background-color: #1b5e20;
  }

  :global(#latestMessage p.player-action) {
    color: #c8e6c9;
  }

  :global(#latestMessage p.enemy-action:after) {
    background-color: #b71c1c;
  }

  :global(#latestMessage p.enemy-action) {
    color: #ffcdd2;
  }

  :global(#latestMessage p.status-effect:after) {
    background-color: #6b1cb7;
  }

  :global(#latestMessage p.status-effect) {
    color: #d5cdff;
  }

  :global(#latestMessage p.system-message:after) {
    background-color: #424242;
  }

  :global(#latestMessage p.system-message) {
    color: #fff;
    font-weight: bold;
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