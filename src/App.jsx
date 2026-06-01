import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { AppProvider } from './contexts/AppContext.jsx';
import { initializeStorage } from './utils/storage.js';
import router from './router.jsx';
import LoadingSpinner from './components/common/LoadingSpinner.jsx';

/**
 * Fallback loading component displayed while the router is initializing.
 * @returns {React.ReactElement}
 */
function RouterFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner
        size="lg"
        variant="primary"
        text="Loading CSNP Portal..."
      />
    </div>
  );
}

/**
 * Root application component.
 * Wraps the application with AuthContext and AppContext providers,
 * renders the RouterProvider with the application router,
 * and initializes localStorage with seed data on first load.
 *
 * @returns {React.ReactElement}
 */
export default function App() {
  /**
   * Initializes localStorage with seed data on first application load.
   * Only runs once — seed data is not re-initialized if already present.
   */
  useEffect(() => {
    try {
      initializeStorage(false);
    } catch (error) {
      console.error('App: failed to initialize seed data:', error);
    }
  }, []);

  return (
    <AuthProvider>
      <AppProvider>
        <RouterProvider
          router={router}
          fallbackElement={<RouterFallback />}
        />
      </AppProvider>
    </AuthProvider>
  );
}