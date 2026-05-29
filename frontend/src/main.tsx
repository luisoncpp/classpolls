import { render } from 'preact';

import { I18nProvider, LanguageSelector } from './common/i18n';
import './styles.css';
import { Dashboard } from './instructor';
import { OBSOverlay } from './overlay';
import { RoomJoin } from './student';

const languageSelectorWrapStyle = { display: 'flex', justifyContent: 'flex-end', padding: '1rem 1rem 0' };

render(<App />, document.getElementById('app')!);

function App() {
  const pathname = window.location.pathname;
  return (
    <I18nProvider>
      {!pathname.startsWith('/overlay/') ? <div style={languageSelectorWrapStyle}><LanguageSelector /></div> : null}
      <AppRouter pathname={pathname} />
    </I18nProvider>
  );
}

function AppRouter(props: { pathname: string }) {
  const { pathname } = props;
  if (pathname === '/instructor') return <Dashboard />;
  if (pathname.startsWith('/overlay/')) return <OBSOverlay roomCode={pathname.slice('/overlay/'.length).toUpperCase()} />;
  return <RoomJoin />;
}
