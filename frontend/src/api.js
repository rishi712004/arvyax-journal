const BASE_URL = import.meta.env.VITE_API_URL + '/api';

export async function createEntry(userId, ambience, text) {
  const res = await fetch(`${BASE_URL}/journal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ambience, text }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save entry');
  return data;
}

export async function getEntries(userId) {
  const res = await fetch(`${BASE_URL}/journal/${userId}`);
  if (!res.ok) throw new Error('Failed to load entries');
  return res.json();
}

export async function analyzeEntry(text, entryId) {
  const res = await fetch(`${BASE_URL}/journal/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, entryId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Analysis failed');
  return data;
}

export async function getInsights(userId) {
  const res = await fetch(`${BASE_URL}/journal/insights/${userId}`);
  if (!res.ok) throw new Error('Could not load insights');
  return res.json();
}

// uses SSE to stream the AI reflection back in real-time
export function streamAnalysis(text, onChunk, onDone, onError) {
  const url = `${BASE_URL}/journal/analyze/stream?text=${encodeURIComponent(text)}`;
  const source = new EventSource(url);

  source.onmessage = (e) => {
    if (e.data === '[DONE]') {
      source.close();
      onDone?.();
      return;
    }
    try {
      const parsed = JSON.parse(e.data);
      if (parsed.error) {
        source.close();
        onError?.(new Error(parsed.error));
      } else if (parsed.chunk) {
        onChunk(parsed.chunk);
      }
    } catch {
      // ignore parse errors on SSE frames
    }
  };

  source.onerror = () => {
    source.close();
    onError?.(new Error('Stream disconnected'));
  };

  // return cleanup fn
  return () => source.close();
}