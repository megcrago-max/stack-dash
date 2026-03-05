import * as THREE from 'three';
import { SoundManager } from './SoundManager';
import { UI3D } from './UI3D';

const BLOCK_HEIGHT = 0.5;
const BASE_WIDTH = 3;
const BASE_DEPTH = 3;
const BASE_SPEED = 0.06;
const PERFECT_THRESHOLD = 0.12;

interface StackBlock {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  w: number;
  d: number;
}

const COLORS = [
  0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71,
  0x1abc9c, 0x3498db, 0x9b59b6, 0xe91e63,
];

export class Game3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private ui: UI3D;
  private sound: SoundManager;

  private stack: StackBlock[] = [];
  private movingMesh: THREE.Mesh | null = null;
  private movingDir = 1;
  private movingAxis: 'x' | 'z' = 'x';
  private movingSpeed = BASE_SPEED;
  private movingPos = 0;

  private level = 0;
  private score = 0;
  private combo = 0;
  private bestScore = 0;
  private cameraTargetY = 0;

  private gameOver = false;
  private started = false;
  private waitingToStart = true;
  private inputLocked = false;
  private gameOverTime = 0;
  private gameStartTime = 0;
  private lastDropTime = 0;

  private fallingPieces: { mesh: THREE.Mesh; vy: number; rotSpeed: THREE.Vector3 }[] = [];
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;

  constructor(container: HTMLElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(6, 8, 6);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(5, 12, 5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 0.1;
    this.dirLight.shadow.camera.far = 50;
    this.dirLight.shadow.camera.left = -10;
    this.dirLight.shadow.camera.right = 10;
    this.dirLight.shadow.camera.top = 10;
    this.dirLight.shadow.camera.bottom = -10;
    this.scene.add(this.dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e, roughness: 0.9, metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x333355, 0x222244);
    grid.position.y = 0;
    (grid.material as THREE.Material).opacity = 0.3;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);

    // Sound & UI
    this.sound = new SoundManager();
    this.ui = new UI3D();
    this.ui.mount(container);
    this.ui.onMuteClick(() => {
      this.sound.toggle();
      this.ui.setMuted(this.sound.muted);
    });

    this.bestScore = parseInt(localStorage.getItem('stackdash_best') || '0');

    // Input
    const handleTap = () => {
      if (this.inputLocked) return;
      const now = Date.now();
      if (this.gameOver) {
        if (now - this.gameOverTime < 1200) return;
        this.restartGame();
        return;
      }
      if (this.waitingToStart) {
        this.startGame();
        return;
      }
      if (this.started) {
        if (now - this.gameStartTime < 800) return;
        if (now - this.lastDropTime < 100) return;
        this.lastDropTime = now;
        this.dropBlock();
      }
    };

    this.renderer.domElement.addEventListener('mousedown', handleTap);
    this.renderer.domElement.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleTap();
    }, { passive: false });

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.ui.showStart();
    this.ui.setScore(0);
    this.animate();
  }

  private getColor(level: number): number {
    return COLORS[level % COLORS.length];
  }

  private createBlockMesh(x: number, z: number, y: number, w: number, d: number, color: number): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, BLOCK_HEIGHT, d);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.35, metalness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + w / 2 - BASE_WIDTH / 2, y, z + d / 2 - BASE_DEPTH / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private startGame() {
    this.waitingToStart = false;
    this.started = true;
    this.gameOver = false;
    this.gameStartTime = Date.now();
    this.lastDropTime = 0;
    this.level = 0;
    this.score = 0;
    this.combo = 0;
    this.cameraTargetY = 0;

    // Clear old
    for (const b of this.stack) this.scene.remove(b.mesh);
    for (const f of this.fallingPieces) this.scene.remove(f.mesh);
    for (const p of this.particles) this.scene.remove(p.mesh);
    if (this.movingMesh) this.scene.remove(this.movingMesh);
    this.stack = [];
    this.fallingPieces = [];
    this.particles = [];

    this.ui.hideOverlay();
    this.ui.setScore(0);
    this.ui.hideCombo();

    // Base block
    const mesh = this.createBlockMesh(0, 0, BLOCK_HEIGHT / 2, BASE_WIDTH, BASE_DEPTH, this.getColor(0));
    this.stack.push({ mesh, x: 0, z: 0, w: BASE_WIDTH, d: BASE_DEPTH });

    this.spawnMovingBlock();
  }

  private spawnMovingBlock() {
    const top = this.stack[this.stack.length - 1];
    this.movingSpeed = BASE_SPEED + Math.floor(this.level / 10) * 0.015;
    this.movingAxis = this.level % 2 === 0 ? 'x' : 'z';

    const y = (this.stack.length) * BLOCK_HEIGHT + BLOCK_HEIGHT / 2;
    const color = this.getColor(this.level + 1);

    if (this.movingAxis === 'x') {
      // First block starts centered
      const startX = this.level === 0 ? top.x : -BASE_WIDTH;
      this.movingPos = startX;
      this.movingMesh = this.createBlockMesh(startX, top.z, y, top.w, top.d, color);
    } else {
      const startZ = this.level === 0 ? top.z : -BASE_DEPTH;
      this.movingPos = startZ;
      this.movingMesh = this.createBlockMesh(top.x, startZ, y, top.w, top.d, color);
    }

    this.movingDir = 1;
    this.level++;
  }

  private dropBlock() {
    if (!this.movingMesh || this.gameOver) return;

    const top = this.stack[this.stack.length - 1];
    const y = this.stack.length * BLOCK_HEIGHT + BLOCK_HEIGHT / 2;
    const color = this.getColor(this.level);

    let overlapStart: number, overlapEnd: number, topStart: number, topEnd: number;
    let movStart: number;

    if (this.movingAxis === 'x') {
      movStart = this.movingPos;
      topStart = top.x;
      topEnd = top.x + top.w;
      overlapStart = Math.max(movStart, topStart);
      overlapEnd = Math.min(movStart + top.w, topEnd);
    } else {
      movStart = this.movingPos;
      topStart = top.z;
      topEnd = top.z + top.d;
      overlapStart = Math.max(movStart, topStart);
      overlapEnd = Math.min(movStart + top.d, topEnd);
    }

    const overlapSize = overlapEnd - overlapStart;

    // Remove moving mesh
    this.scene.remove(this.movingMesh);
    this.movingMesh = null;

    if (overlapSize <= 0) {
      // Miss
      this.sound.gameOver();
      this.triggerGameOver();
      return;
    }

    const fullSize = this.movingAxis === 'x' ? top.w : top.d;
    const diff = Math.abs(overlapSize - fullSize);

    if (diff <= PERFECT_THRESHOLD) {
      // Perfect
      const mesh = this.createBlockMesh(top.x, top.z, y, top.w, top.d, color);
      this.stack.push({ mesh, x: top.x, z: top.z, w: top.w, d: top.d });
      this.combo++;
      this.score += 10 + this.combo * 2;
      this.sound.perfect();
      if (this.combo % 5 === 0) this.sound.combo();
      this.ui.showCombo(this.combo);
      this.spawnParticles(mesh.position.clone(), color);

      // Bounce effect
      mesh.scale.set(1.05, 1.2, 1.05);
      this.tweenScale(mesh, 1, 1, 1, 200);
    } else {
      // Partial
      this.combo = 0;
      this.ui.hideCombo();
      this.score += 10;
      this.sound.slice();

      let newX = top.x, newZ = top.z, newW = top.w, newD = top.d;
      let cutX = 0, cutZ = 0, cutW = 0, cutD = 0;

      if (this.movingAxis === 'x') {
        newX = overlapStart;
        newW = overlapSize;
        if (movStart < topStart) {
          cutX = movStart; cutW = topStart - movStart; cutZ = top.z; cutD = top.d;
        } else {
          cutX = topEnd; cutW = (movStart + top.w) - topEnd; cutZ = top.z; cutD = top.d;
        }
      } else {
        newZ = overlapStart;
        newD = overlapSize;
        if (movStart < topStart) {
          cutZ = movStart; cutD = topStart - movStart; cutX = top.x; cutW = top.w;
        } else {
          cutZ = topEnd; cutD = (movStart + top.d) - topEnd; cutX = top.x; cutW = top.w;
        }
      }

      const mesh = this.createBlockMesh(newX, newZ, y, newW, newD, color);
      this.stack.push({ mesh, x: newX, z: newZ, w: newW, d: newD });
      this.sound.place();

      // Falling piece
      if (cutW > 0.01 && cutD > 0.01) {
        const cutMesh = this.createBlockMesh(cutX, cutZ, y, cutW, cutD, color);
        this.fallingPieces.push({
          mesh: cutMesh, vy: 0,
          rotSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            0,
            (Math.random() - 0.5) * 0.1,
          ),
        });
      }
    }

    this.ui.setScore(this.score);

    // Camera follows
    this.cameraTargetY = Math.max(0, this.stack.length * BLOCK_HEIGHT - 3);

    this.spawnMovingBlock();
  }

  private tweenScale(mesh: THREE.Mesh, tx: number, ty: number, tz: number, dur: number) {
    const start = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
    const startTime = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - startTime) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      mesh.scale.set(
        start.x + (tx - start.x) * ease,
        start.y + (ty - start.y) * ease,
        start.z + (tz - start.z) * ease,
      );
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private spawnParticles(pos: THREE.Vector3, color: number) {
    for (let i = 0; i < 15; i++) {
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          Math.random() * 0.15 + 0.05,
          (Math.random() - 0.5) * 0.15,
        ),
        life: 1,
      });
    }
  }

  private triggerGameOver() {
    this.gameOver = true;
    this.started = false;
    this.gameOverTime = Date.now();
    this.inputLocked = true;
    setTimeout(() => { this.inputLocked = false; }, 1200);

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('stackdash_best', String(this.bestScore));
    }
    this.ui.showGameOver(this.score, this.bestScore);
  }

  private restartGame() {
    this.startGame();
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    // Move block
    if (this.started && this.movingMesh && !this.gameOver) {
      const top = this.stack[this.stack.length - 1];
      this.movingPos += this.movingDir * this.movingSpeed;

      const limit = this.movingAxis === 'x' ? BASE_WIDTH * 1.5 : BASE_DEPTH * 1.5;
      if (this.movingPos > limit) this.movingDir = -1;
      if (this.movingPos < -limit) this.movingDir = 1;

      const y = this.stack.length * BLOCK_HEIGHT + BLOCK_HEIGHT / 2;
      if (this.movingAxis === 'x') {
        this.movingMesh.position.set(
          this.movingPos + top.w / 2 - BASE_WIDTH / 2, y,
          top.z + top.d / 2 - BASE_DEPTH / 2,
        );
      } else {
        this.movingMesh.position.set(
          top.x + top.w / 2 - BASE_WIDTH / 2, y,
          this.movingPos + top.d / 2 - BASE_DEPTH / 2,
        );
      }
    }

    // Camera
    const camY = this.cameraTargetY;
    this.camera.position.y += (camY + 8 - this.camera.position.y) * 0.05;
    this.camera.lookAt(0, camY, 0);
    this.dirLight.position.y = camY + 12;
    this.dirLight.target.position.y = camY;
    this.dirLight.target.updateMatrixWorld();

    // Falling pieces
    this.fallingPieces = this.fallingPieces.filter(f => {
      f.vy -= 0.005;
      f.mesh.position.y += f.vy;
      f.mesh.rotation.x += f.rotSpeed.x;
      f.mesh.rotation.z += f.rotSpeed.z;
      if (f.mesh.position.y < -10) {
        this.scene.remove(f.mesh);
        return false;
      }
      return true;
    });

    // Particles
    this.particles = this.particles.filter(p => {
      p.vel.y -= 0.003;
      p.mesh.position.add(p.vel);
      p.life -= 0.02;
      p.mesh.scale.setScalar(p.life);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        return false;
      }
      return true;
    });

    this.renderer.render(this.scene, this.camera);
  };
}
