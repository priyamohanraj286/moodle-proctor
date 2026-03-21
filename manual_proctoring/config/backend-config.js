// ============================================================================
// Manual Proctoring Client Configuration
// Switch between dummy backend and main backend
// ============================================================================

const BACKEND_CONFIG = {
  // Use the main backend instead of the dummy Express backend
  // Options: 'main' | 'dummy'
  mode: 'main',

  // Main backend URL (your Fastify backend)
  main: {
    apiBaseUrl: 'http://localhost:3000'
  },

  // Dummy backend URL (local Express server)
  dummy: {
    apiBaseUrl: 'http://localhost:5000'
  }
};

// Export the appropriate configuration
const APP_CONFIG = BACKEND_CONFIG.mode === 'main'
  ? BACKEND_CONFIG.main
  : BACKEND_CONFIG.dummy;

console.log(`Manual Proctoring Client using ${BACKEND_CONFIG.mode.toUpperCase()} backend:`, APP_CONFIG.apiBaseUrl);

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APP_CONFIG, BACKEND_CONFIG };
}
