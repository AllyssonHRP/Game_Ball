import React, { useEffect, useRef, useState } from 'react';
import * as Matter from 'matter-js';

// ==============================================================
// 1. INTERFACES E DADOS DOS PERSONAGENS
// ==============================================================
interface BattleBody extends Matter.Body {
  entityType?: 'player' | 'projectile' | 'clone' | 'beam' | 'hollow_purple';
  team?: 'red' | 'blue';
  health?: number;
  maxHealth?: number;
  lastShot?: number;
  animeName?: string;
  damage?: number;
  createdAt?: number;
  hairImageUrl?: string;
  specialCharge?: number;
  isCasting?: boolean;
  castEndTime?: number;
  savedVelocity?: { x: number, y: number };
  // Propriedades Especiais dos Novos Personagens
  isBlue?: boolean;         // Para o puxão do Gojo
  gojoBasicAttackType?: 'blue' | 'red';
  gojoProjectileType?: 'blue' | 'red';
  isGearSecond?: boolean;   // Para o buff do Luffy
  gearSecondEnd?: number;   // Tempo final do buff do Luffy
  knockbackForce?: number;  // Força de empurrão (Luffy)
}

const CHARACTERS = {
  Goku: { name: 'Goku', image: '/goku_hair.png' },
  Naruto: { name: 'Naruto', image: '/naruto_hair.png' },
  Gojo: { name: 'Gojo', image: '/gojo_hair.png' },
  Luffy: { name: 'Luffy', image: '/luffy_hair.png' }
};

// ==============================================================
// 2. COMPONENTE DA ARENA (O Jogo em Si)
// ==============================================================
const Arena: React.FC<{ p1: string, p2: string, onBack: () => void }> = ({ p1, p2, onBack }) => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef(Matter.Engine.create());
  const runnerRef = useRef(Matter.Runner.create());

  useEffect(() => {
    if (!sceneRef.current) return;

    const engine = engineRef.current;
    const runner = runnerRef.current;

    Matter.World.clear(engine.world, false);
    // @ts-ignore
    Matter.Events.off(engine);
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    engine.gravity.scale = 0;

    sceneRef.current.innerHTML = '';

    const width = 600;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { width, height, wireframes: false, background: '#111', hasBounds: true },
    });

    const playSound = (soundName: string, volume = 0.5) => {
      const audio = new Audio(`/${soundName}.mp3`);
      audio.volume = volume;
      audio.play().catch(() => { });
    };

    const wallThickness = 100;
    const walls = [
      Matter.Bodies.rectangle(centerX, -wallThickness / 2, width + wallThickness * 2, wallThickness, { isStatic: true, render: { visible: false } }),
      Matter.Bodies.rectangle(centerX, height + wallThickness / 2, width + wallThickness * 2, wallThickness, { isStatic: true, render: { visible: false } }),
      Matter.Bodies.rectangle(-wallThickness / 2, centerY, wallThickness, height + wallThickness * 2, { isStatic: true, render: { visible: false } }),
      Matter.Bodies.rectangle(width + wallThickness / 2, centerY, wallThickness, height + wallThickness * 2, { isStatic: true, render: { visible: false } }),
    ];
    Matter.Composite.add(engine.world, walls);

    const createCombatant = (x: number, y: number, team: 'red' | 'blue', name: string, hairUrl: string, isClone = false) => {
      const player = Matter.Bodies.circle(x, y, 25, {
        restitution: 1, friction: 0, frictionAir: 0,
        render: { fillStyle: team === 'red' ? '#ff4757' : '#1e90ff', strokeStyle: isClone ? '#ffaa00' : '#ffffff', lineWidth: 3 },
      }) as BattleBody;

      player.entityType = isClone ? 'clone' : 'player';
      player.team = team;
      player.animeName = name;
      player.health = isClone ? 1 : 200;
      player.maxHealth = isClone ? 1 : 200;
      player.lastShot = Date.now() + Math.random() * 1000;
      player.hairImageUrl = hairUrl;
      player.specialCharge = 0;
      player.isCasting = false;
      if (name === 'Gojo') player.gojoBasicAttackType = 'blue';
      player.isGearSecond = false;

      Matter.Composite.add(engine.world, player);
      Matter.Body.setVelocity(player, { x: (Math.random() > 0.5 ? 1 : -1) * (isClone ? 8 : 6), y: (Math.random() > 0.5 ? 1 : -1) * (isClone ? 8 : 6), });

      if (isClone) {
        setTimeout(() => {
          if (Matter.Composite.allBodies(engine.world).includes(player)) {
            createExplosion(player.position.x, player.position.y, '#ffffff', 4, 10); Matter.Composite.remove(engine.world, player);
          }
        }, 6000);
      }
      return player;
    };

    createCombatant(centerX - 200, centerY, 'red', CHARACTERS[p1 as keyof typeof CHARACTERS].name, CHARACTERS[p1 as keyof typeof CHARACTERS].image);
    createCombatant(centerX + 200, centerY, 'blue', CHARACTERS[p2 as keyof typeof CHARACTERS].name, CHARACTERS[p2 as keyof typeof CHARACTERS].image);

    let cinematicEndTime = 0;

    // INTELIGÊNCIA ARTIFICIAL E CÂMERA
    Matter.Events.on(engine, 'beforeUpdate', () => {
      const now = Date.now();
      const allBodies = Matter.Composite.allBodies(engine.world) as BattleBody[];
      const originalCombatants = allBodies.filter(b => b.entityType === 'player' && b.health! > 0);

      if (cinematicEndTime > now && originalCombatants.length > 0) {
        engine.timing.timeScale = 0.2;
        const zoomWindowSize = 500;
        const offset = zoomWindowSize / 2;
        const targetBounds = { min: { x: centerX - offset, y: centerY - offset }, max: { x: centerX + offset, y: centerY + offset } };
        const cameraSmoothing = 0.05;
        render.bounds.min.x += (targetBounds.min.x - render.bounds.min.x) * cameraSmoothing;
        render.bounds.min.y += (targetBounds.min.y - render.bounds.min.y) * cameraSmoothing;
        render.bounds.max.x += (targetBounds.max.x - render.bounds.max.x) * cameraSmoothing;
        render.bounds.max.y += (targetBounds.max.y - render.bounds.max.y) * cameraSmoothing;
      } else {
        engine.timing.timeScale += (1 - engine.timing.timeScale) * 0.1;
        const defaultBounds = { min: { x: 0, y: 0 }, max: { x: width, y: height } };
        render.bounds.min.x += (defaultBounds.min.x - render.bounds.min.x) * 0.1;
        render.bounds.min.y += (defaultBounds.min.y - render.bounds.min.y) * 0.1;
        render.bounds.max.x += (defaultBounds.max.x - render.bounds.max.x) * 0.1;
        render.bounds.max.y += (defaultBounds.max.y - render.bounds.max.y) * 0.1;
      }

      // LIXEIRO DE PROJÉTEIS
      allBodies.forEach(body => {
        if ((body.entityType === 'projectile' || body.entityType === 'hollow_purple') && body.createdAt) {
          // Hollow Purple dura 5s, projéteis normais duram 2s
          const lifespan = body.entityType === 'hollow_purple' ? 5000 : 2000;
          if (now - body.createdAt > lifespan) Matter.Composite.remove(engine.world, body);
        }
      });

      const combatants = allBodies.filter(b => b.entityType === 'player' || b.entityType === 'clone');

      // NOVA IA FÍSICA DOS TIROS DO GOJO (VOANDO)
      const gojoProjectiles = allBodies.filter(b => b.gojoProjectileType);
      gojoProjectiles.forEach(projObj => {
        combatants.forEach(target => {
          if (target.team !== projObj.team) {
            const dx = projObj.position.x - target.position.x;
            const dy = projObj.position.y - target.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 180) { // Raio de efeito
              let forceMagnitude;

              if (projObj.gojoProjectileType === 'blue') {
                // AZUL: Força Gravitacional (Puxar)
                forceMagnitude = -0.001;
              } else {
                // VERMELHO: Força de Repulsão (Empurrar)
                forceMagnitude = 0.0015;
              }

              Matter.Body.applyForce(target, target.position, {
                x: (dx / dist) * forceMagnitude,
                y: (dy / dist) * forceMagnitude
              });
            }
          }
        });
      });

      combatants.forEach(player => {
        if (player.health! <= 0) return;

        if (player.entityType === 'player') {
          player.specialCharge = Math.min(100, (player.specialCharge || 0) + 0.08);
        }

        // Fim do Gear Second do Luffy
        if (player.isGearSecond && player.gearSecondEnd && now > player.gearSecondEnd) {
          player.isGearSecond = false;
        }

        if (player.isCasting && player.castEndTime) {
          if (now < player.castEndTime) {
            Matter.Body.setVelocity(player, { x: 0, y: 0 });
            return;
          } else {
            player.isCasting = false;
            if (player.savedVelocity) Matter.Body.setVelocity(player, player.savedVelocity);

            // Lógica Pós-Cast do Gear Second (Luffy ganha impulso)
            if (player.isGearSecond && player.savedVelocity) {
              Matter.Body.setVelocity(player, { x: player.savedVelocity.x * 1.5, y: player.savedVelocity.y * 1.5 });
            }
          }
        }

        const enemies = combatants.filter(p => p.team !== player.team && p.health! > 0);
        if (enemies.length === 0) return;

        let target = enemies[0];
        let minDistance = Infinity;
        enemies.forEach(enemy => {
          const dx = enemy.position.x - player.position.x;
          const dy = enemy.position.y - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) { minDistance = dist; target = enemy; }
        });

        const dx = target.position.x - player.position.x;
        const dy = target.position.y - player.position.y;
        const baseAngle = Math.atan2(dy, dx);

        // --- ULTIMATES ---
        if (player.entityType === 'player' && player.specialCharge! >= 100) {
          player.specialCharge = 0;
          cinematicEndTime = now + 1200;
          player.isCasting = true;
          player.castEndTime = now + 1200;
          player.savedVelocity = { x: player.velocity.x, y: player.velocity.y };
          Matter.Body.setVelocity(player, { x: 0, y: 0 });

          if (player.animeName === 'Goku') {
            playSound('goku_ult', 0.8);
            const beamLength = 1000;
            const startX = player.position.x + Math.cos(baseAngle) * (beamLength / 2 + 30);
            const startY = player.position.y + Math.sin(baseAngle) * (beamLength / 2 + 30);

            const beam = Matter.Bodies.rectangle(startX, startY, beamLength, 90, {
              angle: baseAngle, isSensor: true, render: { fillStyle: '#ff1e27' }
            }) as BattleBody;
            beam.entityType = 'beam'; beam.team = player.team; beam.damage = 85; beam.createdAt = now;
            Matter.Composite.add(engine.world, beam);
            player.lastShot = now + 1000;

            setTimeout(() => {
              if (Matter.Composite.allBodies(engine.world).includes(beam)) Matter.Composite.remove(engine.world, beam);
            }, 600);
          }
          else if (player.animeName === 'Naruto') {
            playSound('naruto_ult', 0.8);
            const clone1 = createCombatant(player.position.x - 40, player.position.y - 40, player.team!, 'Naruto', '/naruto_hair.png', true);
            const clone2 = createCombatant(player.position.x + 40, player.position.y + 40, player.team!, 'Naruto', '/naruto_hair.png', true);

            [clone1, clone2].forEach(c => {
              c.isCasting = true; c.castEndTime = now + 1200; c.savedVelocity = { x: c.velocity.x, y: c.velocity.y };
              Matter.Body.setVelocity(c, { x: 0, y: 0 });
            });
            createExplosion(player.position.x, player.position.y, '#ffffff', 5, 15);
          }
          else if (player.animeName === 'Gojo') {
            playSound('gojo_ult', 0.8);
            const startX = player.position.x + Math.cos(baseAngle) * 60;
            const startY = player.position.y + Math.sin(baseAngle) * 60;

            // MUDANÇA AQUI: Tiramos o 'restitution: 1' e colocamos 'isSensor: true'
            // Assim ele vai reto e ignora a física de quique (mas ainda dá dano)
            const hollowPurple = Matter.Bodies.circle(startX, startY, 45, {
              friction: 0, frictionAir: 0, isSensor: true, render: { fillStyle: '#9b59b6', strokeStyle: '#8e44ad', lineWidth: 4 }
            }) as BattleBody;

            hollowPurple.entityType = 'hollow_purple';
            hollowPurple.team = player.team;
            hollowPurple.damage = 40;
            hollowPurple.createdAt = now;

            Matter.Body.setVelocity(hollowPurple, { x: Math.cos(baseAngle) * 10, y: Math.sin(baseAngle) * 10 });
            Matter.Composite.add(engine.world, hollowPurple);
            player.lastShot = now + 1000;
          }
          else if (player.animeName === 'Luffy') {
            playSound('luffy_ult', 0.8); // Gear Second sound
            player.isGearSecond = true;
            player.gearSecondEnd = now + 6000; // Dura 6 segundos
            createExplosion(player.position.x, player.position.y, '#ffffff', 6, 20); // Nuvem de vapor
          }
          return;
        }

        // --- ATAQUES BÁSICOS ---
        // Cooldown dinâmico do Luffy
        const luffyCooldown = player.isGearSecond ? 300 : 1200;

        if (player.animeName === 'Luffy' && now - player.lastShot! > luffyCooldown) { 
          
          const beamLength = 200; // Soco curto, não atravessa a arena
          const startX = player.position.x + Math.cos(baseAngle) * (beamLength / 2 + 25);
          const startY = player.position.y + Math.sin(baseAngle) * (beamLength / 2 + 25);

          const beam = Matter.Bodies.rectangle(startX, startY, beamLength, 18, {
            angle: baseAngle, isSensor: true, render: { fillStyle: player.team === 'red' ? '#ff9f43' : '#48dbfb' }
          }) as BattleBody;
          beam.entityType = 'beam'; beam.team = player.team; beam.damage = 15; beam.createdAt = now;
          beam.knockbackForce = 0.03; // Força de empurrão única do Luffy!

          Matter.Composite.add(engine.world, beam);
          player.lastShot = now;

          setTimeout(() => {
            if (Matter.Composite.allBodies(engine.world).includes(beam)) Matter.Composite.remove(engine.world, beam);
          }, 150); // Some muito rápido!
        }

        // --- ATAQUE BÁSICO DO GOJO (ALTERNA AZUL/VERMELHO) ---
        if (player.animeName === 'Gojo' && now - player.lastShot! > 1800) {
          const startX = player.position.x + Math.cos(baseAngle) * 35;
          const startY = player.position.y + Math.sin(baseAngle) * 35;

          const currentAttack = player.gojoBasicAttackType!; // Pega o que está na fila
          const projectileStyle = currentAttack === 'blue'
            ? { fillStyle: '#3498db', strokeStyle: '#ffffff' } // Estilo Azul
            : { fillStyle: '#ff4d4d', strokeStyle: '#ffffff' }; // Estilo Vermelho

          const gojoObj = Matter.Bodies.circle(startX, startY, 12, {
            frictionAir: 0, render: { ...projectileStyle, lineWidth: 2 },
          }) as BattleBody;

          gojoObj.entityType = 'projectile';
          gojoObj.team = player.team;
          gojoObj.damage = 18;
          gojoObj.createdAt = now;

          // Marca o tiro com o tipo correto para a IA física
          gojoObj.gojoProjectileType = currentAttack;

          // Alternar o tempo de recarga (Vermelho é mais rápido de carregar que Azul)
          const nextCooldownOffset = currentAttack === 'blue' ? 0 : 400;

          // Lança o tiro
          Matter.Body.setVelocity(gojoObj, { x: Math.cos(baseAngle) * 8, y: Math.sin(baseAngle) * 8 });
          Matter.Composite.add(engine.world, gojoObj);

          // MUDANÇA DE ESTADO: Alterna o próximo ataque que ficará na fila
          player.gojoBasicAttackType = currentAttack === 'blue' ? 'red' : 'blue';
          player.lastShot = now - nextCooldownOffset;
        }

        if (player.animeName === 'Goku' && now - player.lastShot! > 2200) {
          playSound('kamehameha', 0.4);
          player.isCasting = true; player.castEndTime = now + 400; player.savedVelocity = { x: player.velocity.x, y: player.velocity.y };
          Matter.Body.setVelocity(player, { x: 0, y: 0 });

          const beamLength = 800;
          const startX = player.position.x + Math.cos(baseAngle) * (beamLength / 2 + 30);
          const startY = player.position.y + Math.sin(baseAngle) * (beamLength / 2 + 30);

          const beam = Matter.Bodies.rectangle(startX, startY, beamLength, 25, {
            angle: baseAngle, isSensor: true, render: { fillStyle: '#00ffff' }
          }) as BattleBody;
          beam.entityType = 'beam'; beam.team = player.team; beam.damage = 35; beam.createdAt = now;

          Matter.Composite.add(engine.world, beam);
          player.lastShot = now;

          setTimeout(() => {
            if (Matter.Composite.allBodies(engine.world).includes(beam)) Matter.Composite.remove(engine.world, beam);
          }, 250);
        }

        if (player.animeName === 'Naruto' && now - player.lastShot! > 1000) {
          playSound('shuriken_throw', 0.4);
          const angles = [baseAngle - 0.2, baseAngle, baseAngle + 0.2];
          angles.forEach(angle => {
            const startX = player.position.x + Math.cos(angle) * 35;
            const startY = player.position.y + Math.sin(angle) * 35;

            const shuriken = Matter.Bodies.circle(startX, startY, 8, {
              frictionAir: 0, render: { fillStyle: 'transparent', strokeStyle: 'transparent' },
            }) as BattleBody;
            shuriken.entityType = 'projectile'; shuriken.team = player.team; shuriken.damage = 12; shuriken.createdAt = now;

            Matter.Body.setVelocity(shuriken, { x: Math.cos(angle) * 12, y: Math.sin(angle) * 12 });
            Matter.Composite.add(engine.world, shuriken);
          });
          player.lastShot = now;
        }
      });
    });

    const createExplosion = (x: number, y: number, color: string, size: number = 3, count: number = 8) => {
      const particles: Matter.Body[] = [];
      for (let i = 0; i < count; i++) {
        const particle = Matter.Bodies.circle(x, y, size, { frictionAir: 0.05, render: { fillStyle: color }, collisionFilter: { mask: 0 } });
        Matter.Body.setVelocity(particle, { x: (Math.random() - 0.5) * 15, y: (Math.random() - 0.5) * 15 });
        particles.push(particle);
      }
      Matter.Composite.add(engine.world, particles);
      setTimeout(() => particles.forEach(p => Matter.Composite.remove(engine.world, p)), 300);
    };

    Matter.Events.on(engine, 'collisionStart', (event) => {
      const allBodies = Matter.Composite.allBodies(engine.world) as BattleBody[];
      const originalCombatants = allBodies.filter(b => b.entityType === 'player');

      event.pairs.forEach((pair) => {
        const handleHit = (bodyA: BattleBody, bodyB: BattleBody) => {

          // NOVA REGRA: Se o Vazio Roxo bater numa parede (corpo estático), ele explode e some!
          if (bodyA.entityType === 'hollow_purple' && bodyB.isStatic) {
            createExplosion(bodyA.position.x, bodyA.position.y, '#9b59b6', 6, 30);
            Matter.Composite.remove(engine.world, bodyA);
            return; // Para a execução para ele não causar bugs
          }
          if ((bodyA.entityType === 'projectile' || bodyA.entityType === 'beam' || bodyA.entityType === 'hollow_purple') && (bodyB.entityType === 'player' || bodyB.entityType === 'clone') && bodyA.team !== bodyB.team) 
            {
            playSound('hit', 0.6);

            const attacker = originalCombatants.find(p => p.team === bodyA.team);
            if (attacker) {
              if (attacker.animeName === 'Goku') attacker.specialCharge = Math.min(100, (attacker.specialCharge || 0) + 15);
              else if (attacker.animeName === 'Naruto') attacker.specialCharge = Math.min(100, (attacker.specialCharge || 0) + 8);
              else if (attacker.animeName === 'Luffy') attacker.specialCharge = Math.min(100, (attacker.specialCharge || 0) + 12);
              else if (attacker.animeName === 'Gojo') attacker.specialCharge = Math.min(100, (attacker.specialCharge || 0) + 10);
            }

            // Aplica Empurrão (Knockback do Luffy)
            if (bodyA.knockbackForce) {
              const dx = bodyB.position.x - bodyA.position.x;
              const dy = bodyB.position.y - bodyA.position.y;
              const angle = Math.atan2(dy, dx);
              Matter.Body.applyForce(bodyB, bodyB.position, {
                x: Math.cos(angle) * bodyA.knockbackForce,
                y: Math.sin(angle) * bodyA.knockbackForce
              });
            }

            bodyB.health! -= (bodyA.damage || 10);
            const particleColor = bodyB.team === 'red' ? '#ff4757' : '#1e90ff';

            if (bodyA.entityType === 'hollow_purple') { createExplosion(bodyB.position.x, bodyB.position.y, '#9b59b6', 5, 20); }
            else if (bodyA.damage! > 50) { createExplosion(bodyB.position.x, bodyB.position.y, '#ff1e27', 6, 25); }
            else { createExplosion(bodyB.position.x, bodyB.position.y, bodyA.team === 'blue' ? '#00ffff' : particleColor); }

            // Shurikens somem, Hollow Purple e Feixes perfuram!
            if (bodyA.entityType === 'projectile') { Matter.Composite.remove(engine.world, bodyA); }

            if (bodyB.health! <= 0) {
              createExplosion(bodyB.position.x, bodyB.position.y, '#ffffff', 5, 20); Matter.Composite.remove(engine.world, bodyB);
            }
          }
        };
        handleHit(pair.bodyA as BattleBody, pair.bodyB as BattleBody);
        handleHit(pair.bodyB as BattleBody, pair.bodyA as BattleBody);
      });
    });

    const imagesCache: { [key: string]: HTMLImageElement } = {};
    const preLoadUrls = ['/naruto_hair.png', '/goku_hair.png', '/gojo_hair.png', '/luffy_hair.png', '/shuriken.png'];
    preLoadUrls.forEach(url => {
      const img = new Image(); img.src = url; imagesCache[url] = img;
    });

    // RENDERIZAÇÃO
    Matter.Events.on(render, 'afterRender', () => {
      const context = render.context;
      const allBodies = Matter.Composite.allBodies(engine.world) as BattleBody[];

      const canvas = render.canvas;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const bounds = render.bounds;
      const viewWidth = bounds.max.x - bounds.min.x;
      const viewHeight = bounds.max.y - bounds.min.y;

      const scaleX = canvasWidth / viewWidth;
      const scaleY = canvasHeight / viewHeight;

      allBodies.forEach(body => {
        if (body.entityType === 'projectile' && body.damage === 12) {
          const shurikenImg = imagesCache['/shuriken.png'];
          if (shurikenImg) {
            const baseSize = 26;
            const screenX = (body.position.x - bounds.min.x) * scaleX;
            const screenY = (body.position.y - bounds.min.y) * scaleY;
            const currentSize = baseSize * scaleX;

            context.save(); context.translate(screenX, screenY); context.rotate(Date.now() / 60);
            context.drawImage(shurikenImg, -currentSize / 2, -currentSize / 2, currentSize, currentSize); context.restore();
          }
        }
      });

      const combatants = allBodies.filter(b => b.entityType === 'player' || b.entityType === 'clone');
      combatants.forEach((player) => {
        if (player.health! <= 0) return;

        const screenX = (player.position.x - bounds.min.x) * scaleX;
        const screenY = (player.position.y - bounds.min.y) * scaleY;

        // Aura Kaioken do Goku
        if (player.animeName === 'Goku' && player.isCasting && player.specialCharge! === 0) {
          const auraRadius = 35 * scaleX;
          context.beginPath(); context.arc(screenX, screenY, auraRadius, 0, Math.PI * 2);
          context.fillStyle = 'rgba(255, 30, 39, 0.4)'; context.fill(); context.closePath();
        }

        // Aura Gear Second do Luffy (Fumaça)
        if (player.animeName === 'Luffy' && player.isGearSecond) {
          const auraRadius = 35 * scaleX;
          context.beginPath(); context.arc(screenX, screenY, auraRadius, 0, Math.PI * 2);
          context.fillStyle = 'rgba(255, 255, 255, 0.3)'; // Fumaça branca
          context.fill(); context.closePath();
        }

        if (player.hairImageUrl && imagesCache[player.hairImageUrl]) {
          const img = imagesCache[player.hairImageUrl];
          // Configurações de tamanho por personagem
          let baseHairWidth = 90;
          let baseHairHeight = 90;
          let baseYOffset = -15;

          if (player.animeName === 'Goku') { baseHairWidth = 110; baseHairHeight = 110; baseYOffset = -35; }
          if (player.animeName === 'Gojo') { baseHairWidth = 80; baseHairHeight = 80; baseYOffset = -20; }
          if (player.animeName === 'Luffy') { baseHairWidth = 90; baseHairHeight = 90; baseYOffset = -25; }

          const currentHairWidth = baseHairWidth * scaleX;
          const currentHairHeight = baseHairHeight * scaleY;
          const currentYOffset = baseYOffset * scaleY;

          context.save(); context.translate(screenX, screenY);
          context.drawImage(img, -currentHairWidth / 2, -currentHairHeight / 2 + currentYOffset, currentHairWidth, currentHairHeight); context.restore();
        }

        context.font = `bold ${13 * scaleX}px Arial`; context.fillStyle = '#ffffff'; context.textAlign = 'center';
        const displayName = player.entityType === 'clone' ? 'Clone' : player.animeName!;
        const baseUiOffset = player.animeName === 'Goku' ? -60 : -50;
        const currentUiOffset = baseUiOffset * scaleY;
        context.fillText(displayName, screenX, screenY + currentUiOffset);

        const healthPercent = Math.max(0, player.health! / player.maxHealth!);
        const baseBarWidth = 45; const baseBarHeight = 5;
        const currentBarWidth = baseBarWidth * scaleX; const currentBarHeight = baseBarHeight * scaleY;
        const barX = screenX - currentBarWidth / 2; const barY = screenY + currentUiOffset + (8 * scaleY);

        context.fillStyle = '#222'; context.fillRect(barX, barY, currentBarWidth, currentBarHeight);
        context.fillStyle = player.entityType === 'clone' ? '#ffaa00' : (healthPercent > 0.4 ? '#2ecc71' : healthPercent > 0.2 ? '#f1c40f' : '#e74c3c');
        context.fillRect(barX, barY, currentBarWidth * healthPercent, currentBarHeight); context.strokeStyle = '#000'; context.strokeRect(barX, barY, currentBarWidth, currentBarHeight);

        if (player.entityType === 'player') {
          const specialPercent = (player.specialCharge || 0) / 100;
          const specBarY = barY + (7 * scaleY);
          context.fillStyle = '#222'; context.fillRect(barX, specBarY, currentBarWidth, 4 * scaleY);
          context.fillStyle = specialPercent >= 1 ? (Date.now() % 200 > 100 ? '#e0a8ff' : '#9b59b6') : '#8e44ad';
          context.fillRect(barX, specBarY, currentBarWidth * specialPercent, 4 * scaleY); context.strokeStyle = '#000'; context.strokeRect(barX, specBarY, currentBarWidth, 4 * scaleY);
        }
      });
    });

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);

    return () => {
      Matter.Render.stop(render); Matter.Runner.stop(runner); if (render.canvas) render.canvas.remove();
    };
  }, [p1, p2]);

  return (
    <div style={{ position: 'relative', width: '600px', height: '600px' }}>
      <button
        onClick={onBack}
        style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, padding: '8px 12px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        ← Voltar
      </button>
      <div ref={sceneRef} style={{ width: '100%', height: '100%', overflow: 'hidden', boxShadow: '0 0 30px rgba(0, 0, 0, 0.7)', border: '5px solid #222', backgroundColor: '#111' }} />
    </div>
  );
};

// ==============================================================
// 3. COMPONENTE PRINCIPAL (O Gerenciador de Telas)
// ==============================================================
export default function BattleApp() {
  const [gameState, setGameState] = useState<'menu' | 'playing'>('menu');
  const [p1, setP1] = useState('Naruto');
  const [p2, setP2] = useState('Goku');

  if (gameState === 'playing') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
        <Arena p1={p1} p2={p2} onBack={() => setGameState('menu')} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#fff', textShadow: '0 0 10px #ff1e27', fontSize: '2.5rem', marginBottom: '30px' }}>ANIME AUTO BATTLES</h1>

      <div style={{ display: 'flex', gap: '50px', marginBottom: '40px' }}>

        {/* PLAYER 1 (RED) */}
        <div style={{ background: '#222', padding: '20px', borderRadius: '10px', border: '3px solid #ff4757', width: '250px', textAlign: 'center' }}>
          <h2 style={{ color: '#ff4757', margin: '0 0 15px 0' }}>Time Vermelho</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {Object.keys(CHARACTERS).map(char => (
              <button
                key={`p1-${char}`}
                onClick={() => setP1(char)}
                style={{
                  padding: '10px', width: '45%', background: p1 === char ? '#ff4757' : '#333',
                  color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '1rem', transition: '0.2s'
                }}
              >
                {char}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', color: '#fff', fontSize: '2rem', fontWeight: 'bold' }}>
          VS
        </div>

        {/* PLAYER 2 (BLUE) */}
        <div style={{ background: '#222', padding: '20px', borderRadius: '10px', border: '3px solid #1e90ff', width: '250px', textAlign: 'center' }}>
          <h2 style={{ color: '#1e90ff', margin: '0 0 15px 0' }}>Time Azul</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {Object.keys(CHARACTERS).map(char => (
              <button
                key={`p2-${char}`}
                onClick={() => setP2(char)}
                style={{
                  padding: '10px', width: '45%', background: p2 === char ? '#1e90ff' : '#333',
                  color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer',
                  fontWeight: 'bold', fontSize: '1rem', transition: '0.2s'
                }}
              >
                {char}
              </button>
            ))}
          </div>
        </div>

      </div>

      <button
        onClick={() => setGameState('playing')}
        style={{
          padding: '15px 50px', fontSize: '1.5rem', fontWeight: '900', background: 'linear-gradient(45deg, #ffaa00, #ff1e27)',
          color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 5px 15px rgba(255, 30, 39, 0.4)',
        }}
      >
        COMEÇAR BATALHA
      </button>
    </div>
  );
}