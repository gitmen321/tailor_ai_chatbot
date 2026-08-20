import { Component, Suspense, useEffect, useRef, useState } from "react";
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
        <meshStandardMaterial color="#5a6570" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[-0.5, 0.48, 0]} castShadow>
        <boxGeometry args={[0.38, 0.78, 0.48]} />
        <meshStandardMaterial color="#66727c" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.18, 0.82, 0]} castShadow>
        <boxGeometry args={[1.2, 0.3, 0.42]} />
        <meshStandardMaterial color="#74818b" metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh position={[0.68, 0.52, 0]} castShadow>
        <boxGeometry args={[0.3, 0.48, 0.34]} />
        <meshStandardMaterial color="#3f4852" metalness={0.6} roughness={0.28} />
      </mesh>
      <mesh position={[0.68, 0.18, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.28, 8]} />
        <meshStandardMaterial color="#c9d0d6" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh
        position={[-0.78, 0.58, 0.3]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.24, 0.24, 0.09, 28]} />
        <meshStandardMaterial color="#d5dce2" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.18, 1.1, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.24, 12]} />
        <meshStandardMaterial color="#d0d6dc" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[-0.18, 1.26, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.14, 16]} />
        <meshStandardMaterial color="#0F6B5C" metalness={0.2} roughness={0.5} />
      </mesh>
    </group>
  );
}

function GltfMachine({ spinning = true }) {
  const group = useRef(null);
  const { scene } = useGLTF(MODEL_URL);

  useFrame((_, delta) => {
    if (spinning && group.current) {
      group.current.rotation.y += delta * 0.22;
    }
  });

  return (
    <group ref={group}>
      <Center>
        <primitive object={scene.clone()} scale={1} />
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
  const [useGltf, setUseGltf] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(MODEL_URL, { method: "HEAD" });
        if (!cancelled) {
          setUseGltf(res.ok);
          if (res.ok) {
            try {
              useGLTF.preload(MODEL_URL);
            } catch {
              // ignore preload errors
            }
          }
        }
      } catch {
        if (!cancelled) setUseGltf(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const height =
    size === "lg" ? "min(42dvh, 280px)" : size === "sm" ? "96px" : "128px";

  const camera =
    size === "lg"
      ? { position: [2.2, 1.6, 3.0], fov: 38 }
      : { position: [1.9, 1.4, 2.6], fov: 42 };

  const content =
    useGltf === null ? (
      <PrimitiveMachine spinning={spinning} />
    ) : useGltf ? (
      <ModelErrorBoundary fallback={<PrimitiveMachine spinning={spinning} />}>
        <Suspense fallback={<PrimitiveMachine spinning={spinning} />}>
          <GltfMachine spinning={spinning} />
        </Suspense>
      </ModelErrorBoundary>
    ) : (
      <PrimitiveMachine spinning={spinning} />
    );

  return (
    <div className={`machine-stage ${className}`} style={{ height }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={camera}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 2]} intensity={1.15} />
        <directionalLight position={[-2, 1, -1]} intensity={0.35} />
        {content}
      </Canvas>
    </div>
  );
}

// Optional preload is handled after HEAD check inside the component.
