"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Play, Pause, Square, Upload, Trash2, Settings, Zap, Heart, Shield, Trophy, Target } from "lucide-react"

// Game state types
type GameState = "PRE_BATTLE" | "COUNTDOWN" | "BATTLE" | "PAUSED" | "ENDED"

interface Entity {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  health: number
  maxHealth: number
  image: HTMLImageElement
  hasBarrier: boolean
  barrierUsed: boolean
  lastDamageTime: number
  comboCount: number
  totalDamage: number
  isDestroyed: boolean
  neonColor: string
}

interface UploadedImage {
  id: string
  file: File
  url: string
  processed: boolean
  thumbnail: string
}

export default function CombatArena() {
  // Game state
  const [gameState, setGameState] = useState<GameState>("PRE_BATTLE")
  const [countdown, setCountdown] = useState(3)
  const [entities, setEntities] = useState<Entity[]>([])
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  // Game settings
  const [arenaSize, setArenaSize] = useState({ width: 1200, height: 800 })
  const [entitySize, setEntitySize] = useState(60)

  // Statistics
  const [battleStats, setBattleStats] = useState({
    totalCollisions: 0,
    entitiesDestroyed: 0,
    battleTime: 0,
  })

  // Calculate optimal arena size based on entity count
  const calculateArenaSize = useCallback((entityCount: number) => {
    if (entityCount <= 50) return { width: 1200, height: 800 }
    if (entityCount <= 150) return { width: 1600, height: 1000 }
    if (entityCount <= 300) return { width: 1920, height: 1200 }
    return { width: 2560, height: 1440 }
  }, [])

  // Calculate entity size based on count
  const calculateEntitySize = useCallback((entityCount: number) => {
    if (entityCount <= 100) return 60 + Math.random() * 20
    if (entityCount <= 250) return 50 + Math.random() * 20
    if (entityCount <= 400) return 40 + Math.random() * 20
    return 35 + Math.random() * 20
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback(
    async (files: FileList) => {
      if (files.length === 0) return

      setIsUploading(true)
      setUploadProgress(0)

      const newImages: UploadedImage[] = []

      for (let i = 0; i < Math.min(files.length, 500); i++) {
        const file = files[i]
        if (!file.type.startsWith("image/")) continue

        const id = `img-${Date.now()}-${i}`
        const url = URL.createObjectURL(file)

        // Create thumbnail
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")!
        const img = new Image()

        await new Promise((resolve) => {
          img.onload = () => {
            canvas.width = 100
            canvas.height = 100

            // Draw circular thumbnail
            ctx.beginPath()
            ctx.arc(50, 50, 50, 0, Math.PI * 2)
            ctx.clip()
            ctx.drawImage(img, 0, 0, 100, 100)

            const thumbnail = canvas.toDataURL()
            newImages.push({
              id,
              file,
              url,
              processed: true,
              thumbnail,
            })

            setUploadProgress(((i + 1) / files.length) * 100)
            resolve(null)
          }
          img.src = url
        })
      }

      setUploadedImages((prev) => [...prev, ...newImages])
      setIsUploading(false)

      // Update arena size based on new total
      const totalCount = uploadedImages.length + newImages.length
      setArenaSize(calculateArenaSize(totalCount))
      setEntitySize(calculateEntitySize(totalCount))
    },
    [uploadedImages.length, calculateArenaSize, calculateEntitySize],
  )

  // Remove uploaded image
  const removeImage = useCallback(
    (id: string) => {
      setUploadedImages((prev) => {
        const filtered = prev.filter((img) => img.id !== id)
        setArenaSize(calculateArenaSize(filtered.length))
        setEntitySize(calculateEntitySize(filtered.length))
        return filtered
      })
    },
    [calculateArenaSize, calculateEntitySize],
  )

  // Initialize entities from uploaded images
  const initializeEntities = useCallback(async () => {
    const newEntities: Entity[] = []

    for (const uploadedImg of uploadedImages) {
      const img = new Image()
      await new Promise((resolve) => {
        img.onload = resolve
        img.src = uploadedImg.url
      })

      // Random position within arena bounds
      const radius = calculateEntitySize(uploadedImages.length)
      const x = radius + Math.random() * (arenaSize.width - 2 * radius)
      const y = radius + Math.random() * (arenaSize.height - 2 * radius)

      // Random velocity - INCREASED SPEED
      const speed = 2.0 + Math.random() * 4.0 // Changed from 0.5 + Math.random() * 1.5
      const angle = Math.random() * Math.PI * 2

      // Random neon color
      const neonColors = ["#00ffff", "#ff00ff", "#ffff00", "#ff0080", "#80ff00", "#0080ff"]
      const neonColor = neonColors[Math.floor(Math.random() * neonColors.length)]

      newEntities.push({
        id: uploadedImg.id,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        health: 100,
        maxHealth: 100,
        image: img,
        hasBarrier: false,
        barrierUsed: false,
        lastDamageTime: 0,
        comboCount: 0,
        totalDamage: 0,
        isDestroyed: false,
        neonColor,
      })
    }

    setEntities(newEntities)
  }, [uploadedImages, arenaSize, calculateEntitySize])

  // Start battle sequence
  const startBattle = useCallback(async () => {
    if (uploadedImages.length === 0) return

    await initializeEntities()
    setGameState("COUNTDOWN")

    // Countdown sequence
    for (let i = 3; i > 0; i--) {
      setCountdown(i)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    setGameState("BATTLE")
    setBattleStats({ totalCollisions: 0, entitiesDestroyed: 0, battleTime: 0 })
  }, [uploadedImages, initializeEntities])

  // Pause/Resume battle
  const togglePause = useCallback(() => {
    setGameState((prev) => (prev === "BATTLE" ? "PAUSED" : "BATTLE"))
  }, [])

  // Stop battle
  const stopBattle = useCallback(() => {
    setGameState("PRE_BATTLE")
    setEntities([])
    setBattleStats({ totalCollisions: 0, entitiesDestroyed: 0, battleTime: 0 })
  }, [])

  // Collision detection
  const checkCollisions = useCallback((entities: Entity[]) => {
    const activeEntities = entities.filter((e) => !e.isDestroyed)
    let collisionCount = 0

    for (let i = 0; i < activeEntities.length; i++) {
      for (let j = i + 1; j < activeEntities.length; j++) {
        const e1 = activeEntities[i]
        const e2 = activeEntities[j]

        const dx = e2.x - e1.x
        const dy = e2.y - e1.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < e1.radius + e2.radius) {
          collisionCount++

          // Calculate collision velocity for damage
          const relativeVx = e2.vx - e1.vx
          const relativeVy = e2.vy - e1.vy
          const collisionSpeed = Math.sqrt(relativeVx * relativeVx + relativeVy * relativeVy)

          // Calculate damage based on collision speed
          const baseDamage = Math.floor(5 + collisionSpeed * 10)
          const damage1 = Math.min(baseDamage + Math.random() * 10, 35)
          const damage2 = Math.min(baseDamage + Math.random() * 10, 35)

          // Apply damage with barrier check
          const now = Date.now()

          // Entity 1 damage
          if (e1.hasBarrier) {
            e1.hasBarrier = false
            // Barrier absorbs damage
          } else {
            e1.health = Math.max(0, e1.health - damage2)
            e1.lastDamageTime = now

            // Combo system
            if (now - e1.lastDamageTime < 2000) {
              e1.comboCount++
            } else {
              e1.comboCount = 1
            }

            e2.totalDamage += damage2 * Math.min(1.5, 1 + (e1.comboCount - 1) * 0.25)
          }

          // Entity 2 damage
          if (e2.hasBarrier) {
            e2.hasBarrier = false
            // Barrier absorbs damage
          } else {
            e2.health = Math.max(0, e2.health - damage1)
            e2.lastDamageTime = now

            // Combo system
            if (now - e2.lastDamageTime < 2000) {
              e2.comboCount++
            } else {
              e2.comboCount = 1
            }

            e1.totalDamage += damage1 * Math.min(1.5, 1 + (e2.comboCount - 1) * 0.25)
          }

          // Activate barrier at 1 HP
          if (e1.health === 1 && !e1.barrierUsed) {
            e1.hasBarrier = true
            e1.barrierUsed = true
          }
          if (e2.health === 1 && !e2.barrierUsed) {
            e2.hasBarrier = true
            e2.barrierUsed = true
          }

          // Mark as destroyed if health reaches 0
          if (e1.health <= 0) e1.isDestroyed = true
          if (e2.health <= 0) e2.isDestroyed = true

          // Collision response - MAINTAIN MORE ENERGY
          const overlap = e1.radius + e2.radius - distance
          const separationX = (dx / distance) * overlap * 0.5
          const separationY = (dy / distance) * overlap * 0.5

          e1.x -= separationX
          e1.y -= separationY
          e2.x += separationX
          e2.y += separationY

          // Velocity exchange
          const tempVx = e1.vx
          const tempVy = e1.vy
          e1.vx = e2.vx * 1.2 // Changed from 0.8 to 1.2 for faster bounces
          e1.vy = e2.vy * 1.2 // Changed from 0.8 to 1.2 for faster bounces
          e2.vx = tempVx * 1.2 // Changed from 0.8 to 1.2 for faster bounces
          e2.vy = tempVy * 1.2 // Changed from 0.8 to 1.2 for faster bounces
        }
      }
    }

    return collisionCount
  }, [])

  // Health regeneration
  const applyHealthRegeneration = useCallback((entities: Entity[]) => {
    const now = Date.now()
    return entities.map((entity) => {
      if (
        !entity.isDestroyed &&
        entity.health < entity.maxHealth &&
        entity.health > 0 &&
        now - entity.lastDamageTime > 3000
      ) {
        // Regenerate 1 HP every 5 seconds
        if (now % 5000 < 16) {
          // Approximate frame timing
          entity.health = Math.min(entity.maxHealth, entity.health + 1)
        }
      }
      return entity
    })
  }, [])

  // Game loop
  const gameLoop = useCallback(() => {
    if (gameState !== "BATTLE") return

    setEntities((prevEntities) => {
      let updatedEntities = [...prevEntities]

      // Update positions
      updatedEntities = updatedEntities.map((entity) => {
        if (entity.isDestroyed) return entity

        entity.x += entity.vx
        entity.y += entity.vy

        // Boundary collision - FASTER WALL BOUNCES
        if (entity.x - entity.radius <= 0 || entity.x + entity.radius >= arenaSize.width) {
          entity.vx *= -0.95 // Changed from -0.9 to -0.95 for less energy loss
          entity.x = Math.max(entity.radius, Math.min(arenaSize.width - entity.radius, entity.x))
        }
        if (entity.y - entity.radius <= 0 || entity.y + entity.radius >= arenaSize.height) {
          entity.vy *= -0.95 // Changed from -0.9 to -0.95 for less energy loss
          entity.y = Math.max(entity.radius, Math.min(arenaSize.height - entity.radius, entity.y))
        }

        return entity
      })

      // Check collisions
      const collisions = checkCollisions(updatedEntities)

      // Apply health regeneration
      updatedEntities = applyHealthRegeneration(updatedEntities)

      // Apply velocity boost for more dynamic movement
      updatedEntities = updatedEntities.map((entity) => {
        if (!entity.isDestroyed) {
          // Maintain minimum speed for continuous action
          const currentSpeed = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy)
          if (currentSpeed < 1.5) {
            const boostFactor = 1.5 / currentSpeed
            entity.vx *= boostFactor
            entity.vy *= boostFactor
          }

          // Cap maximum speed to prevent chaos
          if (currentSpeed > 8.0) {
            const capFactor = 8.0 / currentSpeed
            entity.vx *= capFactor
            entity.vy *= capFactor
          }
        }
        return entity
      })

      // Update battle stats
      setBattleStats((prev) => ({
        ...prev,
        totalCollisions: prev.totalCollisions + collisions,
        entitiesDestroyed: updatedEntities.filter((e) => e.isDestroyed).length,
        battleTime: prev.battleTime + 1,
      }))

      // Check victory condition
      const aliveEntities = updatedEntities.filter((e) => !e.isDestroyed)
      if (aliveEntities.length <= 1) {
        setGameState("ENDED")
      }

      return updatedEntities
    })
  }, [gameState, arenaSize, checkCollisions, applyHealthRegeneration])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      gameLoop()

      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")!
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw arena background
      ctx.fillStyle = "#0a0a0a"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw grid pattern
      ctx.strokeStyle = "#1a1a1a"
      ctx.lineWidth = 1
      for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }
      for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      // Draw entities
      entities.forEach((entity) => {
        if (entity.isDestroyed) return

        ctx.save()

        // Draw neon aura
        if (gameState === "BATTLE") {
          const gradient = ctx.createRadialGradient(
            entity.x,
            entity.y,
            entity.radius,
            entity.x,
            entity.y,
            entity.radius + 20,
          )
          gradient.addColorStop(0, entity.neonColor + "40")
          gradient.addColorStop(1, entity.neonColor + "00")
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(entity.x, entity.y, entity.radius + 20, 0, Math.PI * 2)
          ctx.fill()
        }

        // Draw barrier
        if (entity.hasBarrier) {
          ctx.strokeStyle = "#00ff00"
          ctx.lineWidth = 4
          ctx.setLineDash([5, 5])
          ctx.beginPath()
          ctx.arc(entity.x, entity.y, entity.radius + 10, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])
        }

        // Draw entity (circular clipped image)
        ctx.beginPath()
        ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2)
        ctx.clip()

        ctx.drawImage(
          entity.image,
          entity.x - entity.radius,
          entity.y - entity.radius,
          entity.radius * 2,
          entity.radius * 2,
        )

        ctx.restore()

        // Draw health bar
        const barWidth = entity.radius * 2
        const barHeight = 6
        const barX = entity.x - barWidth / 2
        const barY = entity.y - entity.radius - 15

        // Background
        ctx.fillStyle = "#333"
        ctx.fillRect(barX, barY, barWidth, barHeight)

        // Health fill
        const healthPercent = entity.health / entity.maxHealth
        const healthColor = healthPercent > 0.5 ? "#00ff00" : healthPercent > 0.25 ? "#ffff00" : "#ff0000"
        ctx.fillStyle = healthColor
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight)

        // Border
        ctx.strokeStyle = "#fff"
        ctx.lineWidth = 1
        ctx.strokeRect(barX, barY, barWidth, barHeight)

        // Health text
        ctx.fillStyle = "#fff"
        ctx.font = "10px monospace"
        ctx.textAlign = "center"
        ctx.fillText(`${entity.health}`, entity.x, barY - 2)
      })

      // Draw countdown
      if (gameState === "COUNTDOWN") {
        ctx.fillStyle = "#fff"
        ctx.font = "bold 120px Arial"
        ctx.textAlign = "center"
        ctx.fillText(countdown === 0 ? "BATTLE BEGINS!" : countdown.toString(), canvas.width / 2, canvas.height / 2)
      }

      // Draw pause overlay
      if (gameState === "PAUSED") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = "#fff"
        ctx.font = "bold 48px Arial"
        ctx.textAlign = "center"
        ctx.fillText("BATTLE PAUSED", canvas.width / 2, canvas.height / 2)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [entities, gameState, countdown, gameLoop])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const files = e.dataTransfer.files
      handleFileUpload(files)
    },
    [handleFileUpload],
  )

  const aliveEntities = entities.filter((e) => !e.isDestroyed)
  const winner = aliveEntities.length === 1 ? aliveEntities[0] : null

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent mb-2">
            ULTIMATE PROFESSIONAL COMBAT ARENA
          </h1>
          <p className="text-gray-400">Tournament-Style Image Battle System</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Image Upload */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-gray-800 border-gray-700 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Image Arsenal
              </h3>

              {gameState === "PRE_BATTLE" && (
                <div
                  className="border-2 border-dashed border-cyan-500 rounded-lg p-6 text-center hover:border-purple-500 transition-colors cursor-pointer"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
                  <p className="text-sm font-medium">DRAG & DROP UP TO 500 BATTLE IMAGES HERE</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG, WebP, GIF</p>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  />
                </div>
              )}

              {isUploading && (
                <div className="mt-4">
                  <Progress value={uploadProgress} className="mb-2" />
                  <p className="text-sm text-center">Processing images... {Math.round(uploadProgress)}%</p>
                </div>
              )}

              <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                {uploadedImages.map((img) => (
                  <div key={img.id} className="flex items-center gap-2 p-2 bg-gray-700 rounded">
                    <img src={img.thumbnail || "/placeholder.svg"} alt="" className="w-8 h-8 rounded-full" />
                    <span className="text-xs flex-1 truncate">{img.file.name}</span>
                    {gameState === "PRE_BATTLE" && (
                      <Button size="sm" variant="ghost" onClick={() => removeImage(img.id)} className="p-1 h-auto">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 text-sm text-gray-400">
                <p>Images loaded: {uploadedImages.length}/500</p>
                <p>
                  Arena size: {arenaSize.width}×{arenaSize.height}
                </p>
                <p>Entity size: ~{Math.round(entitySize)}px</p>
              </div>
            </Card>
          </div>

          {/* Center - Battle Arena */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-800 border-gray-700 p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Combat Arena
                </h3>

                <div className="flex gap-2">
                  {gameState === "PRE_BATTLE" && uploadedImages.length > 0 && (
                    <Button
                      onClick={startBattle}
                      className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 animate-pulse"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      INITIATE COMBAT ARENA
                    </Button>
                  )}

                  {(gameState === "BATTLE" || gameState === "PAUSED") && (
                    <>
                      <Button onClick={togglePause} variant="outline">
                        {gameState === "PAUSED" ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </Button>
                      <Button onClick={stopBattle} variant="destructive">
                        <Square className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={arenaSize.width}
                  height={arenaSize.height}
                  className="border border-gray-600 rounded-lg w-full max-w-full"
                  style={{ aspectRatio: `${arenaSize.width}/${arenaSize.height}` }}
                />

                {gameState === "ENDED" && winner && (
                  <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
                      <h2 className="text-3xl font-bold mb-2">VICTORY!</h2>
                      <img
                        src={winner.image.src || "/placeholder.svg"}
                        alt="Winner"
                        className="w-20 h-20 rounded-full mx-auto mb-2"
                      />
                      <p className="text-lg">Champion Entity</p>
                      <p className="text-sm text-gray-400">Total Damage Dealt: {Math.round(winner.totalDamage)}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Sidebar - Stats & Controls */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-gray-800 border-gray-700 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Battle Statistics
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Entities Alive:</span>
                  <Badge variant="outline" className="text-green-400 border-green-400">
                    {aliveEntities.length}
                  </Badge>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Entities Destroyed:</span>
                  <Badge variant="outline" className="text-red-400 border-red-400">
                    {battleStats.entitiesDestroyed}
                  </Badge>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Total Collisions:</span>
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                    {battleStats.totalCollisions}
                  </Badge>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Battle Time:</span>
                  <Badge variant="outline" className="text-blue-400 border-blue-400">
                    {Math.floor(battleStats.battleTime / 60)}s
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="bg-gray-800 border-gray-700 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Entity Status
              </h3>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {entities.slice(0, 10).map((entity) => (
                  <div key={entity.id} className={`p-2 rounded ${entity.isDestroyed ? "bg-red-900" : "bg-gray-700"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <img src={entity.image.src || "/placeholder.svg"} alt="" className="w-6 h-6 rounded-full" />
                      <span className="text-xs flex-1 truncate">Entity {entity.id.slice(-4)}</span>
                      {entity.hasBarrier && <Shield className="w-3 h-3 text-green-400" />}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span
                        className={
                          entity.health > 25
                            ? "text-green-400"
                            : entity.health > 10
                              ? "text-yellow-400"
                              : "text-red-400"
                        }
                      >
                        HP: {entity.health}/100
                      </span>
                      <span className="text-gray-400">DMG: {Math.round(entity.totalDamage)}</span>
                    </div>
                  </div>
                ))}

                {entities.length > 10 && (
                  <p className="text-xs text-gray-400 text-center">... and {entities.length - 10} more entities</p>
                )}
              </div>
            </Card>

            <Card className="bg-gray-800 border-gray-700 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Game Features
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Health Regeneration System</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>Defensive Barrier Protection</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Combo Damage Multipliers</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>Velocity-Based Damage</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                  <span>Professional Neon Effects</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
