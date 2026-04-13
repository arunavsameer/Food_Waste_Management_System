import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Trophy, Play, RotateCcw, Volume2, VolumeX, Keyboard, Lock } from 'lucide-react';

const DpadBtn = ({ label, onPress }) => (
  <button
    className="dpad-btn"
    onTouchStart={(e) => { e.preventDefault(); onPress(); }}
    onClick={onPress}
  >
    {label}
  </button>
);

const GameView = ({ credits, onConsumeCredit }) => {
  const [gameState, setGameState] = useState('menu');
  
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0); // FIX: Ensures the game over loop sees the correct final score

  const [isMuted, setIsMuted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [userId, setUserId] = useState(null);
  const [highScore, setHighScore] = useState(0);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

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

  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) return;
        const uid = session.user.id;
        setUserId(uid);

        let { data: stats, error: statsError } = await supabase
          .from('player_score')
          .select('*')
          .eq('student_id', uid)
          .maybeSingle();

        if (!stats) {
          // Initialize with 0 tokens 
          const { data: newStats, error: insertError } = await supabase
            .from('player_score')
            .insert([{ student_id: uid, game_points: 0, high_score: 0, attempts_count: 0 }])
            .select().single();
          if (!insertError) stats = newStats;
        }

        if (stats) {
          setHighScore(stats.high_score);
          setAttemptsCount(stats.attempts_count);
        }

        const { data: lbData, error: lbError } = await supabase
          .from('player_score')
          .select('student_id, high_score, students(name)')
          .order('high_score', { ascending: false })
          .limit(10);
        
        if (lbData) {
          const formattedLb = lbData.map(item => ({
            id: item.student_id,
            name: item.students?.name || 'Unknown',
            score: item.high_score
          }));
          setLeaderboard(formattedLb);
        }
      } catch (err) {
        console.error("Error fetching game data:", err);
      }
    };

    if (gameState === 'menu' || gameState === 'gameover') {
      fetchBackendData();
    }
  }, [gameState]);

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

  const renderGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const isDark = currentTheme === 'dark';

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const c1 = isDark ? '#1a1a1a' : '#f0fdf4';
    const c2 = isDark ? '#222' : '#dcfce7';
    
    for (let r = 0; r < TILE_COUNT; r++) {
      for (let c = 0; c < TILE_COUNT; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? c1 : c2;
        ctx.fillRect(c * GRID_SIZE, r * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      }
    }

    const fx = foodRef.current.x * GRID_SIZE;
    const fy = foodRef.current.y * GRID_SIZE;
    const center = GRID_SIZE / 2;

    if (isDark) { ctx.shadowBlur = 20; ctx.shadowColor = '#e74c3c'; }
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(fx + center, fy + center + 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = isDark ? '#2ecc71' : '#27ae60';
    ctx.beginPath(); ctx.ellipse(fx + center, fy + 4, 3, 6, Math.PI / 4, 0, Math.PI * 2); ctx.fill();

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
      
      // Update both React State and our ref tracking
      const newScore = scoreRef.current + 10;
      setScore(newScore); 
      scoreRef.current = newScore;
      
      playSound('eat');
      let newFood;
      do { newFood = { x: Math.floor(Math.random() * TILE_COUNT), y: Math.floor(Math.random() * TILE_COUNT) }; } while (newSnake.some(s => s.x === newFood.x && s.y === newFood.y));
      foodRef.current = newFood;
    } else { newSnake.pop(); }
    snakeRef.current = newSnake;
  };

  const handleGameOver = async () => {
    playSound('die'); 
    setGameState('gameover');
    cancelAnimationFrame(requestRef.current);
    
    // Read from the ref to avoid the stale closure bug
    const finalScore = scoreRef.current;
    
    if (finalScore > highScore) {
      setHighScore(finalScore);
      await supabase
        .from('player_score')
        .update({ high_score: finalScore })
        .eq('student_id', userId);
    }
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

  const startGame = async () => {
    if (credits > 0) {
      onConsumeCredit(); // Subtracts token in UI instantly
      const newAttempts = attemptsCount + 1;
      
      setAttemptsCount(newAttempts);
      setGameState('playing'); 
      setScore(0);
      scoreRef.current = 0; // Reset tracking ref
      snakeRef.current = [{ x: 5, y: 10 }, { x: 4, y: 10 }];
      directionRef.current = 'RIGHT'; 
      nextDirectionRef.current = 'RIGHT';
      lastTimeRef.current = 0;

      // Ensure Database Subtracts the Token
      await supabase
        .from('player_score')
        .update({ game_points: credits - 1, attempts_count: newAttempts })
        .eq('student_id', userId);
    }
  };

  const handleMobileDir = (dir) => {
    if (gameState !== 'playing') return;
    const cur = directionRef.current;
    if (dir === 'UP'    && cur !== 'DOWN')  nextDirectionRef.current = 'UP';
    if (dir === 'DOWN'  && cur !== 'UP')    nextDirectionRef.current = 'DOWN';
    if (dir === 'LEFT'  && cur !== 'RIGHT') nextDirectionRef.current = 'LEFT';
    if (dir === 'RIGHT' && cur !== 'LEFT')  nextDirectionRef.current = 'RIGHT';
  };

  return (
    <div className="arcade-mode-container">
      <div className="game-dashboard-layout">
        <div className="game-main-area">
          <div className="game-status-bar">
             <button className={`mute-toggle ${isMuted ? 'is-muted' : ''}`} onClick={() => setIsMuted(!isMuted)}>
               {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
             </button>
             
             <div className="score-pill">
                <span>TOKENS: {credits}</span>
                <span className="pill-sep">|</span>
                <span>SCORE: {score.toString().padStart(3, '0')}</span>
                <span className="pill-sep">|</span>
                <span>BEST: {highScore}</span>
             </div>
             
             <div className="score-pill-spacer"></div>
          </div>

          <div className="game-frame">
            <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="game-canvas-el" />
            {gameState !== 'playing' && (
              <div className="game-overlay">
                <h1 className="game-overlay-title">
                  {gameState === 'gameover' ? 'GAME OVER' : 'SNAKE'}
                </h1>
                {gameState === 'gameover' && (
                  <div className="game-over-info">
                    Final Score: <span className="score-highlight">{score}</span><br/>
                    <span className="attempts-label">Total Attempts: {attemptsCount}</span>
                  </div>
                )}
                <button onClick={startGame} disabled={credits === 0} className="game-start-btn">
                  {credits > 0 ? (
                    <>{gameState === 'gameover' ? <RotateCcw size={20}/> : <Play size={20}/>} {gameState === 'gameover' ? 'RETRY' : 'PLAY'}</>
                  ) : (
                    <><Lock size={20}/> NO TOKENS</>
                  )}
                </button>
              </div>
            )}
          </div>
          {/* Desktop hint */}
          {!isMobile && (
            <div className="keyboard-hint">
              <Keyboard size={16} />
              <span>Use <b>Arrow Keys</b> to Move</span>
            </div>
          )}

          {/* Mobile D-pad */}
          {isMobile && (
            <div className="dpad-grid">
              <div className="dpad-up">
                <DpadBtn label="▲" onPress={() => handleMobileDir('UP')} />
              </div>
              <div className="dpad-left">
                <DpadBtn label="◀" onPress={() => handleMobileDir('LEFT')} />
              </div>
              <div className="dpad-center">
                <div className="dpad-center-dot" />
              </div>
              <div className="dpad-right">
                <DpadBtn label="▶" onPress={() => handleMobileDir('RIGHT')} />
              </div>
              <div className="dpad-down">
                <DpadBtn label="▼" onPress={() => handleMobileDir('DOWN')} />
              </div>
            </div>
          )}
        </div>

        <div className="leaderboard-panel">
          <div className="lb-header">
            <Trophy size={18} color="#f1c40f" />
            <h3>Leaderboard</h3>
          </div>
          <div className="lb-list">
            {leaderboard.length === 0 ? (
              <div className="lb-empty">No scores yet!</div>
            ) : (
              leaderboard.map((p, idx) => (
                <div key={idx} className={`lb-item ${p.id === userId ? 'current-user' : ''}`}>
                  <div className="lb-rank">{idx + 1}</div>
                  <div className="player-name">
                    {p.id === userId ? 'You' : p.name}
                  </div>
                  <div className="player-score">{p.score}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameView;