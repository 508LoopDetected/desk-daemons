<script>
	////////////////////////////////////////////
	// CALLING ALL DAEMONS...WE ARE DESKBOUND //
	////////////////////////////////////////////

	import { onMount } from 'svelte';
	import {
		player,
		enemies,
		currentEnemy,
		battleLog
	} from './stores.js';
	import {
		PRESS_TURN_MAX,
		calculateDamage,
		calculateHeal,
		applyAilment,
		updatePressTurns,
		updateAilmentDurations
	} from './battleUtils.js';
	import BattleLog from './BattleLog.svelte';
	import PressTurns from './PressTurns.svelte';
	import CharacterInfo from './CharacterInfo.svelte';
	import modelCoworkers from '$lib/data/modelCoworkers.json';
	import modelObjects from '$lib/data/modelObjects.json';

	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
	import TWEEN from '@tweenjs/tween.js';
	import ModelLoad from './ModelLoad.svelte';

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
		screenMode: {
			x: 23.12,
			y: 203.01,
			z: 172.84
		},
		defaultView: {
			x: -308.92,
			y: 371.33,
			z: -149.27
		},
		playerFocus: {
			x: 42.97,
			y: 334.09,
			z: 248.67
		},
	};

	const cameraTargets = {
		screenMode: {
			x: 23.02,
			y: 202.70,
			z: 174.82
		},
		defaultView: {
			x: -184.21,
			y: 352.09,
			z: 107.67
		},
		playerFocus: {
			x: -19.46,
			y: 132.50,
			z: -91.13
		},
	};

	let currentEnemyData = $enemies[Math.floor(Math.random() * $enemies.length)];
	currentEnemy.set(currentEnemyData);
	let isPlayerTurn = true; // player starts first
	let disableGUI = false; // helper for animations

	// set press turns
	$player = {
		...$player,
		pressTurns: PRESS_TURN_MAX
	};
	$currentEnemy.pressTurns = PRESS_TURN_MAX;
	$battleLog = [...$battleLog, {
		type: 'system-message',
		message: `A wild ${$currentEnemy.name} appeared!`
	}];

	// DOOT DOOT
	onMount(() => {
		if (!isWebGLAvailable()) {
			alert('WebGL is not available in your browser.');
			return;
		}
		initScene();
		animate();
	});


	/////////////////////////
	// LET'S SET THE SCENE //
	/////////////////////////

	// can we render the scene?
	function isWebGLAvailable() {
		const canvas = document.createElement('canvas');
		return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
	}

	// create the scene
	function initScene() {
		clock = new THREE.Clock();
		camera = new THREE.PerspectiveCamera(75, sceneContainer.clientWidth / sceneContainer.clientHeight, 0.1, 5000);
		camera.position.set(0, 200, 500);

		scene = new THREE.Scene();

		const ambientLight = new THREE.AmbientLight(0xffffff, 2);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
		directionalLight.position.set(-5, -5, -5);
		scene.add(directionalLight);

		renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		});
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

	function onWindowResize() {
		camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
	}

	function onModelLoaded(object) {
		if (!effect.selectedObjects) {
			effect.selectedObjects = [];
		}
		effect.selectedObjects.push(object);
	}


	///////////////////////////
	// ONE MORE GOD REJECTED //
	///////////////////////////

	function performAction(action, attacker, defender) {
		if (checkGameOver()) return;
		disableGUI = true;

		// first, report any ailments
		updateAilmentDurations(attacker).forEach(message => {
			$battleLog = [...$battleLog, {
				type: 'status-effect',
				message
			}];
		});

		// is it the player or enemy's turn?
		const isPlayerAttacker = attacker === $player;
		const attackerName = isPlayerAttacker ? $player.name : $currentEnemy.name;
		const defenderName = !isPlayerAttacker ? $player.name : $currentEnemy.name;

		// PHYSICAL skill used
		if (action.type === 'physical') {
			const {
				damage,
				isCrit,
				resistanceMultiplier
			} = calculateDamage(attacker, defender, action, isPlayerAttacker);
			if (resistanceMultiplier === -1) {
				// whoops, attack was absorbed
				const healAmount = Math.abs(damage);
				defender.stats.hp = Math.min(defender.stats.hp + healAmount, defender.stats.maxHp);
				$battleLog = [...$battleLog, {
					type: isPlayerAttacker ? 'player-action' : 'enemy-action',
					message: `attacks ${defenderName} and heals ${healAmount} HP!`
				}];
			} else {
				// landed hit! check for crit & log results
				defender.stats.hp = Math.max(defender.stats.hp - damage, 0);
				let logMessage = `attacks ${defenderName} and deals ${damage} damage!`;
				if (isCrit) logMessage += ' (Critical Hit! +1 Press Turn)';
				$battleLog = [...$battleLog, {
					type: isPlayerAttacker ? 'player-action' : 'enemy-action',
					message: logMessage
				}];
				setAction(attacker.path, 'Magic');
			}
			// action complete, spend a press turn
			if (isPlayerAttacker) {
				$player.pressTurns = isCrit ? Math.min($player.pressTurns, PRESS_TURN_MAX) : Math.max($player.pressTurns - 1, 0);
			} else {
				$currentEnemy.pressTurns = isCrit ? Math.min($currentEnemy.pressTurns, PRESS_TURN_MAX) : Math.max($currentEnemy.pressTurns - 1, 0);
			}

			// MP-based skill used
		} else if (attacker.stats.mp < action.cost) { // unaffordable skill!
			$battleLog = [...$battleLog, {
				type: 'system-message',
				message: `${attacker.name} doesn't have enough MP to use ${action.name}!`
			}];
		} else { // affordable skill!

			// SUPPORT skill used
			if (action.type === 'healing') {
				attacker.stats.mp -= action.cost;
				// calculate based on which healing skill
				const healAmount = calculateHeal(attacker, action);
				// heal no more than caster's max HP
				attacker.stats.hp = Math.min(attacker.stats.hp + healAmount, attacker.stats.maxHp);
				$battleLog = [...$battleLog, {
					type: 'player-action',
					message: `used ${action.name} and healed ${healAmount} HP!`
				}];
				// visual effects
				moveCamera('playerFocus', () => {
					setAction(attacker.path, 'Victory'); // character pose
					const statusEffect = particleStatusEffect(attacker, 0x00ff00, 'plus.png', 2);
					scene.add(statusEffect);
					setTimeout(() => moveCamera('defaultView'), 1500); // reset camera
				});

				// action complete, spend a press turn
				if (isPlayerAttacker) {
					$player.pressTurns = Math.max($player.pressTurns - 1, 0);
				} else {
					$currentEnemy.pressTurns = Math.max($currentEnemy.pressTurns - 1, 0);
				}

				// AILMENT skill used
			} else if (action.type === 'ailment') {
				// make sure defender isn't already afflicted
				if (!defender.ailments || !defender.ailments[action.ailment]) {
					// apply RNG and roll the ailment
					const isAilmentApplied = applyAilment(attacker, defender, action);
					if (!isAilmentApplied) { // womp womp, it failed
						$battleLog = [...$battleLog, {
							type: isPlayerAttacker ? 'player-action' : 'enemy-action',
							message: `tried casting ${action.name}...but it failed!`
						}];
					} else { // success! spend MP and proceed
						attacker.stats.mp -= action.cost;
						$battleLog = [
							...$battleLog,
							{
								type: isPlayerAttacker ? 'player-action' : 'enemy-action',
								message: `tried casting ${action.name} on ${defenderName}!`
							},
							{
								type: 'status-effect',
								message: `${defenderName} has been afflicted with ${action.ailment}!`
							}
						];
						// visual effects
						setAction(attacker.path, 'Ailment');
						const statusEffect = action.ailment === 'sleep' ?
							particleStatusEffect(defender, 0x05bff7, 'zzz.png', 2) :
							particleStatusEffect(defender, 0xA70BD8, 'skull.gif', 1);
						scene.add(statusEffect);
					}
				} else {
					$battleLog = [...$battleLog, {
						type: isPlayerAttacker ? 'player-action' : 'enemy-action',
						message: `tried casting ${action.name}...but ${defenderName} is already afflicted with ${action.ailment}!`
					}];
					// if we wanted to punish the failure...
					// attacker.pressTurns = Math.max(attacker.pressTurns - 1, 0);
				}

				// action complete, spend a press turn
				if (isPlayerAttacker) {
					$player.pressTurns = Math.max($player.pressTurns - 1, 0);
				} else {
					$currentEnemy.pressTurns = Math.max($currentEnemy.pressTurns - 1, 0);
				}

				// MAGIC skill used
			} else {
				const {
					damage,
					isCrit,
					resistanceMultiplier
				} = calculateDamage(attacker, defender, action, isPlayerAttacker);

				if (resistanceMultiplier === -1) {
					// whoops, attack was absorbed
					const healAmount = Math.abs(damage);
					defender.stats.hp = Math.min(defender.stats.hp + healAmount, defender.stats.maxHp);
					attacker.pressTurns = Math.max(attacker.pressTurns - 1, 0);
					$battleLog = [...$battleLog, {
						type: isPlayerAttacker ? 'player-action' : 'enemy-action',
						message: `used ${action.name} and healed ${healAmount} HP to ${defenderName}!`
					}];
				} else {
					// landed hit! spend MP, check for crit, & log results
					attacker.stats.mp -= action.cost;
					defender.stats.hp = Math.max(defender.stats.hp - damage, 0);
					let logMessage = `used ${action.name} and dealt ${damage} damage!`;
					if (isCrit) logMessage += ' (Critical Hit! +1 Press Turn)';
					$battleLog = [...$battleLog, {
						type: isPlayerAttacker ? 'player-action' : 'enemy-action',
						message: logMessage
					}];
					setAction(attacker.path, 'Magic');
				}

				// action complete, spend a press turn
				if (isPlayerAttacker) {
					$player.pressTurns = isCrit ? Math.min($player.pressTurns, PRESS_TURN_MAX) : Math.max($player.pressTurns - 1, 0);
				} else {
					$currentEnemy.pressTurns = isCrit ? Math.min($currentEnemy.pressTurns, PRESS_TURN_MAX) : Math.max($currentEnemy.pressTurns - 1, 0);
				}
			}
		}


		// immediately end turn if defender is killed
		if (defender.stats.hp <= 0) {
			endTurn();
			return;
		}


		if (attacker.pressTurns === 0) {
			endTurn();
		} else if (!isPlayerAttacker) {
			setTimeout(() => {
				if ($currentEnemy.ailments && $currentEnemy.ailments.sleep) {
					$currentEnemy.pressTurns = 0;
					let statusEffect = particleStatusEffect($currentEnemy, 0x05bff7, 'zzz.png', 2);
					scene.add(statusEffect);
					endTurn();
				} else {
					const skill = $currentEnemy.skills[Math.floor(Math.random() * $currentEnemy.skills.length)];
					performAction(skill, $currentEnemy, $player);
				}
			}, 2000);
		}

		setTimeout(() => disableGUI = false, 2000);
	}

	function endTurn() {
		if (checkGameOver()) return;

		// check if player is asleep
		if ($player.ailments && $player.ailments.sleep) {
			setTimeout(() => { // let it breathe
				$battleLog = [...$battleLog, {
					type: 'status-effect',
					message: `💤 ${$player.name} is asleep! 💤`
				}];
			}, 3000);
			$player.pressTurns = 0; // set player's press turns to 0 if asleep
		}

		// who ran out of press turns / what to do next?
		setTimeout(() => { // let it breathe
			if ($currentEnemy.pressTurns > 0) {
				isPlayerTurn = false;
				$battleLog = [...$battleLog, {
					type: 'system-message',
					message: `--- ENEMY TURN! ---`
				}];
				setTimeout(() => { // let it breathe
					if ($currentEnemy.ailments && $currentEnemy.ailments.sleep) {
						$battleLog = [...$battleLog, {
							type: 'status-effect',
							message: `💤 ${$currentEnemy.name} is asleep! 💤`
						}];
						$currentEnemy.pressTurns = 0;
						let statusEffect = particleStatusEffect($currentEnemy, 0x05bff7, 'zzz.png', 2);
						scene.add(statusEffect);
						endTurn();
					} else {
						const skill = $currentEnemy.skills[Math.floor(Math.random() * $currentEnemy.skills.length)];
						performAction(skill, $currentEnemy, $player);
					}
				}, 3000);
			} else {
				//reset press turns
				$player.pressTurns = PRESS_TURN_MAX;
				$currentEnemy.pressTurns = PRESS_TURN_MAX;
				isPlayerTurn = true;
				// ...waiting for player to do something
				$battleLog = [...$battleLog, {
					type: 'system-message',
					message: `--- YOUR TURN! ---`
				}];
			}
		}, 3000);
	}


	function checkGameOver() {
		if ($player.stats.hp <= 0) {
			setAction($currentEnemy.path, 'Victory');
			setAction($player.path, 'Defeat');
			$battleLog = [...$battleLog, {
				type: 'system-message',
				message: `${$player.name} has been defeated! Game Over.`
			}];
			isPlayerTurn = false;
			return true;
		}

		if ($currentEnemy.stats.hp <= 0) {
			setAction($player.path, 'Victory');
			setAction($currentEnemy.path, 'Defeat');
			$battleLog = [...$battleLog, {
				type: 'system-message',
				message: `${$currentEnemy.name} has been defeated! You win!`
			}];
			isPlayerTurn = false;
			return true;
		}

		return false;
	}


	//////////////////////////
	// CAMERA & 3D MOVEMENT //
	//////////////////////////

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


	///////////////////////////
	// PARTICLE EFFECTS //
	///////////////////////////

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

		const tweenAnimation = new TWEEN.Tween({
				opacity: 0,
				time: 0
			})
			.to({
				opacity: 1,
				time: 1
			}, totalDuration)
			.easing(TWEEN.Easing.Quadratic.Out)
			.onUpdate(({
				opacity,
				time
			}) => {
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
</script>

<main>

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

	{#if $currentEnemy}
	  <div id="enemyStats">
		<CharacterInfo character={$currentEnemy} type="enemy" />
	  </div>
	  <div id="playerHUD">
		<CharacterInfo character={$player} type="player" />
		
		<div class="player-actions">
		  {#each $player.skills as skill}
		    <button class="skill-button"
		         class:physical={skill.type === 'physical'}
		         class:healing={skill.type === 'healing'}
		         class:ailment={skill.type === 'ailment'}
		         class:fire={skill.type === 'fire'}
		         class:electric={skill.type === 'electric'}
		         class:ice={skill.type === 'ice'}
		         class:force={skill.type === 'force'}
		         class:light={skill.type === 'light'}
		         class:dark={skill.type === 'dark'}
		         on:click={() => performAction(skill, $player, $currentEnemy)}
		         disabled={!isPlayerTurn || disableGUI}>
		      {skill.name} <small>{skill.cost}</small>
		    </button>
		  {/each}
		</div>
	  </div>

		<PressTurns player={$player} currentEnemy={$currentEnemy} isPlayerTurn={isPlayerTurn} />
	  <div id="battleLog">
		<BattleLog player={$player} currentEnemy={$currentEnemy} isPlayerTurn={isPlayerTurn} />
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
  #enemyStats {
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

  #enemyStats {
	top: 30%;
	right: 2%;
  }

  #battleLog {
	position: absolute;
	top: 4vh;
	width: 94vw;
	left: 2vw;
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

  .skill-button.physical small { display: none; }

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




/*  #camerahud {
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
  }*/
</style>