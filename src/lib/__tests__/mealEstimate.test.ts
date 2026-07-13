import { describe, it, expect } from 'vitest';
import {
  applyEstimateToForm,
  buildEstimateMessage,
  estimateSourceLabel,
  parseMealEstimate,
} from '../mealEstimate';

describe('parseMealEstimate', () => {
  it('parses a plain JSON answer', () => {
    const est = parseMealEstimate(
      '{"name":"鶏むね肉と玄米","kcal":520,"protein":42,"fat":8,"carbs":68,"source":"photo","note":"1人前"}'
    );
    expect(est).toEqual({
      name: '鶏むね肉と玄米',
      kcal: 520,
      protein: 42,
      fat: 8,
      carbs: 68,
      source: 'photo',
      note: '1人前',
    });
  });

  it('tolerates code fences and surrounding prose', () => {
    const est = parseMealEstimate(
      'はい。```json\n{"name":"プロテインバー","kcal":180,"protein":15,"fat":8,"carbs":12,"source":"label","note":"1本あたり"}\n```'
    );
    expect(est.source).toBe('label');
    expect(est.kcal).toBe(180);
  });

  it('derives kcal from PFC when kcal is missing', () => {
    const est = parseMealEstimate('{"name":"x","protein":20,"fat":10,"carbs":30,"source":"name"}');
    expect(est.kcal).toBe(20 * 4 + 10 * 9 + 30 * 4);
  });

  it('accepts numeric strings and clamps negatives to 0', () => {
    const est = parseMealEstimate(
      '{"name":"x","kcal":"250","protein":"-3","fat":"10.5","carbs":"0","source":"label"}'
    );
    expect(est.kcal).toBe(250);
    expect(est.protein).toBe(0);
    expect(est.fat).toBe(10.5);
  });

  it('clamps absurd values to sane ceilings', () => {
    const est = parseMealEstimate(
      '{"name":"x","kcal":99999,"protein":9999,"fat":9999,"carbs":99999,"source":"photo"}'
    );
    expect(est.kcal).toBeLessThanOrEqual(5000);
    expect(est.protein).toBeLessThanOrEqual(500);
    expect(est.carbs).toBeLessThanOrEqual(1000);
  });

  it('falls back to source "photo" on an unknown source value', () => {
    const est = parseMealEstimate('{"name":"x","kcal":100,"source":"???"}');
    expect(est.source).toBe('photo');
  });

  it('throws the model-reported error', () => {
    expect(() => parseMealEstimate('{"error":"食品が写っていません"}')).toThrow(
      /食品が写っていません/
    );
  });

  it('throws on garbage and on all-zero nutrition', () => {
    expect(() => parseMealEstimate('こんにちは!')).toThrow();
    expect(() => parseMealEstimate('{"name":"x","kcal":0,"protein":0,"fat":0,"carbs":0}')).toThrow();
  });
});

describe('buildEstimateMessage / estimateSourceLabel / applyEstimateToForm', () => {
  it('includes the dish name when given', () => {
    expect(buildEstimateMessage('カレー', true)).toContain('カレー');
    expect(buildEstimateMessage(undefined, true)).toContain('画像');
    expect(buildEstimateMessage('カレー', false)).toContain('1人前');
  });

  it('labels each source distinctly and appends the note', () => {
    expect(estimateSourceLabel({ source: 'label', note: '1包装あたり' })).toContain('栄養成分表示');
    expect(estimateSourceLabel({ source: 'label', note: '1包装あたり' })).toContain('1包装あたり');
    expect(estimateSourceLabel({ source: 'photo' })).toContain('推定');
    expect(estimateSourceLabel({ source: 'name' })).toContain('メニュー名');
  });

  it('keeps the user-typed name over the AI name', () => {
    const est = {
      name: 'AI名', kcal: 100, protein: 1, fat: 2, carbs: 3, source: 'photo' as const,
    };
    expect(applyEstimateToForm(est, ' 手入力名 ').name).toBe('手入力名');
    expect(applyEstimateToForm(est, '').name).toBe('AI名');
  });
});
