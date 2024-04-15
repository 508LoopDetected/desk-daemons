const PRESS_TURN_MAX = 3;
const CRITICAL_CHANCE_BASE = 0.05;
const CRITICAL_CHANCE_MULTIPLIER = 0.01;
const AILMENT_CHANCE_MULTIPLIER = 0.01;
const STAT_POINTS_PER_LEVEL = 5;

const RESISTANCE_MULTIPLIERS = {
	weak: 2, // double damage
	resist: 0.5, // half damage
	null: 0, // no damage
	absorb: -1, // heal
	normal: 1, // normal damage
};

const AILMENT_DURATIONS = {
	poison: 4,
	confusion: 2,
	sleep: 3,
	silence: 2,
	fear: 2,
	rage: 3,
};

const STAT_DISTRIBUTION = {
	str: 0.3, // Strength
	vit: 0.2, // Vitality
	mag: 0.1, // Magic
	agi: 0.2, // Agility
	luc: 0.2 // Luck
};

// Calculates the power of a magic skill based on the character's magic stat and skill's base power
function calculateMagicSkillPower(character, skill) {
	const baseSkillPower = skill.power || 0;
	const magicStat = (character.stats && character.stats.mag) || 0;
	return Math.floor(magicStat / 2) + baseSkillPower;
}

// Calculates the power of a physical skill based on the character's strength stat and skill's base power
function calculatePhysicalSkillPower(character, skill) {
	const baseSkillPower = skill.power || 0;
	const strengthStat = (character.stats && character.stats.str) || 0;
	return Math.floor(strengthStat / 4) + baseSkillPower;
}

// Calculates the damage dealt by an attacker to a defender using a specific skill
function calculateDamage(attacker, defender, skill, isPlayerAttacker) {
	const attackerStats = attacker.stats || {};
	const defenderStats = defender.stats || {};

	let skillPower;
	if (skill.type === 'magic') {
		skillPower = calculateMagicSkillPower(attacker, skill);
	} else if (['fire', 'ice', 'electric', 'force', 'light', 'dark'].includes(skill.type)) {
		skillPower = calculateMagicSkillPower(attacker, skill);
	} else if (skill.type === 'physical') {
		skillPower = calculatePhysicalSkillPower(attacker, skill);
	}

	// Calculate base damage based on attacker's strength, skill power, and defender's vitality
	const baseDamage = (attackerStats.strength + skillPower) * (1 - Math.max(defenderStats.vitality, 0) / 100);

	// Get the resistance multiplier based on the skill type and defender's resistances
	const resistanceMultiplier = getResistanceMultiplier(
		skill.type,
		defender.resistances || {}
	);

	// Check if the attack is a critical hit
	const isCrit = skill.type !== "ailment" && skill.type !== "support" && isCritical(attacker);
	const critMultiplier = isCrit ? 1.5 : 1;

	let finalDamage = baseDamage * resistanceMultiplier * critMultiplier;
	if (resistanceMultiplier === -1) {
		// Absorption: Heal the defender instead of dealing damage
		const healAmount = Math.min(finalDamage, defenderStats.maxHp - defenderStats.hp);
		finalDamage = -healAmount; // Negative value indicates healing
	} else if (resistanceMultiplier === 0) {
		finalDamage = 0; // Set final damage to 0 if resistance is null
	}

	// Calculate the damage range based on critical hit and a random factor
	const damageRange = [
		Math.round(finalDamage * (isCrit ? 0.8 : 0.9)),
		Math.round(finalDamage * (isCrit ? 1.2 : 1.1))
	];

	// Randomly select a damage value within the calculated range
	const damage = Math.floor(Math.random() * (damageRange[1] - damageRange[0] + 1)) + damageRange[0];

	// Return an object containing the calculated damage values and related information
	return {
		damage: damage,
		isCrit: isCrit,
		damageRange: damageRange,
		resistanceMultiplier: resistanceMultiplier,
		critMultiplier: critMultiplier,
		skillPower: skillPower,
		baseDamage: baseDamage,
		finalDamage: finalDamage,
		isPlayerAttacker: isPlayerAttacker
	};
}

// Calculates the amount of healing done by a character using a specific skill
function calculateHeal(attacker, skill) {
	const baseHeal = skill.power; // Base healing amount from the skill
	const magicModifier = attacker.stats.magic * 0.5; // Example: magic stat influences healing
	const totalHeal = baseHeal + magicModifier;
	// Ensure total healing does not exceed caster's maximum HP
	const maxHeal = Math.min(totalHeal, attacker.stats.maxHp - attacker.stats.hp);
	return Math.round(maxHeal);
}

// Retrieves the resistance multiplier based on the skill type and defender's resistances
function getResistanceMultiplier(skillType, defenderResistances) {
	const resistance = defenderResistances?.[skillType] || 'normal';
	if (resistance === 'null') {
		return 0; // Explicitly return 0 for 'null' resistance
	} else if (resistance === 'absorb') {
		return -1; // Explicitly return 0 for 'absorb' resistance
	}
	return RESISTANCE_MULTIPLIERS[resistance] || 1;
}

// Determines if an attack is a critical hit based on the attacker's luck stat
function isCritical(attacker) {
	const attackerStats = attacker.stats || {};
	const luck = attackerStats.luck || 0;
	const criticalChance = CRITICAL_CHANCE_BASE + luck * CRITICAL_CHANCE_MULTIPLIER;
	return Math.random() < criticalChance;
}

// Applies an ailment to the defender based on the attacker's skill and stats
function applyAilment(attacker, defender, skill, battleLog) {
	if (!skill.ailment) {
		battleLog.update(log => [...log, {
			type: 'system-message',
			message: `${attacker.name} tried casting ${skill.name}...but it has no ailment effect!`
		}]);
		return {
			isAilmentApplied: false
		};
	}

	const ailmentChance = skill.ailmentChance + attacker.stats.magic * AILMENT_CHANCE_MULTIPLIER;
	const resistanceMultiplier = getResistanceMultiplier(skill.type, defender.resistances);
	const finalAilmentChance = ailmentChance * resistanceMultiplier;

	if (Math.random() < finalAilmentChance) {
		defender.ailments = defender.ailments || {};
		if (skill.ailment === 'sleep') {
			// defender.ailments[skill.ailment] = 4 + skill.power * 2; // set sleep duration based on skill power
			defender.ailments[skill.ailment] = AILMENT_DURATIONS[skill.ailment];
			battleLog.update(log => [...log, {
				type: 'status-effect',
				message: `💤 ${attacker.name} put ${defender.name} to sleep! (${defender.ailments[skill.ailment]}...) 💤`
			}]);
		} else {
			// defender.ailments[skill.ailment] = AILMENT_DURATIONS[skill.ailment];
			defender.ailments[skill.ailment] = 4 + skill.power * 2; // set poison damage based on skill power
			battleLog.update(log => [...log, {
				type: 'status-effect',
				message: `💤 ${attacker.name} afflicted ${defender.name} with ${skill.ailment}! 💤`
			}]);
		}
		return {
			isAilmentApplied: true
		};
	} else {
		battleLog.update(log => [...log, {
			type: 'system-message',
			message: `${attacker.name} tried casting ${skill.name}...but failed!`
		}]);
		return {
			isAilmentApplied: false
		};
	}
}

// Updates the press turns of a character based on the skill used and its effects
function updatePressTurns(character, target, skill) {
	const resistanceMultiplier = getResistanceMultiplier(skill.type, target.resistances);
	if (resistanceMultiplier === 0) {
		character.pressTurns = Math.max(character.pressTurns - 2, 0);
	} else if (resistanceMultiplier === -1) {
		character.pressTurns = 0;
	} else if (resistanceMultiplier === 2 || isCritical(character)) {
		character.pressTurns = Math.min(character.pressTurns + 1, 4);
	}
	return character.pressTurns;
}

function updateAilmentDurations(character, battleLog) {
	let hasAffliction = false;
	if (character.ailments) {
		Object.keys(character.ailments).forEach((ailment) => {
			switch (ailment) {
				case 'poison':
					if (character.ailments[ailment] > 0) {
						const damage = Math.floor(character.stats.hp * 0.1);
						character.stats.hp = Math.max(character.stats.hp - damage, 0);
						battleLog.update(log => [...log, {
							type: 'status-effect',
							message: `${character.name} is poisoned and takes ${damage} damage!`
						}]);
						character.ailments[ailment] = Math.max(character.ailments[ailment] - 1, 0);
						if (character.ailments[ailment] === 0) {
							delete character.ailments[ailment];
						}
						hasAffliction = true;
					}
					break;
				case 'sleep':
					if (character.ailments[ailment] > 0) {
						character.ailments[ailment]--;
						if (character.ailments[ailment] === 1) {
							battleLog.update(log => [...log, {
								type: 'status-effect',
								message: `💤 ${character.name} is waking up! 💤`
							}]);
						} else {
							battleLog.update(log => [...log, {
								type: 'status-effect',
								message: `💤 ${character.name} is asleep! 💤`
							}]);
						}
						hasAffliction = true;
					}
					break;
				default:
					character.ailments[ailment]--;
					if (character.ailments[ailment] === 0) {
						delete character.ailments[ailment];
					}
					break;
			}
		});
	}
	return hasAffliction;
}

// Export formulas and constants
export {
	PRESS_TURN_MAX,
	calculateDamage,
	calculateHeal,
	applyAilment,
	updatePressTurns,
	updateAilmentDurations,
};