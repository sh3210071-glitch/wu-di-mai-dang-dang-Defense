/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Shield, Trophy, RotateCcw, Languages, Info } from 'lucide-react';

// --- Constants ---
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const CITY_COUNT = 6;
const TURRET_POSITIONS = [
  { x: 40, y: GAME_HEIGHT - 30, maxAmmo: 20, id: 'left' },
  { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 30, maxAmmo: 40, id: 'center' },
  { x: GAME_WIDTH - 40, y: GAME_HEIGHT - 30, maxAmmo: 20, id: 'right' },
];

const EXPLOSION_MAX_RADIUS = 40;
const EXPLOSION_SPEED = 1.5;
const MISSILE_SPEED = 7;
const ROCKET_SPEED_MIN = 0.25;
const ROCKET_SPEED_MAX = 0.75;
const SPAWN_RATE = 0.015; // Probability per frame

const VICTORY_SCORE = 1000;

// --- Types ---
type Point = { x: number; y: number };

type Entity = {
  id: string;
  x: number;
  y: number;
  active: boolean;
};

type Rocket = Entity & {
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
};

type Missile = Entity & {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  turretId: string;
};

type Explosion = Entity & {
  radius: number;
  growing: boolean;
};

type City = Entity & {
  destroyed: boolean;
};

type Turret = {
  id: string;
  x: number;
  y: number;
  ammo: number;
  maxAmmo: number;
  destroyed: boolean;
};

type GameState = 'START' | 'PLAYING' | 'LEVEL_UP' | 'VICTORY' | 'GAMEOVER';

type Language = 'zh' | 'en';

const TRANSLATIONS = {
  zh: {
    title: '无敌麦当当新星防御',
    start: '开始游戏',
    victory: '任务成功！',
    gameover: '防线崩溃',
    score: '得分',
    ammo: '弹药',
    restart: '再玩一次',
    backToMenu: '返回主菜单',
    instructions: '点击屏幕拦截敌方火箭。保护城市和炮台。',
    targetScore: '目标得分',
    level: '关卡',
    nextLevel: '进入下一关',
  },
  en: {
    title: 'Nova Defense',
    start: 'Start Game',
    victory: 'Mission Success!',
    gameover: 'Defense Collapsed',
    score: 'Score',
    ammo: 'Ammo',
    restart: 'Play Again',
    backToMenu: 'Back to Menu',
    instructions: 'Click to intercept enemy rockets. Protect cities and turrets.',
    targetScore: 'Target Score',
    level: 'Level',
    nextLevel: 'Next Level',
  }
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lang, setLang] = useState<Language>('zh');
  const [, setTick] = useState(0);
  
  // Game Entities
  const rocketsRef = useRef<Rocket[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const turretsRef = useRef<Turret[]>([]);
  
  const requestRef = useRef<number>(null);

  const t = TRANSLATIONS[lang];

  // --- Initialization ---
  const initGame = useCallback(() => {
    rocketsRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    
    // Init Cities
    const cities: City[] = [];
    const spacing = GAME_WIDTH / (CITY_COUNT + 4);
    for (let i = 0; i < CITY_COUNT; i++) {
      const x = spacing * (i + 1) + (i >= CITY_COUNT / 2 ? spacing * 2 : spacing);
      cities.push({
        id: `city-${i}`,
        x,
        y: GAME_HEIGHT - 20,
        active: true,
        destroyed: false,
      });
    }
    citiesRef.current = cities;

    // Init Turrets
    turretsRef.current = TURRET_POSITIONS.map(p => ({
      ...p,
      ammo: p.maxAmmo,
      destroyed: false,
    }));

    setScore(0);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // --- Game Logic ---
  const spawnRocket = useCallback(() => {
    if (Math.random() > SPAWN_RATE) return;

    const startX = Math.random() * GAME_WIDTH;
    const startY = 0;
    
    // Target either a city or a turret
    const targets = [
      ...citiesRef.current.filter(c => !c.destroyed),
      ...turretsRef.current.filter(t => !t.destroyed)
    ];
    
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    const angle = Math.atan2(target.y - startY, target.x - startX);
    
    // Level 1: 0.25 - 0.75, Level 2+: 1.0 - 3.0
    const speedMultiplier = level === 1 ? 1 : 4;
    const speed = (ROCKET_SPEED_MIN + Math.random() * (ROCKET_SPEED_MAX - ROCKET_SPEED_MIN)) * speedMultiplier;

    rocketsRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      x: startX,
      y: startY,
      targetX: target.x,
      targetY: target.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      active: true,
    });
  }, []);

  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    spawnRocket();

    // Update Rockets
    rocketsRef.current.forEach(rocket => {
      rocket.x += rocket.vx;
      rocket.y += rocket.vy;

      // Check if reached target
      if (rocket.y >= rocket.targetY) {
        rocket.active = false;
        // Create impact explosion
        explosionsRef.current.push({
          id: `impact-${rocket.id}`,
          x: rocket.x,
          y: rocket.y,
          radius: 2,
          growing: true,
          active: true,
        });

        // Damage target
        const city = citiesRef.current.find(c => Math.abs(c.x - rocket.x) < 20 && !c.destroyed);
        if (city) city.destroyed = true;
        
        const turret = turretsRef.current.find(t => Math.abs(t.x - rocket.x) < 20 && !t.destroyed);
        if (turret) turret.destroyed = true;
      }
    });
    rocketsRef.current = rocketsRef.current.filter(r => r.active);

    // Update Missiles
    missilesRef.current.forEach(missile => {
      missile.x += missile.vx;
      missile.y += missile.vy;

      const distToTarget = Math.hypot(missile.targetX - missile.x, missile.targetY - missile.y);
      if (distToTarget < MISSILE_SPEED) {
        missile.active = false;
        explosionsRef.current.push({
          id: `exp-${missile.id}`,
          x: missile.targetX,
          y: missile.targetY,
          radius: 2,
          growing: true,
          active: true,
        });
      }
    });
    missilesRef.current = missilesRef.current.filter(m => m.active);

    // Update Explosions
    explosionsRef.current.forEach(exp => {
      if (exp.growing) {
        exp.radius += EXPLOSION_SPEED;
        if (exp.radius >= EXPLOSION_MAX_RADIUS) {
          exp.growing = false;
        }
      } else {
        exp.radius -= EXPLOSION_SPEED * 0.5;
        if (exp.radius <= 0) {
          exp.active = false;
        }
      }

      // Check collision with rockets
      rocketsRef.current.forEach(rocket => {
        const dist = Math.hypot(rocket.x - exp.x, rocket.y - exp.y);
        if (dist < exp.radius) {
          rocket.active = false;
          setScore(prev => prev + 20);
        }
      });
    });
    explosionsRef.current = explosionsRef.current.filter(e => e.active);

    // Check Game Over / Victory
    if (turretsRef.current.every(t => t.destroyed)) {
      setGameState('GAMEOVER');
    }
    
    if (level === 1 && score >= 500) {
      setGameState('LEVEL_UP');
    } else if (level === 2 && score >= VICTORY_SCORE) {
      setGameState('VICTORY');
    }
  }, [gameState, spawnRocket, score, level]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Ground
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);

    // Draw Cities
    citiesRef.current.forEach(city => {
      if (city.destroyed) {
        ctx.fillStyle = '#333';
        ctx.fillRect(city.x - 10, city.y - 5, 20, 5);
      } else {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(city.x - 12, city.y - 15, 24, 15);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(city.x - 8, city.y - 20, 16, 5);
      }
    });

    // Draw Turrets
    turretsRef.current.forEach(turret => {
      if (turret.destroyed) {
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(turret.x, turret.y, 15, Math.PI, 0);
        ctx.fill();
      } else {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(turret.x, turret.y, 20, Math.PI, 0);
        ctx.fill();
        
        // Barrel
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(turret.x, turret.y - 10);
        ctx.lineTo(turret.x, turret.y - 25);
        ctx.stroke();

        // Ammo text
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(turret.ammo.toString(), turret.x, turret.y + 10);
      }
    });

    // Draw Rockets
    rocketsRef.current.forEach(rocket => {
      // Trail
      const trailLength = 15;
      ctx.beginPath();
      const gradient = ctx.createLinearGradient(
        rocket.x - rocket.vx * trailLength, 
        rocket.y - rocket.vy * trailLength,
        rocket.x, 
        rocket.y
      );
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.8)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.moveTo(rocket.x - rocket.vx * trailLength, rocket.y - rocket.vy * trailLength);
      ctx.lineTo(rocket.x, rocket.y);
      ctx.stroke();
      
      // Rocket Head
      ctx.save();
      ctx.translate(rocket.x, rocket.y);
      ctx.rotate(Math.atan2(rocket.vy, rocket.vx));
      
      // Glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';
      
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-4, -3);
      ctx.lineTo(-4, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Draw Missiles
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    missilesRef.current.forEach(missile => {
      ctx.beginPath();
      ctx.moveTo(missile.startX, missile.startY);
      ctx.lineTo(missile.x, missile.y);
      ctx.stroke();

      // Target marker
      ctx.strokeStyle = '#60a5fa';
      ctx.beginPath();
      ctx.moveTo(missile.targetX - 3, missile.targetY - 3);
      ctx.lineTo(missile.targetX + 3, missile.targetY + 3);
      ctx.moveTo(missile.targetX + 3, missile.targetY - 3);
      ctx.lineTo(missile.targetX - 3, missile.targetY + 3);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(0.4, '#fbbf24');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    update();
    draw(ctx);
    setTick(t => t + 1);
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  // --- Input ---
  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = (clientX - rect.left) * (GAME_WIDTH / rect.width);
    const y = (clientY - rect.top) * (GAME_HEIGHT / rect.height);

    // Find nearest turret with ammo
    const availableTurrets = turretsRef.current.filter(t => !t.destroyed && t.ammo > 0);
    if (availableTurrets.length === 0) return;

    const nearestTurret = availableTurrets.reduce((prev, curr) => {
      const distPrev = Math.hypot(prev.x - x, prev.y - y);
      const distCurr = Math.hypot(curr.x - x, curr.y - y);
      return distCurr < distPrev ? curr : prev;
    });

    // Fire missile
    nearestTurret.ammo--;
    const angle = Math.atan2(y - nearestTurret.y, x - nearestTurret.x);
    
    missilesRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      startX: nearestTurret.x,
      startY: nearestTurret.y,
      x: nearestTurret.x,
      y: nearestTurret.y,
      targetX: x,
      targetY: y,
      vx: Math.cos(angle) * MISSILE_SPEED,
      vy: Math.sin(angle) * MISSILE_SPEED,
      turretId: nearestTurret.id,
      active: true,
    });
  };

  const startGame = () => {
    initGame();
    setLevel(1);
    setGameState('PLAYING');
  };

  const startNextLevel = () => {
    setLevel(2);
    // Replenish ammo but keep cities status
    turretsRef.current.forEach(t => {
      if (!t.destroyed) t.ammo = t.maxAmmo;
    });
    // Clear projectiles
    rocketsRef.current = [];
    missilesRef.current = [];
    setGameState('PLAYING');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Shield className="text-blue-500 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight uppercase">{t.title}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase opacity-50 font-mono">{t.level} {level}</span>
            <span className="text-[10px] uppercase opacity-50 font-mono">{t.score}</span>
            <span className="text-2xl font-mono font-bold text-emerald-400 leading-none">
              {score.toString().padStart(5, '0')}
            </span>
          </div>
          <button 
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Languages className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Game Container */}
      <div className="relative w-full max-w-[800px] aspect-[4/3] bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="w-full h-full cursor-crosshair touch-none"
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasClick}
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <Target className="w-16 h-16 text-blue-500 mb-6 animate-pulse" />
              <h2 className="text-4xl font-bold mb-4 tracking-tighter uppercase">{t.title}</h2>
              <p className="text-gray-400 mb-8 max-w-md">{t.instructions}</p>
              <div className="flex flex-col gap-2 mb-8 text-sm font-mono text-emerald-500/80">
                <span>{t.targetScore}: {VICTORY_SCORE}</span>
              </div>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
              >
                {t.start}
              </button>
            </motion.div>
          )}

          {gameState === 'LEVEL_UP' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <Shield className="w-20 h-20 text-blue-500 mb-6" />
              <h2 className="text-5xl font-bold mb-2 tracking-tighter uppercase text-blue-500">
                {t.level} 1 {t.victory}
              </h2>
              <p className="text-gray-400 mb-8">{lang === 'zh' ? '准备好迎接更快的挑战了吗？' : 'Ready for a faster challenge?'}</p>
              <button
                onClick={startNextLevel}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
              >
                {t.nextLevel}
              </button>
            </motion.div>
          )}

          {(gameState === 'VICTORY' || gameState === 'GAMEOVER') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              {gameState === 'VICTORY' ? (
                <Trophy className="w-20 h-20 text-yellow-500 mb-6" />
              ) : (
                <RotateCcw className="w-20 h-20 text-red-500 mb-6" />
              )}
              <h2 className={`text-5xl font-bold mb-2 tracking-tighter uppercase ${gameState === 'VICTORY' ? 'text-yellow-500' : 'text-red-500'}`}>
                {gameState === 'VICTORY' ? t.victory : t.gameover}
              </h2>
              <div className="mb-8">
                <span className="text-gray-400 uppercase text-xs block mb-1">{t.score}</span>
                <span className="text-4xl font-mono font-bold text-white">{score}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={startGame}
                  className="flex items-center justify-center gap-2 px-8 py-3 bg-white text-black hover:bg-gray-200 rounded-full font-bold transition-all transform hover:scale-105 active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" />
                  {t.restart}
                </button>
                <button
                  onClick={() => setGameState('START')}
                  className="flex items-center justify-center gap-2 px-8 py-3 bg-white/10 text-white hover:bg-white/20 rounded-full font-bold transition-all transform hover:scale-105 active:scale-95 border border-white/10"
                >
                  {t.backToMenu}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD Overlay (Mobile Friendly) */}
        <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-2">
           <div className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-lg flex items-center gap-2">
              <Info className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] uppercase font-mono text-gray-300">Target: {VICTORY_SCORE}</span>
           </div>
           
           <div className="flex gap-2">
             {turretsRef.current.map((turret, idx) => (
               <div key={turret.id} className={`bg-black/50 backdrop-blur-md border border-white/10 px-2 py-1 rounded flex flex-col items-center min-w-[40px] ${turret.destroyed ? 'opacity-30' : ''}`}>
                 <span className="text-[8px] uppercase font-mono text-gray-400">T{idx + 1}</span>
                 <span className={`text-xs font-mono font-bold ${turret.ammo < 5 ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>
                   {turret.ammo}
                 </span>
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* Footer / Controls Info */}
      <div className="mt-6 text-center text-gray-500 text-xs max-w-md">
        <p className="mb-2 opacity-60">
          {lang === 'zh' ? '拦截导弹会飞向点击位置并产生爆炸。预判敌方火箭的轨迹是获胜的关键。' : 'Interceptor missiles fly to the click location and explode. Predicting rocket trajectories is key to victory.'}
        </p>
        <div className="flex justify-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span>{lang === 'zh' ? '拦截导弹' : 'Interceptor'}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span>{lang === 'zh' ? '敌方火箭' : 'Enemy Rocket'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
