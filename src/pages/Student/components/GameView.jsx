import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

// --- SOUND ENGINE (Unchanged) ---
const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    
    if (type === 'eat') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'die') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

const GameView = ({ credits, onConsumeCredit }) => {
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(320);
  const [isMuted, setIsMuted] = useState(false);
  
  const [leaderboard, setLeaderboard] = useState([
    { name: 'Rahul (Hostel A)', score: 320 },
    { name: 'Sneha (Hostel B)', score: 280 },
    { name: 'Arjun (Hostel A)', score: 250 },
    { name: 'Vikram (Hostel C)', score: 230 },
    { name: 'Anjali (Hostel B)', score: 210 },
    { name: 'Rohit (Hostel A)', score: 190 },
    { name: 'You', score: 150 },
    { name: 'Priya (Hostel C)', score: 120 },
    { name: 'Dev (Hostel D)', score: 110 },
    { name: 'Amit (Hostel B)', score: 90 },
  ]);

  const canvasRef = useRef(null);
  
  const snakeRef = useRef([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]);
  const foodRef = useRef({ x: 15, y: 15 });
  const directionRef = useRef('RIGHT');
  const nextDirectionRef = useRef('RIGHT');
  const particlesRef = useRef([]);
  const speedRef = useRef(120);
  const scoreRef = useRef(0);
  const requestRef = useRef();
  const lastTimeRef = useRef(0);

  const GRID_SIZE = 30; 
  const TILE_COUNT = 18;
  const CANVAS_SIZE = GRID_SIZE * TILE_COUNT;

  // --- CONTROLS FIX: PREVENT SCROLLING ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if the key is an arrow key
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        // If game is playing, prevent default browser scrolling
        if (gameState === 'playing') {
          e.preventDefault();
        }
      }

      if (gameState !== 'playing') return;
      
      const currentDir = directionRef.current;
      const key = e.key;

      if ((key === 'ArrowUp' || key === 'w') && currentDir !== 'DOWN') nextDirectionRef.current = 'UP';
      else if ((key === 'ArrowDown' || key === 's') && currentDir !== 'UP') nextDirectionRef.current = 'DOWN';
      else if ((key === 'ArrowLeft' || key === 'a') && currentDir !== 'RIGHT') nextDirectionRef.current = 'LEFT';
      else if ((key === 'ArrowRight' || key === 'd') && currentDir !== 'LEFT') nextDirectionRef.current = 'RIGHT';
    };
    
    // Attach listener with { passive: false } isn't strictly needed for keydown but good practice for wheel
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]); // Dependency on gameState ensures we only block scroll when playing

  // --- GAME LOOP ---
  const gameLoop = useCallback((time) => {
    if (gameState !== 'playing') return;

    const deltaTime = time - lastTimeRef.current;

    if (deltaTime > speedRef.current) {
      lastTimeRef.current = time;
      updateGame();
    }

    renderGame();
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'playing') {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, gameLoop]);

  const updateGame = () => {
    directionRef.current = nextDirectionRef.current;
    const dir = directionRef.current;
    
    const head = { ...snakeRef.current[0] };
    if (dir === 'UP') head.y -= 1;
    if (dir === 'DOWN') head.y += 1;
    if (dir === 'LEFT') head.x -= 1;
    if (dir === 'RIGHT') head.x += 1;

    if (
      head.x < 0 || head.x >= TILE_COUNT || 
      head.y < 0 || head.y >= TILE_COUNT ||
      snakeRef.current.some(s => s.x === head.x && s.y === head.y)
    ) {
      handleGameOver();
      return;
    }

    const newSnake = [head, ...snakeRef.current];
    
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      scoreRef.current += 10;
      setScore(scoreRef.current);
      speedRef.current = Math.max(80, speedRef.current * 0.99);
      if (!isMuted) playSound('eat');
      
      createParticles(head.x * GRID_SIZE + GRID_SIZE/2, head.y * GRID_SIZE + GRID_SIZE/2, '#e74c3c');

      let newFood;
      do {
        newFood = {
          x: Math.floor(Math.random() * TILE_COUNT),
          y: Math.floor(Math.random() * TILE_COUNT)
        };
      } while (newSnake.some(s => s.x === newFood.x && s.y === newFood.y));
      foodRef.current = newFood;
    } else {
      newSnake.pop(); 
    }

    snakeRef.current = newSnake;
  };

  const handleGameOver = () => {
    if (!isMuted) playSound('die');
    setGameState('gameover');
    if (scoreRef.current > highScore) setHighScore(scoreRef.current);
    cancelAnimationFrame(requestRef.current);
  };

  const createParticles = (x, y, color) => {
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color
      });
    }
  };

  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    for (let row = 0; row < TILE_COUNT; row++) {
      for (let col = 0; col < TILE_COUNT; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#a2d149' : '#aad751'; 
        ctx.fillRect(col * GRID_SIZE, row * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      }
    }

    const fx = foodRef.current.x * GRID_SIZE;
    const fy = foodRef.current.y * GRID_SIZE;
    const center = GRID_SIZE / 2;
    
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(fx + center, fy + GRID_SIZE - 2, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(fx + center, fy + center + 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.ellipse(fx + center, fy + 4, 3, 6, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    snakeRef.current.forEach((seg, i) => {
      const sx = seg.x * GRID_SIZE;
      const sy = seg.y * GRID_SIZE;
      
      ctx.fillStyle = i === 0 ? '#4a752c' : '#578a34'; 
      if (i === 0) ctx.fillStyle = '#3a631e'; 

      ctx.beginPath();
      ctx.roundRect(sx + 1, sy + 1, GRID_SIZE - 2, GRID_SIZE - 2, 8);
      ctx.fill();

      if (i === 0) {
        ctx.fillStyle = 'white';
        const dir = directionRef.current;
        let lx, ly, rx, ry;
        const offset = 8;
        
        if (dir === 'RIGHT') { lx = sx + 20; ly = sy + 8; rx = sx + 20; ry = sy + 22; }
        if (dir === 'LEFT')  { lx = sx + 10; ly = sy + 8; rx = sx + 10; ry = sy + 22; }
        if (dir === 'UP')    { lx = sx + 8; ly = sy + 10; rx = sx + 22; ry = sy + 10; }
        if (dir === 'DOWN')  { lx = sx + 8; ly = sy + 20; rx = sx + 22; ry = sy + 20; }
        
        ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx, ry, 3.5, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx, ry, 1.5, 0, Math.PI*2); ctx.fill();
      }
    });

    particlesRef.current.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      
      if (p.life > 0) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      } else {
        particlesRef.current.splice(i, 1);
      }
    });
  };

  const startGame = () => {
    if (credits > 0) {
      onConsumeCredit();
      setGameState('playing');
      setScore(0);
      snakeRef.current = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
      foodRef.current = { x: 12, y: 10 };
      directionRef.current = 'RIGHT';
      nextDirectionRef.current = 'RIGHT';
      scoreRef.current = 0;
      speedRef.current = 120;
      particlesRef.current = [];
      lastTimeRef.current = 0;
    }
  };

  return (
    <div className="game-layout">
      {/* LEFT: Game Arena */}
      <div className="game-section">
        <div className="game-header">
           <button className="mute-btn" onClick={() => setIsMuted(!isMuted)}>
             {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
           </button>
           <div className="score-pill">Score: {score}</div>
           <div className="score-pill high">Best: {highScore}</div>
        </div>

        <div className="canvas-wrapper big-arena">
          <canvas 
            ref={canvasRef} 
            width={CANVAS_SIZE} 
            height={CANVAS_SIZE}
            className="game-canvas"
          />

          {gameState === 'menu' && (
            <div className="game-overlay">
              <div className="snake-logo-text">SNAKE</div>
              <button 
                className={`play-btn ${credits === 0 ? 'disabled' : ''}`} 
                onClick={startGame}
                disabled={credits === 0}
              >
                <Play fill="white" size={24} />
              </button>
              <p className="coin-text">{credits > 0 ? 'INSERT COIN' : 'NO CREDITS'}</p>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="game-overlay">
              <h2 className="game-over-text">GAME OVER</h2>
              <div className="final-score-box">{score}</div>
              <div className="btn-row">
                 <button className="icon-btn" onClick={() => setGameState('menu')}>
                    Menu
                 </button>
                 <button 
                   className={`play-btn small ${credits === 0 ? 'disabled' : ''}`} 
                   onClick={startGame}
                   disabled={credits === 0}
                 >
                   <RotateCcw size={20} />
                 </button>
              </div>
            </div>
          )}
        </div>
        
        <p className="controls-hint">Use Arrow Keys to Move</p>
      </div>

      {/* RIGHT: Leaderboard */}
      <div className="leaderboard-section">
        <div className="leaderboard-card">
          <div className="lb-header">
            <Trophy size={20} color="#f1c40f" />
            <h3>Leaderboard</h3>
          </div>
          
          <div className="lb-list scrollable">
            {leaderboard.map((player, index) => (
              <div key={index} className={`lb-item ${player.name === 'You' ? 'highlight' : ''}`}>
                <div className="lb-rank">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </div>
                <div className="lb-name">{player.name}</div>
                <div className="lb-score">{player.score}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameView;