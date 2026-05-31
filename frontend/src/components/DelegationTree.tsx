'use client';

interface TreeNode {
  label: string;
  sub?: string;
  address?: string;
  tint: 'violet' | 'teal' | 'amber';
}

interface DelegationTreeProps {
  orchestrator: TreeNode;
  left: TreeNode;
  right: TreeNode;
  compact?: boolean;
}

const tintStyles = {
  violet: { bg: 'rgba(123,110,246,0.12)', border: 'rgba(123,110,246,0.35)', color: '#9B8FF8' },
  teal: { bg: 'rgba(78,205,196,0.12)', border: 'rgba(78,205,196,0.3)', color: '#4ECDC4' },
  amber: { bg: 'rgba(232,184,109,0.15)', border: 'rgba(232,184,109,0.4)', color: '#E8B86D' },
};

function NodeCard({ node, compact }: { node: TreeNode; compact?: boolean }) {
  const s = tintStyles[node.tint];
  return (
    <div
      className="rounded-xl text-center"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        padding: compact ? '8px 12px' : '12px 16px',
        minWidth: compact ? '120px' : '150px',
      }}
    >
      <p
        className="font-medium uppercase"
        style={{ color: s.color, fontSize: compact ? '10px' : '11px', letterSpacing: '0.08em' }}
      >
        {node.label}
      </p>
      {node.address && (
        <p className="font-mono text-txt-tertiary mt-0.5" style={{ fontSize: compact ? '9px' : '10px' }}>
          {node.address}
        </p>
      )}
      {node.sub && (
        <p className="text-txt-secondary mt-1" style={{ fontSize: compact ? '10px' : '11px' }}>
          {node.sub}
        </p>
      )}
    </div>
  );
}

export function DelegationTree({ orchestrator, left, right, compact }: DelegationTreeProps) {
  return (
    <div className="relative w-full">
      {/* Orchestrator (top center) */}
      <div className="flex justify-center mb-8">
        <NodeCard node={orchestrator} compact={compact} />
      </div>

      {/* SVG connecting lines */}
      <svg
        className="absolute left-0 right-0 w-full pointer-events-none"
        style={{ top: compact ? '38px' : '48px', height: compact ? '40px' : '48px' }}
        preserveAspectRatio="none"
      >
        <line x1="50%" y1="0" x2="27%" y2="100%" stroke="#7B6EF6" strokeWidth="1.5" className="flow-line" opacity="0.6" />
        <line x1="50%" y1="0" x2="73%" y2="100%" stroke="#7B6EF6" strokeWidth="1.5" className="flow-line" opacity="0.6" />
      </svg>

      {/* Sub-agents (bottom row) */}
      <div className="flex justify-between gap-4">
        <div className="flex-1 flex justify-start"><NodeCard node={left} compact={compact} /></div>
        <div className="flex-1 flex justify-end"><NodeCard node={right} compact={compact} /></div>
      </div>
    </div>
  );
}
