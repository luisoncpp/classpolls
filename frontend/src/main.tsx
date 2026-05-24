import { render } from 'preact';

const app = (
  <div>
    <h1>ClassPolls</h1>
    <p>Frontend dev server running. Open console to verify env vars.</p>
  </div>
);

render(app, document.getElementById('app')!);
