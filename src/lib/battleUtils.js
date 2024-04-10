// Constants
const PRESS_TURN_MAX = 3;
const CRITICAL_CHANCE_BASE = 0.05;
const CRITICAL_CHANCE_MULTIPLIER = 0.01;
const AILMENT_CHANCE_MULTIPLIER = 0.01;
const STAT_POINTS_PER_LEVEL = 5;

const RESISTANCE_MULTIPLIERS = {
  weak: 2,
  resist: 0.5,
  null: 0,
  absorb: -1,
  normal: 1,
};

const AILMENT_DURATIONS = {
  poison: 3,
  confusion: 2,
  sleep: 3,
  silence: 2,
  fear: 2,
  rage: 3,
};

// for leveling purposes later...
const STAT_DISTRIBUTION = {
  str: 0.3,
  vit: 0.2,
  mag: 0.1,
  agi: 0.2,
  luc: 0.2
};

// Formulas
function calculateMagicSkillPower(character, skill) {
  const baseSkillPower = skill.power || 0;
  const magicStat = (character.stats && character.stats.mag) || 0;
  return Math.floor(magicStat / 2) + baseSkillPower;
}

function calculatePhysicalSkillPower(character, skill) {
  const baseSkillPower = skill.power || 0;
  const strengthStat = (character.stats && character.stats.str) || 0;
  return Math.floor(strengthStat / 4) + baseSkillPower;
}

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

  const baseDamage = (attackerStats.strength + skillPower) * (1 - Math.max(defenderStats.vitality, 0) / 100);

  const resistanceMultiplier = getResistanceMultiplier(
    skill.type,
    defender.resistances || {}
  );

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

  const damageRange = [
    Math.round(finalDamage * (isCrit ? 0.8 : 0.9)),
    Math.round(finalDamage * (isCrit ? 1.2 : 1.1))
  ];

  const damage = Math.floor(Math.random() * (damageRange[1] - damageRange[0] + 1)) + damageRange[0];

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

function calculateHeal(attacker, skill) {
  const baseHeal = skill.power; // Base healing amount from the skill
  const magicModifier = attacker.stats.magic * 0.5; // Example: magic stat influences healing
  const totalHeal = baseHeal + magicModifier;
  // Ensure total healing does not exceed caster's maximum HP
  const maxHeal = Math.min(totalHeal, attacker.stats.maxHp - attacker.stats.hp);
  return Math.round(maxHeal);
}

function getResistanceMultiplier(skillType, defenderResistances) {
  const resistance = defenderResistances?.[skillType] || 'normal';
  if (resistance === 'null') {
    return 0; // Explicitly return 0 for 'null' resistance
  } else if (resistance === 'absorb') {
    return -1; // Explicitly return 0 for 'absorb' resistance
  }
  return RESISTANCE_MULTIPLIERS[resistance] || 1;
}

function isCritical(attacker) {
  const attackerStats = attacker.stats || {};
  const luck = attackerStats.luck || 0;
  const criticalChance = CRITICAL_CHANCE_BASE + luck * CRITICAL_CHANCE_MULTIPLIER;
  return Math.random() < criticalChance;
}

function applyAilment(attacker, defender, skill) {
  if (!skill.ailment) return false;

  const ailmentChance = skill.ailmentChance + attacker.stats.magic * AILMENT_CHANCE_MULTIPLIER;
  const resistanceMultiplier = getResistanceMultiplier(skill.type, defender.resistances);
  const finalAilmentChance = ailmentChance * resistanceMultiplier;

  if (Math.random() < finalAilmentChance) {
    defender.ailments = defender.ailments || {};
    if (skill.ailment === 'sleep') {
      defender.ailments[skill.ailment] = 4 + skill.power * 2; // set sleep duration based on skill power
    } else {
      defender.ailments[skill.ailment] = AILMENT_DURATIONS[skill.ailment];
    }
    return true;
  }

  return false;
}

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

function updateAilmentDurations(character) {
  const ailmentMessages = [];
  if (character.ailments) {
    Object.keys(character.ailments).forEach((ailment) => {
      switch (ailment) {
        case 'poison':
          if (character.ailments[ailment] > 0) {
            const damage = Math.floor(character.stats.hp * 0.1); // Deal 10% of current HP as poison damage
            character.stats.hp = Math.max(character.stats.hp - damage, 0);
            ailmentMessages.push(`${character.name} is poisoned and takes ${damage} damage!`);
            character.ailments[ailment] = Math.max(character.ailments[ailment] - 1, 0);
            if (character.ailments[ailment] === 0) {
              delete character.ailments[ailment];
            }
          }
          break;
        case 'sleep':
          if (character.ailments[ailment] > 0) {
            ailmentMessages.push(`${character.name} is asleep!`);
            character.ailments[ailment] = Math.max(character.ailments[ailment] - 1, 0);
            if (character.ailments[ailment] === 0) {
              delete character.ailments[ailment];
            }
          }
          break;
        default:
          character.ailments[ailment] = Math.max(character.ailments[ailment] - 1, 0);
          if (character.ailments[ailment] === 0) {
            delete character.ailments[ailment];
          }
          break;
      }
    });
  }
  return ailmentMessages;
}

// Export formulas
export {
  PRESS_TURN_MAX,
  calculateDamage,
  calculateHeal,
  applyAilment,
  updatePressTurns,
  updateAilmentDurations,
};