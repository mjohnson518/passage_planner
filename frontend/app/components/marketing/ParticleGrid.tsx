'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  originX: number
  originY: number
  x: number
  y: number
  vx: number
  vy: number
}

const SPACING = 40
const RADIUS = 70
const DOT_RADIUS = 1.5
const DOT_COLOR = 'rgba(0, 242, 195, 0.2)'
const SPRING = 0.08
const DAMPING = 0.75
const REPEL_STRENGTH = 120

export function ParticleGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const rafRef = useRef<number>(0)
  const reducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function buildGrid() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width || window.innerWidth
      canvas.height = rect.height || window.innerHeight
      particlesRef.current = []
      const cols = Math.ceil(canvas.width / SPACING) + 1
      const rows = Math.ceil(canvas.height / SPACING) + 1
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * SPACING
          const y = r * SPACING
          particlesRef.current.push({ originX: x, originY: y, x, y, vx: 0, vy: 0 })
        }
      }
    }

    function draw() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const { x: mx, y: my } = mouseRef.current
      for (const p of particlesRef.current) {
        if (!reducedMotion) {
          const dx = p.x - mx
          const dy = p.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < RADIUS && dist > 0) {
            const force = (RADIUS - dist) / RADIUS
            p.vx += (dx / dist) * force * REPEL_STRENGTH * 0.015
            p.vy += (dy / dist) * force * REPEL_STRENGTH * 0.015
          }
          // Spring back to origin
          p.vx += (p.originX - p.x) * SPRING
          p.vy += (p.originY - p.y) * SPRING
          // Damping
          p.vx *= DAMPING
          p.vy *= DAMPING
          p.x += p.vx
          p.y += p.vy
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = DOT_COLOR
        ctx.fill()
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    buildGrid()
    rafRef.current = requestAnimationFrame(draw)

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onResize = () => {
      buildGrid()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
    }
  }, [reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
