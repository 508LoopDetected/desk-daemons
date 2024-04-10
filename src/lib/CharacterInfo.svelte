<script>
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { player, currentEnemy } from './stores.js';

  export let type;

  let character;

  $: {
    character = type === 'player' ? $player : $currentEnemy;
  }

  const hpBar = tweened(0, { duration: 400, easing: cubicOut });
  const mpBar = tweened(0, { duration: 400, easing: cubicOut });

  $: {
    if (character) {
      hpBar.set(character.stats.hp);
      mpBar.set(character.stats.mp);
    }
  }
</script>

<div class="info-wrap">
  <div class={`${type}-info`}>
    <h3>{character.name}</h3>
  </div>
  <div class={`${type}-stats`}>
    <div class="stat-bars">
      <div class="bar-wrapper">
        <div class="bar hp-bar" style="width: {($hpBar / character.stats.maxHp) * 100}%;"></div>
        <span class="bar-label">HP: {character.stats.hp}/{character.stats.maxHp}</span>
      </div>
      <div class="bar-wrapper">
        <div class="bar mp-bar" style="width: {($mpBar / character.stats.maxMp) * 100}%;"></div>
        <span class="bar-label">MP: {character.stats.mp}/{character.stats.maxMp}</span>
      </div>
    </div>
  </div>
</div>

<!-- <p>Level: {character.level}, Strength: {character.stats.strength}, Vitality: {character.stats.vitality}, Magic: {character.stats.magic}, Agility: {character.stats.agility}, Luck: {character.stats.luck}</p>
<p class="resistances"><strong>Physical:</strong> {character.resistances.physical}<br/>
  <strong>Fire:</strong> {character.resistances.fire}<br/>
  <strong>Electric:</strong> {character.resistances.electric}<br/>
  <strong>Ice:</strong> {character.resistances.ice}<br/>
  <strong>Force:</strong> {character.resistances.force}<br/>
  <strong>Light:</strong> {character.resistances.light}<br/>
  <strong>Dark:</strong> {character.resistances.dark}</p> -->

<style>
  .resistances {
    column-count: 2;
    max-width: 350px;
    text-align: left;
    margin: 20px auto 0;
  }
  .enemy-section,
  .player-section {
    background-color: #fff;
    padding: 20px;
    height: 50%;
    border: 1px solid #ccc;
  }

  .enemy-info,
  .player-info {
    font-size: 1.2rem;
    text-transform: uppercase;
    color: #fff;
    letter-spacing: 2px;
  }

  .info-wrap {
    display: grid;
    grid-template-columns: 30% 70%;
    grid-template-rows: 1fr;
    gap: 0px 0px;
    grid-auto-flow: row;
  }

  .stat-bars {
    margin-top: 10px;
  }

  .bar-wrapper {
    position: relative;
    width: 100%;
    height: 30px;
    background-color: #000;
    overflow: hidden;
    margin-bottom: 5px;
  }

  .bar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    transition: width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .hp-bar {
    background-color: #4caf50;
  }

  .mp-bar {
    background-color: #2196f3;
  }

  .bar-label {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  }
</style>