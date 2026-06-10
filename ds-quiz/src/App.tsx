import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Layout from './components/Layout';
import Home from './screens/Home';

// 二次画面は遅延読み込みし、初期表示のバンドル（特にグラフ/Markdown）を分割する
const Setup = lazy(() => import('./screens/Setup'));
const Quiz = lazy(() => import('./screens/Quiz'));
const Result = lazy(() => import('./screens/Result'));
const Review = lazy(() => import('./screens/Review'));
const Stats = lazy(() => import('./screens/Stats'));
const QuestionManager = lazy(() => import('./screens/QuestionManager'));
const Settings = lazy(() => import('./screens/Settings'));
const AIGenerate = lazy(() => import('./screens/AIGenerate'));

function Fallback() {
  return (
    <div className="flex justify-center py-16 text-slate-400">
      <Loader2 className="animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/result" element={<Result />} />
          <Route path="/review" element={<Review />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/questions" element={<QuestionManager />} />
          <Route path="/generate" element={<AIGenerate />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
