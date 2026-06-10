import { useCallbackRef } from '../lib/useCallbackRef';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Check, ChevronLeft, ChevronRight, Flag, X } from 'lucide-react';
import { useQuiz } from '../store/useQuiz';
import { useStore } from '../store/useStore';
import { isAnswerCorrect } from '../lib/quiz';
import CategoryBadge from '../components/CategoryBadge';
import Markdown from '../components/Markdown';
import Timer from '../components/Timer';

function useElapsed(startedAt: number, active: boolean): number {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

export default function Quiz() {
  const navigate = useNavigate();
  const quiz = useQuiz();
  const { questions, index, immediateFeedback, mode } = quiz;
  const stats = useStore((s) => s.questionStats);
  const recordAnswer = useStore((s) => s.recordAnswer);
  const toggleBookmark = useStore((s) => s.toggleBookmark);
  const addSession = useStore((s) => s.addSession);
  const passThreshold = useStore((s) => s.settings.passThreshold);

  const elapsed = useElapsed(quiz.startedAt, quiz.active && !quiz.deadline);

  const q = questions[index];
  const committed = q ? !!quiz.committed[q.id] : false;
  const selected = q ? quiz.selections[q.id] ?? [] : [];

  const answeredCount = useMemo(
    () => questions.filter((qq) => (quiz.selections[qq.id]?.length ?? 0) > 0).length,
    [questions, quiz.selections],
  );

  const finish = useCallbackRef(() => {
    const record = quiz.buildRecord();
    // 模擬試験は確定時に未記録なので、ここでまとめて統計に反映
    if (!immediateFeedback) {
      for (const a of record.answers) recordAnswer(a.questionId, a.isCorrect);
    }
    if (mode === 'mock') {
      record.passed = record.total > 0 && record.correct / record.total >= passThreshold;
    }
    addSession(record);
    quiz.reset();
    navigate('/result', { state: { sessionId: record.id, record } });
  });

  const handleCommit = useCallbackRef(() => {
    if (!q || committed || selected.length === 0) return;
    quiz.commit(q.id);
    if (immediateFeedback) recordAnswer(q.id, isAnswerCorrect(q, selected));
  });

  const goNext = useCallbackRef(() => {
    if (index >= questions.length - 1) {
      if (mode !== 'mock') finish();
      return;
    }
    quiz.next();
  });

  // キーボード操作（数字キーで選択、Enterで確定/次へ）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= q.choices.length) {
        if (!(immediateFeedback && committed)) quiz.select(q.id, q.choices[n - 1].key, q.type);
      } else if (e.key === 'Enter') {
        if (immediateFeedback && !committed) handleCommit();
        else goNext();
      } else if (e.key === 'ArrowLeft') {
        quiz.prev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, committed, immediateFeedback, quiz, handleCommit, goNext]);

  if (!quiz.active || !q) {
    return (
      <div className="card text-center">
        <p className="mb-3">進行中の演習がありません。</p>
        <button className="btn-primary" onClick={() => navigate('/setup')}>出題設定へ</button>
      </div>
    );
  }

  const showFeedback = immediateFeedback && committed;
  const correct = isAnswerCorrect(q, selected);
  const isLast = index === questions.length - 1;

  const choiceClass = (key: string): string => {
    const isSel = selected.includes(key);
    const isAns = q.answer.includes(key);
    if (showFeedback) {
      if (isAns) return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30';
      if (isSel && !isAns) return 'border-red-500 bg-red-50 dark:bg-red-900/30';
      return 'border-slate-200 dark:border-slate-700';
    }
    return isSel
      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
      : 'border-slate-200 hover:border-brand-300 dark:border-slate-700';
  };

  return (
    <div className="space-y-4">
      {/* 上部バー */}
      <div className="flex items-center gap-2">
        <span className="chip bg-slate-200 font-mono tabular-nums dark:bg-slate-800">
          {index + 1} / {questions.length}
        </span>
        {quiz.deadline ? (
          <Timer deadline={quiz.deadline} onExpire={finish} />
        ) : (
          <span className="chip bg-slate-200 font-mono tabular-nums dark:bg-slate-800">
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => toggleBookmark(q.id)}
            className={`btn-ghost !px-2 !py-1 ${stats[q.id]?.bookmarked ? '!text-amber-500' : ''}`}
            aria-pressed={!!stats[q.id]?.bookmarked}
            aria-label="ブックマーク（後で復習）"
          >
            <Bookmark size={18} fill={stats[q.id]?.bookmarked ? 'currentColor' : 'none'} />
          </button>
          {mode === 'mock' && (
            <button
              onClick={() => quiz.toggleFlag(q.id)}
              className={`btn-ghost !px-2 !py-1 ${quiz.flagged[q.id] ? '!text-orange-500' : ''}`}
              aria-pressed={!!quiz.flagged[q.id]}
              aria-label="あとで見直す"
            >
              <Flag size={18} fill={quiz.flagged[q.id] ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>

      {/* 設問 */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={q.category} />
          {q.subCategory && <span className="text-xs text-slate-500">{q.subCategory}</span>}
          <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{'★'.repeat(q.difficulty)}</span>
          {q.type === 'multiple' && <span className="chip bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">複数選択</span>}
        </div>
        <div className="text-base font-medium">
          <Markdown>{q.question}</Markdown>
        </div>
        {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-64 rounded-lg" />}

        <div className="space-y-2">
          {q.choices.map((c, i) => (
            <button
              key={c.key}
              onClick={() => !(showFeedback) && quiz.select(q.id, c.key, q.type)}
              disabled={showFeedback}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${choiceClass(c.key)}`}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-bold dark:bg-slate-800">
                {i + 1}
              </span>
              <span className="flex-1">{c.text}</span>
              {showFeedback && q.answer.includes(c.key) && <Check size={18} className="text-emerald-600" />}
              {showFeedback && selected.includes(c.key) && !q.answer.includes(c.key) && <X size={18} className="text-red-600" />}
            </button>
          ))}
        </div>
      </div>

      {/* 即時フィードバック */}
      {showFeedback && (
        <div className={`card border-2 ${correct ? 'border-emerald-400' : 'border-red-400'}`}>
          <div className={`mb-2 flex items-center gap-2 font-bold ${correct ? 'text-emerald-600' : 'text-red-600'}`}>
            {correct ? <Check size={20} /> : <X size={20} />}
            {correct ? '正解' : '不正解'}
            <span className="text-sm font-normal text-slate-500">正解: {q.answer.join(', ')}</span>
          </div>
          <Markdown>{q.explanation}</Markdown>
          {q.tags && q.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {q.tags.map((t) => (
                <span key={t} className="chip bg-slate-100 text-slate-500 dark:bg-slate-800">#{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* フッターナビ */}
      <div className="flex items-center gap-2">
        <button onClick={quiz.prev} disabled={index === 0} className="btn-ghost">
          <ChevronLeft size={18} /> 前へ
        </button>
        {immediateFeedback && !committed ? (
          <button onClick={handleCommit} disabled={selected.length === 0} className="btn-primary ml-auto">
            解答する
          </button>
        ) : isLast ? (
          mode === 'mock' ? null : (
            <button onClick={finish} className="btn-primary ml-auto">結果を見る</button>
          )
        ) : (
          <button onClick={goNext} className="btn-primary ml-auto">
            次へ <ChevronRight size={18} />
          </button>
        )}
      </div>

      {/* 模擬試験: ナビゲータ + 採点 */}
      {mode === 'mock' && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">回答済み {answeredCount} / {questions.length}</span>
            {answeredCount < questions.length && <span className="text-orange-500">未回答 {questions.length - answeredCount} 問</span>}
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((qq, i) => {
              const ans = (quiz.selections[qq.id]?.length ?? 0) > 0;
              const flagged = quiz.flagged[qq.id];
              return (
                <button
                  key={qq.id}
                  onClick={() => quiz.goto(i)}
                  className={`relative h-8 rounded-md text-xs font-medium tabular-nums ${
                    i === index
                      ? 'ring-2 ring-brand-500'
                      : ''
                  } ${ans ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                  aria-label={`${i + 1}問目${ans ? '（回答済み）' : '（未回答）'}`}
                >
                  {i + 1}
                  {flagged && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500" />}
                </button>
              );
            })}
          </div>
          <button onClick={finish} className="btn-primary w-full">
            終了して採点する
          </button>
        </div>
      )}
    </div>
  );
}
