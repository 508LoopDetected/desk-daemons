import { writable } from 'svelte/store';
import playerData from './data/player.json';
import enemyData from './data/enemies.json';

export const player = writable(playerData);
export const enemies = writable(enemyData);
export const currentEnemy = writable(null);
export const battleLog = writable([]);