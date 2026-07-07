import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Swords } from 'lucide-react';
import type { Character, Quest, Shadow, StatKey, SystemEvent } from '../../types';
import { PixelArt } from '../PixelArt';
import { WorldMapScene } from './WorldMapScene';
import { RegionMapScene } from './RegionMapScene';
import { StoryDialog } from './StoryDialog';
import { BattleScene } from './BattleScene';
import type { CampaignState } from '../../lib/story/campaign';
import { regionFor, isRegionComplete, type RegionNode } from '../../lib/story/regions';
import { CHAPTER_BY_ID } from '../../lib/story/chapters';
import type { ProgressSnapshot } from '../../lib/story/chapterGate';
import { MEDAL_BY_CHAPTER } from '../../lib/story/medals';
import { getDialogue, type DialogueLine } from '../../lib/story/dialogue';
import { getEnemy } from '../../lib/enemies/registry';
import { enemySprite } from '../../lib/enemies/sprites';
import { buildPlayerConfig, buildShadowConfigs } from '../../lib/battle/loadout';
import { enemyMaxHp } from '../../lib/battle/engine';
import { canFight, spendWill, refundOnFirstLordLoss, type BattleKind } from '../../lib/battle/will';
import { rollExtraction } from '../../lib/boss';
import { SHADOW_TEMPLATES } from '../../lib/shadows';
import { renderClassSprite, DEFAULT_APPEARANCE } from '../../lib/playerSprites';
import { CONSUMABLES, consumableCount } from '../../lib/economy';
import { effectiveStreak } from '../../lib/leveling';

interface Props {
  character: Character;
  effectiveStats: Record<StatKey, number>;
  quests: Quest[];
  campaign: CampaignState;
  equippedShadows: Shadow[];
  onSaveCampaign: (c: CampaignState) => Promise<void>;
  onAwardGold: (n: number) => Promise<void>;
  onAwardShadow: (templateId: string) => Promise<{ id: string; name: string } | null>;
  onShadowGrowth: (floor: number) => Promise<unknown>;
  onUseConsumable: (id: string) => Promise<boolean>;
  onEnqueueEvent: (e: SystemEvent) => void;
  onClose: () => void;
}

type View = 'world' | 'region' | 'dialogue' | 'battle' | 'result';

interface ResultData {
  won: boolean;
  gold: number;
  medalName?: string;
  shadowName?: string;
  isLordClear: boolean;
  chapter: number;
}

const NODE_KIND_TO_BATTLE: Record<'battle' | 'elite' | 'lord', BattleKind> = {
  battle: 'mob', elite: 'elite', lord: 'lord',
};

function goldFor(kind: BattleKind, chapter: number): number {
  if (kind === 'lord') return 300 + chapter * 20;
  if (kind === 'elite') return 90 + chapter * 10;
  return 15 + chapter * 3;
}

export function AdventurePanel(props: Props) {
  const { character, effectiveStats, quests, campaign, equippedShadows } = props;
  const [view, setView] = useState<View>('world');
  const [chapter, setChapter] = useState<number>(campaign.chapter || 1);
  const [activeNode, setActiveNode] = useState<RegionNode | null>(null);
  const [dialogue, setDialogue] = useState<{ lines: DialogueLine[]; onDone: () => void } | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const snapshot: ProgressSnapshot = useMemo(() => {
    const totalQuests = quests.reduce((n, q) => n + q.completedDates.length, 0);
    const bestStreak = quests.reduce(
      (m, q) => Math.max(m, effectiveStreak(q.completedDates, q.type)),
      0
    );
    const weekly = quests
      .filter((q) => q.type === 'weekly')
      .reduce((n, q) => n + q.completedDates.length, 0);
    return {
      level: character.level,
      totalQuestsCompleted: totalQuests,
      bestStreak,
      weeklyQuestsCompleted: weekly,
      focusGateDays: 0,
      mealLogDays: 0,
      savingsWeeks: 0,
      weightLogDays: 0,
      achievementsUnlocked: character.unlocked?.achievements.length ?? 0,
      medalsOwned: campaign.medals.length,
    };
  }, [quests, character.level, character.unlocked, campaign.medals.length]);

  const region = regionFor(chapter);
  const clearedIds = campaign.clearedNodes[chapter] ?? [];

  const appearance = character.appearance ?? DEFAULT_APPEARANCE;
  const playerSprite = renderClassSprite(
    appearance.hunterClass,
    appearance.primaryColor,
    appearance.accentColor
  );

  const battleItems = useMemo(
    () =>
      CONSUMABLES.filter((c) => c.effect.type === 'heal' || c.effect.type === 'attack-boost')
        .map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          count: consumableCount(character, c.id),
          effect: c.effect as { type: 'heal'; percent: number } | { type: 'attack-boost'; multiplier: number },
        }))
        .filter((c) => c.count > 0),
    [character]
  );

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 1800);
  };

  const addClearedNode = (camp: CampaignState, ch: number, nodeId: string): CampaignState => {
    const existing = camp.clearedNodes[ch] ?? [];
    if (existing.includes(nodeId)) return camp;
    return { ...camp, clearedNodes: { ...camp.clearedNodes, [ch]: [...existing, nodeId] } };
  };

  const handleSelectChapter = (ch: number) => {
    setChapter(ch);
    setView('region');
  };

  const handleSelectNode = (node: RegionNode) => {
    setActiveNode(node);
    if (node.kind === 'event') {
      setDialogue({
        lines: getDialogue(node.dialogueId),
        onDone: async () => {
          await props.onSaveCampaign(addClearedNode(campaign, chapter, node.id));
          setView('region');
        },
      });
      setView('dialogue');
      return;
    }
    const kind = NODE_KIND_TO_BATTLE[node.kind];
    if (!canFight(campaign.will, kind)) {
      flash('戦意が たりない。クエストを こなそう。');
      return;
    }
    // Spend Will up-front (persist), then enter battle.
    void props.onSaveCampaign({ ...campaign, will: spendWill(campaign.will, kind) });
    setView('battle');
  };

  const handleBattleEnd = async (won: boolean, _turns: number) => {
    const node = activeNode;
    if (!node || node.kind === 'event') { setView('region'); return; }
    const kind = NODE_KIND_TO_BATTLE[node.kind];
    const enemyDef = getEnemy(node.enemyId);
    let camp = campaign;

    if (won) {
      const gold = goldFor(kind, chapter);
      await props.onAwardGold(gold);
      await props.onShadowGrowth(chapter);

      let shadowName: string | undefined;
      if ((kind === 'elite' || kind === 'lord') && enemyDef) {
        const cfg = buildPlayerConfig(character, effectiveStats, campaign.medals);
        const roll = rollExtraction({
          playerLevel: character.level,
          perception: effectiveStats.PER,
          intelligence: effectiveStats.INT,
          floor: chapter,
          bossHpScaled: enemyMaxHp(enemyDef, cfg, equippedShadows.length),
        });
        if (roll.success) {
          const template = SHADOW_TEMPLATES.find(
            (t) => t.stat === roll.stat && t.rarity === roll.rarity
          );
          if (template) {
            const created = await props.onAwardShadow(template.id);
            shadowName = created?.name ?? template.name;
          }
        }
      }

      camp = addClearedNode(camp, chapter, node.id);
      if (!camp.defeatedEnemies.includes(node.enemyId)) {
        camp = { ...camp, defeatedEnemies: [...camp.defeatedEnemies, node.enemyId] };
      }

      let medalName: string | undefined;
      const isLordClear = kind === 'lord';
      if (isLordClear) {
        const medal = MEDAL_BY_CHAPTER[chapter];
        if (medal && !camp.medals.includes(medal.id)) {
          camp = { ...camp, medals: [...camp.medals, medal.id] };
          medalName = medal.jp;
          props.onEnqueueEvent({
            id: `medal:${medal.id}:${Date.now()}`,
            kind: 'achievement',
            title: 'メダル獲得',
            primary: medal.jp,
            secondary: medal.desc,
            icon: '🏅',
            accent: 'gold',
          });
        }
        if (!camp.clearedChapters.includes(chapter)) {
          camp = { ...camp, clearedChapters: [...camp.clearedChapters, chapter], chapter: chapter + 1 };
        }
        if (!camp.lordAttempts.includes(node.enemyId)) {
          camp = { ...camp, lordAttempts: [...camp.lordAttempts, node.enemyId] };
        }
      }

      await props.onSaveCampaign(camp);
      setResult({ won: true, gold, medalName, shadowName, isLordClear, chapter });
      setView('result');
      return;
    }

    // Loss — first-attempt lord refund.
    if (kind === 'lord' && !camp.lordAttempts.includes(node.enemyId)) {
      camp = {
        ...camp,
        will: refundOnFirstLordLoss(camp.will),
        lordAttempts: [...camp.lordAttempts, node.enemyId],
      };
      await props.onSaveCampaign(camp);
    }
    setResult({ won: false, gold: 0, isLordClear: false, chapter });
    setView('result');
  };

  const handleResultContinue = () => {
    const r = result;
    setResult(null);
    if (r?.won && r.isLordClear) {
      setDialogue({
        lines: getDialogue(`ch${r.chapter}-lord-clear`),
        onDone: () => setView('world'),
      });
      setView('dialogue');
      return;
    }
    setView('region');
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (view === 'battle' && activeNode && activeNode.kind !== 'event') {
    const enemyDef = getEnemy(activeNode.enemyId);
    if (!enemyDef) { setView('region'); return null; }
    const cfg = buildPlayerConfig(character, effectiveStats, campaign.medals);
    return (
      <BattleScene
        playerConfig={cfg}
        shadowConfigs={buildShadowConfigs(equippedShadows)}
        enemy={enemyDef}
        playerSprite={playerSprite}
        enemySprite={enemySprite(activeNode.enemyId)}
        isLord={activeNode.kind === 'lord'}
        items={battleItems}
        onUseConsumable={props.onUseConsumable}
        onEnd={handleBattleEnd}
      />
    );
  }

  if (view === 'dialogue' && dialogue) {
    return <StoryDialog lines={dialogue.lines} onDone={dialogue.onDone} />;
  }

  const title =
    view === 'world' ? 'ダラリア大陸'
      : view === 'result' ? (result?.won ? 'せんとうけっか' : 'ざんねん')
        : CHAPTER_BY_ID[chapter]?.title ?? '冒険';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#04070f]/97 p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}>
      <div className="mx-auto max-w-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {view === 'region' && (
              <button type="button" onClick={() => setView('world')} className="text-sys-muted hover:text-sys-text" aria-label="もどる">←</button>
            )}
            <Swords className="h-4 w-4 text-sys-accent" />
            <h2 className="sys-title text-base">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-sys-text" title="戦意">
              ⚔️ {campaign.will.stock}/3
            </span>
            <button type="button" onClick={props.onClose} className="text-sys-muted hover:text-sys-text" aria-label="とじる">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-200"
          >
            {notice}
          </motion.div>
        )}

        {view === 'world' && (
          <WorldMapScene campaign={campaign} snapshot={snapshot} onSelectChapter={handleSelectChapter} />
        )}

        {view === 'region' && region && (
          <RegionMapScene
            region={region}
            clearedIds={clearedIds}
            recommendedLevel={CHAPTER_BY_ID[chapter]?.recommendedLevel ?? 1}
            willStock={campaign.will.stock}
            onSelectNode={handleSelectNode}
          />
        )}
        {view === 'region' && region && isRegionComplete(region, clearedIds) && (
          <p className="mt-4 text-center text-sm text-amber-300">この地方は クリア済み! 大陸マップへ もどろう。</p>
        )}

        {view === 'result' && result && (
          <div className="mx-auto max-w-sm space-y-4 text-center">
            <div className="flex justify-center">
              <PixelArt layers={[playerSprite]} pixelSize={6} />
            </div>
            {result.won ? (
              <>
                <p className="text-lg font-black text-amber-300">しょうり!</p>
                <div className="space-y-1 text-sm text-sys-text">
                  <p>💰 ゴールド +{result.gold}</p>
                  {result.shadowName && <p>🩶 影を 抽出:{result.shadowName}</p>}
                  {result.medalName && <p className="text-amber-300">🏅 {result.medalName} を 獲得!</p>}
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-black text-rose-300">やられてしまった…</p>
                <p className="text-xs text-sys-muted">クエストで レベルと 戦意を ためて、もういちど 挑もう。</p>
              </>
            )}
            <button type="button" onClick={handleResultContinue} className="sys-button w-full py-2.5">
              つづける
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
