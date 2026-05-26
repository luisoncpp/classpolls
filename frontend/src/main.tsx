import { render } from 'preact';

import './styles.css';
import { Dashboard } from './instructor';
import { OBSOverlay } from './overlay';
import { RoomJoin } from './student';

render(<AppRouter />, document.getElementById('app')!);

function AppRouter() {
  const pathname = window.location.pathname;
  if (pathname === '/instructor') return <Dashboard />;
  if (pathname.startsWith('/overlay/')) return <OBSOverlay roomCode={pathname.slice('/overlay/'.length).toUpperCase()} />;
  return <RoomJoin />;
}
