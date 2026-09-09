import React from 'react';
import type { ProcessMappingEdge, ProcessMappingNode } from '@/types/processMapping';
import { calculateEdgePath } from './canvasGeometry';

interface ProcessMappingEdgeLineProps {
  edge: ProcessMappingEdge;
  sourceNode: ProcessMappingNode;
  targetNode: ProcessMappingNode;
  isSelected: boolean;
  onSelect: (edge: ProcessMappingEdge) => void;
  onEditLabel: (edge: ProcessMappingEdge) => void;
}

export const ProcessMappingEdgeLine: React.FC<ProcessMappingEdgeLineProps> = ({
  edge,
  sourceNode,
  targetNode,
  isSelected,
  onSelect,
  onEditLabel,
}) => {
  const { path, labelPoint } = calculateEdgePath(sourceNode, targetNode, edge);

  return (
    <g className="connector-group cursor-pointer select-none group" onClick={() => onSelect(edge)}>
      {/* Invisible wider stroke for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="16"
        className="cursor-pointer"
      />

      {/* Visible stepped orthogonal line */}
      <path
        d={path}
        fill="none"
        stroke={isSelected ? '#2563eb' : edge.style === 'dashed' ? '#7c3aed' : '#64748b'}
        strokeWidth={isSelected ? '2.5' : '1.75'}
        strokeDasharray={edge.style === 'dashed' ? '6,5' : 'none'}
        markerEnd={isSelected ? 'url(#mapping-arrow-selected)' : 'url(#mapping-arrow)'}
        className="transition-colors group-hover:stroke-blue-500"
      />

      {/* Edge Branch Label */}
      {edge.label && (
        <g
          transform={`translate(${labelPoint.x}, ${labelPoint.y})`}
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onEditLabel(edge);
          }}
        >
          {/* Background Pill */}
          <rect
            x={-(edge.label.length * 3.4 + 12)}
            y="-10"
            width={edge.label.length * 6.8 + 24}
            height="20"
            rx="10"
            fill="#ffffff"
            stroke={isSelected ? '#2563eb' : '#cbd5e1'}
            strokeWidth="1.2"
            className="filter drop-shadow-xs group-hover:stroke-blue-400"
          />
          {/* Text */}
          <text
            x="0"
            y="4"
            textAnchor="middle"
            className="text-[10px] font-semibold fill-slate-700 pointer-events-none"
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
};
