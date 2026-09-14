import { useEffect, useRef, useState } from 'react'

const BEST_KEY = 'football-keepup-best-v1'

type GameState = 'ready' | 'playing' | 'over'

type Ball = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  rotation: number
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)
  const stateRef = useRef<GameState>('ready')
  const scoreRef = useRef(0)
  const bestRef = useRef(Number(localStorage.getItem(BEST_KEY) || 0))
  const ballRef = useRef<Ball>({ x: 0.5, y: 0.78, vx: 0, vy: 0, radius: 42, rotation: 0 })
  const [state, setState] = useState<GameState>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(bestRef.current)
  const [muted, setMuted] = useState(true)
  const audioRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const resizeCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const resetBall = () => {
    ballRef.current = {
      x: 0.5,
      y: 0.76,
      vx: 0,
      vy: 0,
      radius: 42,
      rotation: 0,
    }
  }

  const startGame = () => {
    scoreRef.current = 0
    setScore(0)
    resetBall()
    stateRef.current = 'playing'
    setState('playing')
    lastTimeRef.current = performance.now()
  }

  const createAudio = () => {
    if (muted) return
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    if (!audioRef.current) audioRef.current = new AC()
    if (audioRef.current.state === 'suspended') audioRef.current.resume()
  }

  const hitSound = () => {
    if (muted || !audioRef.current) return
    const ctx = audioRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 180 + Math.min(scoreRef.current * 3, 100)
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.08)
  }

  const kick = (inputX?: number) => {
    createAudio()
    if (stateRef.current !== 'playing') {
      startGame()
      return
    }
    const ball = ballRef.current
    const canvas = canvasRef.current
    if (!canvas) return

    const width = canvas.clientWidth
    const x = ball.x * width
    const target = inputX ?? x
    const horizontal = Math.max(-360, Math.min(360, (target - x) * 2.2))

    // Only count a kick when the ball is close enough to the player's foot zone.
    const groundZone = 0.83
    if (ball.y > groundZone || ball.vy > 0) {
      ball.vy = -820
      ball.vx = horizontal
      scoreRef.current += 1
      setScore(scoreRef.current)
      if (scoreRef.current > bestRef.current) {
        bestRef.current = scoreRef.current
        setBest(scoreRef.current)
        localStorage.setItem(BEST_KEY, String(scoreRef.current))
      }
      hitSound()
    }
  }

  const drawBall = (ctx: CanvasRenderingContext2D, b: Ball, w: number, h: number) => {
    const x = b.x * w
    const y = b.y * h
    const r = b.radius

    // shadow
    const shadowY = h * 0.9
    const shadowScale = Math.max(0.25, 1 - Math.abs(y - shadowY) / h * 1.7)
    ctx.save()
    ctx.globalAlpha = 0.22 * shadowScale
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(x, shadowY, r * 1.15 * shadowScale, r * 0.28 * shadowScale, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(b.rotation)

    const gradient = ctx.createRadialGradient(-r * .35, -r * .45, r * .08, 0, 0, r)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.72, '#f2f4f7')
    gradient.addColorStop(1, '#c8cdd4')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#aeb4bd'
    ctx.stroke()

    // football patches
    ctx.fillStyle = '#171a1f'
    const patch = (px: number, py: number, s: number) => {
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5
        const xx = px + Math.cos(a) * s
        const yy = py + Math.sin(a) * s
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy)
      }
      ctx.closePath()
      ctx.fill()
    }
    patch(0, 0, r * .24)
    patch(-r * .58, -r * .05, r * .12)
    patch(r * .48, -r * .35, r * .12)
    patch(r * .35, r * .55, r * .12)
    patch(-r * .4, r * .52, r * .12)

    ctx.strokeStyle = '#333840'
    ctx.lineWidth = 3
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    }
    line(-r*.2, -r*.1, -r*.52, -.05*r)
    line(r*.2, -.1*r, r*.48, -.35*r)
    line(r*.18, .1*r, r*.35, .52*r)
    line(-r*.16, .1*r, -.4*r, .52*r)
    ctx.restore()
  }

  const draw = (time: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight

    ctx.clearRect(0, 0, w, h)

    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#f7f8fa')
    bg.addColorStop(1, '#dfe3e8')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // subtle field lines
    ctx.strokeStyle = 'rgba(70, 76, 84, .08)'
    ctx.lineWidth = 2
    for (let i = 1; i < 9; i++) {
      const yy = h * (i / 10)
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke()
    }

    const b = ballRef.current
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.033)
    lastTimeRef.current = time

    if (stateRef.current === 'playing') {
      const gravity = 1850
      b.vy += gravity * dt
      b.x += (b.vx * dt) / w
      b.y += (b.vy * dt) / h
      b.rotation += b.vx * dt / 160
      b.vx *= Math.pow(0.985, dt * 60)

      if (b.x < 0.08) { b.x = 0.08; b.vx *= -0.75 }
      if (b.x > 0.92) { b.x = 0.92; b.vx *= -0.75 }

      if (b.y > 0.88) {
        stateRef.current = 'over'
        setState('over')
      }
    }

    drawBall(ctx, b, w, h)
    rafRef.current = requestAnimationFrame(draw)
  }

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    rafRef.current = requestAnimationFrame((t) => {
      lastTimeRef.current = t
      draw(t)
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        kick()
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('keydown', onKey)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      audioRef.current?.close()
    }
  }, [muted])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    kick(e.clientX - rect.left)
  }

  return (
    <main className="app-shell">
      <section className="game">
        <header className="topbar">
          <button className="icon-btn" aria-label="Reset" onClick={startGame}>↻</button>
          <div className="title">Football Keep-Up</div>
          <button className="icon-btn" aria-label="Sound" onClick={() => setMuted(v => !v)}>
            {muted ? '🔇' : '🔊'}
          </button>
        </header>

        <div className="stats">
          <div>
            <span>Current Best</span>
            <strong>{score}</strong>
          </div>
          <div>
            <span>Highest</span>
            <strong>{best}</strong>
          </div>
        </div>

        <canvas ref={canvasRef} onPointerDown={onPointerDown} className="game-canvas" />

        <div className={`overlay ${state === 'playing' ? 'hidden' : ''}`}>
          {state === 'ready' ? (
            <>
              <div className="ball-icon">⚽</div>
              <h1>Keep It Up!</h1>
              <p>Tap, click or press Space to kick the ball.</p>
              <button className="primary" onClick={startGame}>PLAY</button>
            </>
          ) : (
            <>
              <div className="over-icon">✦</div>
              <h1>Game Over</h1>
              <p>Your score: <b>{score}</b></p>
              <button className="primary" onClick={startGame}>PLAY AGAIN</button>
            </>
          )}
        </div>

        <footer>Offline game • Your best score stays on this device</footer>
      </section>
    </main>
  )
}