import type { Region, RegionNode } from '../../lib/story/regions';
import { nextNode } from '../../lib/story/regions';
import { getEnemy } from '../../lib/enemies/registry';
import { WILL_COST } from '../../lib/battle/will';

const NODE_ICON: Record<RegionNode['kind'], string> = {
  event: '💬', battle: '⚔️', elite: '🛡️', lord: '👑',
};

interface Props {
  region: Region;
  clearedIds: string[];
  recommendedLevel: number;
  willStock: number;
  onSelectNode: (node: RegionNode) => void;
}

export function RegionMapScene({ region, clearedIds, recommendedLevel, willStock, onSelectNode }: Props) {
  const cleared = new Set(clearedIds);
  const current = nextNode(region, clearedIds);

  return (
    <div className="mx-auto max-w-xl space-y-1.5">
      {region.nodes.map((node) => {
        const isCleared = cleared.has(node.id);
        const isCurrent = current?.id === node.id;
        const enemy = 'enemyId' in node ? getEnemy(node.enemyId) : undefined;
        const willCost = node.kind === 'lord' ? WILL_COST.lord : node.kind === 'event' ? 0 : WILL_COST.mob;
        const needWill = willCost > 0 && willStock < willCost;

        return (
          <div key={node.id} className="flex items-stretch gap-2">
            <div className="flex flex-col items-center">
              <span className={`text-base ${isCurrent ? '' : isCleared ? 'opacity-80' : 'opacity-30'}`}>
                {NODE_ICON[node.kind]}
              </span>
            </div>
            <button
              type="button"
              disabled={!isCurrent}
              onClick={() => isCurrent && onSelectNode(node)}
              className={`flex flex-1 items-center justify-between rounded-md border p-2.5 text-left transition ${
                isCurrent
                  ? needWill
                    ? 'border-rose-500/50 bg-rose-500/5'
                    : 'border-sys-accent bg-sys-accent/10 active:scale-[0.99]'
                  : isCleared
                    ? 'border-sys-border/40 opacity-70'
                    : 'border-sys-border/20 opacity-40'
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-sys-text">
                  {node.label}
                  {isCleared && <span className="ml-1 text-amber-400">✓</span>}
                </span>
                <span className="block text-[11px] text-sys-muted">
                  {node.kind === 'event' && 'イベント'}
                  {node.kind === 'battle' && enemy && `ダラモン:${enemy.name}`}
                  {node.kind === 'elite' && enemy && `中ボス:${enemy.name}`}
                  {node.kind === 'lord' && enemy && `幹部:${enemy.name}(推奨Lv${recommendedLevel})`}
                </span>
              </span>
              {isCurrent && willCost > 0 && (
                <span className={`shrink-0 text-[10px] ${needWill ? 'text-rose-300' : 'text-sys-muted'}`}>
                  戦意 -{willCost}{needWill ? '(不足)' : ''}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
