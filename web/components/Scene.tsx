"use client";
// 3D scene: Mars and Earth side by side, score overlay, haze frames, site/twin markers and the thread.
// Written with SI assistance (Claude).
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { PresentationControls, QuadraticBezierLine, Stars } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type Marker = { key: string; lat: number; lon: number; active: boolean; onClick: () => void };
type LL = { lat: number; lon: number };

const rad = THREE.MathUtils.degToRad;

/** lat / east-lon -> point on a three.js sphere carrying an equirectangular texture. */
function ll2v(lat: number, lon: number, r: number) {
  const phi = rad(90 - lat), theta = rad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function useTex(url: string, srgb = true) {
  const t = useLoader(THREE.TextureLoader, url);
  useMemo(() => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  }, [t, srgb]);
  return t;
}

function Overlay({ url, r, additive = true }: { url: string; r: number; additive?: boolean }) {
  const t = useTex(url);
  return (
    <mesh>
      <sphereGeometry args={[r, 96, 48]} />
      <meshBasicMaterial map={t} transparent depthWrite={false} blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </mesh>
  );
}

/** One frame of a 12-column atlas. */
function Haze({ url, r, frame, opacity }: { url: string; r: number; frame: number; opacity: number }) {
  const base = useTex(url);
  const t = useMemo(() => {
    const c = base.clone();
    c.repeat.set(1 / 12, 1);
    c.wrapS = THREE.ClampToEdgeWrapping;
    c.needsUpdate = true;
    return c;
  }, [base]);
  useEffect(() => { t.offset.x = frame / 12; }, [t, frame]);
  return (
    <mesh>
      <sphereGeometry args={[r, 96, 48]} />
      <meshBasicMaterial map={t} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function Glow({ r, color }: { r: number; color: string }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { c: { value: new THREE.Color(color) } },
    vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 c; varying vec3 n; void main(){ float i = pow(max(0.0, 0.62 - dot(n, vec3(0.,0.,1.))), 4.0); gl_FragColor = vec4(c, 1.0) * i * 0.9; }",
  }), [color]);
  return <mesh scale={1.14} material={mat}><sphereGeometry args={[r, 48, 24]} /></mesh>;
}

function Pin({ m, r, color, register }: { m: Marker; r: number; color: string; register: (k: string, o: THREE.Object3D | null) => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => ll2v(m.lat, m.lon, r * 1.012), [m.lat, m.lon, r]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()), [pos]);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    void clock;
    ring.current.scale.setScalar(m.active ? 1.25 : 1);
  });
  return (
    <group position={pos} quaternion={quat} ref={(o) => register(m.key, o)}>
      <mesh
        onClick={(e) => { e.stopPropagation(); m.onClick(); }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <circleGeometry args={[r * 0.07, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh><circleGeometry args={[r * (m.active ? 0.022 : 0.014), 20]} /><meshBasicMaterial color={m.active ? "#ffffff" : color} /></mesh>
      <mesh ref={ring}>
        <ringGeometry args={[r * 0.034, r * 0.042, 40]} />
        <meshBasicMaterial color={color} transparent opacity={m.active ? 0.95 : 0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Globe(props: {
  tex: string; position: [number, number, number]; r: number; face: LL | null; glow: string; pin: string;
  markers: Marker[]; overlay?: string | null; additive?: boolean; haze: string; hazeFrame: number; hazeOpacity: number;
  register: (k: string, o: THREE.Object3D | null) => void; still: boolean;
}) {
  const map = useTex(props.tex);
  const tilt = useRef<THREE.Group>(null), spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!tilt.current || !spin.current) return;
    const k = props.still ? 1 : Math.min(1, dt * 2.6);
    if (props.face) {
      // bring (lat, lon) to face the camera: spin about Y, then tilt about X
      const ty = -rad(props.face.lon + 90), tx = rad(props.face.lat);
      let dy = (ty - spin.current.rotation.y) % (Math.PI * 2);
      if (dy > Math.PI) dy -= Math.PI * 2;
      if (dy < -Math.PI) dy += Math.PI * 2;
      spin.current.rotation.y += dy * k;
      tilt.current.rotation.x += (tx - tilt.current.rotation.x) * k;
    } else if (!props.still) {
      spin.current.rotation.y += dt * 0.06;
      tilt.current.rotation.x += (0.15 - tilt.current.rotation.x) * k;
    }
  });
  return (
    <group position={props.position}>
      <PresentationControls global={false} snap speed={1.4} polar={[-0.5, 0.5]} azimuth={[-Infinity, Infinity]}>
        <group ref={tilt}>
          <group ref={spin}>
            <mesh>
              <sphereGeometry args={[props.r, 96, 48]} />
              <meshStandardMaterial map={map} roughness={1} metalness={0} />
            </mesh>
            <Haze url={props.haze} r={props.r * 1.004} frame={props.hazeFrame} opacity={props.hazeOpacity} />
            {props.overlay && <Suspense fallback={null}><Overlay key={props.overlay} url={props.overlay} r={props.r * 1.008} additive={props.additive} /></Suspense>}
            {props.markers.map((m) => <Pin key={m.key} m={m} r={props.r} color={props.pin} register={props.register} />)}
          </group>
        </group>
      </PresentationControls>
    </group>
  );
}

/** The thread: an arc from the active Mars site to the active Earth twin, following both as they turn. */
function Thread({ get, from, to }: { get: (k: string) => THREE.Object3D | undefined; from: string | null; to: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const line = useRef<any>(null);
  const a = useMemo(() => new THREE.Vector3(), []), b = useMemo(() => new THREE.Vector3(), []), mid = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const A = from && get(from), B = to && get(to);
    if (!line.current) return;
    line.current.visible = !!(A && B);
    if (!A || !B) return;
    A.getWorldPosition(a); B.getWorldPosition(b);
    mid.copy(a).add(b).multiplyScalar(0.5); mid.z += 1.1; mid.y += 0.5;
    line.current.setPoints(a, b, mid);
    line.current.computeLineDistances?.();   // dashes need fresh distances after the points move
    line.current.material.dashOffset = -clock.elapsedTime * 0.6;
  });
  return <QuadraticBezierLine ref={line} start={[0, 0, 0]} end={[0, 0, 0]} color="#e6c07a" lineWidth={1.5} dashed dashScale={6} dashSize={0.6} gapSize={0.35} transparent opacity={0.9} />;
}

function Rig({ children }: { children: (l: { mars: [number, number, number]; earth: [number, number, number]; r: number }) => React.ReactNode }) {
  const { viewport, size } = useThree();
  const wide = size.width >= 520;
  // the canvas is its own column: two globes side by side, lifted a little to clear the month strip
  // narrower columns (a 1280px laptop leaves about 600px) need smaller globes, or the Earth slides under the sidebar
  const r = Math.min(viewport.width * (!wide ? 0.225 : size.width < 760 ? 0.19 : 0.215), viewport.height * (wide ? 0.27 : 0.34));
  const d = r * 1.16, y = wide ? viewport.height * 0.045 : 0;
  return <>{children({ mars: [-d, y, 0], earth: [d, y, 0], r })}</>;
}

export default function Scene(props: {
  marsMarkers: Marker[]; earthMarkers: Marker[]; marsFace: LL | null; earthFace: LL | null;
  overlay: string | null; marsOverlay?: string | null; additive?: boolean; marsFrame: number; earthFrame: number; showHaze: boolean;
  threadFrom: string | null; threadTo: string | null; reducedMotion: boolean;
}) {
  const refs = useRef(new Map<string, THREE.Object3D>());
  const register = (k: string, o: THREE.Object3D | null) => { if (o) refs.current.set(k, o); else refs.current.delete(k); };
  return (
    <Canvas camera={{ fov: 35, position: [0, 0, 9] }} dpr={[1, 2]} gl={{ antialias: true }} resize={{ scroll: false }}>
      <ambientLight intensity={1.15} />
      <directionalLight position={[2, 3, 6]} intensity={1.6} />
      <Stars radius={60} depth={40} count={1400} factor={2.4} fade speed={0} />
      <Suspense fallback={null}>
        <Rig>
          {(l) => (
            <>
              <Globe tex="/tex/mars.jpg" position={l.mars} r={l.r} face={props.marsFace} glow="#000" pin="#efe9df"
                markers={props.marsMarkers} overlay={props.marsOverlay} additive={false} haze="/data/haze_mars.png" hazeFrame={props.marsFrame} hazeOpacity={props.showHaze ? 0.85 : 0}
                register={register} still={props.reducedMotion} />
              <Globe tex="/tex/earth.jpg" position={l.earth} r={l.r} face={props.earthFace} glow="#000" pin="#e6c07a"
                markers={props.earthMarkers} overlay={props.overlay} additive={props.additive} haze="/data/haze_earth.png" hazeFrame={props.earthFrame}
                hazeOpacity={props.showHaze ? 0.9 : 0} register={register} still={props.reducedMotion} />
            </>
          )}
        </Rig>
        <Thread get={(k) => refs.current.get(k)} from={props.threadFrom} to={props.threadTo} />
      </Suspense>
    </Canvas>
  );
}
