"use client"

import * as React from "react"
import type * as ThreeTypes from "three"

/**
 * The hero object: a map pin sitting inside pulsing geofence rings — the whole
 * product in one shape. three.js is imported on the client only, so it stays
 * out of the initial bundle; if it fails to load the caption stands in for it.
 */
export function TaskBeacon() {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let cleanup: (() => void) | undefined

    void (async () => {
      let THREE: typeof import("three")
      try {
        THREE = await import("three")
      } catch {
        if (!disposed) setFailed(true)
        return
      }
      if (disposed || !hostRef.current) return

      const width = host.clientWidth || 480
      const height = host.clientHeight || 480

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100)
      camera.position.set(0, 0.9, 7.4)
      camera.lookAt(0, 0.1, 0)

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height)
      renderer.domElement.style.cssText =
        "display:block;width:100%;height:100%;cursor:grab;touch-action:pan-y;"
      host.appendChild(renderer.domElement)

      scene.add(new THREE.HemisphereLight(0xeaf6f5, 0x3a3630, 0.85))
      const key = new THREE.DirectionalLight(0xffffff, 1.5)
      key.position.set(3.5, 5, 4)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0x64c2b9, 0.7)
      rim.position.set(-4, 1.5, -3)
      scene.add(rim)
      const warm = new THREE.PointLight(0xe89a1c, 12, 12)
      warm.position.set(-1.8, -1.4, 2.6)
      scene.add(warm)

      const teal = new THREE.MeshStandardMaterial({
        color: 0x0e7c7b,
        metalness: 0.3,
        roughness: 0.34,
      })
      const tealDeep = new THREE.MeshStandardMaterial({
        color: 0x094f4e,
        metalness: 0.35,
        roughness: 0.4,
      })
      const gold = new THREE.MeshStandardMaterial({
        color: 0xe89a1c,
        metalness: 0.45,
        roughness: 0.26,
        emissive: 0x7c4e07,
        emissiveIntensity: 0.35,
      })

      const group = new THREE.Group()

      const head = new THREE.Mesh(new THREE.SphereGeometry(1.02, 64, 44), teal)
      head.position.y = 1.28
      group.add(head)

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.98, 2, 64), tealDeep)
      tip.rotation.x = Math.PI
      tip.position.y = 0.34
      group.add(tip)

      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.66, 0.09, 20, 72),
        gold
      )
      collar.rotation.x = Math.PI / 2
      collar.position.y = 1.28
      group.add(collar)

      const coreDot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 36, 26), gold)
      coreDot.position.set(0, 1.28, 0.92)
      group.add(coreDot)

      const rings: ThreeTypes.Mesh<
        ThreeTypes.TorusGeometry,
        ThreeTypes.MeshStandardMaterial
      >[] = []
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.85 + i * 0.62, 0.022, 10, 140),
          new THREE.MeshStandardMaterial({
            color: i === 2 ? 0xe89a1c : 0x35a79c,
            transparent: true,
            opacity: 0.62 - i * 0.14,
            roughness: 0.5,
          })
        )
        ring.rotation.x = Math.PI / 2
        ring.position.y = -1.32
        group.add(ring)
        rings.push(ring)
      }

      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(3.2, 72),
        new THREE.MeshStandardMaterial({
          color: 0xcfedea,
          transparent: true,
          opacity: 0.16,
          roughness: 0.9,
        })
      )
      pad.rotation.x = -Math.PI / 2
      pad.position.y = -1.36
      group.add(pad)

      scene.add(group)

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      const motion = reduceMotion ? 0 : 1

      let dragX: number | null = null
      let spin = 0
      let spinVelocity = 0
      let scrollT = 0

      const canvas = renderer.domElement
      const onPointerDown = (event: PointerEvent) => {
        dragX = event.clientX
        canvas.style.cursor = "grabbing"
        canvas.setPointerCapture(event.pointerId)
      }
      const onPointerMove = (event: PointerEvent) => {
        if (dragX === null) return
        spinVelocity += (event.clientX - dragX) * 0.0022
        dragX = event.clientX
      }
      const onPointerUp = () => {
        dragX = null
        canvas.style.cursor = "grab"
      }
      canvas.addEventListener("pointerdown", onPointerDown)
      canvas.addEventListener("pointermove", onPointerMove)
      canvas.addEventListener("pointerup", onPointerUp)
      canvas.addEventListener("pointercancel", onPointerUp)

      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        scrollT = max > 0 ? window.scrollY / max : 0
      }
      onScroll()
      window.addEventListener("scroll", onScroll, { passive: true })

      const resizeObserver = new ResizeObserver(() => {
        const w = host.clientWidth
        const h = host.clientHeight
        if (!w || !h) return
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      })
      resizeObserver.observe(host)

      const clock = new THREE.Clock()
      let frame = 0

      const tick = () => {
        const t = clock.getElapsedTime()

        spinVelocity *= 0.94
        spin += spinVelocity + 0.0038 * motion
        group.rotation.y = spin
        group.rotation.x = Math.sin(t * 0.4) * 0.06 * motion + scrollT * 0.5
        group.position.y = Math.sin(t * 0.85) * 0.12 * motion

        rings.forEach((ring, i) => {
          const phase = (t * 0.42 * motion + i * 0.33) % 1
          const scale = 0.55 + phase * 0.9
          ring.scale.set(scale, scale, 1)
          ring.material.opacity = (1 - phase) * (0.6 - i * 0.1)
        })

        renderer.render(scene, camera)
        frame = requestAnimationFrame(tick)
      }
      tick()

      cleanup = () => {
        cancelAnimationFrame(frame)
        resizeObserver.disconnect()
        window.removeEventListener("scroll", onScroll)
        canvas.removeEventListener("pointerdown", onPointerDown)
        canvas.removeEventListener("pointermove", onPointerMove)
        canvas.removeEventListener("pointerup", onPointerUp)
        canvas.removeEventListener("pointercancel", onPointerUp)
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose()
            const material = object.material
            if (Array.isArray(material)) material.forEach((m) => m.dispose())
            else material.dispose()
          }
        })
        renderer.dispose()
        canvas.remove()
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [])

  return (
    <div className="relative flex h-[66vh] min-h-[440px] items-center justify-center">
      <div ref={hostRef} className="absolute inset-0" />
      {failed ? (
        <div className="border-n-300 text-n-400 absolute inset-[12%] flex items-center justify-center rounded-full border border-dashed p-5 text-center font-mono text-[11px]">
          3d beacon — needs network for three.js
        </div>
      ) : null}
      <div className="text-n-400 absolute inset-x-0 bottom-1.5 text-center font-mono text-[11px] tracking-[0.06em]">
        TASK BEACON · GEOFENCE RINGS · DRAG TO SPIN
      </div>
    </div>
  )
}
