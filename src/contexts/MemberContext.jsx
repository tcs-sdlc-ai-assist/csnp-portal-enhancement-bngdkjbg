import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getCurrentMember, updateMemberProfile } from '../services/memberService.js';
import { useAuth } from './AuthContext.jsx';

/**
 * @typedef {Object} MemberContextValue
 * @property {Object|null} member - The current member record from `csnp_members`
 * @property {boolean} loading - Whether the member record is being loaded
 * @property {string|null} error - Most recent error message
 * @property {function(): void} refresh - Reload the member record from storage
 * @property {function(Object): Promise<import('../services/memberService.js').MemberUpdateResult>} updateProfile - Update editable profile fields
 */

const MemberContext = createContext(null);

/**
 * Provides the currently authenticated member's record and self-service
 * actions to the member portal. Must be rendered inside an AuthProvider,
 * below a route guarded to the `member` role.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function MemberProvider({ children }) {
  const { user } = useAuth();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Loads the member record linked to the current user.
   */
  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const record = getCurrentMember();
      setMember(record);
      if (!record) {
        setError('No member record is linked to this account.');
      }
    } catch (err) {
      console.error('MemberContext.refresh: unexpected error:', err);
      setMember(null);
      setError('Unable to load your member information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, user]);

  /**
   * Updates editable profile fields and refreshes local state on success.
   * @param {Object} patch - Partial member fields to apply
   * @returns {Promise<import('../services/memberService.js').MemberUpdateResult>}
   */
  const updateProfile = useCallback(async (patch) => {
    const memberId = member ? member.id : (user ? user.memberId : null);
    const result = await updateMemberProfile(memberId, patch, {
      performedBy: user ? user.id : undefined,
    });
    if (result.success && result.member) {
      setMember(result.member);
    }
    return result;
  }, [member, user]);

  const contextValue = {
    member,
    loading,
    error,
    refresh,
    updateProfile,
  };

  return (
    <MemberContext.Provider value={contextValue}>
      {children}
    </MemberContext.Provider>
  );
}

MemberProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to access the member context. Must be used within a MemberProvider.
 * @returns {MemberContextValue}
 */
export function useMember() {
  const context = useContext(MemberContext);
  if (context === null) {
    throw new Error('useMember must be used within a MemberProvider');
  }
  return context;
}

export default MemberContext;
