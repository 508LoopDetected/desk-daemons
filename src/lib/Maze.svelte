<script>
  import { onMount, onDestroy } from 'svelte';
  let mazeData = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 1, 0],
    [0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 1, 0, 1, 0, 0, 0],
    [0, 1, 0, 0, 1, 0, 1, 1, 1, 1],
    [0, 1, 1, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 1, 1, 1, 1, 1, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  ];

  let startX = 0, startY = 0, endX = 9, endY = 9;
  let isStarted = false, isFinished = false;
  let cursorX = startX, cursorY = startY;
  let spotlightRadius = 120, holdTimer = 3, holdDuration = 0;
  let spotlightX = startX * 50, spotlightY = startY * 50;
  let mouseCursorX = 0, mouseCursorY = 0;
  let isMouseOverStartCircle = false;
  let trailElements = []; // Array to hold trail elements
  const trailLength = 100; // Number of elements in the trail

  let animationFrameId; // To store requestAnimationFrame ID

  onMount(() => {
    // Initialize trail elements with positions and opacities
    for (let i = 0; i < trailLength; i++) {
      trailElements.push({ x: -10, y: -10, opacity: ((1 - i / trailLength) * 0.5).toFixed(2) }); // More aggressive opacity reduction
    }
    const update = () => {
      if (isMouseOverStartCircle && !isStarted) {
        holdDuration += 1;
        if (holdDuration >= holdTimer * 60) {
          isStarted = true;
          holdDuration = 0;
        }
      } else {
        holdDuration = 0;
      }
      animationFrameId = requestAnimationFrame(update);
    };
    update();
  });

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  function handleMouseMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseCursorX = event.clientX - rect.left;
    mouseCursorY = event.clientY - rect.top;
    spotlightX = mouseCursorX;
    spotlightY = mouseCursorY;
    const cellSize = rect.width / mazeData[0].length;
    const centerX = startX * 50 + 25, centerY = startY * 50 + 25;
    isMouseOverStartCircle = Math.hypot(mouseCursorX - centerX, mouseCursorY - centerY) <= 25;

    const newCursorX = Math.floor(mouseCursorX / cellSize);
    const newCursorY = Math.floor(mouseCursorY / cellSize);

    if (isStarted && !isFinished) {
      if (newCursorX >= 0 && newCursorX < mazeData[0].length && newCursorY >= 0 && newCursorY < mazeData.length && mazeData[newCursorY][newCursorX] === 0) {
        // Cursor is moving within the bounds and on valid paths
        cursorX = newCursorX;
        cursorY = newCursorY;
        if (cursorX === endX && cursorY === endY) {
          // If the cursor reaches the end point, the player wins
          isFinished = true;
        }
      } else {
        // If the cursor attempts to move into a wall or outside the maze, the player loses
        isFinished = true;
      }
    }

    updateTrail(); // This updates the trail based on the current cursor position
  }

  function updateTrail() {
    // This function updates the trail based on the current cursor position, adjusting for the shorter trail
    for (let i = trailElements.length - 1; i > 0; i--) {
      trailElements[i] = { ...trailElements[i - 1] };
    }
    if (isStarted && !isFinished) {
      trailElements[0] = { x: mouseCursorX, y: mouseCursorY, opacity: 1 };
      for (let i = 1; i < trailLength; i++) {
        trailElements[i].opacity = ((1 - i / trailLength) * 0.5).toFixed(2); // Adjust opacity more aggressively
      }
    } else {
      trailElements.forEach(el => {
        el.x = -10;
        el.y = -10;
        el.opacity = 0;
      });
    }
  }
</script>

<div class="game-area" on:mousemove={handleMouseMove} style="position: relative; width: 500px; height: 500px; overflow: hidden;">
  <div class="cursor" style="left: {mouseCursorX - 5}px; top: {mouseCursorY - 5}px;"/>
  {#if !isStarted}
    <div style="position: absolute; left: {startX * 50}px; top: {startY * 50}px; width: 50px; height: 50px; background-color: green; border-radius: 50%; z-index: 3;">
      {#if isMouseOverStartCircle}
        <div style="color: white; text-align: center; line-height: 50px;">{holdTimer - Math.floor(holdDuration / 60)}</div>
      {:else}
        <div style="color: white; text-align: center; line-height: 50px;">Start</div>
      {/if}
    </div>
  {/if}
  {#if isStarted && !isFinished}
    {#each trailElements as trail}
      <div class="trail" style="left: {trail.x}px; top: {trail.y}px; opacity: {trail.opacity};"/>
    {/each}
    <div class="spotlight" style="left: {spotlightX - spotlightRadius}px; top: {spotlightY - spotlightRadius}px; width: {spotlightRadius * 2}px; height: {spotlightRadius * 2}px;"/>
    {#each mazeData as row, y}
      {#each row as cell, x}
        {#if cell === 0}
          <div class="cell" style="position: absolute; left: {x * 50}px; top: {y * 50}px;"/>
        {/if}
      {/each}
    {/each}
    <div style="position: absolute; left: {endX * 50}px; top: {endY * 50}px; width: 50px; height: 50px; background-color: red; border-radius: 50%;"/>
  {/if}
  {#if isFinished}
    <div style="color: white; font-size: 24px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
      {cursorX === endX && cursorY === endY ? 'A Winner is You' : 'Bye Bye Bonus'}
    </div>
  {/if}
</div>

<style>
	:global(body) {
		background-color: rgb(33, 58, 59);
		margin: 0;
	}
  .game-area {
    cursor: none;
    background-color: rgb(33, 58, 59);
    margin: 100px auto;
  }
  .cursor {
    position: absolute;
    width: 40px;
    height: 40px;
    z-index: 9;
    transform: translate(-8px, -8px);
    /*background-image: url('https://media3.giphy.com/media/3d4Ic3Aziz4VFXTocm/giphy.gif?cid=790b7611s2z17wmh8ugjr9zcrm5zq6r32qp44h0nfr0qkanl&ep=v1_stickers_search&rid=giphy.gif&ct=s');*/
    background-image: url('https://media.tenor.com/tuIfAnlHnwcAAAAj/skull-spin.gif');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center center;

  }
  .trail {
    position: absolute;
    width: 10px;
    height: 10px;
    background-color: rgb(255, 0, 63);
    border-radius: 50%;
    z-index: 8;
    transition: opacity 1s;
    box-shadow: 0 0 12px 2px rgb(186, 0, 81);
  }
  .cell {
    width: 50px;
    height: 50px;
    background-color: #a8bfa2;
  }
  .cell:after,
  .cell:before {
    content: '';
    background: grey;
    position: absolute;
  }
  .cell:after {
    width: 100%;
    height: 40px;
    left: 20px;
    bottom: 0;
    transform: translateY(100%) skewX(45deg);
    background: linear-gradient(0deg, rgb(33, 58, 59) 0%, rgb(130, 156, 124) 100%);
  }
  .cell:before {
    width: 40px;
    height: 100%;
    right: 0;
    transform: translateX(100%) skewY(45deg);
    top: 20px;
    background: linear-gradient(-90deg, rgb(33, 58, 59) 0%, rgb(130, 156, 124) 100%);
  }
  .spotlight {
    position: absolute;
    border-radius: 50%;
    box-shadow:
    	0 0 0 100vmax rgb(33, 58, 59),
    	inset 0 0 40px 50px rgb(33, 58, 59);
    z-index: 1;
  }
  .spotlight:after {
    width: 98%;
    height: 98%;
    border-radius: 50%;
    display: block;
    content: '';
    position: absolute;
    border: 12px solid rgb(33, 58, 59);
    top: -4%;
    left: -4%;
  }
</style>
