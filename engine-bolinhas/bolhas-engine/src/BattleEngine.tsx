import React, { useEffect, useRef } from 'react';
import * as Matter from 'matter-js';

interface BattleBody extends Matter.Body {
  entityType?: 'player' | 'projectile' | 'clone' | 'beam';
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
}

const BattleEngine: React.FC = () => {
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

    // Suas configurações de tela mantidas
    const width = 600;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: { 
        width, 
        height, 
        wireframes: false, 
        background: '#111',
        hasBounds: true
      },
    });

    const playSound = (soundName: string, volume = 0.5) => {
      const audio = new Audio(`/${soundName}.mp3`);
      audio.volume = volume;
      audio.play().catch(() => console.log(`Clique na tela para habilitar o som de ${soundName}!`));
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

    createCombatant(centerX - 200, centerY, 'red', 'Naruto', '/naruto_hair.png');
    createCombatant(centerX + 200, centerY, 'blue', 'Goku', '/goku_hair.png');

    let cinematicEndTime = 0;

    // ==============================================================
    // 4. INTELIGÊNCIA ARTIFICIAL E NOVA CÂMERA DE COMBATE (X1)
    // ==============================================================
    Matter.Events.on(engine, 'beforeUpdate', () => {
      const now = Date.now();
      const allBodies = Matter.Composite.allBodies(engine.world) as BattleBody[];

      const originalCombatants = allBodies.filter(b => b.entityType === 'player' && b.health! > 0);
      
      // --- MÁGICA 1: CÂMERA FIXA NO CENTRO DA ARENA ---
      if (cinematicEndTime > now && originalCombatants.length > 0) {
          engine.timing.timeScale = 0.2; 
          
          // O seu zoom customizado para 500
          const zoomWindowSize = 500; 
          const offset = zoomWindowSize / 2;
          
          const targetBounds = {
              min: { x: centerX - offset, y: centerY - offset },
              max: { x: centerX + offset, y: centerY + offset }
          };

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

      allBodies.forEach(body => {
        if (body.entityType === 'projectile' && body.createdAt) {
          if (now - body.createdAt > 2000) Matter.Composite.remove(engine.world, body);
        }
      });

      const combatants = allBodies.filter(b => b.entityType === 'player' || b.entityType === 'clone');

      combatants.forEach(player => {
        if (player.health! <= 0) return;

        if (player.entityType === 'player') {
          player.specialCharge = Math.min(100, (player.specialCharge || 0) + 0.08);
        }

        if (player.isCasting && player.castEndTime) {
          if (now < player.castEndTime) {
            Matter.Body.setVelocity(player, { x: 0, y: 0 }); 
            return; 
          } else {
            player.isCasting = false;
            if (player.savedVelocity) Matter.Body.setVelocity(player, player.savedVelocity);
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
              angle: baseAngle,
              isSensor: true, 
              render: { fillStyle: '#00a0fc' } 
            }) as BattleBody;

            beam.entityType = 'beam'; 
            beam.team = player.team;
            beam.damage = 85; 
            beam.createdAt = now;

            Matter.Composite.add(engine.world, beam);
            player.lastShot = now + 1000; 
            
            setTimeout(() => {
                if (Matter.Composite.allBodies(engine.world).includes(beam)) {
                    Matter.Composite.remove(engine.world, beam);
                }
            }, 600);
          } 
          else if (player.animeName === 'Naruto') {
            playSound('naruto_ult', 0.8);
            const clone1 = createCombatant(player.position.x - 40, player.position.y - 40, 'red', 'Naruto', '/naruto_hair.png', true);
            const clone2 = createCombatant(player.position.x + 40, player.position.y + 40, 'red', 'Naruto', '/naruto_hair.png', true);
            
            [clone1, clone2].forEach(c => {
               c.isCasting = true;
               c.castEndTime = now + 1200;
               c.savedVelocity = { x: c.velocity.x, y: c.velocity.y };
               Matter.Body.setVelocity(c, { x: 0, y: 0 });
            });
            createExplosion(player.position.x, player.position.y, '#ffffff', 5, 15); 
          }
          return;
        }

        // --- ATAQUES BÁSICOS ---
        if (player.animeName === 'Goku' && now - player.lastShot! > 2200) {
          playSound('kamehameha', 0.4);
          player.isCasting = true;
          player.castEndTime = now + 400; 
          player.savedVelocity = { x: player.velocity.x, y: player.velocity.y };
          Matter.Body.setVelocity(player, { x: 0, y: 0 });

          const beamLength = 800; 
          const startX = player.position.x + Math.cos(baseAngle) * (beamLength / 2 + 30);
          const startY = player.position.y + Math.sin(baseAngle) * (beamLength / 2 + 30);

          const beam = Matter.Bodies.rectangle(startX, startY, beamLength, 25, {
            angle: baseAngle,
            isSensor: true, 
            render: { fillStyle: '#00ffff' }
          }) as BattleBody;

          beam.entityType = 'beam';
          beam.team = player.team;
          beam.damage = 35;
          beam.createdAt = now;

          Matter.Composite.add(engine.world, beam);
          player.lastShot = now;
          
          setTimeout(() => {
              if (Matter.Composite.allBodies(engine.world).includes(beam)) {
                  Matter.Composite.remove(engine.world, beam);
              }
          }, 250);
        }

        if (player.animeName === 'Naruto' && now - player.lastShot! > 1000) {
          playSound('shuriken_throw', 0.4);
          const angles = [baseAngle - 0.2, baseAngle, baseAngle + 0.2];
          angles.forEach(angle => {
            const startX = player.position.x + Math.cos(angle) * 35;
            const startY = player.position.y + Math.sin(angle) * 35;

            const shuriken = Matter.Bodies.circle(startX, startY, 8, { 
              frictionAir: 0,
              render: { fillStyle: 'transparent', strokeStyle: 'transparent' }, 
            }) as BattleBody;

            shuriken.entityType = 'projectile'; 
            shuriken.team = player.team;
            shuriken.damage = 12; 
            shuriken.createdAt = now;

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
        const particle = Matter.Bodies.circle(x, y, size, {
          frictionAir: 0.05, render: { fillStyle: color }, collisionFilter: { mask: 0 },
        });
        Matter.Body.setVelocity(particle, { x: (Math.random() - 0.5) * 15, y: (Math.random() - 0.5) * 15 });
        particles.push(particle);
      }
      Matter.Composite.add(engine.world, particles);
      setTimeout(() => particles.forEach(p => Matter.Composite.remove(engine.world, p)), 300);
    };

    Matter.Events.on(engine, 'collisionStart', (event) => {
      const allBodies = Matter.Composite.allBodies(engine.world) as BattleBody[];
      const gokuOriginal = allBodies.find(b => b.animeName === 'Goku' && b.entityType === 'player');
      const narutoOriginal = allBodies.find(b => b.animeName === 'Naruto' && b.entityType === 'player');

      event.pairs.forEach((pair) => {
        const handleHit = (bodyA: BattleBody, bodyB: BattleBody) => {
          if ((bodyA.entityType === 'projectile' || bodyA.entityType === 'beam') && (bodyB.entityType === 'player' || bodyB.entityType === 'clone') && bodyA.team !== bodyB.team) {
            
            playSound('hit', 0.6);

            if (bodyA.team === 'blue' && gokuOriginal) {
              gokuOriginal.specialCharge = Math.min(100, (gokuOriginal.specialCharge || 0) + 15); 
            } else if (bodyA.team === 'red' && narutoOriginal) {
              narutoOriginal.specialCharge = Math.min(100, (narutoOriginal.specialCharge || 0) + 8); 
            }

            bodyB.health! -= (bodyA.damage || 10);
            const particleColor = bodyB.team === 'red' ? '#ff4757' : '#1e90ff';
            if (bodyA.damage! > 50) { createExplosion(bodyB.position.x, bodyB.position.y, '#ff1e27', 6, 25); } 
            else { createExplosion(bodyB.position.x, bodyB.position.y, bodyA.team === 'blue' ? '#00ffff' : particleColor); }
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
    const preLoadUrls = ['/naruto_hair.png', '/goku_hair.png', '/shuriken.png'];
    preLoadUrls.forEach(url => {
      const img = new Image(); img.src = url; imagesCache[url] = img;
    });

    // ==============================================================
    // 5. RENDERIZAÇÃO CUSTOMIZADA (Agora usando Matemática Screen-Space)
    // ==============================================================
    Matter.Events.on(render, 'afterRender', () => {
      const context = render.context;
      const allBodies = Matter.Composite.allBodies(engine.world) as BattleBody[];
      
      // Captura as dimensões da tela e o zoom atual
      const canvas = render.canvas;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const bounds = render.bounds;
      const viewWidth = bounds.max.x - bounds.min.x;
      const viewHeight = bounds.max.y - bounds.min.y;

      // Calcula o fator de escala (o quanto os elementos devem crescer na tela)
      const scaleX = canvasWidth / viewWidth;
      const scaleY = canvasHeight / viewHeight;
      
      allBodies.forEach(body => {
        if (body.entityType === 'projectile' && body.team === 'red') {
            const shurikenImg = imagesCache['/shuriken.png'];
            if (shurikenImg) {
                const baseSize = 26; 
                // Atualiza a posição para o mundo do Canvas escalado
                const screenX = (body.position.x - bounds.min.x) * scaleX;
                const screenY = (body.position.y - bounds.min.y) * scaleY;
                const currentSize = baseSize * scaleX;

                context.save(); 
                context.translate(screenX, screenY); 
                context.rotate(Date.now() / 60); 
                context.drawImage(shurikenImg, -currentSize / 2, -currentSize / 2, currentSize, currentSize); 
                context.restore();
            }
        }
      });

      const combatants = allBodies.filter(b => b.entityType === 'player' || b.entityType === 'clone');
      combatants.forEach((player) => {
        if (player.health! <= 0) return;
        
        // Posição baseada na tela com o Zoom aplicado
        const screenX = (player.position.x - bounds.min.x) * scaleX;
        const screenY = (player.position.y - bounds.min.y) * scaleY;

        if (player.animeName === 'Goku' && player.isCasting && player.specialCharge! === 0) {
          const auraRadius = 35 * scaleX;
          context.beginPath(); 
          context.arc(screenX, screenY, auraRadius, 0, Math.PI * 2);
          context.fillStyle = 'rgba(255, 30, 39, 0.4)'; 
          context.fill(); 
          context.closePath();
        }

        if (player.hairImageUrl && imagesCache[player.hairImageUrl]) {
            const img = imagesCache[player.hairImageUrl];
            // Seus tamanhos customizados mantidos
            let baseHairWidth = player.animeName === 'Goku' ? 110 : 90;
            let baseHairHeight = player.animeName === 'Goku' ? 110 : 90;
            let baseYOffset = player.animeName === 'Goku' ? -35 : -15;

            // Escala as imagens junto com o Zoom
            const currentHairWidth = baseHairWidth * scaleX;
            const currentHairHeight = baseHairHeight * scaleY;
            const currentYOffset = baseYOffset * scaleY;

            context.save(); 
            context.translate(screenX, screenY); 
            // Seguindo o seu código, mantive sem o rotate() da bolinha
            context.drawImage(img, -currentHairWidth / 2, -currentHairHeight / 2 + currentYOffset, currentHairWidth, currentHairHeight); 
            context.restore();
        }

        // Tudo na UI também cresce proporcionalmente
        context.font = `bold ${13 * scaleX}px Arial`; 
        context.fillStyle = '#ffffff'; 
        context.textAlign = 'center';
        
        const displayName = player.entityType === 'clone' ? 'Clone' : player.animeName!;
        const baseUiOffset = player.animeName === 'Goku' ? -60 : -50;
        const currentUiOffset = baseUiOffset * scaleY;
        
        context.fillText(displayName, screenX, screenY + currentUiOffset); 

        const healthPercent = Math.max(0, player.health! / player.maxHealth!);
        
        const baseBarWidth = 45; 
        const baseBarHeight = 5; 
        const currentBarWidth = baseBarWidth * scaleX;
        const currentBarHeight = baseBarHeight * scaleY;
        
        const barX = screenX - currentBarWidth / 2; 
        const barY = screenY + currentUiOffset + (8 * scaleY);

        context.fillStyle = '#222'; 
        context.fillRect(barX, barY, currentBarWidth, currentBarHeight);
        context.fillStyle = player.entityType === 'clone' ? '#ffaa00' : (healthPercent > 0.4 ? '#2ecc71' : healthPercent > 0.2 ? '#f1c40f' : '#e74c3c'); 
        context.fillRect(barX, barY, currentBarWidth * healthPercent, currentBarHeight); 
        context.strokeStyle = '#000'; 
        context.strokeRect(barX, barY, currentBarWidth, currentBarHeight);

        if (player.entityType === 'player') {
          const specialPercent = (player.specialCharge || 0) / 100;
          const specBarY = barY + (7 * scaleY);
          
          context.fillStyle = '#222'; 
          context.fillRect(barX, specBarY, currentBarWidth, 4 * scaleY);
          context.fillStyle = specialPercent >= 1 ? (Date.now() % 200 > 100 ? '#e0a8ff' : '#9b59b6') : '#8e44ad'; 
          context.fillRect(barX, specBarY, currentBarWidth * specialPercent, 4 * scaleY); 
          context.strokeStyle = '#000'; 
          context.strokeRect(barX, specBarY, currentBarWidth, 4 * scaleY);
        }
      });
    });

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);

    return () => {
      Matter.Render.stop(render); Matter.Runner.stop(runner); if (render.canvas) render.canvas.remove();
    };
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
      <div ref={sceneRef} style={{ width: '600px', height: '600px', overflow: 'hidden', boxShadow: '0 0 30px rgba(0, 0, 0, 0.7)', border: '5px solid #222', backgroundColor: '#111' }} />
    </div>
  );
};

export default BattleEngine;