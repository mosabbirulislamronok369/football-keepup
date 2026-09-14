import { useEffect, useRef, useState } from 'react'

const BEST_KEY = 'football-keepup-best-v1'

type GameState = 'ready' | 'armed' | 'playing' | 'over'

type Ball = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  rotation: number
}

const ExpandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
)

const CollapseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
)

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)

  const stateRef = useRef<GameState>('ready')
  const scoreRef = useRef(0)

  const bestRef = useRef(
    Number(localStorage.getItem(BEST_KEY) || 0)
  )

  const mutedRef = useRef(true)

  const ballRef = useRef<Ball>({
    x: 0.5,
    y: 0.76,
    vx: 0,
    vy: 0,
    radius: 42,
    rotation: 0,
  })

  const [state, setState] = useState<GameState>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(bestRef.current)
  const [muted, setMuted] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [manualFullscreen, setManualFullscreen] = useState(false)

  const audioRef = useRef<AudioContext | null>(null)

  // --------------------------------------------------
  // FULLSCREEN
  // --------------------------------------------------

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement)

      // Canvas size depends on layout, which shifts
      // when entering/exiting fullscreen.
      setTimeout(resizeCanvas, 50)
    }

    document.addEventListener('fullscreenchange', handleChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
    }
  }, [])

  const fullscreenActive = isFullscreen || manualFullscreen

  const toggleFullscreen = () => {
    const el = sectionRef.current

    if (fullscreenActive) {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      setManualFullscreen(false)
      setTimeout(resizeCanvas, 50)
      return
    }

    const orientation = screen.orientation as any
    if (orientation?.lock) {
      orientation.lock('portrait').catch(() => {})
    }

    if (el?.requestFullscreen) {
      el.requestFullscreen()
        .then(() => {
          // Some WebViews (Android APK wrappers) resolve this promise
          // without actually entering fullscreen. Verify shortly after.
          setTimeout(() => {
            if (!document.fullscreenElement) {
              setManualFullscreen(true)
              setTimeout(resizeCanvas, 50)
            }
          }, 250)
        })
        .catch(() => {
          setManualFullscreen(true)
          setTimeout(resizeCanvas, 50)
        })
    } else {
      setManualFullscreen(true)
      setTimeout(resizeCanvas, 50)
    }
  }

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // --------------------------------------------------
  // CANVAS RESIZE
  // --------------------------------------------------

  const resizeCanvas = () => {
    const canvas = canvasRef.current

    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    const dpr = Math.min(
      window.devicePixelRatio || 1,
      2
    )

    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)

    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      )
    }
  }

  // --------------------------------------------------
  // RESET BALL
  // --------------------------------------------------

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

  // --------------------------------------------------
  // RESET EVERYTHING
  // --------------------------------------------------

  const resetToReady = () => {
    scoreRef.current = 0
    setScore(0)

    resetBall()

    stateRef.current = 'ready'
    setState('ready')

    lastTimeRef.current = performance.now()
  }

  // --------------------------------------------------
  // AUDIO
  // --------------------------------------------------

  const createAudio = () => {
    if (mutedRef.current) return

    const AudioCtx =
      window.AudioContext ||
      (window as any).webkitAudioContext

    if (!AudioCtx) return

    if (!audioRef.current) {
      audioRef.current = new AudioCtx()
    }

    if (
      audioRef.current.state ===
      'suspended'
    ) {
      audioRef.current.resume()
    }
  }

  const hitSound = () => {
    if (
      mutedRef.current ||
      !audioRef.current
    ) {
      return
    }

    const ctx = audioRef.current

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.frequency.value =
      180 +
      Math.min(
        scoreRef.current * 3,
        100
      )

    gain.gain.setValueAtTime(
      0.05,
      ctx.currentTime
    )

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.08
    )

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()

    osc.stop(
      ctx.currentTime + 0.08
    )
  }

  // --------------------------------------------------
  // KICK BALL
  // --------------------------------------------------

  const kickBall = (
    inputX?: number,
    countScore = true
  ) => {
    createAudio()

    const ball = ballRef.current
    const canvas = canvasRef.current

    if (!canvas) return

    const width = canvas.clientWidth

    const currentX =
      ball.x * width

    const target =
      inputX ?? currentX

    const horizontal = Math.max(
      -360,
      Math.min(
        360,
        (target - currentX) * 2.2
      )
    )

    ball.vy = -820
    ball.vx = horizontal

    if (countScore) {
      scoreRef.current += 1

      setScore(
        scoreRef.current
      )

      if (
        scoreRef.current >
        bestRef.current
      ) {
        bestRef.current =
          scoreRef.current

        setBest(
          scoreRef.current
        )

        localStorage.setItem(
          BEST_KEY,
          String(
            scoreRef.current
          )
        )
      }

      hitSound()
    }
  }

  // --------------------------------------------------
  // PLAY BUTTON
  //
  // IMPORTANT:
  // PLAY DOES NOT START THE GAME.
  // It only arms the game.
  // Ball remains completely stationary.
  // --------------------------------------------------

  const armGame = () => {
    scoreRef.current = 0
    setScore(0)

    resetBall()

    stateRef.current = 'armed'
    setState('armed')

    lastTimeRef.current =
      performance.now()
  }

  // --------------------------------------------------
  // START GAME FROM BALL CLICK
  // --------------------------------------------------

  const startFromBall = () => {
    resetBall()

    stateRef.current = 'playing'
    setState('playing')

    lastTimeRef.current =
      performance.now()

    // First kick does NOT add a point.
    kickBall(undefined, false)
  }

  // --------------------------------------------------
  // BALL HIT DETECTION
  // --------------------------------------------------

  const isBallHit = (
    clientX: number,
    clientY: number
  ) => {
    const canvas = canvasRef.current

    if (!canvas) return false

    const rect =
      canvas.getBoundingClientRect()

    const ball =
      ballRef.current

    const ballX =
      rect.left +
      ball.x * rect.width

    const ballY =
      rect.top +
      ball.y * rect.height

    const dx =
      clientX - ballX

    const dy =
      clientY - ballY

    const distance =
      Math.sqrt(
        dx * dx +
        dy * dy
      )

    // Slightly generous hit area
    return (
      distance <=
      ball.radius + 25
    )
  }

  // --------------------------------------------------
  // POINTER INPUT
  // --------------------------------------------------

  const onPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault()

    // ------------------------------------------
    // BEFORE GAME START:
    // Only clicking the actual ball starts game.
    // ------------------------------------------

    if (
      stateRef.current === 'armed'
    ) {
      if (
        isBallHit(
          e.clientX,
          e.clientY
        )
      ) {
        startFromBall()
      }

      return
    }

    // ------------------------------------------
    // READY SCREEN:
    // Canvas itself does nothing.
    // User must press PLAY button.
    // ------------------------------------------

    if (
      stateRef.current === 'ready'
    ) {
      return
    }

    // ------------------------------------------
    // GAME OVER:
    // Canvas does nothing.
    // PLAY AGAIN button starts armed mode.
    // ------------------------------------------

    if (
      stateRef.current === 'over'
    ) {
      return
    }

    // ------------------------------------------
    // PLAYING:
    // Normal keep-up controls.
    // ------------------------------------------

    if (
      stateRef.current === 'playing'
    ) {
      if (
        !isBallHit(
          e.clientX,
          e.clientY
        )
      ) {
        return
      }

      const rect =
        e.currentTarget.getBoundingClientRect()

      const inputX =
        e.clientX - rect.left

      kickBall(
        inputX,
        true
      )
    }
  }

  // --------------------------------------------------
  // DRAW BALL
  // --------------------------------------------------

  const drawBall = (
    ctx: CanvasRenderingContext2D,
    b: Ball,
    w: number,
    h: number
  ) => {
    const x =
      b.x * w

    const y =
      b.y * h

    const r =
      b.radius

    // Shadow
    const shadowY =
      h * 0.9

    const shadowScale =
      Math.max(
        0.25,
        1 -
          (Math.abs(
            y - shadowY
          ) /
            h) *
            1.7
      )

    ctx.save()

    ctx.globalAlpha =
      0.22 * shadowScale

    ctx.fillStyle = '#000'

    ctx.beginPath()

    ctx.ellipse(
      x,
      shadowY,
      r *
        1.15 *
        shadowScale,
      r *
        0.28 *
        shadowScale,
      0,
      0,
      Math.PI * 2
    )

    ctx.fill()

    ctx.restore()

    // Ball
    ctx.save()

    ctx.translate(
      x,
      y
    )

    ctx.rotate(
      b.rotation
    )

    const gradient =
      ctx.createRadialGradient(
        -r * 0.35,
        -r * 0.45,
        r * 0.08,
        0,
        0,
        r
      )

    gradient.addColorStop(
      0,
      '#ffffff'
    )

    gradient.addColorStop(
      0.72,
      '#f2f4f7'
    )

    gradient.addColorStop(
      1,
      '#c8cdd4'
    )

    ctx.fillStyle =
      gradient

    ctx.beginPath()

    ctx.arc(
      0,
      0,
      r,
      0,
      Math.PI * 2
    )

    ctx.fill()

    ctx.lineWidth = 2
    ctx.strokeStyle =
      '#aeb4bd'

    ctx.stroke()

    // Football patches
    ctx.fillStyle =
      '#171a1f'

    const patch = (
      px: number,
      py: number,
      s: number
    ) => {
      ctx.beginPath()

      for (
        let i = 0;
        i < 5;
        i++
      ) {
        const angle =
          -Math.PI / 2 +
          (i *
            Math.PI *
            2) /
            5

        const xx =
          px +
          Math.cos(angle) *
            s

        const yy =
          py +
          Math.sin(angle) *
            s

        if (i === 0) {
          ctx.moveTo(
            xx,
            yy
          )
        } else {
          ctx.lineTo(
            xx,
            yy
          )
        }
      }

      ctx.closePath()
      ctx.fill()
    }

    patch(
      0,
      0,
      r * 0.24
    )

    patch(
      -r * 0.58,
      -r * 0.05,
      r * 0.12
    )

    patch(
      r * 0.48,
      -r * 0.35,
      r * 0.12
    )

    patch(
      r * 0.35,
      r * 0.55,
      r * 0.12
    )

    patch(
      -r * 0.4,
      r * 0.52,
      r * 0.12
    )

    // Ball lines
    ctx.strokeStyle =
      '#333840'

    ctx.lineWidth = 3

    const line = (
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ) => {
      ctx.beginPath()

      ctx.moveTo(
        x1,
        y1
      )

      ctx.lineTo(
        x2,
        y2
      )

      ctx.stroke()
    }

    line(
      -r * 0.2,
      -r * 0.1,
      -r * 0.52,
      -0.05 * r
    )

    line(
      r * 0.2,
      -0.1 * r,
      r * 0.48,
      -0.35 * r
    )

    line(
      r * 0.18,
      0.1 * r,
      r * 0.35,
      0.52 * r
    )

    line(
      -r * 0.16,
      0.1 * r,
      -0.4 * r,
      0.52 * r
    )

    ctx.restore()
  }

  // --------------------------------------------------
  // GAME LOOP
  // --------------------------------------------------

  const draw = (
    time: number
  ) => {
    const canvas =
      canvasRef.current

    if (!canvas) return

    const ctx =
      canvas.getContext('2d')

    if (!ctx) return

    const w =
      canvas.clientWidth

    const h =
      canvas.clientHeight

    ctx.clearRect(
      0,
      0,
      w,
      h
    )

    // Background
    const bg =
      ctx.createLinearGradient(
        0,
        0,
        0,
        h
      )

    bg.addColorStop(
      0,
      '#f7f8fa'
    )

    bg.addColorStop(
      1,
      '#dfe3e8'
    )

    ctx.fillStyle =
      bg

    ctx.fillRect(
      0,
      0,
      w,
      h
    )

    // Field lines
    ctx.strokeStyle =
      'rgba(70, 76, 84, .08)'

    ctx.lineWidth = 2

    for (
      let i = 1;
      i < 9;
      i++
    ) {
      const yy =
        h *
        (i / 10)

      ctx.beginPath()

      ctx.moveTo(
        0,
        yy
      )

      ctx.lineTo(
        w,
        yy
      )

      ctx.stroke()
    }

    const ball =
      ballRef.current

    const dt =
      Math.min(
        (time -
          lastTimeRef.current) /
          1000,
        0.033
      )

    lastTimeRef.current =
      time

    // ------------------------------------------
    // PHYSICS ONLY RUNS IN PLAYING
    //
    // READY = stationary
    // ARMED = stationary
    // OVER = stationary
    // ------------------------------------------

    if (
      stateRef.current ===
      'playing'
    ) {
      const gravity =
        1850

      ball.vy +=
        gravity * dt

      ball.x +=
        (ball.vx * dt) /
        w

      ball.y +=
        (ball.vy * dt) /
        h

      ball.rotation +=
        (ball.vx * dt) /
        160

      ball.vx *=
        Math.pow(
          0.985,
          dt * 60
        )

      // Left wall
      if (
        ball.x < 0.08
      ) {
        ball.x = 0.08
        ball.vx *= -0.75
      }

      // Right wall
      if (
        ball.x > 0.92
      ) {
        ball.x = 0.92
        ball.vx *= -0.75
      }

      // Ground = Game Over
      if (
        ball.y > 0.88
      ) {
        ball.y = 0.88

        ball.vx = 0
        ball.vy = 0

        stateRef.current =
          'over'

        setState(
          'over'
        )
      }
    }

    drawBall(
      ctx,
      ball,
      w,
      h
    )

    rafRef.current =
      requestAnimationFrame(
        draw
      )
  }

  // --------------------------------------------------
  // INITIALIZE
  // --------------------------------------------------

  useEffect(() => {
    resizeCanvas()

    window.addEventListener(
      'resize',
      resizeCanvas
    )

    rafRef.current =
      requestAnimationFrame(
        (t) => {
          lastTimeRef.current =
            t

          draw(t)
        }
      )

    const onKey = (
      e: KeyboardEvent
    ) => {
      if (
        e.code ===
          'Space' ||
        e.code ===
          'ArrowUp'
      ) {
        e.preventDefault()

        // Space does NOT start from ready.
        // User must press PLAY first.
        if (
          stateRef.current ===
          'ready'
        ) {
          return
        }

        // In armed state, keyboard does not
        // start the game because we require
        // clicking/tapping the ball.
        if (
          stateRef.current ===
          'armed'
        ) {
          return
        }

        // During gameplay
        if (
          stateRef.current ===
          'playing'
        ) {
          kickBall(
            undefined,
            true
          )
        }
      }
    }

    window.addEventListener(
      'keydown',
      onKey
    )

    return () => {
      window.removeEventListener(
        'resize',
        resizeCanvas
      )

      window.removeEventListener(
        'keydown',
        onKey
      )

      if (
        rafRef.current
      ) {
        cancelAnimationFrame(
          rafRef.current
        )
      }

      audioRef.current?.close()
    }
  }, [])

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="app-shell">
      <section className={`game${manualFullscreen ? ' manual-fullscreen' : ''}`} ref={sectionRef}>

        <header className="topbar">

          <button
            className="icon-btn"
            aria-label="Reset"
            onClick={
              resetToReady
            }
          >
            ↻
          </button>

          <div className="title">
            Football Keep-Up
          </div>

          <button
            className="icon-btn"
            aria-label={
              fullscreenActive
                ? 'Exit fullscreen'
                : 'Enter fullscreen'
            }
            onClick={toggleFullscreen}
          >
            {fullscreenActive
              ? <CollapseIcon />
              : <ExpandIcon />}
          </button>

          <button
            className="icon-btn"
            aria-label={
              muted
                ? 'Turn sound on'
                : 'Turn sound off'
            }
            onClick={() => {
              setMuted(
                (v) => !v
              )
            }}
          >
            {muted
              ? '🔇'
              : '🔊'}
          </button>

        </header>

        <div className="stats">

          <div>
            <span>
              Current Best
            </span>

            <strong>
              {score}
            </strong>
          </div>

          <div>
            <span>
              Highest
            </span>

            <strong>
              {best}
            </strong>
          </div>

        </div>

        <canvas
          ref={canvasRef}
          onPointerDown={
            onPointerDown
          }
          className="game-canvas"
        />

        {/* ----------------------------------------
            READY SCREEN
        ----------------------------------------- */}

        {state === 'ready' && (
          <div className="overlay">

            <div className="ball-icon">
              ⚽
            </div>

            <h1>
              Keep It Up!
            </h1>

            <p>
              Press PLAY to get ready.
            </p>

            <button
              className="primary"
              onClick={
                armGame
              }
            >
              PLAY
            </button>

          </div>
        )}

        {/* ----------------------------------------
            ARMED SCREEN
            Ball is stationary.
            Sound button remains usable.
        ----------------------------------------- */}

        {state === 'armed' && (
          <div className="armed-message">

            <div className="tap-hint">
              👆
            </div>

            <strong>
              Tap the ball to start
            </strong>

            <span>
              The ball is ready!
            </span>

          </div>
        )}

        {/* ----------------------------------------
            GAME OVER
        ----------------------------------------- */}

        {state === 'over' && (
          <div className="overlay">

            <div className="over-icon">
              ✦
            </div>

            <h1>
              Game Over
            </h1>

            <p>
              Your score:{' '}
              <b>
                {score}
              </b>
            </p>

            <button
              className="primary"
              onClick={
                armGame
              }
            >
              PLAY AGAIN
            </button>

          </div>
        )}

        <footer>
          Offline game • Your best score
          stays on this device
        </footer>

      </section>
    </main>
  )
}