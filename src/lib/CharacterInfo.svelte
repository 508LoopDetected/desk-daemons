<script>
  export let character;
  export let type;
  let htmlContent;
  $: if (type === 'player') {
    htmlContent = '<img class="avatar" src="skull.gif">';
  } else {
    htmlContent = '<img class="avatar" src="zesty.gif">';
  }
</script>

<div class={`${type}-info`}>
  <h3>
    <span class={`${type}-sprite`}>
      {@html htmlContent}
    </span> {character.name}
  </h3>
  <div class={`${type}-stats`}>
    <p><strong>HP:</strong> {character.stats.hp} | <strong>MP:</strong> {character.stats.mp}</p>
    <p>Level: {character.level}, Strength: {character.stats.strength}, Vitality: {character.stats.vitality}, Magic: {character.stats.magic}, Agility: {character.stats.agility}, Luck: {character.stats.luck}</p>
    <p class="resistances"><strong>Physical:</strong> {character.resistances.physical}<br/>
      <strong>Fire:</strong> {character.resistances.fire}<br/>
      <strong>Electric:</strong> {character.resistances.electric}<br/>
      <strong>Ice:</strong> {character.resistances.ice}<br/>
      <strong>Force:</strong> {character.resistances.force}<br/>
      <strong>Light:</strong> {character.resistances.light}<br/>
      <strong>Dark:</strong> {character.resistances.dark}</p>
  </div>
</div>

<style>
  :global(.avatar) {
    height: 52px;
  }
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
    text-align: center;
    font-size: 1.2rem;
  }

  .enemy-sprite,
  .player-sprite {
    font-size: 42px;
    margin-bottom: 10px;
  }

  .enemy-stats,
  .player-stats {
    text-align: center;
  }
</style>