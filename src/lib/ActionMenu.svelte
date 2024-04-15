<script>
  import { createEventDispatcher } from 'svelte';

  export let player;
  export let disableGUI;
  export let isPlayerTurn;

  let menuStack = ['main'];
  let currentMenu = 'main';
  let selectedIndexMap = { main: 0 };
  let selectionTimeout = null;
  let selectionProgress = 0;

  const dispatch = createEventDispatcher();

  $: skills = player.skills;
  $: attackSkills = skills.filter(skill => skill.type === 'physical');
  $: magicSkills = skills.filter(skill => !['physical', 'ailment', 'healing'].includes(skill.type));
  $: supportSkills = skills.filter(skill => ['healing', 'ailment'].includes(skill.type));

  function handleKeyDown(event) {
    // Return early if the GUI is disabled
    if (!isPlayerTurn || disableGUI) return;

    switch (event.key) {
      case 's':
        // Go back to the previous menu if not in the main menu
        if (menuStack.length > 1) {
          menuStack.pop();
          currentMenu = menuStack[menuStack.length - 1];
        }
        break;
      case 'w':
        // Get the currently selected item in the menu
        const selectedItem = getMenuItems(currentMenu)[selectedIndexMap[currentMenu]];
        // If the selected item has a submenu, navigate to that submenu
        if (selectedItem.submenu) {
          menuStack.push(selectedItem.submenu);
          currentMenu = selectedItem.submenu;
          selectedIndexMap[currentMenu] = selectedIndexMap[currentMenu] || 0;
        }
        // If the selected item is an actual skill and no selection timeout is active,
        // start the selection timeout
        else if (selectedItem.action && !selectionTimeout) {
          selectionProgress = 0;
          selectionTimeout = setInterval(() => {
            selectionProgress += 10;
            if (selectionProgress >= 100) {
              dispatch('menuselect', selectedItem.action);
              clearInterval(selectionTimeout);
              selectionTimeout = null;
              selectionProgress = 0;
            }
          }, 50);
        }
        break;
      case 'a':
        // Move the selection up in the current menu
        selectedIndexMap[currentMenu] = Math.max(selectedIndexMap[currentMenu] - 1, 0);
        break;
      case 'd':
        // Move the selection down in the current menu
        selectedIndexMap[currentMenu] = Math.min(selectedIndexMap[currentMenu] + 1, getMenuItems(currentMenu).length - 1);
        break;
    }
  }

  function handleKeyUp(event) {
    if (event.key === 'w' && selectionTimeout) {
      clearInterval(selectionTimeout);
      selectionTimeout = null;
      selectionProgress = 0;
    }
  }

  function getMenuItems(menu) {
    if (menu === 'main') {
      return [
        { label: 'Attack', submenu: 'attack' },
        { label: 'Magic', submenu: 'magic' },
        { label: 'Support', submenu: 'support' },
      ];
    } else if (menu === 'attack') {
      return attackSkills.map(skill => ({
        label: `${skill.name}`,
        action: skill,
        type: 'physical',
      }));
    } else if (menu === 'magic') {
      return magicSkills.map(skill => ({
        label: `${skill.name} <small>${skill.cost}</small>`,
        action: skill,
        type: `${skill.type}`,
      }));
    } else if (menu === 'support') {
      return supportSkills.map(skill => ({
        label: `${skill.name} <small>${skill.cost}</small>`,
        action: skill,
        type: `${skill.type}`,
      }));
    }
    return [];
  }
</script>

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} />

<div class="action-menu">
  <div class="button-container">
    {#each getMenuItems(currentMenu) as item, i}
      <button class="skill-button"
        class:selected={i === selectedIndexMap[currentMenu]}
        class:physical={item.type === 'physical'}
        class:healing={item.type === 'healing'}
        class:ailment={item.type === 'ailment'}
        class:fire={item.type === 'fire'}
        class:electric={item.type === 'electric'}
        class:ice={item.type === 'ice'}
        class:force={item.type === 'force'}
        disabled={!isPlayerTurn || disableGUI}>
        {@html item.label}
        {#if i === selectedIndexMap[currentMenu]}
          <div class="selection-progress" style="height: {selectionProgress}%;"></div>
        {/if}
      </button>
    {/each}
  </div>
</div>


<style>
  h3 {
    color: #fff;
    margin: 10px 0 5px;
  }
  .action-menu {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(230,230,230,0.4);
    padding: 20px 10px 15px;
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: #a0a0a0 #1c1c1c;
    text-shadow: 0 0 5px #000;
  }

  .action-menu::-webkit-scrollbar {
    width: 8px;
  }

  .action-menu::-webkit-scrollbar-track {
    background: #1c1c1c;
  }

  .action-menu::-webkit-scrollbar-thumb {
    background-color: #a0a0a0;
  }

  .button-container {
    display: flex;
    align-items: center;
  }

  .skill-button {
    background-color: #333;
    color: #fff;
    cursor: pointer;
    font-weight: bold;
    font-size: 16px;
/*    transition: all 0.15s ease;*/
    position: relative;
    border: 2px solid rgba(255,255,255,0.3);
    outline: 3px solid #000;
    display: inline-block;
    text-align: left;
    width: 100%;
    min-width: 200px;
    padding: 5px 10px;
    margin: 5px 10px;
  }

  .skill-button:hover,
  .skill-button.selected {
    background-color: #6c6c6c;
    outline: 3px solid #000;
  }

  .skill-button::before,
  .skill-button:hover::before,
  .skill-button.selected::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    display: block;
    width: 0; 
    height: 0; 
    border-left: 25px solid transparent;
    border-right: 25px solid transparent;
    border-bottom: 0px solid #000;
    margin: auto;
    bottom: 100%;
    opacity: 0;
    font-size: 1.3rem;
    color: #000;
    z-index: -2;
    transition: border-bottom 0.15s ease;
  }

  .skill-button:hover::before,
  .skill-button.selected::before {
    opacity: 1;
    border-bottom: 15px solid #000;
  }

  .skill-button:disabled {
    background-color: #000 !important;
    color: #333;
    cursor: not-allowed;
  }

  .skill-button:disabled:before {
    color: #333;
  }

  :global(.skill-button small) {
    position: absolute;
    font-size: 0.8rem;
    top: 5px;
    right: 5px;
    text-align: center;
    border-radius: 50%;
    background-color: #000;
    width: 25px;
    height: 21px;
    padding-top: 4px;
  }

  .skill-button.selected.physical small { display: none; }

  .skill-button.selected.healing { background-color: #008080; }
  .skill-button.selected.ailment { background-color: #524774; }
  .skill-button.selected.fire { background-color: #d53515; }
  .skill-button.selected.electric { background-color: #dfbd08; }
  .skill-button.selected.ice { background-color: #59b2cf; }
  .skill-button.selected.force { background-color: #228b22; }
  .skill-button.selected.light { background-color: #fffff0; color: #000; }
  .skill-button.selected.dark { background-color: #8b0000; }

  .selection-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(255,255,255,0.3);
    pointer-events: none;
  }
</style>