import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F4F6F5' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', background: '#F4F6F5' }}>
          <div style={{ width: '100%', margin: '0' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
