const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const scoreEl = document.getElementById('scoreEl');
const gameOverModal = document.getElementById('gameOverModal');
const finalScoreEl = document.getElementById('finalScoreEl');
const restartBtn = document.getElementById('restartBtn');

let score = 0;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Input state
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

const mouse = {
    x: canvas.width / 2,
    y: canvas.height / 2
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = false;
    }
});

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

const projectiles = [];
const powerUps = [];

let currentPowerUp = null;
let powerUpTimer = 0;
let isMouseDown = false;
let lastShotTime = 0;

window.addEventListener('mousedown', (event) => {
    if (isMobile) return; // handled by touch
    if (!isGameStarted) return;
    if(event.target.classList.contains('audio-btn')) return;

    isMouseDown = true;
    if (currentPowerUp !== 'rapid') {
        shoot();
    }
});

window.addEventListener('mouseup', () => {
    if (isMobile) return;
    isMouseDown = false;
});

let isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let leftTouchId = null;
let rightTouchId = null;
let leftJoyX = 0, leftJoyY = 0;
let rightJoyX = 0, rightJoyY = 0;

document.addEventListener("DOMContentLoaded", () => {
    if (isMobile) {
        document.getElementById('mobileControls').style.display = 'block';
    }
    const leftJoyBase = document.getElementById('leftJoystickBase');
    const leftJoyKnob = document.getElementById('leftJoystickKnob');
    const rightJoyBase = document.getElementById('rightJoystickBase');
    const rightJoyKnob = document.getElementById('rightJoystickKnob');
    
    function handleTouch(e) {
        if (!isGameStarted || isPaused) return;
        if(e.target.classList.contains('audio-btn')) return;
        
        e.preventDefault();
        const touches = e.changedTouches;
        
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            
            if (touch.clientX < window.innerWidth / 2) {
                // Left stick
                if (e.type === 'touchstart' && leftTouchId === null) {
                    leftTouchId = touch.identifier;
                    updateJoy(touch, leftJoyBase, leftJoyKnob, true);
                } else if (e.type === 'touchmove' && touch.identifier === leftTouchId) {
                    updateJoy(touch, leftJoyBase, leftJoyKnob, true);
                } else if ((e.type === 'touchend' || e.type === 'touchcancel') && touch.identifier === leftTouchId) {
                    leftTouchId = null;
                    resetJoy(leftJoyKnob, true);
                }
            } else {
                // Right stick
                if (e.type === 'touchstart' && rightTouchId === null) {
                    rightTouchId = touch.identifier;
                    updateJoy(touch, rightJoyBase, rightJoyKnob, false);
                    isMouseDown = true;
                    if (currentPowerUp !== 'rapid') shoot();
                } else if (e.type === 'touchmove' && touch.identifier === rightTouchId) {
                    updateJoy(touch, rightJoyBase, rightJoyKnob, false);
                } else if ((e.type === 'touchend' || e.type === 'touchcancel') && touch.identifier === rightTouchId) {
                    rightTouchId = null;
                    resetJoy(rightJoyKnob, false);
                    isMouseDown = false;
                }
            }
        }
    }
    
    function updateJoy(touch, base, knob, isLeft) {
        if(!base) return;
        const rect = base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const distance = Math.hypot(dx, dy);
        const maxDist = rect.width / 2 - 25;
        
        if (distance > maxDist) {
            dx = (dx / distance) * maxDist;
            dy = (dy / distance) * maxDist;
        }
        
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        
        const normX = dx / maxDist;
        const normY = dy / maxDist;
        
        if (isLeft) {
            leftJoyX = normX;
            leftJoyY = normY;
        } else {
            rightJoyX = normX;
            rightJoyY = normY;
            if (normX !== 0 || normY !== 0) {
                player.angle = Math.atan2(normY, normX);
            }
        }
    }
    
    function resetJoy(knob, isLeft) {
        if(!knob) return;
        knob.style.transform = 'translate(-50%, -50%)';
        if (isLeft) {
            leftJoyX = 0; leftJoyY = 0;
        } else {
            rightJoyX = 0; rightJoyY = 0;
        }
    }

    if(isMobile) {
        const mc = document.getElementById('mobileControls');
        mc.addEventListener('touchstart', handleTouch, {passive: false});
        mc.addEventListener('touchmove', handleTouch, {passive: false});
        mc.addEventListener('touchend', handleTouch, {passive: false});
        mc.addEventListener('touchcancel', handleTouch, {passive: false});
    }
});

function shoot() {
    fireProjectile(0);
    if (currentPowerUp === 'spread') {
        fireProjectile(0.2);
        fireProjectile(-0.2);
    }
    if (window.AudioEngine) window.AudioEngine.playShoot();
}

function fireProjectile(angleOffset) {
    let angle;
    if (isMobile && rightTouchId !== null) {
        angle = player.angle + angleOffset;
    } else {
        angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + angleOffset;
    }
    const velocity = {
        x: Math.cos(angle) * 10,
        y: Math.sin(angle) * 10
    };
    projectiles.push(new Projectile(player.x, player.y, 5, '#00ffff', velocity));
}

class Projectile {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.closePath();
    }

    update() {
        this.draw();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Enemy {
    constructor(x, y, radius, color, velocity, type = 'standard') {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.type = type;
        this.flashTime = 0;
        
        if (type === 'tank') {
            this.hp = 3;
            this.speedMult = 0.5;
            this.radius *= 1.5;
        } else if (type === 'dasher') {
            this.hp = 1;
            this.speedMult = 1.5;
            this.radius *= 0.8;
        } else {
            this.hp = 1;
            this.speedMult = 1.0;
        }
    }

    draw() {
        ctx.beginPath();
        if (this.type === 'tank') {
            ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        } else if (this.type === 'dasher') {
            ctx.moveTo(this.x, this.y - this.radius);
            ctx.lineTo(this.x + this.radius, this.y + this.radius);
            ctx.lineTo(this.x - this.radius, this.y + this.radius);
            ctx.closePath();
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        }
        
        ctx.strokeStyle = (this.flashTime > 0) ? 'white' : this.color;
        if (this.flashTime > 0) this.flashTime--;
        
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.color;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = (this.flashTime > 0) ? 'white' : this.color;
        
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    update() {
        this.draw();
        
        // Update velocity to follow player
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.velocity = {
            x: Math.cos(angle) * 2 * this.speedMult,
            y: Math.sin(angle) * 2 * this.speedMult
        };

        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

const friction = 0.98;
class Particle {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }

    update() {
        this.draw();
        this.velocity.x *= friction;
        this.velocity.y *= friction;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.01;
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 12;
        this.color = type === 'rapid' ? '#ff0000' : '#ffff00';
        this.pulse = 0;
    }
    
    draw() {
        this.pulse += 0.1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + Math.sin(this.pulse) * 3, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.closePath();
    }
    
    update() {
        this.draw();
    }
}

let isCenteredMode = true;
let isGameStarted = false;
let isPaused = false;
let spawnRate = 1000;
let mapVisual = 'void';

let isGameOver = false;
let wave = 1;
let enemiesToSpawn = 0;
let enemiesAlive = 0;
let isWaveTransition = false;
let lastSpawnTime = 0;
let combo = 0;
let comboTimer = 0;
let shakeDuration = 0;

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = '#00ffff'; // Neon cyan
        this.speed = 5;
        this.angle = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.beginPath();
        // Draw a triangle pointing to the right (0 radians)
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.fillStyle = this.color;
        
        // Neon glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.closePath();
        
        ctx.restore();
    }

    update() {
        if (isCenteredMode) {
            this.x = canvas.width / 2;
            this.y = canvas.height / 2;
        } else {
            // Movement
            if (isMobile) {
                this.x += leftJoyX * this.speed;
                this.y += leftJoyY * this.speed;
            } else {
                if (keys.w) this.y -= this.speed;
                if (keys.s) this.y += this.speed;
                if (keys.a) this.x -= this.speed;
                if (keys.d) this.x += this.speed;
            }

            // Screen boundaries
            this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
            this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
        }

        // Aiming
        if (!isMobile || rightTouchId === null) {
            this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        }

        this.draw();
    }
}

const player = new Player(canvas.width / 2, canvas.height / 2);
const enemies = [];
const particles = [];
function spawnEnemy() {
    const radius = Math.random() * (30 - 10) + 10;
    let x, y;
    
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
    }
    
    const color = `hsl(${Math.random() * 360}, 50%, 50%)`;
    const angle = Math.atan2(player.y - y, player.x - x);
    const velocity = {
        x: Math.cos(angle) * 2,
        y: Math.sin(angle) * 2
    };
    
    const rand = Math.random();
    let type = 'standard';
    
    let tankChance = 0.8;
    let dasherChance = 0.5;
    if (wave > 2) dasherChance = 0.4;
    if (wave > 4) tankChance = 0.7;
    
    if (rand > tankChance) type = 'tank';
    else if (rand > dasherChance) type = 'dasher';
    
    enemies.push(new Enemy(x, y, radius, color, velocity, type));
}

let animationId;

function init() {
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    projectiles.length = 0;
    enemies.length = 0;
    particles.length = 0;
    score = 0;
    isGameOver = false;
    scoreEl.innerHTML = score;
    gameOverModal.style.display = 'none';
    
    keys.w = false;
    keys.a = false;
    keys.s = false;
    keys.d = false;

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

    animate();
}

function drawBackground() {
    if (mapVisual === 'void') {
        ctx.fillStyle = 'rgba(15, 15, 19, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (mapVisual === 'grid') {
        ctx.fillStyle = 'rgba(15, 15, 19, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += 50) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }
        for (let y = 0; y <= canvas.height; y += 50) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();
    } else if (mapVisual === 'cyberpunk') {
        ctx.fillStyle = 'rgba(30, 10, 40, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);
    
    if (isPaused) return;
    
    drawBackground();
    
    ctx.save();
    if (shakeDuration > 0) {
        shakeDuration -= 1/60;
        ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    }
    
    const time = performance.now();
    if (isMouseDown && currentPowerUp === 'rapid' && time - lastShotTime > 100) {
        shoot();
        lastShotTime = time;
    }
    
    // Update powerups
    powerUps.forEach((p, index) => {
        p.update();
        const dist = Math.hypot(player.x - p.x, player.y - p.y);
        if (dist - player.radius - p.radius < 1) {
            currentPowerUp = p.type;
            powerUpTimer = 10;
            
            document.getElementById('powerupUI').style.display = 'block';
            document.getElementById('powerupName').innerText = currentPowerUp === 'rapid' ? 'Rapid Fire' : 'Spread Shot';
            document.getElementById('powerupName').style.color = currentPowerUp === 'rapid' ? '#ff0000' : '#ffff00';
            
            powerUps.splice(index, 1);
        }
    });
    
    // Update timer
    if (powerUpTimer > 0) {
        powerUpTimer -= 1/60; // Approx 60fps delta
        document.getElementById('powerupTime').innerText = Math.ceil(powerUpTimer);
        if (powerUpTimer <= 0) {
            currentPowerUp = null;
            document.getElementById('powerupUI').style.display = 'none';
        }
    }
    
    player.update();

    projectiles.forEach((projectile, index) => {
        projectile.update();

        // Remove projectile from edges of screen
        if (
            projectile.x - projectile.radius < 0 ||
            projectile.x + projectile.radius > canvas.width ||
            projectile.y - projectile.radius < 0 ||
            projectile.y + projectile.radius > canvas.height
        ) {
            setTimeout(() => {
                projectiles.splice(index, 1);
            }, 0);
        }
    });

    enemies.forEach((enemy, index) => {
        enemy.update();

        // End game collision
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (dist - enemy.radius - player.radius < 1) {
            cancelAnimationFrame(animationId);
            isGameOver = true;
            finalScoreEl.innerHTML = score;
            gameOverModal.style.display = 'block';
        }

        // Projectile collision
        projectiles.forEach((projectile, projectileIndex) => {
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            
            // Collision detected
            if (dist - enemy.radius - projectile.radius < 1) {
                
                enemy.hp -= 1;
                
                if (enemy.hp > 0) {
                    enemy.flashTime = 5;
                    enemy.radius *= 0.85;
                    setTimeout(() => {
                        projectiles.splice(projectileIndex, 1);
                    }, 0);
                    return;
                }
                
                if (window.AudioEngine) window.AudioEngine.playExplosion();

                // Create explosions
                for (let i = 0; i < enemy.radius * 2; i++) {
                    particles.push(new Particle(
                        projectile.x, 
                        projectile.y, 
                        Math.random() * 2, 
                        enemy.color, 
                        {
                            x: (Math.random() - 0.5) * (Math.random() * 8),
                            y: (Math.random() - 0.5) * (Math.random() * 8)
                        }
                    ));
                }

                // Increase score
                let baseScore = 100;
                if (enemy.type === 'tank') baseScore = 300;
                else if (enemy.type === 'dasher') baseScore = 150;
                
                combo++;
                comboTimer = 2;
                score += (baseScore * combo);
                
                document.getElementById('comboUI').style.display = 'block';
                document.getElementById('comboMultiplier').innerText = combo;
                scoreEl.innerHTML = score;
                
                if (enemy.type === 'tank') shakeDuration = 0.3;
                
                enemiesAlive--;
                
                // PowerUp drop (10%)
                if (Math.random() < 0.1) {
                    const pType = Math.random() < 0.5 ? 'rapid' : 'spread';
                    powerUps.push(new PowerUp(enemy.x, enemy.y, pType));
                }

                // setTimeout prevents flashing/flickering issues when splicing arrays during iteration
                setTimeout(() => {
                    enemies.splice(index, 1);
                    projectiles.splice(projectileIndex, 1);
                }, 0);
            }
        });
    });

    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            particle.update();
        }
    });
    
    ctx.restore();
    
    // Wave Logic
    if (!isWaveTransition && isGameStarted && !isPaused) {
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
        comboTimer -= 1/60;
        if (comboTimer <= 0) {
            combo = 0;
            document.getElementById('comboUI').style.display = 'none';
        }
    }
}

restartBtn.addEventListener('click', () => {
    init();
});

const setupMap = document.getElementById('setupMap');
if (setupMap) {
    setupMap.addEventListener('change', (e) => {
        mapVisual = e.target.value;
        // Hack: draw an opaque frame first so the alpha doesn't stack incorrectly when previewing
        ctx.fillStyle = mapVisual === 'cyberpunk' ? '#1e0a28' : '#0f0f13';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawBackground();
    });
}

// Initial draw for preview
drawBackground();

// Add pause logic for 2D
window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isGameStarted && !isGameOver) {
        isPaused = !isPaused;
        if (isPaused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
            ctx.font = '24px sans-serif';
            ctx.fillText('Press ESC to Resume', canvas.width / 2, canvas.height / 2 + 40);
        }
    }
});

document.getElementById('startGameBtn').addEventListener('click', () => {
    isCenteredMode = (document.getElementById('setupMode').value === 'centered');
    const diff = document.getElementById('setupDiff').value;
    if (diff === 'easy') spawnRate = 1500;
    else if (diff === 'hard') spawnRate = 500;
    else spawnRate = 1000;
    
    mapVisual = document.getElementById('setupMap').value;
    
    document.getElementById('setupMenu').style.display = 'none';
    isGameStarted = true;
    
    init();
});

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

document.addEventListener('click', () => {
    if (window.AudioEngine) {
        window.AudioEngine.init();
        window.AudioEngine.playMusic();
    }
}, { once: true });
