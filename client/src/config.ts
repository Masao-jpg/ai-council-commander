// API Configuration for mobile app
// For mobile: Change this to your PC's IP address (e.g., 'http://192.168.1.100:3001')
// For web: Leave as empty string to use proxy
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper function to get full API URL
export function getApiUrl(path: string): string {
  const url = `${API_BASE_URL}${path}`;
  console.log(`🔗 API Request: ${url} (BASE: ${API_BASE_URL || 'empty - using proxy'})`);
  return url;
}
