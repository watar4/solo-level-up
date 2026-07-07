// Chapter 1 dialogue — trin tone with docs/redesign/02-story.md §7:
// short, hiragana-heavy, Aria = polite + light snark, enemies are harmless.

export interface DialogueLine {
  speaker: 'aria' | 'balgas' | 'kain' | 'merle' | 'enemy' | 'narration';
  name?: string;    // display name override (enemy/narration)
  text: string;
  window?: 'system' | 'dq';
}

export const CH01_DIALOGUE: Record<string, DialogueLine[]> = {
  'ch1-intro': [
    { speaker: 'narration', text: 'ハンター登録の あさ。あなたは 寝坊しかけて、ギルドへ 走っていた。' },
    { speaker: 'aria', window: 'system', text: 'おはようございます。〈システム〉が 起動しました。' },
    { speaker: 'aria', window: 'system', text: '評価:E。……伸びしろは、あります。たぶん。' },
    { speaker: 'balgas', text: 'よう新人。おはよう平原の みんなが 起きてこねえんだ。' },
    { speaker: 'balgas', text: '原因は ダラモン。「まくら大公スヤリン」ってやつさ。行ってみな。' },
    { speaker: 'aria', window: 'system', text: 'では、はじめましょう。まずは 目の前の ダラモンから。' },
  ],
  'ch1-mid': [
    { speaker: 'narration', text: '井戸ばたで、寝ぼけた 村人が つぶやいた。' },
    { speaker: 'narration', name: '村人', text: '「あと5ふん……あと5ふんだけ……」' },
    { speaker: 'aria', window: 'system', text: 'この 眠気、大公の しわざですね。もう少しで 本人です。' },
  ],
  'ch1-prelord': [
    { speaker: 'balgas', text: 'その先が スヤリンの間だ。眠らされるなよ、新人。' },
    { speaker: 'aria', window: 'system', text: '弱点は「心(しん)」属性。眠りには「めざましの鐘」が 効きます。' },
    { speaker: 'aria', window: 'system', text: '……準備は いいですか? わたしは、いつでも。' },
  ],
  'ch1-lord-open': [
    { speaker: 'enemy', name: 'まくら大公スヤリン', text: 'んん……いま いいとこ なんだけど……' },
  ],
  'ch1-lord-clear': [
    { speaker: 'enemy', name: 'スヤリン', text: 'えっ……もう あさ!? ……あさだ!' },
    { speaker: 'narration', text: 'スヤリンは 飛び起き、平原に 朝日が もどった。' },
    { speaker: 'aria', window: 'system', text: 'メダル〈はやおき〉を 獲得。……おめでとうございます。ちゃんと、言いました。' },
    { speaker: 'balgas', text: 'やるじゃねえか。次の 地方は また今度な。まずは 続けることだ。' },
  ],
};
