import { useState, useRef, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  Float,
  MeshDistortMaterial,
  Stars,
  Text,
  Html,
  Sphere,
  Box,
  RoundedBox,
  ContactShadows
} from '@react-three/drei'
import * as THREE from 'three'

interface Orb {
  id: number
  position: [number, number, number]
  collected: boolean
}

interface GameState {
  score: number
  time: number
  gameStarted: boolean
  gameOver: boolean
}

// Player marble controlled by keyboard
function PlayerMarble({
  position,
  setPosition,
  orbs,
  setOrbs,
  setScore,
  gameStarted
}: {
  position: [number, number, number]
  setPosition: (pos: [number, number, number]) => void
  orbs: Orb[]
  setOrbs: (orbs: Orb[]) => void
  setScore: (fn: (s: number) => number) => void
  gameStarted: boolean
}) {
  const ref = useRef<THREE.Mesh>(null!)
  const velocity = useRef({ x: 0, z: 0 })
  const keys = useRef({ w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = true
      }
      if (e.key in keys.current) {
        keys.current[e.key as keyof typeof keys.current] = true
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = false
      }
      if (e.key in keys.current) {
        keys.current[e.key as keyof typeof keys.current] = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (!gameStarted) return

    const acceleration = 15
    const friction = 0.95
    const maxSpeed = 8

    // Apply forces based on keys
    if (keys.current.w || keys.current.ArrowUp) velocity.current.z -= acceleration * delta
    if (keys.current.s || keys.current.ArrowDown) velocity.current.z += acceleration * delta
    if (keys.current.a || keys.current.ArrowLeft) velocity.current.x -= acceleration * delta
    if (keys.current.d || keys.current.ArrowRight) velocity.current.x += acceleration * delta

    // Apply friction
    velocity.current.x *= friction
    velocity.current.z *= friction

    // Clamp speed
    const speed = Math.sqrt(velocity.current.x ** 2 + velocity.current.z ** 2)
    if (speed > maxSpeed) {
      velocity.current.x = (velocity.current.x / speed) * maxSpeed
      velocity.current.z = (velocity.current.z / speed) * maxSpeed
    }

    // Update position
    let newX = position[0] + velocity.current.x * delta
    let newZ = position[2] + velocity.current.z * delta

    // Boundary constraints (platform is 20x20)
    const boundary = 9
    newX = Math.max(-boundary, Math.min(boundary, newX))
    newZ = Math.max(-boundary, Math.min(boundary, newZ))

    // Bounce off walls
    if (Math.abs(newX) >= boundary) velocity.current.x *= -0.5
    if (Math.abs(newZ) >= boundary) velocity.current.z *= -0.5

    setPosition([newX, position[1], newZ])

    // Rotate marble based on movement
    if (ref.current) {
      ref.current.rotation.x += velocity.current.z * delta * 2
      ref.current.rotation.z -= velocity.current.x * delta * 2
    }

    // Check orb collisions
    orbs.forEach((orb, index) => {
      if (!orb.collected) {
        const dist = Math.sqrt(
          (newX - orb.position[0]) ** 2 +
          (position[1] - orb.position[1]) ** 2 +
          (newZ - orb.position[2]) ** 2
        )
        if (dist < 1.2) {
          const newOrbs = [...orbs]
          newOrbs[index] = { ...orb, collected: true }
          setOrbs(newOrbs)
          setScore(s => s + 100)
        }
      }
    })
  })

  return (
    <mesh ref={ref} position={position} castShadow>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial
        color="#00ffff"
        metalness={0.9}
        roughness={0.1}
        emissive="#00ffff"
        emissiveIntensity={0.3}
      />
    </mesh>
  )
}

// Collectible orbs
function CollectibleOrb({ position, collected }: { position: [number, number, number], collected: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (ref.current && !collected) {
      ref.current.rotation.y = state.clock.elapsedTime * 2
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.2
    }
  })

  if (collected) return null

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={ref} position={position}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color="#ff00ff"
          emissive="#ff00ff"
          emissiveIntensity={2}
          metalness={1}
          roughness={0}
        />
      </mesh>
      <pointLight position={position} color="#ff00ff" intensity={2} distance={3} />
    </Float>
  )
}

// Game platform
function Platform() {
  return (
    <group>
      {/* Main platform */}
      <RoundedBox args={[20, 0.5, 20]} radius={0.1} position={[0, -0.5, 0]} receiveShadow>
        <meshStandardMaterial
          color="#1a1a2e"
          metalness={0.5}
          roughness={0.3}
        />
      </RoundedBox>

      {/* Grid lines */}
      <gridHelper args={[20, 20, '#ff00ff', '#00ffff']} position={[0, -0.24, 0]} />

      {/* Edge walls with glow */}
      {[[-10, 0], [10, 0], [0, -10], [0, 10]].map(([x, z], i) => (
        <group key={i}>
          <Box
            args={[i < 2 ? 0.2 : 20, 1, i < 2 ? 20 : 0.2]}
            position={[x, 0, z]}
          >
            <meshStandardMaterial
              color="#ff00ff"
              emissive="#ff00ff"
              emissiveIntensity={0.5}
              transparent
              opacity={0.3}
            />
          </Box>
        </group>
      ))}

      {/* Corner pillars */}
      {[[-9.5, -9.5], [-9.5, 9.5], [9.5, -9.5], [9.5, 9.5]].map(([x, z], i) => (
        <Float key={i} speed={1} rotationIntensity={0.2}>
          <Box args={[0.5, 3, 0.5]} position={[x, 1, z]}>
            <meshStandardMaterial
              color="#00ffff"
              emissive="#00ffff"
              emissiveIntensity={1}
              metalness={0.9}
              roughness={0.1}
            />
          </Box>
        </Float>
      ))}
    </group>
  )
}

// Obstacles
function Obstacles() {
  const obstacles = [
    { pos: [3, 0.5, 3] as [number, number, number], size: [1.5, 1, 1.5] as [number, number, number] },
    { pos: [-4, 0.5, -2] as [number, number, number], size: [2, 1.5, 1] as [number, number, number] },
    { pos: [5, 0.5, -5] as [number, number, number], size: [1, 2, 1] as [number, number, number] },
    { pos: [-6, 0.5, 4] as [number, number, number], size: [1.5, 1, 2] as [number, number, number] },
    { pos: [0, 0.5, 6] as [number, number, number], size: [3, 0.8, 1] as [number, number, number] },
    { pos: [-2, 0.5, -6] as [number, number, number], size: [1, 1.2, 2] as [number, number, number] },
  ]

  return (
    <>
      {obstacles.map((obs, i) => (
        <RoundedBox key={i} args={obs.size} position={obs.pos} radius={0.05} castShadow>
          <meshStandardMaterial
            color="#16213e"
            metalness={0.7}
            roughness={0.2}
            emissive="#0f3460"
            emissiveIntensity={0.3}
          />
        </RoundedBox>
      ))}
    </>
  )
}

// Background spheres for atmosphere
function BackgroundSpheres() {
  const spheres = Array.from({ length: 30 }, (_, i) => ({
    position: [
      (Math.random() - 0.5) * 60,
      Math.random() * 30 + 5,
      (Math.random() - 0.5) * 60 - 20
    ] as [number, number, number],
    scale: Math.random() * 2 + 0.5
  }))

  return (
    <>
      {spheres.map((sphere, i) => (
        <Float key={i} speed={0.5 + Math.random()} rotationIntensity={0.2}>
          <Sphere args={[sphere.scale, 16, 16]} position={sphere.position}>
            <MeshDistortMaterial
              color={i % 2 === 0 ? '#ff00ff' : '#00ffff'}
              emissive={i % 2 === 0 ? '#ff00ff' : '#00ffff'}
              emissiveIntensity={0.5}
              distort={0.3}
              speed={2}
              transparent
              opacity={0.3}
            />
          </Sphere>
        </Float>
      ))}
    </>
  )
}

// Score display in 3D
function ScoreDisplay({ score, time }: { score: number, time: number }) {
  return (
    <group position={[0, 8, -10]}>
      <Text
        fontSize={1.5}
        color="#00ffff"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/orbitron/v29/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1ny.woff2"
      >
        SCORE: {score}
      </Text>
      <Text
        position={[0, -2, 0]}
        fontSize={1}
        color="#ff00ff"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/orbitron/v29/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1ny.woff2"
      >
        TIME: {Math.floor(time)}s
      </Text>
    </group>
  )
}

// Mobile controls
function MobileControls({ onMove }: { onMove: (dir: string, pressed: boolean) => void }) {
  return (
    <div className="fixed bottom-20 left-4 md:hidden z-20">
      <div className="grid grid-cols-3 gap-1">
        <div />
        <button
          className="w-14 h-14 bg-cyan-500/30 border border-cyan-400 rounded-lg flex items-center justify-center active:bg-cyan-500/50"
          onTouchStart={() => onMove('w', true)}
          onTouchEnd={() => onMove('w', false)}
        >
          <span className="text-cyan-400 text-2xl">↑</span>
        </button>
        <div />
        <button
          className="w-14 h-14 bg-cyan-500/30 border border-cyan-400 rounded-lg flex items-center justify-center active:bg-cyan-500/50"
          onTouchStart={() => onMove('a', true)}
          onTouchEnd={() => onMove('a', false)}
        >
          <span className="text-cyan-400 text-2xl">←</span>
        </button>
        <button
          className="w-14 h-14 bg-cyan-500/30 border border-cyan-400 rounded-lg flex items-center justify-center active:bg-cyan-500/50"
          onTouchStart={() => onMove('s', true)}
          onTouchEnd={() => onMove('s', false)}
        >
          <span className="text-cyan-400 text-2xl">↓</span>
        </button>
        <button
          className="w-14 h-14 bg-cyan-500/30 border border-cyan-400 rounded-lg flex items-center justify-center active:bg-cyan-500/50"
          onTouchStart={() => onMove('d', true)}
          onTouchEnd={() => onMove('d', false)}
        >
          <span className="text-cyan-400 text-2xl">→</span>
        </button>
      </div>
    </div>
  )
}

// Camera that follows player
function FollowCamera({ target }: { target: [number, number, number] }) {
  const { camera } = useThree()

  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, target[0], 0.05)
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, target[2] + 12, 0.05)
    camera.lookAt(target[0], 0, target[2])
  })

  return null
}

// Main game scene
function GameScene({ gameState, setGameState }: {
  gameState: GameState
  setGameState: (fn: (s: GameState) => GameState) => void
}) {
  const [playerPos, setPlayerPos] = useState<[number, number, number]>([0, 0.5, 0])
  const [orbs, setOrbs] = useState<Orb[]>([
    { id: 1, position: [5, 1, 5], collected: false },
    { id: 2, position: [-5, 1, -5], collected: false },
    { id: 3, position: [7, 1, -3], collected: false },
    { id: 4, position: [-7, 1, 3], collected: false },
    { id: 5, position: [0, 1, -8], collected: false },
    { id: 6, position: [-3, 1, 7], collected: false },
    { id: 7, position: [8, 1, 0], collected: false },
    { id: 8, position: [-8, 1, -7], collected: false },
    { id: 9, position: [2, 1, -4], collected: false },
    { id: 10, position: [-5, 1, 0], collected: false },
  ])

  // Update timer
  useFrame((_, delta) => {
    if (gameState.gameStarted && !gameState.gameOver) {
      setGameState(s => ({ ...s, time: s.time + delta }))

      // Check win condition
      if (orbs.every(o => o.collected)) {
        setGameState(s => ({ ...s, gameOver: true }))
      }
    }
  })

  const setScore = useCallback((fn: (s: number) => number) => {
    setGameState(s => ({ ...s, score: fn(s.score) }))
  }, [setGameState])

  return (
    <>
      <color attach="background" args={['#0a0a0f']} />
      <fog attach="fog" args={['#0a0a0f', 20, 50]} />

      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[0, 5, 0]} color="#ff00ff" intensity={1} />
      <pointLight position={[-5, 3, 5]} color="#00ffff" intensity={0.5} />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <BackgroundSpheres />

      <Platform />
      <Obstacles />

      <PlayerMarble
        position={playerPos}
        setPosition={setPlayerPos}
        orbs={orbs}
        setOrbs={setOrbs}
        setScore={setScore}
        gameStarted={gameState.gameStarted}
      />

      {orbs.map(orb => (
        <CollectibleOrb key={orb.id} position={orb.position} collected={orb.collected} />
      ))}

      <ScoreDisplay score={gameState.score} time={gameState.time} />

      <ContactShadows
        position={[0, -0.24, 0]}
        opacity={0.5}
        scale={25}
        blur={2}
        far={10}
      />

      <FollowCamera target={playerPos} />
      <OrbitControls
        enablePan={false}
        maxPolarAngle={Math.PI / 2.5}
        minDistance={8}
        maxDistance={25}
      />
    </>
  )
}

function App() {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    time: 0,
    gameStarted: false,
    gameOver: false
  })

  const startGame = () => {
    setGameState({
      score: 0,
      time: 0,
      gameStarted: true,
      gameOver: false
    })
  }

  return (
    <div className="w-screen h-screen bg-[#0a0a0f] overflow-hidden relative">
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.1) 2px, rgba(0,255,255,0.1) 4px)'
        }}
      />

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 12, 15], fov: 50 }}
        gl={{ antialias: true }}
      >
        <GameScene gameState={gameState} setGameState={setGameState} />
      </Canvas>

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
        <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-4 py-2 md:px-6 md:py-3">
          <div className="text-cyan-400 font-orbitron text-xs md:text-sm tracking-widest">SCORE</div>
          <div className="text-white font-orbitron text-xl md:text-3xl">{gameState.score}</div>
        </div>

        <div className="bg-black/50 backdrop-blur-sm border border-fuchsia-500/30 rounded-lg px-4 py-2 md:px-6 md:py-3">
          <div className="text-fuchsia-400 font-orbitron text-xs md:text-sm tracking-widest">TIME</div>
          <div className="text-white font-orbitron text-xl md:text-3xl">{Math.floor(gameState.time)}s</div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-20 md:bottom-8 right-4 bg-black/50 backdrop-blur-sm border border-cyan-500/20 rounded-lg px-3 py-2 md:px-4 md:py-3 text-right z-20">
        <div className="text-cyan-300/70 font-mono text-xs hidden md:block">WASD or Arrow Keys to move</div>
        <div className="text-fuchsia-300/70 font-mono text-xs">Collect all orbs!</div>
      </div>

      {/* Start Screen */}
      {!gameState.gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/70 backdrop-blur-sm">
          <div className="text-center px-4">
            <h1 className="font-orbitron text-4xl md:text-6xl lg:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-cyan-400 mb-4 md:mb-6 animate-pulse">
              NEON MARBLE
            </h1>
            <p className="text-cyan-300/80 font-mono text-sm md:text-base mb-6 md:mb-8 max-w-md mx-auto">
              Roll through the cyber grid and collect all the glowing orbs
            </p>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white font-orbitron text-lg md:text-xl rounded-lg
                         hover:from-cyan-400 hover:to-fuchsia-400 transition-all duration-300
                         shadow-[0_0_30px_rgba(0,255,255,0.5)] hover:shadow-[0_0_50px_rgba(255,0,255,0.7)]
                         active:scale-95 min-w-[200px]"
            >
              START GAME
            </button>
            <p className="text-cyan-500/50 font-mono text-xs mt-4 md:mt-6">
              <span className="hidden md:inline">WASD / Arrows to move</span>
              <span className="md:hidden">Use on-screen controls</span>
            </p>
          </div>
        </div>
      )}

      {/* Win Screen */}
      {gameState.gameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/70 backdrop-blur-sm">
          <div className="text-center px-4">
            <h1 className="font-orbitron text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400 mb-4 md:mb-6">
              VICTORY!
            </h1>
            <div className="text-cyan-300 font-mono text-lg md:text-xl mb-2">
              Final Score: <span className="text-fuchsia-400 font-bold">{gameState.score}</span>
            </div>
            <div className="text-cyan-300 font-mono text-base md:text-lg mb-6 md:mb-8">
              Time: <span className="text-fuchsia-400 font-bold">{Math.floor(gameState.time)}s</span>
            </div>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-orbitron text-lg md:text-xl rounded-lg
                         hover:from-fuchsia-400 hover:to-cyan-400 transition-all duration-300
                         shadow-[0_0_30px_rgba(255,0,255,0.5)] hover:shadow-[0_0_50px_rgba(0,255,255,0.7)]
                         active:scale-95 min-w-[200px]"
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      {gameState.gameStarted && !gameState.gameOver && (
        <div className="fixed bottom-16 left-4 md:hidden z-20">
          <div className="grid grid-cols-3 gap-1">
            <div />
            <button
              className="w-14 h-14 bg-cyan-500/30 border border-cyan-400 rounded-lg flex items-center justify-center active:bg-cyan-500/50 touch-none"
              onTouchStart={(e) => {
                e.preventDefault()
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }))
              }}
            >
              <span className="text-cyan-400 text-2xl">↑</span>
            </button>
            <div />
            <button
              className="w-14 h-14 bg-cyan-500/30 border border-cyan-400 rounded-lg flex items-center justify-center active:bg-cyan-500/50 touch-none"
              onTouchStart={(e) => {
                e.preventDefault()
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }))
              }}
            >
              <span className="text-cyan-400 text-2xl">←</span>
            </button>
            <button
              className="w-14 h-14 bg-cyan-500/30 border border-cyan-400 rounded-lg flex items-center justify-center active:bg-cyan-500/50 touch-none"
              onTouchStart={(e) => {
                e.preventDefault()
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }))
              }}
            >
              <span className="text-cyan-400 text-2xl">↓</span>
            </button>
            <button
              className="w-14 h-14 bg-cyan-500/30 border border-cyan-400 rounded-lg flex items-center justify-center active:bg-cyan-500/50 touch-none"
              onTouchStart={(e) => {
                e.preventDefault()
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }))
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }))
              }}
            >
              <span className="text-cyan-400 text-2xl">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-2 left-0 right-0 text-center z-20">
        <p className="text-cyan-500/30 font-mono text-[10px] md:text-xs tracking-wide">
          Requested by <a href="https://twitter.com/moltocrat" className="hover:text-cyan-400/50 transition-colors">@moltocrat</a> · Built by <a href="https://twitter.com/clonkbot" className="hover:text-fuchsia-400/50 transition-colors">@clonkbot</a>
        </p>
      </div>
    </div>
  )
}

export default App