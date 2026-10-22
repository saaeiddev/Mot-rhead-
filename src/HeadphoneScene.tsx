import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

function Headset() {
  const [angle, setAngle] = useState(-0.28)
  const [dragging, setDragging] = useState(false)
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (dragging) setAngle(previous => Math.max(-0.75, Math.min(0.75, previous + event.movementX * 0.007)))
  }
  return (
    <group rotation={[0.08, angle, -0.12]} scale={1.15} onPointerDown={event => { setDragging(true); event.target.setPointerCapture(event.pointerId) }} onPointerUp={event => { setDragging(false); event.target.releasePointerCapture(event.pointerId) }} onPointerMove={move}>
      <mesh position={[0, 0.25, 0]}>
        <torusGeometry args={[1.12, 0.14, 16, 72, Math.PI]} />
        <meshPhysicalMaterial color="#111111" roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.27, 0.09]}>
        <torusGeometry args={[1.06, 0.075, 12, 72, Math.PI]} />
        <meshStandardMaterial color="#404040" roughness={0.78} />
      </mesh>
      {([-1, 1] as const).map(side => (
        <group key={side} position={[side * 1.06, -0.5, 0]}>
          <mesh position={[side * 0.025, 0.44, 0]}>
            <capsuleGeometry args={[0.105, 0.5, 5, 14]} />
            <meshStandardMaterial color="#393939" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.1, 0]} scale={[0.66, 1.07, 0.48]}>
            <sphereGeometry args={[0.52, 36, 24]} />
            <meshPhysicalMaterial color="#181818" roughness={0.32} metalness={0.42} clearcoat={0.7} />
          </mesh>
          <mesh position={[0, -0.1, 0.24]} scale={[0.57, 0.98, 0.16]}>
            <sphereGeometry args={[0.52, 30, 24]} />
            <meshStandardMaterial color="#101010" metalness={0.7} roughness={0.28} />
          </mesh>
          <mesh position={[0, -0.1, 0.37]} scale={[0.43, 0.8, 0.095]}>
            <sphereGeometry args={[0.52, 30, 24]} />
            <meshStandardMaterial color="#242424" roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.1, 0.41]} scale={[0.37, 0.72, 0.04]}>
            <sphereGeometry args={[0.52, 30, 24]} />
            <meshStandardMaterial color="#090909" roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.09, -0.13]} scale={[0.52, 0.9, 0.27]}>
            <sphereGeometry args={[0.53, 28, 22]} />
            <meshStandardMaterial color="#242424" roughness={0.62} metalness={0.12} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
export default function HeadphoneScene() {
  return <div className="headphone-scene" aria-label="Interactive 3D black headphones; drag to rotate">
    <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0.3, 5.2], fov: 43 }} gl={{ antialias: true, alpha: true }} fallback={<p>3D preview unavailable in this browser.</p>}>
      <ambientLight intensity={2.0} />
      <directionalLight position={[-2, 3, 5]} intensity={2.8} />
      <directionalLight position={[4, -1, -3]} intensity={3.5} />
      <pointLight position={[0, 0, 4]} intensity={2.1} />
      <Headset />
    </Canvas>
  </div>
}
