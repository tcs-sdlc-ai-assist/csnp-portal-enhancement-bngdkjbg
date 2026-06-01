import React from 'react';
import PropTypes from 'prop-types';
import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

/**
 * Main application layout wrapper component.
 * Renders the sidebar, header, and content area with responsive design.
 * Handles sidebar collapse state and adjusts content area sizing accordingly.
 *
 * When the user is not authenticated, renders only the children/outlet
 * without the sidebar and header chrome.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.children] - Optional child content (falls back to <Outlet />)
 * @returns {React.ReactElement}
 */
export default function MainLayout({ children }) {
  const { sidebarCollapsed } = useApp();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        {children || <Outlet />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Header */}
      <Header />

      {/* Main Content Area */}
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <div className="p-4 md:p-6 lg:p-8">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}

MainLayout.propTypes = {
  children: PropTypes.node,
};

MainLayout.defaultProps = {
  children: null,
};