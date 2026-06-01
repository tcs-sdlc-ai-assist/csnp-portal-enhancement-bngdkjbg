import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useApp } from '../contexts/AppContext.jsx';
import Tabs from '../components/common/Tabs.jsx';
import Button from '../components/common/Button.jsx';
import Card from '../components/common/Card.jsx';
import Alert from '../components/common/Alert.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import FormField from '../components/common/FormField.jsx';
import UserManagement from '../components/settings/UserManagement.jsx';
import DataExportImport from '../components/settings/DataExportImport.jsx';
import { getStorageStats } from '../utils/storage.js';
import { formatDateTime, formatRelativeTime, toTitleCase } from '../utils/helpers.js';
import { USER_ROLE_LABELS, APP_TITLE, SESSION_TIMEOUT } from '../utils/constants.js';

/**
 * Formats a byte count to a human-readable string.
 * @param {number} bytes - Byte count
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }
  if (bytes === 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Storage usage gauge component.
 *
 * @param {Object} props
 * @param {number} props.usedBytes - Used storage in bytes
 * @param {number} props.remainingBytes - Remaining storage in bytes
 * @param {number} props.totalKeys - Total number of localStorage keys
 * @param {string} props.sizeFormatted - Formatted size string
 * @returns {React.ReactElement}
 */
function StorageUsageDisplay({ usedBytes, remainingBytes, totalKeys, sizeFormatted }) {
  const estimatedMax = 5 * 1024 * 1024; // 5MB
  const usagePercentage = estimatedMax > 0
    ? Math.min(Math.round((usedBytes / estimatedMax) * 10000) / 100, 100)
    : 0;

  let barColor = 'bg-green-500';
  if (usagePercentage >= 80) {
    barColor = 'bg-red-500';
  } else if (usagePercentage >= 60) {
    barColor = 'bg-yellow-500';
  } else if (usagePercentage >= 40) {
    barColor = 'bg-blue-500';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Storage Usage
        </p>
        <span className="text-[10px] font-medium text-gray-400">
          {usagePercentage}% used
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${Math.max(usagePercentage, 1)}%` }}
          role="progressbar"
          aria-valuenow={usagePercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Storage usage: ${usagePercentage}%`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Used</p>
          <p className="text-sm font-bold text-csnp-primary mt-0.5">{sizeFormatted}</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Remaining</p>
          <p className="text-sm font-bold text-green-700 mt-0.5">{formatBytes(remainingBytes)}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Keys</p>
          <p className="text-sm font-bold text-gray-700 mt-0.5">{totalKeys}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Max Capacity</p>
          <p className="text-sm font-bold text-gray-700 mt-0.5">{formatBytes(estimatedMax)}</p>
        </div>
      </div>

      {usagePercentage >= 80 && (
        <Alert
          variant="warning"
          title="Storage Nearly Full"
          showIcon={true}
          bordered={true}
          size="sm"
        >
          localStorage usage is at {usagePercentage}%. Consider exporting and clearing old data to free up space.
        </Alert>
      )}
    </div>
  );
}

/**
 * System information display component.
 *
 * @returns {React.ReactElement}
 */
function SystemInformation() {
  const buildDate = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        System Information
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Application</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">{APP_TITLE}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Version</p>
          <p className="text-xs font-mono font-medium text-gray-700 mt-0.5">1.0.0</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Environment</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">
            {import.meta.env.MODE || 'development'}
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Session Timeout</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">
            {Math.floor(SESSION_TIMEOUT / 60)} minutes
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Storage Backend</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">localStorage</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Build Framework</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">Vite + React 18</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">CSS Framework</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">Tailwind CSS 3</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Routing</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">React Router v6</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Authentication</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">Simulated JWT</p>
        </div>
      </div>

      {/* Regulatory Info */}
      <div className="flex items-start gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-csnp-primary flex-shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
          <span className="font-semibold">Regulatory Framework:</span>{' '}
          This portal is designed for Chronic Condition Special Needs Plans (C-SNP) in compliance
          with CMS regulations (42 CFR §422.4). All data handling follows HIPAA privacy and security
          requirements (45 CFR §164.312). The audit trail provides tamper-evident logging with hash
          chain integrity verification.
        </p>
      </div>
    </div>
  );
}

/**
 * Application preferences component.
 *
 * @returns {React.ReactElement}
 */
function ApplicationPreferences() {
  const { user } = useAuth();
  const { sidebarCollapsed, toggleSidebar, theme, setTheme } = useApp();

  const userRoleLabel = user
    ? (USER_ROLE_LABELS[user.role] || toTitleCase(user.role || 'unknown'))
    : '';

  return (
    <div className="space-y-6">
      {/* User Profile */}
      <Card bordered={true} flat={false} size="sm">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-csnp-primary">User Profile</p>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-csnp-primary flex items-center justify-center text-lg font-bold text-white">
              {user && user.firstName ? user.firstName.charAt(0).toUpperCase() : ''}
              {user && user.lastName ? user.lastName.charAt(0).toUpperCase() : ''}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {user ? `${user.firstName} ${user.lastName}` : 'Unknown User'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {user ? user.email : ''}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <StatusBadge
                  status="active"
                  label={userRoleLabel}
                  size="sm"
                  showDot={false}
                  bordered={true}
                />
                <span className="text-[10px] text-gray-400">
                  @{user ? user.username : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">User ID</p>
              <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={user ? user.id : ''}>
                {user && user.id ? user.id.substring(0, 16) + '…' : '—'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Username</p>
              <p className="text-xs font-mono text-gray-700 mt-0.5">
                {user ? user.username : '—'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Role</p>
              <p className="text-xs text-gray-700 mt-0.5">{userRoleLabel || '—'}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Display Preferences */}
      <Card bordered={true} flat={false} size="sm">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-csnp-primary">Display Preferences</p>

          {/* Sidebar Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-700">Sidebar Collapsed</p>
              <p className="text-[10px] text-gray-500">
                Toggle the sidebar between expanded and collapsed modes
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sidebarCollapsed}
              onClick={toggleSidebar}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
                sidebarCollapsed ? 'bg-csnp-primary' : 'bg-gray-300'
              } cursor-pointer`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  sidebarCollapsed ? 'translate-x-5' : 'translate-x-0'
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Theme Selection */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-700">Theme</p>
              <p className="text-[10px] text-gray-500">
                Select the application color theme (dark mode is a preview feature)
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-1 ${
                  theme === 'light'
                    ? 'bg-csnp-primary text-white border-csnp-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-1 ${
                  theme === 'dark'
                    ? 'bg-csnp-primary text-white border-csnp-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          {/* Simulation Notice */}
          <div className="flex items-start gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-csnp-primary flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
              <span className="font-semibold">Simulation Mode:</span>{' '}
              This portal runs entirely in the browser using localStorage for data persistence.
              All data is stored locally and will be lost if browser storage is cleared.
              Use the Data Export feature to back up your data regularly.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Settings page component with tabbed interface.
 * Tab 1: Application Preferences (profile, display settings)
 * Tab 2: User Management (admin only - UserManagement component)
 * Tab 3: Data Export & Import (DataExportImport component)
 * Tab 4: Storage & System (storage usage, system information)
 *
 * @returns {React.ReactElement}
 */
export default function SettingsPage() {
  const { user, isAuthenticated, isAdminUser } = useAuth();
  const { addNotification } = useApp();

  // Active tab state
  const [activeTab, setActiveTab] = useState('preferences');

  // Storage stats state
  const [storageStats, setStorageStats] = useState(() => getStorageStats());

  /**
   * Refreshes storage statistics.
   */
  const refreshStorageStats = useCallback(() => {
    setStorageStats(getStorageStats());
  }, []);

  /**
   * Refreshes storage stats when switching to the storage tab.
   */
  useEffect(() => {
    if (activeTab === 'storage') {
      refreshStorageStats();
    }
  }, [activeTab, refreshStorageStats]);

  /**
   * Renders the Application Preferences tab content.
   * @returns {React.ReactElement}
   */
  function renderPreferencesTab() {
    return <ApplicationPreferences />;
  }

  /**
   * Renders the User Management tab content (admin only).
   * @returns {React.ReactElement}
   */
  function renderUserManagementTab() {
    if (!isAdminUser) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-400"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">Access Denied</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
            User management is restricted to administrators. Your current role does not have permission to access this section.
          </p>
        </div>
      );
    }

    return (
      <UserManagement
        showHeader={true}
        compact={false}
      />
    );
  }

  /**
   * Renders the Data Export & Import tab content.
   * @returns {React.ReactElement}
   */
  function renderDataTab() {
    return (
      <DataExportImport
        showHeader={true}
        compact={false}
      />
    );
  }

  /**
   * Renders the Storage & System tab content.
   * @returns {React.ReactElement}
   */
  function renderStorageTab() {
    return (
      <div className="space-y-6">
        {/* Storage Usage */}
        <Card bordered={true} flat={false} size="sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-csnp-primary">Storage Usage</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshStorageStats}
                iconLeft={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                  </svg>
                }
              >
                Refresh
              </Button>
            </div>

            <StorageUsageDisplay
              usedBytes={storageStats.sizeBytes}
              remainingBytes={storageStats.remainingBytes}
              totalKeys={storageStats.totalKeys}
              sizeFormatted={storageStats.sizeFormatted}
            />
          </div>
        </Card>

        {/* System Information */}
        <Card bordered={true} flat={false} size="sm">
          <SystemInformation />
        </Card>
      </div>
    );
  }

  /**
   * Builds the tabs configuration.
   */
  const tabs = useMemo(() => {
    const tabList = [
      {
        key: 'preferences',
        label: 'Preferences',
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        content: renderPreferencesTab(),
      },
    ];

    // User Management tab (visible to all, but content restricted to admins)
    tabList.push({
      key: 'users',
      label: 'User Management',
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      content: renderUserManagementTab(),
    });

    tabList.push({
      key: 'data',
      label: 'Data Export & Import',
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
      content: renderDataTab(),
    });

    tabList.push({
      key: 'storage',
      label: 'Storage & System',
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      ),
      content: renderStorageTab(),
    });

    return tabList;
  }, [isAdminUser, storageStats]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
              Settings
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage your profile, application preferences, user accounts, data backup, and system configuration.
            </p>
          </div>
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs
        tabs={tabs}
        activeKey={activeTab}
        onChange={setActiveTab}
        variant="underline"
        size="md"
      />

      {/* HIPAA Compliance Notice */}
      <div className="flex items-start gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-csnp-primary flex-shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <p className="text-[10px] text-csnp-blue-700 leading-relaxed">
          <span className="font-semibold">HIPAA Security:</span>{' '}
          Settings changes are subject to HIPAA security requirements (45 CFR §164.312).
          User account modifications, role changes, and data export/import operations are
          logged in the audit trail. Ensure users are assigned the minimum necessary role
          for their job function. Exported data may contain Protected Health Information (PHI)
          and must be handled securely.
        </p>
      </div>
    </div>
  );
}