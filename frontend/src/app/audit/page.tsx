'use client';

import { useState } from 'react';
import { Nav } from '@/components/Nav';
import { Address } from '@/components/AddressPill';
import { ChevronDown } from 'lucide-react';

type RecordType = 'rebalance' | 'data' | 'permission';

interface AuditRecord {
  type: RecordType;
  title: string;
  time: string;
  rows: { label: string; value: string; hash?: boolean }[];
  json: Record<string, unknown>;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'rebalance', label: 'Rebalances' },
  { key: 'data', label: 'Data Purchases' },
  { key: 'permission', label: 'Permission Changes' },
] as const;

const RECORDS: AuditRecord[] = [
  {
    type: 'rebalance',
    title: 'Portfolio Rebalanced',
    time: '6 hours ago',
    rows: [
      { label: 'Intent', value: 'Maximize stablecoin yield, drawdown < 8%' },
      { label: 'Strategy', value: 'Withdraw 1,800 USDC from Aave → Deposit to Compound' },
      { label: 'Executed via', value: '1Shot Relayer' },
      { label: 'Gas cost', value: '1.2 USDC (in USDC, no ETH)' },
      { label: 'Tx hash', value: '0x4f2a8c1e9b2c4e6d8f0a1b3c5e7d9f1a', hash: true },
      { label: 'Outcome', value: '+4.1% APY gain' },
    ],
    json: {
      type: 'execution',
      relayer: '1shot',
      txHash: '0x4f2a8c1e...',
      feeToken: 'USDC',
      feeAmount: '1.2',
      strategy: { action: 'rebalance', from: 'aave', to: 'compound', amount: 1800 },
    },
  },
  {
    type: 'data',
    title: 'Agent Data Purchase',
    time: '6 hours ago',
    rows: [
      { label: 'Agent', value: 'Risk Agent' },
      { label: 'Spent', value: '18 USDC' },
      { label: 'Source', value: 'Venice x402' },
      { label: 'Data', value: 'volatility + drawdown data' },
    ],
    json: { type: 'x402_purchase', agent: 'risk', amount: 18, provider: 'venice', dataType: 'volatility' },
  },
  {
    type: 'data',
    title: 'Agent Data Purchase',
    time: '6 hours ago',
    rows: [
      { label: 'Agent', value: 'Yield Scanner' },
      { label: 'Spent', value: '20 USDC' },
      { label: 'Source', value: 'Venice x402' },
      { label: 'Data', value: 'APY data across 4 protocols' },
    ],
    json: { type: 'x402_purchase', agent: 'yield', amount: 20, provider: 'venice', dataType: 'apy' },
  },
  {
    type: 'permission',
    title: 'Redelegation Created',
    time: '6 hours ago',
    rows: [
      { label: 'From → To', value: 'Orchestrator → Risk Agent' },
      { label: 'Cap', value: '20 USDC' },
      { label: 'Delegation hash', value: '0x9b2f4a8c1e3d5f7a9b2c4e6d', hash: true },
    ],
    json: { type: 'redelegation', from: 'orchestrator', to: 'risk', cap: 20, hash: '0x9b2f...' },
  },
  {
    type: 'permission',
    title: 'Redelegation Created',
    time: '6 hours ago',
    rows: [
      { label: 'From → To', value: 'Orchestrator → Yield Scanner' },
      { label: 'Cap', value: '20 USDC' },
      { label: 'Delegation hash', value: '0x1c4e7a2b9d3f5a8c2e4d6f8a', hash: true },
    ],
    json: { type: 'redelegation', from: 'orchestrator', to: 'yield', cap: 20, hash: '0x1c4e...' },
  },
  {
    type: 'permission',
    title: 'Root Permission Granted',
    time: '2 days ago',
    rows: [
      { label: 'From → To', value: 'User → Orchestrator' },
      { label: 'Budget', value: '100 USDC/week' },
      { label: 'Standard', value: 'ERC-7715 · 30-day expiry' },
      { label: 'Permission hash', value: '0x7f3a2b8c1e9d4f6a8b2c5e7d', hash: true },
    ],
    json: { type: 'root_permission', standard: 'erc-7715', budget: 100, period: 'week', expiry: '30d' },
  },
];

const borderColor: Record<RecordType, string> = {
  rebalance: '#E8B86D',
  data: '#4ECDC4',
  permission: '#9B8FF8',
};

export default function AuditPage() {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? RECORDS : RECORDS.filter(r => r.type === filter);

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="relative pt-24 pb-20 px-6">
        <div className="lightwave" />
        <div className="relative max-w-4xl mx-auto">
          {/* Header */}
          <h1 className="font-display text-txt-primary" style={{ fontSize: '32px' }}>Audit Trail</h1>
          <p className="text-txt-secondary text-sm mt-1">Every agent action, cryptographically verifiable.</p>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mt-6 mb-8">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-full text-xs transition-all"
                style={{
                  background: filter === f.key ? 'rgba(232,184,109,0.15)' : 'rgba(255,255,255,0.035)',
                  border: `1px solid ${filter === f.key ? 'rgba(232,184,109,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  color: filter === f.key ? '#E8B86D' : 'var(--color-txt-secondary)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Records */}
          <div className="space-y-3">
            {filtered.map((record, i) => (
              <AuditCard key={i} record={record} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditCard({ record }: { record: AuditRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass rounded-xl p-5" style={{ borderLeft: `3px solid ${borderColor[record.type]}` }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <h3 className="text-txt-primary font-medium text-sm">{record.title}</h3>
          <span className="text-txt-tertiary text-[11px]">{record.time}</span>
        </div>
        <ChevronDown size={16} className={`text-txt-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className="mt-3 space-y-1.5">
        {record.rows.map((row, i) => (
          <div key={i} className="flex items-start gap-3 text-xs">
            <span className="text-txt-tertiary w-28 shrink-0">{row.label}</span>
            {row.hash ? (
              <span className="flex items-center gap-2">
                <Address value={row.value} className="text-[11px]" />
                <a
                  href={`https://sepolia.basescan.org/tx/${row.value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-txt-tertiary hover:text-amber-glow cursor-pointer transition-colors"
                >
                  View on Basescan ↗
                </a>
              </span>
            ) : (
              <span className="text-txt-primary">{row.value}</span>
            )}
          </div>
        ))}
      </div>

      {expanded && (
        <div
          className="mt-4 rounded-lg p-4 font-mono text-[11px] overflow-x-auto fade-page"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <JsonView data={record.json} />
        </div>
      )}
    </div>
  );
}

function JsonView({ data }: { data: Record<string, unknown> }) {
  const render = (obj: unknown, depth = 0): React.ReactNode => {
    if (obj === null) return <span style={{ color: '#9B8FF8' }}>null</span>;
    if (typeof obj === 'string') {
      const isHash = obj.startsWith('0x');
      return <span style={{ color: isHash ? '#F87171' : '#4ECDC4' }}>&quot;{obj}&quot;</span>;
    }
    if (typeof obj === 'number') return <span style={{ color: '#4ECDC4' }}>{obj}</span>;
    if (typeof obj === 'boolean') return <span style={{ color: '#9B8FF8' }}>{String(obj)}</span>;
    if (typeof obj === 'object') {
      const entries = Object.entries(obj as Record<string, unknown>);
      const pad = '  '.repeat(depth + 1);
      return (
        <>
          {'{'}
          {entries.map(([k, v], i) => (
            <div key={k} style={{ paddingLeft: '16px' }}>
              <span style={{ color: '#E8B86D' }}>&quot;{k}&quot;</span>
              <span className="text-txt-tertiary">: </span>
              {render(v, depth + 1)}
              {i < entries.length - 1 && <span className="text-txt-tertiary">,</span>}
            </div>
          ))}
          {'}'}
        </>
      );
    }
    return null;
  };
  return <div className="text-txt-secondary">{render(data)}</div>;
}
