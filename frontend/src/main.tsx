import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './i18n'
import './index.css'

import { initializePublicDemo } from './utils/publicDemo'
import { getBaseURL } from './api/client'

function Bootstrap() {
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState('');
  const load = () => {
    setError('');
    initializePublicDemo(getBaseURL()).then(() => setReady(true)).catch(e => setError(e.message));
  };
  React.useEffect(load, []);
  if (!ready) return <div className="p-8" role="status">{error || '正在连接服务…'}{error && <button className="ml-3 underline" onClick={load}>重试</button>}</div>;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
)

