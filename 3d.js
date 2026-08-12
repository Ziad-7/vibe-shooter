import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Setup basic scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f13);
scene.fog = new THREE.FogExp2(0x0f0f13, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Environment
const gridHelper = new THREE.GridHelper(200, 100, 0x00ffff, 0x003333);
scene.add(gridHelper);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x00ffff, 2, 50);
pointLight.position.set(0, 10, 0);
scene.add(pointLight);

// Controls & Physics
const playerPivot = new THREE.Group();
playerPivot.position.y = 2;
scene.add(playerPivot);

const controls = new PointerLockControls(playerPivot, document.body);

const playerMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.2, wireframe: true })
);
playerMesh.position.set(0, -1, 0); // body hangs below eyes
playerMesh.visible = false;
playerPivot.add(playerMesh);

playerPivot.add(camera);
camera.position.set(0, 0, 0);

let is3rdPerson = false;
let spawnRate = 1500;
let isGameStarted = false;

const instructions = document.getElementById('instructions');

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    if (isGameStarted && !isGameOver) {
        instructions.style.display = 'block';
    }
});

scene.add(controls.getObject());

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const onKeyDown = (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Removed V hotkey since view is locked in setup menu

// Shooting Mechanics
const raycaster = new THREE.Raycaster();
const laserMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });

let score = 0;
let isGameOver = false;

let wave = 1;
let enemiesToSpawn = 0;
let enemiesAlive = 0;
let isWaveTransition = false;
let lastSpawnTime = 0;
let combo = 0;
let comboTimer = 0;
let shakeDuration = 0;
let currentDifficulty = 'normal';

let currentPowerUp = null;
let powerUpTimer = 0;
let isMouseDown = false;
let lastShotTime = 0;
const powerUps = [];

document.addEventListener('mousedown', (event) => {
    if (!isGameStarted) return;
    
    if (controls.isLocked === true && event.button === 0 && !isGameOver) {
        isMouseDown = true;
        if (currentPowerUp !== 'rapid') {
            shoot();
            if (window.AudioEngine) window.AudioEngine.playShoot();
        }
    }
});

document.addEventListener('mouseup', (event) => {
    if (event.button === 0) isMouseDown = false;
});

function spawnPowerUp(position, type) {
    const geo = new THREE.SphereGeometry(1, 16, 16);
    const color = type === 'rapid' ? 0xff0000 : 0xffff00;
    const mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.8
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.userData = { type };
    scene.add(mesh);
    powerUps.push(mesh);
}

function shoot() {
    fireRay(0, 0);
    if (currentPowerUp === 'spread') {
        fireRay(-0.05, 0);
        fireRay(0.05, 0);
    }
}

function fireRay(offsetX, offsetY) {
    raycaster.setFromCamera(new THREE.Vector2(offsetX, offsetY), camera);
    
    const intersects = raycaster.intersectObjects(enemies);
    if (intersects.length > 0) {
        const hitEnemy = intersects[0].object;
        
        // Handle HP
        hitEnemy.userData.hp -= 1;
        
        if (hitEnemy.userData.hp > 0) {
            // Tank taking damage (shrink slightly and flash)
            hitEnemy.scale.multiplyScalar(0.85);
            hitEnemy.material.emissiveIntensity = 2.0;
            setTimeout(() => {
                if(hitEnemy.parent) hitEnemy.material.emissiveIntensity = 0.8;
            }, 100);
        } else {
            // Explode (dead)
            createParticles(hitEnemy.position, hitEnemy.material.color);
            
            scene.remove(hitEnemy);
            enemies.splice(enemies.indexOf(hitEnemy), 1);
            
            // Score based on type
            let baseScore = 100;
            if (hitEnemy.userData.type === 'tank') baseScore = 300;
            else if (hitEnemy.userData.type === 'dasher') baseScore = 150;
            
            // Combo System
            combo++;
            comboTimer = 2;
            score += (baseScore * combo);
            
            document.getElementById('comboUI').style.display = 'block';
            document.getElementById('comboMultiplier').innerText = combo;
            document.getElementById('scoreEl').innerText = score;
            
            if (hitEnemy.userData.type === 'tank') shakeDuration = 0.3;
            
            enemiesAlive--;
            
            if (window.AudioEngine) window.AudioEngine.playExplosion();
            
            // PowerUp drop (10% chance)
            if (Math.random() < 0.1) {
                const pType = Math.random() < 0.5 ? 'rapid' : 'spread';
                spawnPowerUp(hitEnemy.position, pType);
            }
        }
    }
    
    const direction = raycaster.ray.direction.clone().multiplyScalar(100);
    
    const origin = new THREE.Vector3();
    if (is3rdPerson) {
        playerMesh.getWorldPosition(origin);
    } else {
        origin.copy(raycaster.ray.origin);
        origin.y -= 0.5;
    }
    
    const endPoint = origin.clone().add(direction);
    
    const points = [origin, endPoint];
    const laserGeo = new THREE.BufferGeometry().setFromPoints(points);
    const laser = new THREE.Line(laserGeo, laserMaterial);
    
    scene.add(laser);
    
    setTimeout(() => {
        scene.remove(laser);
        laserGeo.dispose();
    }, 50);
}

// Game state
const enemies = [];
const particles = [];

function createParticles(position, color) {
    const particleGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    for (let i = 0; i < 20; i++) {
        const particleMat = new THREE.MeshBasicMaterial({ color: color });
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.position.copy(position);
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30
        );
        scene.add(particle);
        particles.push(particle);
    }
}

function spawnEnemy() {
    if (isGameOver) return;
    
    const rand = Math.random();
    let type = 'standard';
    let hp = 1;
    let geometry;
    
    // Scale types by wave
    let tankChance = 0.8;
    let dasherChance = 0.5;
    
    if (wave > 2) dasherChance = 0.4;
    if (wave > 4) tankChance = 0.7;
    
    if (rand > tankChance) {
        type = 'tank';
        hp = 3;
        geometry = new THREE.BoxGeometry(4, 4, 4);
    } else if (rand > 0.5) {
        type = 'dasher';
        hp = 1;
        geometry = new THREE.TetrahedronGeometry(1.5);
    } else {
        type = 'standard';
        hp = 1;
        geometry = new THREE.OctahedronGeometry(2);
    }
    
    const color = new THREE.Color().setHSL(Math.random(), 1.0, 0.5);
    const material = new THREE.MeshStandardMaterial({ 
        color: color, 
        emissive: color, 
        emissiveIntensity: 0.8,
        wireframe: true
    });
    
    const enemy = new THREE.Mesh(geometry, material);
    enemy.userData = { type, hp };
    
    const angle = Math.random() * Math.PI * 2;
    const radius = 60 + Math.random() * 20;
    
    enemy.position.x = Math.cos(angle) * radius;
    enemy.position.z = Math.sin(angle) * radius;
    enemy.position.y = 2;
    
    scene.add(enemy);
    enemies.push(enemy);
}

function applyMapVisuals(mapType) {
    if (mapType === 'magenta') {
        gridHelper.material.color.setHex(0xff00ff);
        pointLight.color.setHex(0xff00ff);
        scene.fog.color.setHex(0x0f0f13);
        scene.background = new THREE.Color(0x0f0f13);
    } else if (mapType === 'matrix') {
        gridHelper.material.color.setHex(0x00ff00);
        pointLight.color.setHex(0x00ff00);
        scene.fog.color.setHex(0x002200);
        scene.background = new THREE.Color(0x002200);
    } else {
        gridHelper.material.color.setHex(0x00ffff);
        pointLight.color.setHex(0x00ffff);
        scene.fog.color.setHex(0x0f0f13);
        scene.background = new THREE.Color(0x0f0f13);
    }
}

const setupMap = document.getElementById('setupMap');
if (setupMap) {
    setupMap.addEventListener('change', (e) => {
        applyMapVisuals(e.target.value);
    });
}

document.getElementById('startGameBtn').addEventListener('click', () => {
    const setupView = document.getElementById('setupView').value;
    const setupDiff = document.getElementById('setupDiff').value;
    const setupMap = document.getElementById('setupMap').value;
    
    // Apply View
    is3rdPerson = (setupView === '3rd');
    if (is3rdPerson) {
        camera.position.set(0, 2, 7);
        playerMesh.visible = true;
    } else {
        camera.position.set(0, 0, 0);
        playerMesh.visible = false;
    }
    
    // Apply Difficulty
    currentDifficulty = setupDiff;
    if (setupDiff === 'easy') spawnRate = 2000;
    else if (setupDiff === 'hard') spawnRate = 800;
    else spawnRate = 1500;
    
    // Apply Map Visuals
    applyMapVisuals(setupMap);
    
    document.getElementById('setupMenu').style.display = 'none';
    isGameStarted = true;
    
    wave = 1;
    enemiesToSpawn = 10;
    enemiesAlive = 0;
    isWaveTransition = false;
    combo = 0;
    document.getElementById('waveUI').innerText = `WAVE 1`;
    document.getElementById('waveUI').style.display = 'block';
    setTimeout(() => {
        document.getElementById('waveUI').style.display = 'none';
    }, 3000);
    
    controls.lock();
});

document.getElementById('restartBtn').addEventListener('click', () => {
    isGameOver = false;
    score = 0;
    document.getElementById('scoreEl').innerText = score;
    document.getElementById('gameOverModal').style.display = 'none';
    
    enemies.forEach(e => scene.remove(e));
    enemies.length = 0;
    
    particles.forEach(p => scene.remove(p));
    particles.length = 0;
    
    controls.getObject().position.set(0, 2, 0);
    velocity.set(0, 0, 0);
    
    wave = 1;
    enemiesToSpawn = 10;
    enemiesAlive = 0;
    isWaveTransition = false;
    combo = 0;
    document.getElementById('waveUI').innerText = `WAVE 1`;
    document.getElementById('waveUI').style.display = 'block';
    setTimeout(() => {
        document.getElementById('waveUI').style.display = 'none';
    }, 3000);
    
    controls.lock();
});

let prevTime = performance.now();

// Window resize handling
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();

    if (controls.isLocked === true && isGameStarted) {
        const delta = (time - prevTime) / 1000;

        // Rapid Fire Check
        if (isMouseDown && currentPowerUp === 'rapid' && time - lastShotTime > 100) {
            shoot();
            if (window.AudioEngine) window.AudioEngine.playShoot();
            lastShotTime = time;
        }

        // Apply friction
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // consistent movement in all directions

        const speed = 100.0;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        
        // Boundaries constraint
        if (controls.getObject().position.x > 100) controls.getObject().position.x = 100;
        if (controls.getObject().position.x < -100) controls.getObject().position.x = -100;
        if (controls.getObject().position.z > 100) controls.getObject().position.z = 100;
        if (controls.getObject().position.z < -100) controls.getObject().position.z = -100;
        
        const moveSpeed = 10;
        
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            
            enemy.rotation.x += 0.01;
            enemy.rotation.y += 0.02;

            let typeSpeed = moveSpeed;
            if (enemy.userData.type === 'tank') typeSpeed = moveSpeed * 0.4;
            if (enemy.userData.type === 'dasher') {
                if (currentDifficulty === 'hard') typeSpeed = moveSpeed * 2.0;
                else if (currentDifficulty === 'easy') typeSpeed = moveSpeed * 1.2;
                else typeSpeed = moveSpeed * 1.5; // Normal
            }

            // Move towards player
            const playerPos = controls.getObject().position;
            const direction = new THREE.Vector3();
            direction.subVectors(playerPos, enemy.position).normalize();
            enemy.position.addScaledVector(direction, typeSpeed * delta);
            
            // Check player collision
            if (enemy.position.distanceTo(playerPos) < 3.0) {
                isGameOver = true;
                
                const currentBest = parseInt(localStorage.getItem('vibeShooterBest3D')) || 0;
                if (score > currentBest && score > 0) {
                    localStorage.setItem('vibeShooterBest3D', score);
                    document.getElementById('highScoreText').style.display = 'block';
                } else {
                    document.getElementById('highScoreText').style.display = 'none';
                }
                
                document.getElementById('finalScoreEl').innerText = score;
                document.getElementById('gameOverModal').style.display = 'block';
            }
        }
        
        if (!isWaveTransition && isGameStarted && !isGameOver) {
            if (enemiesToSpawn <= 0 && enemiesAlive <= 0) {
                isWaveTransition = true;
                wave++;
                document.getElementById('waveUI').innerText = `WAVE ${wave}`;
                document.getElementById('waveUI').style.display = 'block';
                
                setTimeout(() => {
                    document.getElementById('waveUI').style.display = 'none';
                    enemiesToSpawn = 5 + (wave * 5);
                    isWaveTransition = false;
                }, 3000);
            } else if (enemiesToSpawn > 0 && time - lastSpawnTime > spawnRate) {
                spawnEnemy();
                enemiesToSpawn--;
                enemiesAlive++;
                lastSpawnTime = time;
            }
        }
        
        if (comboTimer > 0) {
            comboTimer -= delta;
            if (comboTimer <= 0) {
                combo = 0;
                document.getElementById('comboUI').style.display = 'none';
            }
        }
        
        if (shakeDuration > 0) {
            shakeDuration -= delta;
            camera.position.x = (Math.random() - 0.5) * 0.5;
            camera.position.y = (is3rdPerson ? 2 : 0) + (Math.random() - 0.5) * 0.5;
        } else {
            camera.position.x = 0;
            camera.position.y = is3rdPerson ? 2 : 0;
        }
        
        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.position.addScaledVector(p.velocity, delta);
            if (p.position.y < 0) p.position.y = 0; // Floor bounce
            p.scale.multiplyScalar(0.95);
            if (p.scale.x < 0.01) {
                scene.remove(p);
                particles.splice(i, 1);
            }
        }
        
        // Update powerups
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const p = powerUps[i];
            p.rotation.y += 0.05;
            p.position.y = 2 + Math.sin(time / 200) * 0.5;
            
            // Collision with player
            if (p.position.distanceTo(controls.getObject().position) < 3.0) {
                currentPowerUp = p.userData.type;
                powerUpTimer = 10;
                
                document.getElementById('powerupUI').style.display = 'block';
                document.getElementById('powerupName').innerText = currentPowerUp === 'rapid' ? 'Rapid Fire' : 'Spread Shot';
                document.getElementById('powerupName').style.color = currentPowerUp === 'rapid' ? '#ff0000' : '#ffff00';
                
                scene.remove(p);
                powerUps.splice(i, 1);
            }
        }
        
        if (powerUpTimer > 0) {
            powerUpTimer -= delta;
            document.getElementById('powerupTime').innerText = Math.ceil(powerUpTimer);
            if (powerUpTimer <= 0) {
                currentPowerUp = null;
                document.getElementById('powerupUI').style.display = 'none';
            }
        }
    }

    prevTime = time;

    renderer.render(scene, camera);
}

animate();

// Audio setup
const musicBtn = document.getElementById('toggleMusicBtn');
const sfxBtn = document.getElementById('toggleSfxBtn');

if (musicBtn && sfxBtn && window.AudioEngine) {
    musicBtn.innerText = `🎵 Music: ${window.AudioEngine.state.musicMuted ? 'OFF' : 'ON'}`;
    sfxBtn.innerText = `🔊 SFX: ${window.AudioEngine.state.sfxMuted ? 'OFF' : 'ON'}`;

    musicBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.AudioEngine.init();
        window.AudioEngine.playMusic();
        const muted = window.AudioEngine.toggleMusic();
        musicBtn.innerText = `🎵 Music: ${muted ? 'OFF' : 'ON'}`;
    });
    
    sfxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.AudioEngine.init();
        const muted = window.AudioEngine.toggleSfx();
        sfxBtn.innerText = `🔊 SFX: ${muted ? 'OFF' : 'ON'}`;
    });
}

// Resume game if paused
document.addEventListener('click', (event) => {
    if (isGameStarted && !isGameOver && !controls.isLocked) {
        if(event.target.classList && event.target.classList.contains('audio-btn')) return;
        if(event.target.id === 'restartBtn') return;
        controls.lock();
    }
});

document.addEventListener('click', () => {
    if (window.AudioEngine) {
        window.AudioEngine.init();
        window.AudioEngine.playMusic();
    }
}, { once: true });
