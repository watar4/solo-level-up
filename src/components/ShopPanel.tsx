import { useState } from 'react';
import { X, Coins, Dices } from 'lucide-react';
import { motion } from 'framer-motion';
import { SystemWindow } from './SystemWindow';
import {
  CONSUMABLES,
  WEAPON_GACHA_PRICE,
  consumableCount,
  formatGold,
  walletGold,
} from '../lib/economy';
import { rollChestWeapon, weaponBonusFor } from '../lib/items';
import { RARITY_COLOR, RARITY_LABEL } from '../lib/shadows';
import { currentFloor } from '../lib/boss';
import type { Character, ShadowRarity, StatKey } from '../types';

interface Props {
  open: boolean;
  character: Character;
  onClose: () => void;
  onBuyConsumable: (consumableId: string) => Promise<boolean>;
  onSpendGold: (amount: number) => Promise<boolean>;
  onAwardWeapon: (templateId: string) => Promise<{ id: string; name: string } | null>;
}

interface GachaResult {
  name: string;
  rarity: ShadowRarity;
  stat: StatKey;
  bonus: number;
}

export function ShopPanel({
  open,
  character,
  onClose,
  onBuyConsumable,
  onSpendGold,
  onAwardWeapon,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [gachaResult, setGachaResult] = useState<GachaResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const gold = walletGold(character);

  const handleBuy = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setNotice(null);
    try {
      const ok = await onBuyConsumable(id);
      if (!ok) setNotice('ゴールドが足りない…');
    } catch (err) {
      console.error('[shop] buy failed', err);
      setNotice('購入に失敗しました');
    } finally {
      setBusyId(null);
    }
  };

  const handleGacha = async () => {
    if (busyId) return;
    setBusyId('gacha');
    setNotice(null);
    setGachaResult(null);
    try {
      const paid = await onSpendGold(WEAPON_GACHA_PRICE);
      if (!paid) {
        setNotice('ゴールドが足りない…');
        return;
      }
      const template = rollChestWeapon({
        playerLevel: character.level,
        floor: currentFloor(character),
      });
      await onAwardWeapon(template.id);
      setGachaResult({
        name: template.name,
        rarity: template.rarity,
        stat: template.stat,
        bonus: weaponBonusFor(template.rarity),
      });
    } catch (err) {
      console.error('[shop] gacha failed', err);
      setNotice('ガチャに失敗しました');
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        <SystemWindow title="Shop" subtitle="guild trader">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm">
              <Coins className="h-4 w-4 text-sys-gold" />
              <span className="gold-text text-lg">{formatGold(gold)}</span>
              <span className="text-[10px] text-sys-muted">G (所持ゴールド)</span>
            </p>
            <button
              type="button"
              onClick={onClose}
              className="text-sys-muted hover:text-sys-text"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-4 text-[11px] text-sys-muted">
            ゴールドはクエスト完了・ボス討伐・貯金記録のボーナスで貯まる (ゲーム内通貨。リアルマネーとは無関係)
          </p>

          {notice && (
            <div className="mb-3 border border-sys-danger/50 bg-sys-danger/5 px-3 py-2 text-xs text-sys-danger">
              {notice}
            </div>
          )}

          {/* Consumables */}
          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-sys-muted">
              消費アイテム (ボス戦で使用)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONSUMABLES.map((c) => {
                const held = consumableCount(character, c.id);
                const affordable = gold >= c.price;
                return (
                  <div
                    key={c.id}
                    className="flex items-start gap-2.5 border border-sys-border/40 bg-black/30 px-3 py-2.5"
                  >
                    <span className="mt-0.5 text-xl">{c.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-bold text-sys-text">{c.name}</p>
                        <span className="shrink-0 font-mono text-[10px] text-sys-muted">
                          所持 ×{held}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-sys-muted">
                        {c.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleBuy(c.id)}
                        disabled={busyId !== null || !affordable}
                        className="sys-button sys-button-gold mt-2 !px-3 !py-1 !text-xs"
                      >
                        <Coins className="h-3 w-3" />
                        {c.price} G で購入
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Weapon gacha */}
          <section className="mt-5 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-sys-muted">
              武器ガチャ
            </p>
            <div className="border border-sys-arise/40 bg-sys-arise/5 px-4 py-3 space-y-3">
              <p className="text-[11px] text-sys-muted">
                レベルと到達フロアが高いほど高レア率UP。出た武器はインベントリへ
              </p>
              <button
                type="button"
                onClick={() => void handleGacha()}
                disabled={busyId !== null || gold < WEAPON_GACHA_PRICE}
                className="sys-button sys-button-arise w-full justify-center"
              >
                <Dices className="h-4 w-4" />
                {busyId === 'gacha' ? '鑑定中…' : `${WEAPON_GACHA_PRICE} G で1回引く`}
              </button>
              {gachaResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={`border px-3 py-2 text-center ${RARITY_COLOR[gachaResult.rarity]} bg-black/40`}
                >
                  <p className="text-[10px] uppercase tracking-widest">
                    {RARITY_LABEL[gachaResult.rarity]}
                  </p>
                  <p className="mt-0.5 text-lg font-black tracking-wider text-sys-text">
                    {gachaResult.name}
                  </p>
                  <p className="font-mono text-xs text-sys-accent">
                    {gachaResult.stat} +{gachaResult.bonus}
                  </p>
                </motion.div>
              )}
            </div>
          </section>
        </SystemWindow>
      </div>
    </div>
  );
}
