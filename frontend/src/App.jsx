import { useState, useEffect, useCallback } from 'react';
import { createEntry, getEntries, analyzeEntry, getInsights, streamAnalysis } from './api';
import './App.css';

const AMBIENCES = [
  { id: 'forest',    label: 'Forest',    icon: '🌲', color: '#4a6741' },
  { id: 'ocean',     label: 'Ocean',     icon: '🌊', color: '#2c4a6e' },
  { id: 'mountain',  label: 'Mountain',  icon: '⛰️',  color: '#5c6b7a' },
  { id: 'desert',    label: 'Desert',    icon: '🏜️',  color: '#c4875a' },
  { id: 'meadow',    label: 'Meadow',    icon: '🌿', color: '#6b9463' },
  { id: 'waterfall', label: 'Waterfall', icon: '💧', color: '#4a7fa5' },
];

// rough color mapping for emotions - not exhaustive but covers the main ones
const EMOTION_COLORS = {
  calm: '#4a6741',
  peaceful: '#4a6741',
  serene: '#6b9463',
  happy: '#c9a84c',
  joyful: '#c9a84c',
  grateful: '#c9a84c',
  anxious: '#c4875a',
  stressed: '#c4875a',
  worried: '#c4875a',
  sad: '#4a7fa5',
  melancholic: '#2c4a6e',
  excited: '#9b6b3a',
  energetic: '#c9a84c',
  hopeful: '#8ab87a',
  reflective: '#6b4f3a',
};

// hardcoded for now - in a real app this would come from auth
const USER_ID = 'user_001';

export default function App() {
  const [activeTab, setActiveTab] = useState('write');

  // write form
  const [journalText, setJournalText] = useState('');
  const [selectedAmbience, setSelectedAmbience] = useState('forest');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // { type: 'success'|'error', msg }

  // entries list
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // per-entry analysis loading state
  const [analyzingId, setAnalyzingId] = useState({}); // { [id]: bool }
  const [streamText, setStreamText] = useState({});   // { [id]: string }

  // insights
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const data = await getEntries(USER_ID);
      setEntries(data.entries || []);
    } catch (e) {
      console.error('loadEntries failed:', e);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  const loadInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const data = await getInsights(USER_ID);
      setInsights(data);
    } catch (e) {
      console.error('loadInsights failed:', e);
    } finally {
      setLoadingInsights(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'entries') loadEntries();
    if (activeTab === 'insights') loadInsights();
  }, [activeTab]);

  async function handleSave() {
    if (!journalText.trim() || saving) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      await createEntry(USER_ID, selectedAmbience, journalText);
      setSaveStatus({ type: 'success', msg: 'Entry saved!' });
      setJournalText('');
    } catch (e) {
      setSaveStatus({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyze(entry) {
    setAnalyzingId(prev => ({ ...prev, [entry.id]: true }));
    try {
      const result = await analyzeEntry(entry.text, entry.id);
      setEntries(prev => prev.map(e => {
        if (e.id !== entry.id) return e;
        return { ...e, emotion: result.emotion, keywords: result.keywords, summary: result.summary };
      }));
    } catch (e) {
      console.error('analyze failed:', e);
    } finally {
      setAnalyzingId(prev => ({ ...prev, [entry.id]: false }));
    }
  }

  function handleDeepReflect(entry) {
    setStreamText(prev => ({ ...prev, [entry.id]: '' }));
    setAnalyzingId(prev => ({ ...prev, [entry.id]: true }));

    streamAnalysis(
      entry.text,
      (chunk) => setStreamText(prev => ({
        ...prev,
        [entry.id]: (prev[entry.id] || '') + chunk
      })),
      () => setAnalyzingId(prev => ({ ...prev, [entry.id]: false })),
      (err) => {
        console.error('stream error:', err);
        setAnalyzingId(prev => ({ ...prev, [entry.id]: false }));
      }
    );
  }

  const currentAmbience = AMBIENCES.find(a => a.id === selectedAmbience);

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon">✦</span>
            <div>
              <h1 className="brand-title">ArvyaX Journal</h1>
              <p className="brand-sub">Dream › Innovate › Create</p>
            </div>
          </div>
          <div className="user-pill">
            <span className="user-dot" />
            {USER_ID}
          </div>
        </div>
      </header>

      <nav className="tabs">
        {[
          { id: 'write',    label: '✍️ Write' },
          { id: 'entries',  label: '📖 Entries' },
          { id: 'insights', label: '✦ Insights' },
        ].map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main">

        {/* ── Write ── */}
        {activeTab === 'write' && (
          <div className="panel animate-fadeUp">
            <div className="panel-header">
              <h2>New Entry</h2>
              <p className="panel-sub">Reflect on your nature session</p>
            </div>

            <div className="field">
              <label className="field-label">Ambience</label>
              <div className="ambience-grid">
                {AMBIENCES.map(a => (
                  <button
                    key={a.id}
                    className={`ambience-btn ${selectedAmbience === a.id ? 'selected' : ''}`}
                    style={selectedAmbience === a.id ? { '--ac': a.color } : {}}
                    onClick={() => setSelectedAmbience(a.id)}
                  >
                    <span className="ambience-icon">{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label">
                Journal Entry
                <span className="char-count">{journalText.length} chars</span>
              </label>
              <div
                className="textarea-wrap"
                style={{ '--border-color': currentAmbience?.color + '60' }}
              >
                <textarea
                  className="textarea"
                  placeholder={`How did your ${currentAmbience?.label.toLowerCase()} session feel today?`}
                  value={journalText}
                  onChange={e => setJournalText(e.target.value)}
                  rows={7}
                />
              </div>
            </div>

            {saveStatus && (
              <div className={`msg msg-${saveStatus.type}`}>
                {saveStatus.type === 'success' ? '✓ ' : '✗ '}
                {saveStatus.msg}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!journalText.trim() || saving}
            >
              {saving ? <><span className="spinner" /> Saving…</> : 'Save to Journal →'}
            </button>
          </div>
        )}

        {/* ── Entries ── */}
        {activeTab === 'entries' && (
          <div className="panel animate-fadeUp">
            <div className="panel-header between">
              <div>
                <h2>Journal Entries</h2>
                <p className="panel-sub">{entries.length} entries</p>
              </div>
              <button className="btn btn-ghost" onClick={loadEntries}>↻ Refresh</button>
            </div>

            {loadingEntries && (
              <div className="loading-row">
                <span className="spinner" /> Loading…
              </div>
            )}

            {!loadingEntries && entries.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon">🌿</span>
                <p>No entries yet. Head to Write to add one.</p>
              </div>
            )}

            <div className="entries-list">
              {entries.map((entry, i) => {
                const amb = AMBIENCES.find(a => a.id === entry.ambience);
                const emotionColor = entry.emotion
                  ? (EMOTION_COLORS[entry.emotion] || '#6b4f3a')
                  : null;

                return (
                  <div
                    key={entry.id}
                    className="entry-card animate-fadeUp"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="entry-top">
                      <div className="entry-meta">
                        <span className="entry-ambience" style={{ '--amb': amb?.color }}>
                          {amb?.icon} {amb?.label}
                        </span>
                        <span className="entry-date">
                          {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {entry.emotion && (
                        <span className="emotion-badge" style={{ '--ec': emotionColor }}>
                          {entry.emotion}
                        </span>
                      )}
                    </div>

                    <p className="entry-text">{entry.text}</p>

                    {entry.summary && (
                      <div className="entry-analysis">
                        <p className="analysis-summary">{entry.summary}</p>
                        {entry.keywords && (
                          <div className="keywords">
                            {entry.keywords.map(kw => (
                              <span key={kw} className="keyword">{kw}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {streamText[entry.id] && (
                      <div className="stream-output">
                        <p className="stream-label">✦ AI Reflection</p>
                        <p className="stream-text">{streamText[entry.id]}</p>
                      </div>
                    )}

                    {!entry.emotion && (
                      <div className="entry-actions">
                        <button
                          className="btn btn-sm btn-moss"
                          onClick={() => handleAnalyze(entry)}
                          disabled={analyzingId[entry.id]}
                        >
                          {analyzingId[entry.id]
                            ? <><span className="spinner" /> Analyzing…</>
                            : '⚡ Quick Analyze'}
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleDeepReflect(entry)}
                          disabled={analyzingId[entry.id]}
                        >
                          ✦ Deep Reflection
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Insights ── */}
        {activeTab === 'insights' && (
          <div className="panel animate-fadeUp">
            <div className="panel-header between">
              <div>
                <h2>Your Insights</h2>
                <p className="panel-sub">Patterns in your mental landscape</p>
              </div>
              <button className="btn btn-ghost" onClick={loadInsights}>↻ Refresh</button>
            </div>

            {loadingInsights && (
              <div className="loading-row">
                <span className="spinner" /> Loading insights…
              </div>
            )}

            {!loadingInsights && insights?.totalEntries === 0 && (
              <div className="empty-state">
                <span className="empty-icon">✦</span>
                <p>Write and analyze some entries first to see insights.</p>
              </div>
            )}

            {!loadingInsights && insights && insights.totalEntries > 0 && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-val">{insights.totalEntries}</span>
                    <span className="stat-lbl">Total Entries</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-val">{insights.analyzedEntries}</span>
                    <span className="stat-lbl">Analyzed</span>
                  </div>
                  <div className="stat-card">
                    <span
                      className="stat-val"
                      style={{
                        color: insights.topEmotion
                          ? (EMOTION_COLORS[insights.topEmotion] || '#6b4f3a')
                          : 'inherit'
                      }}
                    >
                      {insights.topEmotion || '—'}
                    </span>
                    <span className="stat-lbl">Top Emotion</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-val">
                      {AMBIENCES.find(a => a.id === insights.mostUsedAmbience)?.icon || '—'}
                      {' '}{insights.mostUsedAmbience || '—'}
                    </span>
                    <span className="stat-lbl">Favourite Ambience</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-val">{insights.recentEntries}</span>
                    <span className="stat-lbl">Last 7 Days</span>
                  </div>
                </div>

                {insights.emotionBreakdown?.length > 0 && (
                  <div className="breakdown-section">
                    <h3 className="breakdown-title">Emotional Landscape</h3>
                    <div className="bars">
                      {insights.emotionBreakdown.map(({ emotion, count }) => {
                        const maxCount = insights.emotionBreakdown[0].count;
                        const pct = Math.round((count / maxCount) * 100);
                        const color = EMOTION_COLORS[emotion] || '#6b4f3a';
                        return (
                          <div key={emotion} className="bar-row">
                            <span className="bar-label">{emotion}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
                            </div>
                            <span className="bar-count">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {insights.ambienceBreakdown?.length > 0 && (
                  <div className="breakdown-section">
                    <h3 className="breakdown-title">Nature Sessions</h3>
                    <div className="ambience-breakdown">
                      {insights.ambienceBreakdown.map(({ ambience: amb, count }) => {
                        const a = AMBIENCES.find(x => x.id === amb);
                        return (
                          <div key={amb} className="amb-chip" style={{ '--c': a?.color }}>
                            {a?.icon} {amb}
                            <span className="amb-count">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {insights.recentKeywords?.length > 0 && (
                  <div className="breakdown-section">
                    <h3 className="breakdown-title">Recurring Themes</h3>
                    <div className="keywords large">
                      {insights.recentKeywords.map(kw => (
                        <span key={kw} className="keyword">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </main>

      <footer className="footer">
        <p>ArvyaX · RevoltronX Intern Assignment</p>
      </footer>
    </div>
  );
}