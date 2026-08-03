const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWJhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const EXTENSION_SESSION_STORAGE_KEY = 'siages-extension-session';
const SESSION_REFRESH_ALARM = 'siages-extension-session-refresh';
const REFRESH_AHEAD_SECONDS = 20 * 60;

async function refreshSessionIfNeeded() {
  const stored = await chrome.storage.local.get(EXTENSION_SESSION_STORAGE_KEY);
  const session = stored[EXTENSION_SESSION_STORAGE_KEY];
  if (!session?.accessToken || !session?.refreshToken) return;
  if (Number(session.expiresAt || 0) > (Date.now() / 1000) + REFRESH_AHEAD_SECONDS) return;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!response.ok) {
    await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
    return;
  }

  const payload = await response.json();
  if (!payload.access_token || !payload.refresh_token) {
    await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
    return;
  }
  await chrome.storage.local.set({
    [EXTENSION_SESSION_STORAGE_KEY]: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
    },
  });
}

function scheduleSessionRefresh() {
  chrome.alarms.create(SESSION_REFRESH_ALARM, { periodInMinutes: 15 });
  void refreshSessionIfNeeded();
}

chrome.runtime.onInstalled.addListener(scheduleSessionRefresh);
chrome.runtime.onStartup.addListener(scheduleSessionRefresh);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SESSION_REFRESH_ALARM) void refreshSessionIfNeeded();
});
