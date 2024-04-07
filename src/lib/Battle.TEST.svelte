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
  import TWEEN from '@tweenjs/tween.js';
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

  let sceneContainer;
  let camera, scene, renderer, controls, effect, clock;
  let cameraPosition = '';
  let cameraTarget = '';
  const mixers = {};
  const currentActions = {};
  let defaultAnimation = $player.defaultAnimation;
  let currentAction = defaultAnimation;

  const cameraPositions = {
    screenMode: { x: 23.12, y: 203.01, z: 172.84 },
    defaultView: { x: -308.92, y: 371.33, z: -149.27 },
    playerFocus: { x: 42.97, y: 334.09, z: 248.67 },
  };

  const cameraTargets = {
    screenMode: { x: 23.02, y: 202.70, z: 174.82 },
    defaultView: { x: -184.21, y: 352.09, z: 107.67 },
    playerFocus: { x: -19.46, y: 132.50, z: -91.13 },
  };


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
    camera = new THREE.PerspectiveCamera(75, sceneContainer.clientWidth / sceneContainer.clientHeight, 0.1, 5000);
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
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    renderer.shadowMap.enabled = true;
    sceneContainer.appendChild(renderer.domElement);

    effect = new OutlineEffect(renderer, {
      defaultThickness: 0.008,
      defaultColor: [0, 0, 0],
      defaultAlpha: 1,
      defaultKeepAlive: true,
    });

    controls = new OrbitControls(camera, renderer.domElement);
    controls.screenSpacePanning = true;
    controls.minDistance = 2;
    controls.maxDistance = 400;

    // Set the default camera position and target
    camera.position.set(cameraPositions.defaultView.x, cameraPositions.defaultView.y, cameraPositions.defaultView.z);
    controls.target.set(cameraTargets.defaultView.x, cameraTargets.defaultView.y, cameraTargets.defaultView.z);

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
    TWEEN.update();
    controls.update();
    effect.render(scene, camera);
    updateCameraPosition();
    updateCameraTarget();
  }

  // 
  function onWindowResize() {
    camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
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

    // let logMessage = `attacks ${defenderName} and deals ${damage} damage! (Attack Range: ${damageRange[0]}-${damageRange[1]})`;
    let logMessage = `attacks ${defenderName} and deals ${damage} damage!`;
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
        moveCamera('playerFocus', () => {
          const healAmount = calculateHeal($player, skill);
          $player.stats.hp = Math.min($player.stats.hp + healAmount, $player.stats.maxHp);
          $battleLog = [...$battleLog, { type: 'player-action', message: `used ${skill.name} and healed ${healAmount} HP!` }];
          $player.pressTurns = Math.max($player.pressTurns - 1, 0);

          // Trigger particles on the character model
          let statusEffect = particleStatusEffect($player, 0x00ff00, 'plus.png', 2);
          scene.add(statusEffect);
          setAction($player.path, 'SittingVictory');

          setTimeout(() => {
            moveCamera('defaultView');
          }, 1500);
        });
      } else if (skill.type === "ailment") {
        // do some Ailment stuff to the enemy
        if (!currentEnemy.ailments || !currentEnemy.ailments[skill.ailment]) {
          // enemy isn't afflicted yet, so..
          const isAilmentApplied = applyAilment($player, currentEnemy, skill);
          if (isAilmentApplied) {
            // successful cast
            $battleLog = [...$battleLog, { type: 'player-action', message: `tried casting ${skill.name} on ${currentEnemy.name}!` }];
            $battleLog = [...$battleLog, { type: 'status-effect', message: `${currentEnemy.name} is afflicted with ${skill.ailment}!` }];

            // Trigger particles on the character model
            let statusEffect;
            if (skill.ailment == 'sleep') {
              statusEffect = particleStatusEffect(currentEnemy, 0x05bff7, 'zzz.png', 2);
            } else if (skill.ailment == 'poison') {
              statusEffect = particleStatusEffect(currentEnemy, 0xA70BD8, 'skull.gif', 1);
            }
            scene.add(statusEffect);
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

        // Trigger particles on the character model
        let statusEffect = particleSkillEffect($player, currentEnemy, new THREE.Color(1, 1, 0), 2);
        scene.add(statusEffect);

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
          //let logMessage = `used ${skill.name} and dealt ${damage} damage! (Attack Range: ${damageRange[0]}-${damageRange[1]})`;
          let logMessage = `used ${skill.name} and dealt ${damage} damage!`;
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
        let statusEffect = particleStatusEffect(currentEnemy, 0x05bff7, 'zzz.png', 2);
        scene.add(statusEffect);
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
            let statusEffect = particleStatusEffect(currentEnemy, 0xA70BD8, 'skull.gif', 1);
            scene.add(statusEffect);
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
            // let logMessage = `used ${skill.name} and dealt ${damage} damage! (Attack Range: ${damageRange[0]}-${damageRange[1]})`;
            let logMessage = `used ${skill.name} and dealt ${damage} damage!`;
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

  function moveCamera(mode, callback) {
    const position = cameraPositions[mode];
    const target = cameraTargets[mode];

    const tweenPosition = new TWEEN.Tween(camera.position)
      .to(position, 1000)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .start();

    const tweenTarget = new TWEEN.Tween(controls.target)
      .to(target, 500)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onComplete(() => {
        if (typeof callback === 'function') {
          callback();
        }
      })
      .start();
  }

  function updateCameraPosition() {
    cameraPosition = `{ x: ${camera.position.x.toFixed(2)}, y: ${camera.position.y.toFixed(2)}, z: ${camera.position.z.toFixed(2)} }`;
  }

  function updateCameraTarget() {
    cameraTarget = `{ x: ${controls.target.x.toFixed(2)}, y: ${controls.target.y.toFixed(2)}, z: ${controls.target.z.toFixed(2)} }`;
  }

  function particleStatusEffect(character, color, texture, scaleFactor = 1) {
    const particleCount = 20;
    const particles = new THREE.BufferGeometry();
    const particleMaterial = new THREE.PointsMaterial({
      color: color,
      size: character.scale.x * 20 * scaleFactor, // Adjust the particle size based on the scaleFactor
      transparent: true,
      opacity: 0,
      map: new THREE.TextureLoader().load(texture),
      blending: THREE.NormalBlending,
    });

    const particlePositions = new Float32Array(particleCount * 3);
    const characterScale = character.scale;
    const characterPosition = character.position;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      particlePositions[i3] = characterPosition.x + (Math.random() - 0.5) * characterScale.x * 150 * scaleFactor; // Adjust the spread based on the scaleFactor
      particlePositions[i3 + 1] = characterPosition.y + Math.random() * characterScale.y * 170 * scaleFactor; // Adjust the vertical spread based on the scaleFactor
      particlePositions[i3 + 2] = characterPosition.z + (Math.random() - 0.5) * characterScale.z * 150 * scaleFactor; // Adjust the spread based on the scaleFactor
    }

    particles.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));

    const particleSystem = new THREE.Points(particles, particleMaterial);

    const fadeInDuration = 1000;
    const fadeOutDuration = 1000;
    const totalDuration = fadeInDuration + fadeOutDuration;

    const tweenAnimation = new TWEEN.Tween({ opacity: 0, time: 0 })
      .to({ opacity: 1, time: 1 }, totalDuration)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(({ opacity, time }) => {
        particleMaterial.opacity = opacity < 0.5 ? opacity * 2 : (1 - opacity) * 2;
        const easedTime = TWEEN.Easing.Quadratic.InOut(time);
        const verticalOffset = easedTime * characterScale.y * 1 * scaleFactor; // Adjust the upward velocity based on the scaleFactor

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          particlePositions[i3 + 1] += verticalOffset;
        }

        particles.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
      })
      .onComplete(() => {
        scene.remove(particleSystem);
      });

    tweenAnimation.start();

    return particleSystem;
  }

  function particleSkillEffect(player, enemy, color, scaleFactor = 1) {
    const boltCount = 5;
    const boltDuration = 500;
    const boltDelay = 100;

    const playerPosition = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    const enemyPosition = new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z);

    for (let i = 0; i < boltCount; i++) {
      const bolt = createLightningBolt(playerPosition, enemyPosition, color, scaleFactor);
      console.log('bolt:', bolt); // Add this line for debugging

      if (bolt) {
        try {
          scene.add(bolt);
          console.log('bolt added to scene'); // Add this line for debugging
        } catch (error) {
          console.error('Error adding bolt to scene:', error);
        }
      } else {
        console.error('bolt is undefined or not a valid THREE.Object3D instance');
      }

      setTimeout(() => {
        const tweenAlpha = new TWEEN.Tween(bolt.material)
          .to({ opacity: 0 }, boltDuration)
          .easing(TWEEN.Easing.Quadratic.Out)
          .onComplete(() => {
            scene.remove(bolt);
          });

        tweenAlpha.start();
      }, i * boltDelay);
    }
  }

  function createLightningBolt(start, end, color, scaleFactor) {
    const segmentCount = 10;
    const segmentLength = start.distanceTo(end) / segmentCount;
    const positionVariation = segmentLength * 0.2 * scaleFactor;

    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    let currentPosition = start.clone();
    for (let i = 0; i < segmentCount; i++) {
      positions.push(currentPosition.x, currentPosition.y, currentPosition.z);
      colors.push(color.r, color.g, color.b);

      if (i < segmentCount - 1) {
        const nextPosition = new THREE.Vector3().lerpVectors(currentPosition, end, 1 / (segmentCount - i));
        nextPosition.x += (Math.random() - 0.5) * positionVariation;
        nextPosition.y += (Math.random() - 0.5) * positionVariation;
        nextPosition.z += (Math.random() - 0.5) * positionVariation;
        currentPosition = nextPosition;
      }
    }

    positions.push(end.x, end.y, end.z);
    colors.push(color.r, color.g, color.b);

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 2 * scaleFactor,
      opacity: 1,
      transparent: true,
    });

    const line = new THREE.Line(geometry, material);
    console.log('Line object:', line); // Add this line for debugging

    return line;
  }
</script>

<main class:active={isActive}>

  <div bind:this={sceneContainer} class="webgl-container">
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
    <!-- <button class="toggle-mode" on:click={toggleActive}>Toggle Battle Mode</button> -->

    {#if currentEnemy}
      <div id="enemyStats">
        <CharacterInfo character={currentEnemy} type="enemy" />
      </div>
      <div id="playerHUD">
        <CharacterInfo character={$player} type="player" />
        <div class="player-actions">
          <!-- {#if $player.animations}
            {#each $player.animations as animName}
              <button on:click={() => setAction($player.path, animName)}>{animName}</button>
            {/each}
          {/if} -->
          <button class="basic-attack" on:click={() => basicAttack($player, currentEnemy)} disabled={!isPlayerTurn}>
            Basic Attack
          </button>
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
              {skill.name} <small>{skill.cost}</small>
            </button>
          {/each}
          <!-- <br/><br/>
          <button class="end-turn" on:click={endTurn} disabled={!isPlayerTurn}>End Turn</button> -->
        </div>
      </div>
      <div id="battleLog">
        <BattleLog player={$player} currentEnemy={currentEnemy} />
      </div>
    {:else}
      <!-- nothing yet -->
    {/if}
  </div>



  <!-- <div id="camerahud">
    <div class="info-panel">
      <div class="info-item"><strong>Camera Position:</strong> {cameraPosition} | <strong>Camera Target:</strong> {cameraTarget}</div>
    </div>
    <div class="button-panel">
      <button class="hud-button" on:click={() => moveCamera('defaultView')}>Default Battle</button>
      <button class="hud-button" on:click={() => moveCamera('screenMode')}>Screen Mode</button>
      <button class="hud-button" on:click={() => moveCamera('playerFocus')}>Player Focus</button>
    </div>
  </div> -->

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
    width: 100vw;
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
  .background:after {
    background: radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,1) 100%);
    width: 100%;
    height: 100%;
    content: '';
    top: 0;
    left: 0;
    z-index: 2;
    display: block;
    position: absolute;
  }

  .battle-wrap {
    overflow: hidden;
    position: absolute;
    z-index: 2;
    width: 100vw;
    height: 100vh;
    right: 0;
    font-family: monospace;
  }

  #playerHUD,
  #enemyStats,
  #battleLog {
    position: absolute;
    background: rgba(30,30,30,0.8);
    width: 500px;
    padding: 10px;
    border: 5px solid #000;
  }

  #playerHUD {
    bottom: 2vh;
    width: 94vw;
    left: 2vw;
    display: grid;
    grid-template-columns: 20% 80%;
    grid-template-rows: 1fr;
  }
  main.active #playerHUD {
    transform: scaleX(0.65) scaleY(0.65) scaleZ(0.65) rotateX(-10deg) rotateY(-20deg) rotateZ(3deg) translateX(0px) translateY(0px) translateZ(0px) skewX(0deg) skewY(0deg);
    width: 960px;
    height: 720px;
    margin: -50px auto 0;
    left: 10vw;
  }

  #enemyStats {
    top: 30%;
    right: 2%;
  }

  #battleLog {
    top: 4%;
    left: 2%;
  }

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
    margin: 10px auto 0;
    max-height: 100%;
  }

  button {
    padding: 10px 15px;
    background-color: #555;
    color: #fff;
    cursor: pointer;
    font-weight: bold;
    font-size: 1rem;
    transition: background-color 0.3s ease;
    position: relative;
    text-shadow: 0 0 5px #000;
    border: 2px solid rgba(255,255,255,0.3);
    outline: 3px solid #000;
  }

  button:disabled {
    background-color: #000 !important;
    color: #333 !important;
    cursor: not-allowed !important;
  }

  .skill-button {
    margin: 10px;
    color: #fff;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.3s ease;
    display: inline-block;
    text-align: left;
  }

  .skill-button small {
    position: absolute;
    font-size: 0.8rem;
    top: -10px;
    right: -10px;
    text-align: center;
    border-radius: 50%;
    background-color: #000;
    width: 25px;
    height: 21px;
    padding-top: 4px;
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




  #camerahud {
    position: absolute;
    top: 0px;
    left: 0; right: 0;
    margin: auto;
    z-index: 999;
    color: white;
    font-family: Arial, sans-serif;
    background-color: rgba(0, 0, 0, 0.7);
    padding: 10px 30px 15px;
    border-radius: 5px;
    text-align: center;
  }
  .info-panel {
    margin-bottom: 10px;
  }
  .info-item {
    margin-bottom: 5px;
  }
  .info-item strong {
    color: crimson;
  }
  .button-panel {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }
  .hud-button {
    background-color: #444;
    color: white;
    border: none;
    padding: 8px 16px;
    font-size: 14px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }
  .hud-button:hover {
    background-color: #666;
  }
</style>