import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import { USER_ROLE_LABELS } from '../../utils/constants.js';
import { toTitleCase } from '../../utils/helpers.js';

/**
 * Application header component.
 * Displays app logo/title, search bar, notification bell with count badge,
 * user profile dropdown with role and name, and logout button.
 *
 * @returns {React.ReactElement}
 */
export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { notifications, sidebarCollapsed } = useApp();
  const navigate = useNavigate();

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileDropdownRef = useRef(null);

  /**
   * Unread notification count.
   * @type {number}
   */
  const unreadCount = notifications.length;

  /**
   * Closes the profile dropdown when clicking outside.
   */
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setProfileDropdownOpen(false);
      }
    }

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  /**
   * Toggles the profile dropdown.
   */
  const toggleProfileDropdown = useCallback(() => {
    setProfileDropdownOpen((prev) => !prev);
  }, []);

  /**
   * Handles logout action.
   */
  const handleLogout = useCallback(() => {
    setProfileDropdownOpen(false);
    logout();
    navigate('/login');
  }, [logout, navigate]);

  /**
   * Handles search form submission.
   * @param {React.FormEvent} e - Form event
   */
  const handleSearchSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (searchQuery.trim().length > 0) {
        // Navigate to dashboard with search context
        navigate(`/dashboard?search=${encodeURIComponent(searchQuery.trim())}`);
        setSearchQuery('');
      }
    },
    [searchQuery, navigate]
  );

  /**
   * Handles navigation to profile/settings.
   */
  const handleProfileClick = useCallback(() => {
    setProfileDropdownOpen(false);
    navigate('/settings');
  }, [navigate]);

  if (!isAuthenticated) {
    return null;
  }

  const userRole = user && user.role
    ? USER_ROLE_LABELS[user.role] || toTitleCase(user.role)
    : '';

  const userInitials = user
    ? `${user.firstName ? user.firstName.charAt(0).toUpperCase() : ''}${user.lastName ? user.lastName.charAt(0).toUpperCase() : ''}`
    : '';

  const userFullName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : '';

  return (
    <header
      className={`fixed top-0 right-0 z-20 h-16 bg-white border-b border-gray-200 shadow-nav flex items-center justify-between px-4 md:px-6 transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      {/* Left Section: Title / Search */}
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        {/* App Title (visible on smaller screens or when sidebar is collapsed) */}
        <h1 className="text-lg font-bold text-csnp-primary tracking-tight hidden sm:block lg:hidden">
          CSNP Portal
        </h1>

        {/* Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex-1 max-w-md"
        >
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members, claims, providers..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg placeholder-gray-400 focus:bg-white focus:border-csnp-primary-light focus:ring-2 focus:ring-csnp-primary-light focus:outline-none transition-all duration-200"
              aria-label="Search"
            />
          </div>
        </form>
      </div>

      {/* Right Section: Notifications, Profile */}
      <div className="flex items-center space-x-3 ml-4">
        {/* Notification Bell */}
        <button
          type="button"
          className="relative p-2 rounded-lg text-gray-500 hover:text-csnp-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light transition-colors duration-200"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
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
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-csnp-alert-error rounded-full leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-gray-200" aria-hidden="true" />

        {/* Profile Dropdown */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            type="button"
            onClick={toggleProfileDropdown}
            className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light transition-colors duration-200"
            aria-expanded={profileDropdownOpen}
            aria-haspopup="true"
            aria-label="User menu"
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {userInitials}
            </div>

            {/* Name and Role (hidden on small screens) */}
            <div className="hidden md:flex flex-col items-start min-w-0">
              <span className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
                {userFullName}
              </span>
              <span className="text-xs text-gray-500 truncate max-w-[140px]">
                {userRole}
              </span>
            </div>

            {/* Chevron */}
            <svg
              className={`hidden md:block w-4 h-4 text-gray-400 transition-transform duration-200 ${
                profileDropdownOpen ? 'rotate-180' : ''
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userFullName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user ? user.email : ''}
                </p>
                <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-semibold text-csnp-primary bg-csnp-blue-50 rounded-full">
                  {userRole}
                </span>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={handleProfileClick}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-csnp-primary transition-colors duration-150"
                >
                  <svg
                    className="w-4 h-4 mr-3 text-gray-400"
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
                  Profile & Settings
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                >
                  <svg
                    className="w-4 h-4 mr-3 text-red-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}