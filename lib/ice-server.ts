const turnApiKey = process.env.NEXT_PUBLIC_METERED_API_KEY;
const TURN_API_URL = `https://whonoahexe.metered.live/api/v1/turn/credentials?apiKey=${turnApiKey}`;

const STUN_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
    ],
  },
];

// Fetches TURN credentials from the Metered API
export async function fetchTurnCredentials(): Promise<RTCIceServer[] | null> {
  if (!turnApiKey) {
    console.warn('[TURN] NEXT_PUBLIC_METERED_API_KEY not found in environment variables');
    return null;
  }

  try {
    const response = await fetch(TURN_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[TURN] Failed to fetch TURN credentials:', response.status, response.statusText);
      return null;
    }

    const data: RTCIceServer[] = await response.json();
    console.log('[TURN] API Response:', data);

    // The API returns RTCIceServer objects directly
    return data;
  } catch (error) {
    console.warn('[TURN] Error fetching TURN credentials:', error);
    return null;
  }
}

// Creates ICE server configuration with STUN-first, TURN-fallback strategy
export async function createIceServerConfig(): Promise<RTCIceServer[]> {
  // Always include STUN servers first for optimal performance
  const iceServers: RTCIceServer[] = [...STUN_SERVERS];

  // Try to add TURN servers as fallback
  try {
    const turnServers = await fetchTurnCredentials();

    if (turnServers && turnServers.length > 0) {
      iceServers.push(...turnServers);
      console.log('[TURN] Successfully configured TURN servers as fallback');
    } else {
      console.log('[TURN] No TURN credentials available, using STUN-only configuration');
    }
  } catch (error) {
    console.warn('[TURN] Failed to configure TURN servers, falling back to STUN-only:', error);
  }

  return iceServers;
}

// Gets STUN-only configuration for initial connection attempts
export function getStunOnlyConfig(): RTCIceServer[] {
  return [...STUN_SERVERS];
}

// Creates RTCConfiguration with ICE servers and optimal settings
export async function createRTCConfiguration(): Promise<RTCConfiguration> {
  const iceServers = await createIceServerConfig();

  return {
    iceServers,
    iceTransportPolicy: 'all', // Allow both STUN and TURN
    iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
  };
}

// Creates RTCConfiguration with STUN-only for initial connection attempts
export function createStunOnlyRTCConfiguration(): RTCConfiguration {
  return {
    iceServers: getStunOnlyConfig(),
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 10,
  };
}
