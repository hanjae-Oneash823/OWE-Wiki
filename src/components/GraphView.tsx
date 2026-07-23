import { useEffect, useMemo, useRef, useState } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { GraphEdge, GraphNode } from '../lib/wikilinks';

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  domains: readonly string[];
}

interface SimNode extends GraphNode, SimulationNodeDatum {}
interface SimLink extends SimulationLinkDatum<SimNode> {
  cross: boolean;
}

const WIDTH = 900;
const HEIGHT = 640;
const SETTLE_TICKS = 300;
const MIN_RADIUS = 6;
const MAX_RADIUS = 18;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

function domainAnchor(index: number, total: number): { x: number; y: number } {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = Math.min(WIDTH, HEIGHT) * 0.28;
  return { x: WIDTH / 2 + radius * Math.cos(angle), y: HEIGHT / 2 + radius * Math.sin(angle) };
}

function radiusFor(backlinkCount: number): number {
  return Math.min(MAX_RADIUS, MIN_RADIUS + Math.sqrt(backlinkCount) * 5);
}

// forceLink resolves string source/target ids to node objects as soon as the force
// is attached to the simulation, so by render time these are always SimNode refs.
function endpoint(value: string | number | SimNode): SimNode {
  return value as SimNode;
}

export default function GraphView({ nodes, edges, domains }: GraphViewProps) {
  const [laidOutNodes, setLaidOutNodes] = useState<SimNode[] | null>(null);
  const [laidOutEdges, setLaidOutEdges] = useState<SimLink[] | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const anchors = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    domains.forEach((domain, index) => map.set(domain, domainAnchor(index, domains.length)));
    return map;
  }, [domains]);

  useEffect(() => {
    const simNodes: SimNode[] = nodes.map((node, index) => {
      const anchor = anchors.get(node.domain) ?? { x: WIDTH / 2, y: HEIGHT / 2 };
      const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
      return { ...node, x: anchor.x + Math.cos(angle) * 20, y: anchor.y + Math.sin(angle) * 20 };
    });
    const simLinks: SimLink[] = edges.map((edge) => ({ source: edge.source, target: edge.target, cross: edge.cross }));

    const simulation = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((link) => (link.cross ? 160 : 70))
          .strength((link) => (link.cross ? 0.1 : 0.5)),
      )
      .force('charge', forceManyBody().strength(-140))
      .force('collide', forceCollide<SimNode>().radius((d) => radiusFor(d.backlinkCount) + 6))
      .force('x', forceX<SimNode>((d) => anchors.get(d.domain)?.x ?? WIDTH / 2).strength(0.12))
      .force('y', forceY<SimNode>((d) => anchors.get(d.domain)?.y ?? HEIGHT / 2).strength(0.12))
      .stop();

    for (let i = 0; i < SETTLE_TICKS; i += 1) simulation.tick();

    setLaidOutNodes(simNodes);
    setLaidOutEdges(simLinks);
  }, [nodes, edges, anchors]);

  function handleWheel(event: React.WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({ ...t, scale: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.scale * factor)) }));
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>): void {
    dragState.current = { startX: event.clientX, startY: event.clientY, originX: transform.x, originY: transform.y };
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>): void {
    if (!dragState.current) return;
    const { startX, startY, originX, originY } = dragState.current;
    setTransform((t) => ({ ...t, x: originX + (event.clientX - startX), y: originY + (event.clientY - startY) }));
  }

  function stopDragging(): void {
    dragState.current = null;
  }

  if (!laidOutNodes || !laidOutEdges) {
    return <p className="graph-view-status">Laying out graph…</p>;
  }

  const neighborIds = hoveredId
    ? new Set(
        laidOutEdges.flatMap((edge) => {
          const source = endpoint(edge.source).id;
          const target = endpoint(edge.target).id;
          return source === hoveredId || target === hoveredId ? [source, target] : [];
        }),
      )
    : null;

  return (
    <div className="graph-view">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Knowledge graph of all notes, clustered by domain"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          {laidOutEdges.map((edge, index) => {
            const source = endpoint(edge.source);
            const target = endpoint(edge.target);
            const dimmed = neighborIds ? !(neighborIds.has(source.id) && neighborIds.has(target.id)) : false;
            return (
              <line
                key={index}
                x1={source.x ?? 0}
                y1={source.y ?? 0}
                x2={target.x ?? 0}
                y2={target.y ?? 0}
                className={`graph-edge${edge.cross ? ' graph-edge--cross' : ''}`}
                opacity={dimmed ? 0.12 : 1}
              />
            );
          })}

          {laidOutNodes.map((node) => {
            const dimmed = neighborIds ? !neighborIds.has(node.id) && node.id !== hoveredId : false;
            const radius = radiusFor(node.backlinkCount);
            return (
              <a
                key={node.id}
                href={node.href}
                className="graph-node"
                opacity={dimmed ? 0.25 : 1}
                onPointerEnter={() => setHoveredId(node.id)}
                onPointerLeave={() => setHoveredId(null)}
              >
                <circle cx={node.x ?? 0} cy={node.y ?? 0} r={radius} style={{ fill: `var(--domain-${node.domain})` }} />
                <text x={node.x ?? 0} y={(node.y ?? 0) + radius + 12} textAnchor="middle" className="graph-node__label">
                  {node.title}
                </text>
              </a>
            );
          })}
        </g>
      </svg>
      <p className="graph-hint">Scroll to zoom, drag to pan, hover a note to trace its links.</p>
    </div>
  );
}
