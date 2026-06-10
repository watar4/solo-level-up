import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* GitHub Pages のサブパス配信・リロード時404を避けるため HashRouter を使用 */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
