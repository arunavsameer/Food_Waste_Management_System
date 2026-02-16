import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Play, RotateCcw, Volume2, VolumeX, Keyboard, Lock } from 'lucide-react';

const GameView = ({ credits, onConsumeCredit }) => {
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(320);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');

  // --- Theme Observer ---
  useEffect(() => {
    setCurrentTheme(document.body.getAttribute('data-theme') || 'light');
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          setCurrentTheme(document.body.getAttribute('data-theme'));
        }
      });
    });
    observer.observe(document.body, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const canvasRef = useRef(null);
  const snakeRef = useRef([{ x: 10, y: 10 }]);
  const foodRef = useRef({ x: 15, y: 15 });
  const directionRef = useRef('RIGHT');
  const nextDirectionRef = useRef('RIGHT');
  const requestRef = useRef();
  const lastTimeRef = useRef(0);
  
  const GRID_SIZE = 30; 
  const TILE_COUNT = 18; 
  const CANVAS_SIZE = GRID_SIZE * TILE_COUNT;

  // --- Sound Logic ---
  const playSound = (type) => {
    if (isMuted) return;
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
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
      } else if (type === 'die') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      }
    } catch (e) {}
  };

  // --- Game Controls ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && gameState === 'playing') e.preventDefault();
      if (gameState !== 'playing') return;
      const key = e.key;
      const cur = directionRef.current;
      if ((key === 'ArrowUp' || key === 'w') && cur !== 'DOWN') nextDirectionRef.current = 'UP';
      else if ((key === 'ArrowDown' || key === 's') && cur !== 'UP') nextDirectionRef.current = 'DOWN';
      else if ((key === 'ArrowLeft' || key === 'a') && cur !== 'RIGHT') nextDirectionRef.current = 'LEFT';
      else if ((key === 'ArrowRight' || key === 'd') && cur !== 'LEFT') nextDirectionRef.current = 'RIGHT';
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // --- Render ---
  const renderGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const isDark = currentTheme === 'dark';

    // 1. Background
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const c1 = isDark ? '#1a1a1a' : '#f0fdf4';
    const c2 = isDark ? '#222' : '#dcfce7';
    
    for (let r = 0; r < TILE_COUNT; r++) {
      for (let c = 0; c < TILE_COUNT; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? c1 : c2;
        ctx.fillRect(c * GRID_SIZE, r * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      }
    }

    // 2. Food
    const fx = foodRef.current.x * GRID_SIZE;
    const fy = foodRef.current.y * GRID_SIZE;
    const center = GRID_SIZE / 2;

    if (isDark) { ctx.shadowBlur = 20; ctx.shadowColor = '#e74c3c'; }
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(fx + center, fy + center + 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = isDark ? '#2ecc71' : '#27ae60';
    ctx.beginPath(); ctx.ellipse(fx + center, fy + 4, 3, 6, Math.PI / 4, 0, Math.PI * 2); ctx.fill();

    // 3. Snake
    snakeRef.current.forEach((seg, i) => {
      const sx = seg.x * GRID_SIZE;
      const sy = seg.y * GRID_SIZE;
      
      if (isDark) {
        ctx.fillStyle = i === 0 ? '#2ecc71' : '#27ae60';
        ctx.shadowBlur = i === 0 ? 20 : 0; ctx.shadowColor = '#2ecc71';
      } else {
        ctx.fillStyle = i === 0 ? '#22c55e' : '#4ade80';
      }
      
      ctx.beginPath(); ctx.roundRect(sx + 1, sy + 1, GRID_SIZE - 2, GRID_SIZE - 2, 8); ctx.fill();
      ctx.shadowBlur = 0;

      if (i === 0) {
        ctx.fillStyle = 'white';
        const offset = 8;
        ctx.beginPath(); ctx.arc(sx + offset + 3, sy + offset + 3, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + GRID_SIZE - offset - 3, sy + offset + 3, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(sx + offset + 3, sy + offset + 3, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + GRID_SIZE - offset - 3, sy + offset + 3, 1.5, 0, Math.PI*2); ctx.fill();
      }
    });
  }, [currentTheme]);

  const updateGame = () => {
    directionRef.current = nextDirectionRef.current;
    const dir = directionRef.current;
    const head = { ...snakeRef.current[0] };
    if (dir === 'UP') head.y -= 1; if (dir === 'DOWN') head.y += 1;
    if (dir === 'LEFT') head.x -= 1; if (dir === 'RIGHT') head.x += 1;

    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT || snakeRef.current.some(s => s.x === head.x && s.y === head.y)) {
      handleGameOver(); return;
    }
    const newSnake = [head, ...snakeRef.current];
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      setScore(prev => prev + 10); playSound('eat');
      let newFood;
      do { newFood = { x: Math.floor(Math.random() * TILE_COUNT), y: Math.floor(Math.random() * TILE_COUNT) }; } while (newSnake.some(s => s.x === newFood.x && s.y === newFood.y));
      foodRef.current = newFood;
    } else { newSnake.pop(); }
    snakeRef.current = newSnake;
  };

  const handleGameOver = () => {
    playSound('die'); setGameState('gameover');
    if (score > highScore) setHighScore(score);
    cancelAnimationFrame(requestRef.current);
  };

  const gameLoop = useCallback((time) => {
    if (gameState !== 'playing') return;
    const deltaTime = time - lastTimeRef.current;
    if (deltaTime > 120) { lastTimeRef.current = time; updateGame(); }
    renderGame();
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, renderGame]);

  useEffect(() => {
    if (gameState === 'playing') requestRef.current = requestAnimationFrame(gameLoop);
    else renderGame();
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, gameLoop, renderGame]);

  const startGame = () => {
    if (credits > 0) {
      onConsumeCredit(); setGameState('playing'); setScore(0);
      snakeRef.current = [{ x: 5, y: 10 }, { x: 4, y: 10 }];
      directionRef.current = 'RIGHT'; nextDirectionRef.current = 'RIGHT';
      lastTimeRef.current = 0;
    }
  };

  const leaderboard = [
    { name: 'Rahul', score: 320 },
    { name: 'Sneha', score: 280 },
    { name: 'You', score: score > 270 ? score : 270 },
    { name: 'Arjun', score: 250 },
  ].sort((a,b) => b.score - a.score);

  return (
    <div className="arcade-mode-container">
      <div className="game-dashboard-layout">
        <div className="game-main-area">
          <div className="game-status-bar">
             {/* ADDED CLASSNAME FOR RED COLOR LOGIC */}
             <button className={`mute-toggle ${isMuted ? 'is-muted' : ''}`} onClick={() => setIsMuted(!isMuted)}>
               {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
             </button>
             
             <div className="score-pill">
                <span>SCORE: {score.toString().padStart(3, '0')}</span>
                <span style={{opacity:0.5}}>|</span>
                <span>BEST: {highScore}</span>
             </div>
             
             <div style={{width:'40px'}}></div>
          </div>

          <div className="game-frame">
            <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ display: 'block', width: '100%', height: '100%' }} />
            {gameState !== 'playing' && (
              <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                <h1 style={{fontSize:'3.5rem', fontWeight:'900', color:'white', marginBottom:'20px', textShadow:'0 0 20px rgba(46,204,113,0.5)'}}>
                  {gameState === 'gameover' ? 'GAME OVER' : 'SNAKE'}
                </h1>
                {gameState === 'gameover' && (
                   <div style={{fontSize:'1.5rem', color:'white', marginBottom:'20px'}}>
                     Final Score: <span style={{color:'#e74c3c', fontWeight:'bold'}}>{score}</span>
                   </div>
                )}
                <button onClick={startGame} disabled={credits === 0} style={{
                  padding:'16px 40px', borderRadius:'50px', border:'none',
                  background: credits > 0 ? '#2ecc71' : '#555', color:'white',
                  fontSize:'1.1rem', fontWeight:'bold', cursor: credits > 0 ? 'pointer' : 'not-allowed',
                  display:'flex', alignItems:'center', gap:'10px'
                }}>
                   {credits > 0 ? (
                     <>{gameState === 'gameover' ? <RotateCcw size={20}/> : <Play size={20}/>} {gameState === 'gameover' ? 'RETRY' : 'PLAY'}</>
                   ) : (
                     <><Lock size={20}/> NO CREDITS</>
                   )}
                </button>
              </div>
            )}
          </div>
          <div style={{
            marginTop: '20px',
            padding: '8px 20px',
            borderRadius: '20px',
            background: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            backdropFilter: 'blur(4px)',
            border: currentTheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
            color: currentTheme === 'dark' ? '#ccc' : '#666',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.85rem',
            fontWeight: '400',
            boxShadow: currentTheme === 'dark' ? '0 4px 10px rgba(0,0,0,0.3)' : 'none'
          }}>
             <Keyboard size={16} /> 
             <span>Use <b>Arrow Keys</b> to Move</span>
          </div>
        </div>

        <div className="leaderboard-panel">
          <div className="lb-header">
            <Trophy size={18} color="#f1c40f" />
            <h3>Leaderboard</h3>
          </div>
          <div className="lb-list">
            {leaderboard.map((p, idx) => (
              <div key={idx} className={`lb-item ${p.name === 'You' ? 'current-user' : ''}`}>
                <div className="lb-rank">{idx + 1}</div>
                <div className="player-name" style={{flex:1}}>{p.name}</div>
                <div className="player-score" style={{fontWeight:700}}>{p.score}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameView;