import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { Note } from "../types/note";

type GraphNode = SimulationNodeDatum & {
  id: string;
  label: string;
};

type GraphLink = SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode;
  target: string | GraphNode;
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

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const cr = entry.contentRect;
      setSize({ width: cr.width, height: cr.height });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ...size };
}

export function GraphView({
  notes,
  onOpenNote,
}: {
  notes: Note[];
  onOpenNote: (noteId: string) => void;
}) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  const { nodes, links } = useMemo(() => {
    const titleToId = new Map<string, string>();
    for (const n of notes) {
      const title = (n.title ?? "").trim();
      if (!title) continue;
      titleToId.set(title.toLowerCase(), n.id);
    }

    const nodeById = new Map<string, GraphNode>();
    for (const n of notes) {
      nodeById.set(n.id, { id: n.id, label: (n.title || "Untitled").trim() || "Untitled" });
    }

    const edges: GraphLink[] = [];
    for (const n of notes) {
      const targets = extractWikiLinks(n.content ?? "");
      for (const t of targets) {
        const targetId = titleToId.get(t.toLowerCase());
        if (!targetId) continue;
        if (targetId === n.id) continue;
        edges.push({ source: n.id, target: targetId });
      }
    }

    return { nodes: Array.from(nodeById.values()), links: edges };
  }, [notes]);

  const [layout, setLayout] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    if (nodes.length === 0) {
      setLayout({ nodes: [], links: [] });
      return;
    }

    const simNodes: GraphNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: GraphLink[] = links.map((l) => ({ ...l }));

    const linkForce = forceLink<GraphNode, GraphLink>(simLinks)
      .id((d: GraphNode) => d.id)
      .distance(90)
      .strength(0.5);

    const sim = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(width / 2, height / 2))
      .force("link", linkForce)
      .force("collide", forceCollide(18));

    const tick = () => {
      setLayout({ nodes: simNodes, links: simLinks });
      rafRef.current = window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      sim.stop();
    };
  }, [height, links, nodes, width]);

  return (
    <div ref={ref} className="h-full w-full overflow-hidden">
      {nodes.length === 0 ? (
        <div className="h-full w-full flex items-center justify-center text-sm text-gray-500 dark-amoled:text-gray-400">
          No notes to graph yet.
        </div>
      ) : (
        <svg width={width} height={height} className="block">
          <g>
            {layout.links.map((l, idx) => {
              const s = typeof l.source === "string" ? layout.nodes.find((n) => n.id === l.source) : l.source;
              const t = typeof l.target === "string" ? layout.nodes.find((n) => n.id === l.target) : l.target;
              if (!s || !t) return null;
              return (
                <line
                  key={idx}
                  x1={s.x ?? 0}
                  y1={s.y ?? 0}
                  x2={t.x ?? 0}
                  y2={t.y ?? 0}
                  className="stroke-gray-300 dark-amoled:stroke-gray-800"
                  strokeWidth={1}
                  opacity={0.7}
                />
              );
            })}
          </g>

          <g>
            {layout.nodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                className="cursor-pointer"
                onClick={() => onOpenNote(n.id)}
              >
                <circle r={10} className="fill-blue-500" opacity={0.85} />
                <text
                  x={14}
                  y={4}
                  className="select-none fill-gray-700 dark-amoled:fill-gray-200"
                  fontSize={12}
                >
                  {n.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}
