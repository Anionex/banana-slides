import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminApp } from './pages/admin/AdminApp';
import './index.css';
import './styles/feiye-brand.css';

ReactDOM.createRoot(document.getElementById('admin-root')!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
);
