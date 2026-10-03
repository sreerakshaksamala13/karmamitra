import Constants from 'expo-constants';

/**
 * Works out where the API lives.
 *
 * When you run the app with `npx expo start` and open it in Expo Go, the
 * dev server already knows your computer's LAN IP. We reuse that IP so the
 * phone can reach the API without any manual configuration.
 *
 * If you deploy the API somewhere public, set `expo.extra.apiUrl` in
 * app.json (e.g. "https://api.example.com/api").
 */
export const API_PORT = 5005;

function guessFromExpo() {
  // e.g. "192.168.1.7:8081" -> "192.168.1.7"
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  return host ? `http://${host}:${API_PORT}/api` : null;
}

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl || guessFromExpo() || `http://localhost:${API_PORT}/api`;
