import { Component, Suspense, useMemo, useRef } from "react";
import { Box3, Vector3 } from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, useGLTF } from "@react-three/drei";

const MODEL_URL = "/models/machine.glb";

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Missing / corrupt GLB — fall back to primitives.
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/** Improved sewing-machine silhouette from primitives (fallback). */
function PrimitiveMachine({ spinning = true }) {
  const group = useRef(null);

  useFrame((_, delta) => {
    if (spinning && group.current) {
      group.current.rotation.y += delta * 0.28;
    }
  });

  return (
    <group ref={group} position={[0, -0.2, 0]} scale={1.05}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[1.7, 0.2, 0.75]} />
        <meshStandardMaterial color="#1f2a28" metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[-0.5, 0.48, 0]} castShadow>
        <boxGeometry args={[0.38, 0.78, 0.48]} />
        <meshStandardMaterial color="#14403a" metalness={0.62} roughness={0.3} />
      </mesh>
      <mesh position={[0.18, 0.82, 0]} castShadow>
        <boxGeometry args={[1.2, 0.3, 0.42]} />
        <meshStandardMaterial color="#155048" metalness={0.66} roughness={0.26} />
      </mesh>
      <mesh position={[0.68, 0.52, 0]} castShadow>
        <boxGeometry args={[0.3, 0.48, 0.34]} />
        <meshStandardMaterial color="#0e2e2a" metalness={0.72} roughness={0.22} />
      </mesh>
      <mesh position={[0.68, 0.18, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.28, 8]} />
        <meshStandardMaterial color="#e8eef0" metalness={0.95} roughness={0.12} />
      </mesh>
      <mesh
        position={[-0.78, 0.58, 0.3]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.24, 0.24, 0.09, 28]} />
        <meshStandardMaterial color="#c0913f" metalness={0.92} roughness={0.18} />
      </mesh>
      <mesh position={[-0.18, 1.1, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.24, 12]} />
        <meshStandardMaterial color="#d8dee1" metalness={0.85} roughness={0.18} />
      </mesh>
      <mesh position={[-0.18, 1.26, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.14, 16]} />
        <meshStandardMaterial color="#17a78d" metalness={0.35} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Half-extent the model is normalised to, so framing is model-independent. */
const FIT_RADIUS = 0.9;

function GltfMachine({ spinning = true }) {
  const group = useRef(null);
  const { scene } = useGLTF(MODEL_URL);

  const object = useMemo(() => scene.clone(true), [scene]);

  // Normalise to a known size: the raw model is authored at arbitrary scale, so
  // a fixed camera would frame every model differently. Use the Y-rotation
  // sweep radius, not just the bounding box, so it never clips while spinning.
  const fit = useMemo(() => {
    const size = new Box3().setFromObject(object).getSize(new Vector3());
    const radius = Math.max(Math.hypot(size.x, size.z) / 2, size.y / 2);
    return radius > 0 ? FIT_RADIUS / radius : 1;
  }, [object]);

  useFrame((_, delta) => {
    if (spinning && group.current) {
      group.current.rotation.y += delta * 0.22;
    }
  });

  return (
    <group ref={group} scale={fit}>
      <Center>
        <primitive object={object} />
      </Center>
    </group>
  );
}

/**
 * Shared 3D machine visual for splash / chat / settings.
 * TODO: swap textures or lighting once a final production .glb is confirmed.
 * Loads /models/machine.glb when present; otherwise uses primitive silhouette.
 */
export default function MachineModel({
  size = "md",
  spinning = true,
  className = "",
}) {
  const height =
    size === "lg" ? "min(42dvh, 280px)" : size === "sm" ? "96px" : "128px";

  // Framed against the normalised FIT_RADIUS above, so these stay valid if the
  // model is ever swapped.
  const camera =
    size === "lg"
      ? { position: [1.55, 1.05, 2.15], fov: 38 }
      : { position: [1.45, 1.0, 2.0], fov: 42 };

  // While the real model streams in, render nothing rather than the primitive
  // stand-in — showing the wrong machine reads as a bug. The primitive is kept
  // strictly for the failure case.
  const content = (
    <ModelErrorBoundary fallback={<PrimitiveMachine spinning={spinning} />}>
      <Suspense fallback={null}>
        <GltfMachine spinning={spinning} />
      </Suspense>
    </ModelErrorBoundary>
  );

  return (
    <div className={`machine-stage ${className}`} style={{ height }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={camera}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 2]} intensity={1.3} />
        <directionalLight position={[-2, 1, -1]} intensity={0.4} />
        {/* Rim lights pick out the metal edges against the dark body. */}
        <pointLight position={[-2.5, 1.2, 1.8]} intensity={18} color="#3ad4b1" />
        <pointLight position={[2.4, 0.6, -1.6]} intensity={12} color="#d7b069" />
        {content}
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
