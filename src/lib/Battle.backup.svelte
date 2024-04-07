<script>
  // CALLING ALL DAEMONS...WE ARE DESKBOUND
  import { onMount } from 'svelte';
  import { player, enemies, battleLog } from './stores.js';
  import { PRESS_TURN_MAX, calculateDamage, calculateHeal, applyAilment, updatePressTurns, updateAilmentDurations } from './battleUtils.js';
  import BattleLog from './BattleLog.svelte';
  import CharacterInfo from './CharacterInfo.svelte';

  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
  import ModelLoad from './ModelLoad.svelte';
  import modelCoworkers from '$lib/data/modelCoworkers.json';
  import modelObjects from '$lib/data/modelObjects.json';

  let currentEnemy = null;
  let isPlayerTurn = true; // player starts first

  // for the "battle mode" animation
  let isActive = false;
  function toggleActive() { isActive = !isActive; }

  export let playerModel = '';
  export let enemyModels = [];
  export let objectModels = [];

  let container;
  let camera, scene, renderer, controls, effect, clock;
  const mixers = {};
  const currentActions = {};
  let defaultAnimation = $player.defaultAnimation;
  let currentAction = defaultAnimation;


  // DOOT DOOT
  onMount(() => {
      currentEnemy = $enemies[Math.floor(Math.random() * $enemies.length)];
      // set press turns
      $player = { ...$player, pressTurns: PRESS_TURN_MAX };
      currentEnemy.pressTurns = PRESS_TURN_MAX;
      $battleLog = [...$battleLog, { type: 'system-message', message: `A wild ${currentEnemy.name} appeared!` }];

      if (!isWebGLAvailable()) {
        alert('WebGL is not available in your browser.');
        return;
      }
      init();
      animate();
  });




  // can we render the scene?
  function isWebGLAvailable() {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  }



  // create the scene
  function init() {
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 5000);
    camera.position.set(0, 200, 500);

    scene = new THREE.Scene();
    // scene.background = new THREE.Color(0xa0a0a0);
    // scene.fog = new THREE.Fog(0xa0a0a0, 700, 1800);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(-5, -5, -5);
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    effect = new OutlineEffect(renderer, {
      defaultThickness: 0.006,
      defaultColor: [0, 0, 0],
      defaultAlpha: 1,
      defaultKeepAlive: true,
    });

    controls = new OrbitControls(camera, renderer.domElement);
    controls.update();

    window.addEventListener('resize', onWindowResize, false);
  }

  function onModelLoaded(object) {
    if (!effect.selectedObjects) {
      effect.selectedObjects = [];
    }
    effect.selectedObjects.push(object);
  }

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Iterate over each mixer in the mixers object
    Object.values(mixers).forEach(mixer => {
        mixer.update(delta);
    });
    effect.render(scene, camera);
  }

  // 
  function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }


  function basicAttack(attacker, defender) {
    if (checkGameOver()) {
      return;
    }
    //$battleLog = [...$battleLog, { type: 'system-message', message: 'start player/enemy attack' }];
    // announce any status effects
    const playerAilmentMessages = updateAilmentDurations($player);
    playerAilmentMessages.forEach(message => {
      $battleLog = [...$battleLog, { type: 'status-effect', message }];
      //$battleLog = [...$battleLog, { type: 'system-message', message: `--- NEXT TURN ---` }];
    });
    const basePower = 10;
    const attackerStrength = attacker.stats.strength;
    const damageRange = [
      Math.max(basePower + attackerStrength - defender.stats.vitality, 1),
      Math.max(basePower + attackerStrength - defender.stats.vitality + 5, 1)
    ];
    const isCrit = Math.random() < (attacker.stats.luck / 100); // Calculate critical hit chance based on luck stat
    const critMultiplier = isCrit ? 1.5 : 1; // Apply critical hit multiplier
    const damage = Math.floor(Math.random() * (damageRange[1] - damageRange[0] + 1) + damageRange[0]) * critMultiplier;

    const attackerName = attacker === $player ? $player.name : currentEnemy.name;
    const defenderName = defender === $player ? $player.name : currentEnemy.name;

    let logMessage = `attacks ${defenderName} and deals ${damage} damage! (Attack Range: ${damageRange[0]}-${damageRange[1]})`;
    if (isCrit) {
      logMessage += ' (Critical Hit! +1 Press Turn)';
    }
    /*$battleLog = [...$battleLog, { type: 'calculation', message: `Basic Attack Calculation:
      Attacker: ${attackerName}
      Defender: ${defenderName}
      Base Power: ${basePower}
      Attacker Strength: ${attackerStrength}
      Defender Vitality: ${defender.stats.vitality}
      Damage Range: [${damageRange[0]}, ${damageRange[1]}]
      Critical Hit: ${isCrit ? 'Yes' : 'No'}
      Critical Hit Multiplier: ${critMultiplier}
      Damage: ${damage}` }];*/
    $battleLog = [...$battleLog, { type: attacker === $player ? 'player-action' : 'enemy-action', message: logMessage }];

    if (attacker === $player) {
      currentEnemy.stats.hp = Math.max(currentEnemy.stats.hp - damage, 0); // update enemy HP display
      if (isCrit) {
        $player.pressTurns = Math.min($player.pressTurns, PRESS_TURN_MAX); // don't exceed max turns
      } else {
        $player.pressTurns = Math.max($player.pressTurns - 1, 0); // no crit, decrease press turn
      }
      //$battleLog = [...$battleLog, { type: 'system-message', message: 'end player attack' }];

      setAction($player.path, 'SittingVictory');
      if ($player.pressTurns === 0) {
        endTurn();
      }
    } else {
      if (isCrit) {
        currentEnemy.pressTurns = Math.min(currentEnemy.pressTurns, PRESS_TURN_MAX); // don't exceed max turns
      } else {
        currentEnemy.pressTurns = Math.max(currentEnemy.pressTurns - 1, 0); // no crit, decrease press turn
      }
      //$battleLog = [...$battleLog, { type: 'system-message', message: 'end enemy attack' }];

      if (currentEnemy.pressTurns === 0) {
        endTurn();
      } else {
        setTimeout(enemyTurn, 1000);
      }
    }

    if (defender.stats.hp <= 0) {
      endTurn();
      return;
    }

    return damage;
  }


  function playerSkill(skill) {
    if (checkGameOver()) {
      return;
    }
    //$battleLog = [...$battleLog, { type: 'system-message', message: 'start player skill action' }];

    // announce any status effects
    const playerAilmentMessages = updateAilmentDurations($player);
    playerAilmentMessages.forEach(message => {
      $battleLog = [...$battleLog, { type: 'status-effect', message }];
      //$battleLog = [...$battleLog, { type: 'system-message', message: `--- NEXT TURN ---` }];
    });

    // can you afford it?
    if ($player.stats.mp >= skill.cost) {
      // are you healing?
      if (skill.type === "healing") {
        const healAmount = calculateHeal($player, skill);
        // no higher than player's maxHp
        $player.stats.hp = Math.min($player.stats.hp + healAmount, $player.stats.maxHp);
        $battleLog = [...$battleLog, { type: 'player-action', message: `used ${skill.name} and healed ${healAmount} HP!` }];
        $player.pressTurns = Math.max($player.pressTurns - 1, 0); // Decrease press turn
      } else if (skill.type === "ailment") {
        // do some Ailment stuff to the enemy
        if (!currentEnemy.ailments || !currentEnemy.ailments[skill.ailment]) {
          // enemy isn't afflicted yet, so..
          const isAilmentApplied = applyAilment($player, currentEnemy, skill);
          if (isAilmentApplied) {
            // successful cast
            $battleLog = [...$battleLog, { type: 'player-action', message: `tried casting ${skill.name} on ${currentEnemy.name}!` }];
            $battleLog = [...$battleLog, { type: 'status-effect', message: `${currentEnemy.name} is afflicted with ${skill.ailment}!` }];
          } else {
            // failed cast
            $battleLog = [...$battleLog, { type: 'player-action', message: `tried casting ${skill.name}...but it failed!` }];
          }
          // Decrease press turn
          $player.pressTurns = Math.max($player.pressTurns - 1, 0);
        } else {
          // Whoops, guess you wasted your turn...
          $battleLog = [...$battleLog, { type: 'player-action', message: `tried casting ${skill.name}...but ${currentEnemy.name} is already afflicted with ${skill.ailment}!` }];
          $player.pressTurns = Math.max($player.pressTurns - 1, 0);
        }
      } else {
        // do some Damage to the enemy
        const { damage, isCrit, damageRange, resistanceMultiplier, critMultiplier, skillPower, baseDamage, finalDamage } = calculateDamage($player, currentEnemy, skill, true);

        /*$battleLog = [...$battleLog, { type: 'calculation', message: `Skill Calculation:
          Attacker: ${$player.name}
          Defender: ${currentEnemy.name}
          Skill: ${skill.name}
          Skill Type: ${skill.type}
          Skill Power: ${skillPower}
          Attacker Strength: ${$player.stats.strength}
          Defender Vitality: ${currentEnemy.stats.vitality}
          Base Damage: ${baseDamage}
          Resistance Multiplier: ${resistanceMultiplier}
          Critical Hit: ${isCrit ? 'Yes' : 'No'}
          Critical Hit Multiplier: ${critMultiplier}
          Final Damage: ${finalDamage}
          Damage Range: [${damageRange[0]}, ${damageRange[1]}]
          Damage: ${damage}` }];*/

        if (resistanceMultiplier === -1) {
          // Absorption: Heal the enemy instead of dealing damage
          const healAmount = Math.abs(damage);
          currentEnemy.stats.hp = Math.min(currentEnemy.stats.hp + healAmount, currentEnemy.stats.maxHp); // update enemy HP display
          $player.pressTurns = Math.max($player.pressTurns - 1, 0); // Decrease press turn

          $battleLog = [...$battleLog, { type: 'player-action', message: `used ${skill.name} and healed ${healAmount} HP to ${currentEnemy.name}!` }];
        } else {
          currentEnemy.stats.hp = Math.max(currentEnemy.stats.hp - damage, 0); // update enemy HP display
          const attackRange = `${Math.round(damage * 0.9)}-${Math.round(damage * 1.1)}`;
          let logMessage = `used ${skill.name} and dealt ${damage} damage! (Attack Range: ${damageRange[0]}-${damageRange[1]})`;
          if (isCrit) {
            logMessage += ' (Critical Hit! +1 Press Turn)';
            $player.pressTurns = Math.min($player.pressTurns, PRESS_TURN_MAX); // don't exceed max turns
          } else {
            $player.pressTurns = Math.max($player.pressTurns - 1, 0); // no crit, decrease press turn
          }
          $battleLog = [...$battleLog, { type: 'player-action', message: logMessage }];
        }

        if (currentEnemy.stats.hp <= 0) {
          endTurn();
          return;
        }
      }

      // deduct MP
      $player.stats.mp -= skill.cost;

      //$battleLog = [...$battleLog, { type: 'system-message', message: 'end player skill action' }];
      if ($player.pressTurns === 0) {
        endTurn();
      }
    } else {
      // unaffordable!
      $battleLog = [...$battleLog, { type: 'system-message', message: `${$player.name} does not have enough MP to use ${skill.name}!` }];
    }

  }


  function enemyTurn() {
    if (checkGameOver()) {
      return;
    }
    isPlayerTurn = false;

    const enemyTurnInterval = setInterval(() => {

      // first, check the press turn count
      if (currentEnemy.pressTurns <= 0 || $player.stats.hp <= 0) {
        clearInterval(enemyTurnInterval);
        endTurn();
        isPlayerTurn = true;
        return;
      }
      //$battleLog = [...$battleLog, { type: 'system-message', message: 'start enemy action' }];

      // announce any status effects
      const enemyAilmentMessages = updateAilmentDurations(currentEnemy);
      enemyAilmentMessages.forEach(message => {
        $battleLog = [...$battleLog, { type: 'status-effect', message }];
      });

      // are they even awake?
      if (currentEnemy.ailments && currentEnemy.ailments.sleep) {
        // is asleep, decrease press turn
        currentEnemy.pressTurns = Math.max(currentEnemy.pressTurns - 1, 0);
      } else {
        // not asleep

        const skill = currentEnemy.skills[Math.floor(Math.random() * currentEnemy.skills.length)];

        if (skill.type === "ailment") {
          // do some Ailment stuff to the player
          if (!$player.ailments || !$player.ailments[skill.ailment]) {
            // player isn't afflicted yet, so..
            const isAilmentApplied = applyAilment(currentEnemy, $player, skill);
            if (isAilmentApplied) {
              // successful cast
              $battleLog = [...$battleLog, { type: 'enemy-action', message: `tried casting ${skill.name} on ${$player.name}!` }];
              $battleLog = [...$battleLog, { type: 'status-effect', message: `${$player.name} is afflicted with ${skill.ailment}!` }];
            } else {
              // failed cast
              $battleLog = [...$battleLog, { type: 'enemy-action', message: `tried casting ${skill.name}...but it failed!` }];
            }
            // Decrease press turn
            currentEnemy.pressTurns = Math.max(currentEnemy.pressTurns - 1, 0);
          } else {
            // Whoops, guess they wasted their turn...
            $battleLog = [...$battleLog, { type: 'enemy-action', message: `tried casting ${skill.name}...but ${$player.name} is already afflicted with ${skill.ailment}!` }];
            currentEnemy.pressTurns = Math.max(currentEnemy.pressTurns - 1, 0);
          }
        } else {
          // do some Damage to the player
          const { damage, isCrit, damageRange, resistanceMultiplier, critMultiplier, skillPower, baseDamage, finalDamage } = calculateDamage(currentEnemy, $player, skill, false);

          if (resistanceMultiplier === -1) {
            // Absorption: Heal the player instead of dealing damage
            const healAmount = Math.abs(damage);
            $player.stats.hp = Math.min($player.stats.hp + healAmount, $player.stats.maxHp);
            currentEnemy.pressTurns = Math.max(currentEnemy.pressTurns - 1, 0);
            $battleLog = [...$battleLog, { type: 'enemy-action', message: `used ${skill.name} and healed ${healAmount} HP to ${$player.name}!` }];
          } else {
            $player.stats.hp = Math.max($player.stats.hp - damage, 0);
            /*$battleLog = [...$battleLog, { type: 'calculation', message: `Skill Calculation:
              Attacker: ${currentEnemy.name}
              Defender: ${$player.name}
              Skill: ${skill.name}
              Skill Type: ${skill.type}
              Skill Power: ${skillPower}
              Attacker Strength: ${currentEnemy.stats.strength}
              Defender Vitality: ${$player.stats.vitality}
              Base Damage: ${baseDamage}
              Resistance Multiplier: ${resistanceMultiplier}
              Critical Hit: ${isCrit ? 'Yes' : 'No'}
              Critical Hit Multiplier: ${critMultiplier}
              Final Damage: ${finalDamage}
              Damage Range: [${damageRange[0]}, ${damageRange[1]}]
              Damage: ${damage}` }];*/
            let logMessage = `used ${skill.name} and dealt ${damage} damage! (Attack Range: ${damageRange[0]}-${damageRange[1]})`;
            if (isCrit) {
              logMessage += ' (Critical Hit! +1 Press Turn)';
              currentEnemy.pressTurns = Math.min(currentEnemy.pressTurns, PRESS_TURN_MAX); // don't exceed max turns
            } else {
              currentEnemy.pressTurns = Math.max(currentEnemy.pressTurns - 1, 0); // no crit, decrease press turn
            }
            $battleLog = [...$battleLog, { type: 'enemy-action', message: logMessage }];
          }
        }

        // Update the enemy's HP display
        currentEnemy = { ...currentEnemy };
      } // wasn't asleep
      //$battleLog = [...$battleLog, { type: 'system-message', message: 'end enemy action' }];
    }, 1000);
  }


  function endTurn() {
    if (checkGameOver()) {
      return;
    }

    // check if player is asleep
    if ($player.ailments && $player.ailments.sleep) {
      $player.pressTurns = 0; // set player's press turns to 0 if asleep
    }

    // onward
    $battleLog = [...$battleLog, { type: 'system-message', message: `--- NEXT TURN ---` }];

    // who ran out of press turns / what to do next?
    if (currentEnemy.pressTurns > 0) {
      enemyTurn();
    } else {
      $player.pressTurns = PRESS_TURN_MAX;
      currentEnemy.pressTurns = PRESS_TURN_MAX;
      isPlayerTurn = true;
      // ...waiting for player to do something
    }
  }


  function checkGameOver() {
    if ($player.stats.hp <= 0) {
      $battleLog = [...$battleLog, { type: 'system-message', message: `${$player.name} has been defeated! Game Over.` }];
      isPlayerTurn = false;
      return true;
    }
    
    if (currentEnemy.stats.hp <= 0) {
      $battleLog = [...$battleLog, { type: 'system-message', message: `${currentEnemy.name} has been defeated! You win!` }];
      isPlayerTurn = false;
      return true;
    }
    
    return false;
  }



  function setAction(path, actionName) {
    const mixer = mixers[path];
    if (!mixer || !currentActions[path][actionName]) {
      console.warn(`Action not found for model: ${path}, action: ${actionName}`);
      return;
    }

    // Fade out the current action
    if (currentActions[path][currentAction]) {
      const prevAction = currentActions[path][currentAction];
      prevAction.fadeOut(0.5);
    }

    // Prepare and play the new action
    const newAction = currentActions[path][actionName];
    newAction.reset();
    newAction.fadeIn(0.5);
    newAction.play();

    // Update the currentAction tracker
    currentAction = actionName;

    // Set up a delayed transition back to "Typing" for non-"Typing" animations
    if (actionName !== defaultAnimation) {
      const animationDuration = newAction.getClip().duration;
      setTimeout(() => {
        setAction(path, defaultAnimation);
      }, (animationDuration - 0.5) * 1000); // Subtract 0.5s for the fade-out transition
    }
  }

  /*function levelUp(character) {
    const distribution = STAT_DISTRIBUTION;
    for (const stat in distribution) {
      const increase = Math.floor(STAT_POINTS_PER_LEVEL * distribution[stat]);
      character.stats[stat] += increase;
    }
    character.level += 1;
  }*/

</script>

<main>
  <!-- <button class="toggle-mode" on:click={toggleActive}>Toggle Battle Mode</button> -->

  <div bind:this={container} class="webgl-container">
    <div class="background"></div>
    
    {#if $player && playerModel}
      {#if $player.path === playerModel}
        <ModelLoad
          modelConfig={$player}
          {scene}
          {mixers}
          {currentActions}
          onModelLoaded={onModelLoaded}
        />
      {/if}
    {/if}

    {#each modelCoworkers.filter(coworker => enemyModels.includes(coworker.path)) as enemyConfig}
      <ModelLoad
        modelConfig={enemyConfig}
        {scene}
        {mixers}
        {currentActions}
        onModelLoaded={onModelLoaded}
      />
    {/each}

    {#each modelObjects.filter(object => objectModels.includes(object.path)) as objectConfig}
      <ModelLoad
        modelConfig={objectConfig}
        {scene}
        onModelLoaded={onModelLoaded}
      />
    {/each}
  </div>

  <div class="battle-wrap">
  {#if currentEnemy}
    <div class="battle-container" class:active={isActive}>
      <CharacterInfo character={currentEnemy} type="enemy" />
      <CharacterInfo character={$player} type="player" />
      <BattleLog player={$player} currentEnemy={currentEnemy} />

      <div class="player-actions">
        <!-- {#if $player.animations}
          {#each $player.animations as animName}
            <button on:click={() => setAction($player.path, animName)}>{animName}</button>
          {/each}
        {/if} -->
        <button class="basic-attack" on:click={() => basicAttack($player, currentEnemy)} disabled={!isPlayerTurn}>
          Basic Attack
        </button><br/><br/>
        {#each $player.skills as skill}
          <button class="skill-button"
               class:healing={skill.type === 'healing'}
               class:ailment={skill.type === 'ailment'}
               class:fire={skill.type === 'fire'}
               class:electric={skill.type === 'electric'}
               class:ice={skill.type === 'ice'}
               class:force={skill.type === 'force'}
               class:light={skill.type === 'light'}
               class:dark={skill.type === 'dark'}
               on:click={() => playerSkill(skill)}
               disabled={!isPlayerTurn}>
            {skill.name} <small>({skill.cost} MP)</small>
          </button>
        {/each}
        <br/><br/>
        <button class="end-turn" on:click={endTurn} disabled={!isPlayerTurn}>End Turn</button>
      </div>

    </div>
  {:else}
    <!-- nothing yet -->
  {/if}
  </div>

</main>

<style>
  /*.toggle-mode {
    top: 0;
    left: 0;
    position: fixed;
    z-index: 999;
  }*/

  .webgl-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 50vw;
    height: 100vh;
    left: 0;
    z-index: 1;
  }
  
  .background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url("/battle.gif");
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
    z-index: -1;
  }

  .battle-wrap {
    /*perspective: 740px;
    perspective-origin: 50% 50%;*/
    overflow: hidden;
    position: absolute;
    z-index: 2;
    width: 50vw;
    height: 100vh;
    right: 0;
  }
  .battle-container {
    display: grid;
    position: relative;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto 1fr auto auto;
    gap: 20px;
    font-family: 'Arial', sans-serif;
    color: #fff;
    background-color: #222;
    overflow: hidden;
    margin: 0 auto;
    width: 100%;
    height: 100%;
    left: 0;
    /*transform: scaleX(1) scaleY(1) scaleZ(1) rotateX(0deg) rotateY(0deg) rotateZ(0deg) translateX(0px) translateY(0px) translateZ(0px) skewX(0deg) skewY(0deg);
    transition: all 0.25s ease-in-out;*/
  }
  /*.battle-container.active {
    transform: scaleX(0.65) scaleY(0.65) scaleZ(0.65) rotateX(-10deg) rotateY(-20deg) rotateZ(3deg) translateX(0px) translateY(0px) translateZ(0px) skewX(0deg) skewY(0deg);
    width: 960px;
    height: 720px;
    margin: -50px auto 0;
    left: 10vw;
  }*/

  .header {
    grid-column: 1 / 3;
    text-align: center;
    background-color: #ff004a;
    color: #fff;
    padding: 0px;
  }

  .left-section {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .player-actions {
    text-align: center;
    max-width: 500px;
    margin: 20px auto 0;
  }

  button {
    padding: 15px 20px;
    background-color: #555;
    color: #fff;
    border: none;
    cursor: pointer;
    font-weight: bold;
    font-size: 1.2rem;
    transition: background-color 0.3s ease;
    position: relative;
  }

  button:disabled {
    background-color: #ccc !important;
    cursor: not-allowed !important;
  }

  .skill-button {
    padding: 15px 20px 35px;
    margin: 5px 5px;
    color: #fff;
    border: none;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.3s ease;
  }

  .skill-button small {
    position: absolute;
    font-size: 0.8rem;
    bottom: 15px;
    left: 0;
    width: 100%;
    text-align: center;
  }

  .skill-button.healing {
    background-color: #008080;
  }
  .skill-button.ailment {
    background-color: #524774;
  }
  .skill-button.fire {
    background-color: #d53515;
  }
  .skill-button.electric {
    background-color: #dfbd08;
  }
  .skill-button.ice {
    background-color: #59b2cf;
  }
  .skill-button.force {
    background-color: #228b22;
  }
  .skill-button.light {
    background-color: #fffff0;
    color: #000000;
  }
  .skill-button.dark {
    background-color: #8b0000;
  }
</style>