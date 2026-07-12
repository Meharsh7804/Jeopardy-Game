import React, { useState } from 'react';
import { saveFirebaseConfig } from '../firebase';
import type { FirebaseConfig } from '../firebase';
import { Database, HelpCircle, Save, Check, RefreshCw } from 'lucide-react';

interface FirebaseSetupProps {
  onConfigured: () => void;
}

export const FirebaseSetup: React.FC<FirebaseSetupProps> = ({ onConfigured }) => {
  const [apiKey, setApiKey] = useState('');
  const [databaseURL, setDatabaseURL] = useState('');
  const [projectId, setProjectId] = useState('');
  const [appId, setAppId] = useState('');
  const [pasteArea, setPasteArea] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePasteConfig = () => {
    try {
      // Clean up string to find json or key-value patterns
      let clean = pasteArea.trim();
      
      // Match inside braces if they pasted the whole js snippet
      const bracesMatch = clean.match(/\{[\s\S]*\}/);
      if (bracesMatch) {
        clean = bracesMatch[0];
      }

      // Convert js object representation to valid json if necessary
      // e.g. replace keys like apiKey: with "apiKey":
      clean = clean
        .replace(/([a-zA-Z0-9]+)\s*:/g, '"$1":')
        .replace(/'/g, '"')
        // Remove trailing commas before closing braces/brackets
        .replace(/,\s*([\]}])/g, '$1');

      const parsed = JSON.parse(clean);
      if (parsed.apiKey) setApiKey(parsed.apiKey);
      if (parsed.databaseURL) setDatabaseURL(parsed.databaseURL);
      if (parsed.projectId) setProjectId(parsed.projectId);
      if (parsed.appId) setAppId(parsed.appId);
      
      setError('');
    } catch (e) {
      setError('Could not parse config snippet. Try copying just the JSON object containing apiKey, databaseURL, etc.');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!apiKey.trim()) { setError('API Key is required.'); return; }
    if (!databaseURL.trim() || !databaseURL.startsWith('http')) { setError('A valid Realtime Database URL (starting with https://) is required.'); return; }
    if (!projectId.trim()) { setError('Project ID is required.'); return; }
    if (!appId.trim()) { setError('App ID is required.'); return; }

    const config: FirebaseConfig = {
      apiKey: apiKey.trim(),
      databaseURL: databaseURL.trim(),
      projectId: projectId.trim(),
      appId: appId.trim(),
      authDomain: `${projectId.trim()}.firebaseapp.com`,
      storageBucket: `${projectId.trim()}.appspot.com`,
      messagingSenderId: '',
    };

    saveFirebaseConfig(config);
    setSuccess(true);
    setTimeout(() => {
      onConfigured();
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden bg-primary-bg">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-primary-accent/10 border border-primary-accent/20 text-primary-accent mb-2">
            <Database className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-display font-extrabold text-text-main">
            Firebase Connection Required
          </h1>
          <p className="text-text-muted text-sm max-w-md mx-auto">
            To enable real-time buzzers and multiplayer matches, please connect your Firebase Realtime Database.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Instructions */}
          <div className="md:col-span-5 glass-panel p-5 rounded-2xl space-y-4 text-xs">
            <h2 className="font-bold text-sm text-text-main flex items-center gap-1.5 border-b border-white/5 pb-2">
              <HelpCircle className="w-4 h-4 text-secondary-accent" />
              Setup Steps
            </h2>
            <ol className="space-y-3 list-decimal list-inside text-text-muted leading-relaxed">
              <li>
                Go to the <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-primary-accent hover:underline font-bold">Firebase Console</a> and create a free project.
              </li>
              <li>
                Add a <strong>Web App</strong> to retrieve your config snippet.
              </li>
              <li>
                Click <strong>Realtime Database</strong> in the sidebar, click <strong>Create Database</strong>, and select your location.
              </li>
              <li>
                In the Database <strong>Rules</strong> tab, set rules to allow read/write:
                <pre className="mt-1 p-2 rounded bg-black/40 text-[10px] font-mono border border-white/5 text-secondary-accent">
                  {`{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}`}
                </pre>
              </li>
            </ol>
          </div>

          {/* Form */}
          <div className="md:col-span-7 glass-panel p-6 rounded-2xl space-y-5">
            {/* Quick paste helper */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Option A: Paste Config Snippet</label>
              <div className="flex gap-2">
                <textarea
                  placeholder="Paste firebaseConfig = { ... } object here"
                  value={pasteArea}
                  onChange={(e) => setPasteArea(e.target.value)}
                  rows={2}
                  className="flex-1 bg-primary-bg border border-white/10 rounded-xl px-3 py-2 text-xs text-text-main outline-none focus:border-primary-accent resize-none placeholder-text-muted/30"
                />
                <button
                  type="button"
                  onClick={handlePasteConfig}
                  className="px-3 py-2 rounded-xl bg-card-bg border border-white/5 text-[10px] font-bold text-text-muted hover:text-text-main transition flex flex-col items-center justify-center shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mb-1" />
                  Parse
                </button>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <span className="relative px-3 bg-card-bg text-[10px] text-text-muted uppercase font-bold tracking-wider">Or Fill Manually</span>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Project ID</label>
                  <input
                    type="text"
                    placeholder="my-jeopardy-app"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-text-main outline-none focus:border-primary-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">App ID</label>
                  <input
                    type="text"
                    placeholder="1:123:web:abc"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-text-main outline-none focus:border-primary-accent"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">API Key</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-text-main outline-none focus:border-primary-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Realtime Database URL</label>
                <input
                  type="text"
                  placeholder="https://your-db-rdb.firebaseio.com"
                  value={databaseURL}
                  onChange={(e) => setDatabaseURL(e.target.value)}
                  className="w-full bg-primary-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-text-main outline-none focus:border-primary-accent"
                />
              </div>

              {error && (
                <p className="text-xs text-danger-accent bg-danger-accent/10 border border-danger-accent/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={success}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary-accent hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-primary-accent/20 transition disabled:opacity-50"
              >
                {success ? (
                  <>
                    <Check className="w-4 h-4" /> Connected!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save & Connect
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
