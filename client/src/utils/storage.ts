/**
 * Storage utility for Web and Android (Capacitor) compatibility
 *
 * Uses localStorage (available in both Web and Capacitor)
 * Future: Can be extended to use @capacitor/preferences for native storage
 */

const STORAGE_KEYS = {
  SESSION_ID: 'ai_council_sessionId',
  THEME: 'ai_council_theme',
  MODE: 'ai_council_mode',
  OUTPUT_MODE: 'ai_council_outputMode',
  CURRENT_PHASE: 'ai_council_currentPhase',
} as const;

export interface StoredSessionInfo {
  sessionId: string;
  theme: string;
  mode: string;
  outputMode: 'implementation' | 'documentation';
  currentPhase: number;
  timestamp: number; // When this session was last saved
}

/**
 * Save session info to storage (sessionID and minimal metadata only)
 */
export function saveSessionInfo(info: Omit<StoredSessionInfo, 'timestamp'>): void {
  try {
    const dataToSave: StoredSessionInfo = {
      ...info,
      timestamp: Date.now(),
    };

    // Save as single JSON object for easy retrieval
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, JSON.stringify(dataToSave));

    console.log('✅ Session info saved to storage:', dataToSave.sessionId);
  } catch (error) {
    console.error('❌ Failed to save session info:', error);
  }
}

/**
 * Load session info from storage
 * Returns null if no session found or expired
 */
export function loadSessionInfo(): StoredSessionInfo | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    if (!saved) {
      console.log('ℹ️ No saved session found');
      return null;
    }

    const data: StoredSessionInfo = JSON.parse(saved);

    // Check if session is too old (older than 24 hours)
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - data.timestamp > MAX_AGE) {
      console.log('⚠️ Saved session expired, clearing...');
      clearSessionInfo();
      return null;
    }

    console.log('✅ Session info loaded from storage:', data.sessionId);
    return data;
  } catch (error) {
    console.error('❌ Failed to load session info:', error);
    return null;
  }
}

/**
 * Clear session info from storage
 */
export function clearSessionInfo(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    console.log('🗑️ Session info cleared from storage');
  } catch (error) {
    console.error('❌ Failed to clear session info:', error);
  }
}

/**
 * Check if a session exists in storage
 */
export function hasStoredSession(): boolean {
  return localStorage.getItem(STORAGE_KEYS.SESSION_ID) !== null;
}
