<script>
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
  import { TextureLoader } from 'three';

  export let modelConfig;
  export let scene;
  export let mixers;
  export let currentActions;
  export let onModelLoaded;

  let defaultAnimation = modelConfig.defaultAnimation;
  let currentAction = defaultAnimation;

  onMount(() => {
    loadModel(modelConfig);
  });

  export function loadModel({ path, model, mesh, animations, defaultAnimation, position, rotation, scale }) {
    const loader = new FBXLoader();
    loader.load(`/models/${path}/${model}`, object => {
      object.position.set(position.x, position.y, position.z);
      object.rotation.set(rotation.x, rotation.y, rotation.z);
      object.scale.set(scale.x, scale.y, scale.z);

      // Load textures based on mesh
      object.traverse(child => {
        if (child.isMesh) {
          if (mesh) {
            // Load custom texture if mesh is defined
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(`/models/${path}/${mesh}`, (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace; // custom texture fix
              child.material = new THREE.MeshToonMaterial({
                map: texture, // load custom texture
                color: child.material.color,
                gradientMap: null,
              });
            });
          } else {
            // Use built-in texture if mesh is null
            child.material = new THREE.MeshToonMaterial({
              map: child.material.map, // load native texture
              color: child.material.color,
              gradientMap: null,
            });
          }
        }
      });

      scene.add(object);
      onModelLoaded(object);

      // Check if animations exist before setting up the mixer and actions
      if (animations && defaultAnimation) {
        const mixer = new THREE.AnimationMixer(object);
        mixers[path] = mixer; // Store mixer with model name as key
        currentActions[path] = {};

        animations.forEach(animName => {
          loadAnimation(path, mixer, model, animName);
        });
      }
    });
  }

  function loadAnimation(path, mixer, model, animName) {
    const loader = new FBXLoader();
    console.log(`/models/${path}/animations/${animName}.fbx`);
    loader.load(`/models/${path}/animations/${animName}.fbx`, anim => {
      const action = mixer.clipAction(anim.animations[0]);
      currentActions[path][animName] = action;

      if (animName !== defaultAnimation) {
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
      }

      // If this is the initial or current action, play it
      if (animName === currentAction) {
        action.play();
      }
    });
  }
</script>

<div class="model-container">
  <div class="btn-group">
  </div>
</div>

<style>
  .model-container {
    position: relative;
  }

  .btn-group {
    position: relative;
    top: 0;
    left: 0;
    z-index: 1;
  }
  button {
    margin: 5px;
    padding: 8px 16px;
    border: none;
    background-color: #333;
    color: white;
    cursor: pointer;
  }
  button:hover {
    background-color: #777;
  }
</style>