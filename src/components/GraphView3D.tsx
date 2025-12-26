import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Note } from "../types/note";

type Node3D = {
  id: string;
  label: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  links: string[];
};

type Link3D = {
  source: string;
  target: string;
};

function extractWikiLinks(content: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    const raw = (match[1] ?? "").trim();
    if (!raw) continue;
    const title = raw.split("|")[0]?.trim() ?? "";
    if (title) out.push(title);
  }
  return out;
}

function ForceGraph3D({
  nodes,
  links,
  onNodeClick,
}: {
  nodes: Node3D[];
  links: Link3D[];
  onNodeClick: (nodeId: string) => void;
}) {
  const nodeRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const [paused, setPaused] = useState(false);

  useFrame(() => {
    if (paused || nodes.length === 0) return;

    const nodeMap = new Map<string, Node3D>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    // Physics simulation
    const alpha = 0.02;
    const repulsionStrength = 100;
    const attractionStrength = 0.1;
    const damping = 0.8;
    const centerStrength = 0.01;

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dz = b.position.z - a.position.z;
        const distSq = dx * dx + dy * dy + dz * dz + 0.01;
        const dist = Math.sqrt(distSq);
        const force = repulsionStrength / distSq;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;

        a.velocity.x -= fx * alpha;
        a.velocity.y -= fy * alpha;
        a.velocity.z -= fz * alpha;
        b.velocity.x += fx * alpha;
        b.velocity.y += fy * alpha;
        b.velocity.z += fz * alpha;
      }
    }

    // Attraction along links
    links.forEach((link) => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return;

      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      const dz = target.position.z - source.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz + 0.01);

      const force = (dist - 5) * attractionStrength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;

      source.velocity.x += fx * alpha;
      source.velocity.y += fy * alpha;
      source.velocity.z += fz * alpha;
      target.velocity.x -= fx * alpha;
      target.velocity.y -= fy * alpha;
      target.velocity.z -= fz * alpha;
    });

    // Center gravity
    nodes.forEach((n) => {
      n.velocity.x -= n.position.x * centerStrength;
      n.velocity.y -= n.position.y * centerStrength;
      n.velocity.z -= n.position.z * centerStrength;
    });

    // Apply velocity with damping
    nodes.forEach((n) => {
      n.position.x += n.velocity.x;
      n.position.y += n.velocity.y;
      n.position.z += n.velocity.z;
      n.velocity.multiplyScalar(damping);

      const mesh = nodeRefs.current.get(n.id);
      if (mesh) {
        mesh.position.copy(n.position);
      }
    });
  });

  return (
    <>
      {/* @ts-expect-error - Three.js JSX elements */}
      <ambientLight intensity={0.4} />
      {/* @ts-expect-error - Three.js JSX elements */}
      <pointLight position={[10, 10, 10]} intensity={1} />

      {/* Links */}
      {links.map((link, idx) => {
        const source = nodes.find((n) => n.id === link.source);
        const target = nodes.find((n) => n.id === link.target);
        if (!source || !target) return null;

        const start = source.position;
        const end = target.position;
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const distance = start.distanceTo(end);

        return (
          /* @ts-expect-error - Three.js JSX elements */
          <mesh key={idx} position={mid}>
            {/* @ts-expect-error - Three.js JSX elements */}
            <cylinderGeometry args={[0.02, 0.02, distance, 8]} />
            {/* @ts-expect-error - Three.js JSX elements */}
            <meshStandardMaterial color="#888888" opacity={0.4} transparent />
            {/* @ts-expect-error - Three.js JSX elements */}
          </mesh>
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => (
        /* @ts-expect-error - Three.js JSX elements */
        <group key={node.id}>
          {/* @ts-expect-error - Three.js JSX elements */}
          <mesh
            ref={(ref: THREE.Mesh | null) => {
              if (ref) nodeRefs.current.set(node.id, ref);
            }}
            position={node.position}
            onClick={() => {
              setPaused(true);
              onNodeClick(node.id);
              setTimeout(() => setPaused(false), 1000);
            }}
          >
            {/* @ts-expect-error - Three.js JSX elements */}
            <sphereGeometry args={[0.3, 16, 16]} />
            {/* @ts-expect-error - Three.js JSX elements */}
            <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.3} />
            {/* @ts-expect-error - Three.js JSX elements */}
          </mesh>
          <Text
            position={[node.position.x, node.position.y + 0.5, node.position.z]}
            fontSize={0.3}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {node.label}
          </Text>
          {/* @ts-expect-error - Three.js JSX elements */}
        </group>
      ))}

      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  );
}

export function GraphView3D({ notes, onOpenNote }: { notes: Note[]; onOpenNote: (noteId: string) => void }) {
  const { nodes, links } = useMemo(() => {
    const titleToId = new Map<string, string>();
    for (const n of notes) {
      const title = (n.title ?? "").trim();
      if (!title) continue;
      titleToId.set(title.toLowerCase(), n.id);
    }

    const nodeList: Node3D[] = notes.map((n) => ({
      id: n.id,
      label: (n.title || "Untitled").slice(0, 20),
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      ),
      velocity: new THREE.Vector3(0, 0, 0),
      links: extractWikiLinks(n.content ?? "")
        .map((t) => titleToId.get(t.toLowerCase()))
        .filter((id): id is string => Boolean(id)),
    }));

    const linkList: Link3D[] = [];
    for (const n of nodeList) {
      for (const targetId of n.links) {
        if (targetId !== n.id) {
          linkList.push({ source: n.id, target: targetId });
        }
      }
    }

    return { nodes: nodeList, links: linkList };
  }, [notes]);

  if (notes.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-gray-500 dark-amoled:text-gray-400">
        No notes to visualize yet.
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gradient-to-br from-gray-50 to-gray-100 dark-amoled:from-black dark-amoled:to-gray-950">
      <Canvas camera={{ position: [0, 0, 20], fov: 75 }}>
        <ForceGraph3D nodes={nodes} links={links} onNodeClick={onOpenNote} />
      </Canvas>
    </div>
  );
}
