import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import { findEligibleProvidersForMember, getProviderNetwork } from '../../services/providerService.js';

/**
 * Returns whether a provider is in-network based on its contract.
 * @param {Object} provider - The provider record
 * @returns {boolean}
 */
function isInNetwork(provider) {
  return !!(provider && provider.contract && provider.contract.status === 'active' && provider.contract.contractType === 'In-Network');
}

/**
 * Simulated "Doctor & Hospital Finder" SSO modal (FR-003).
 * Mimics an SSO handoff to the external Find-a-Provider tool, then lets the
 * member search the in-network provider directory and select a new PCP.
 * All data comes from the local provider directory (no real backend).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSelect - Called with the selected provider record
 * @param {string} props.memberId - The member ID (for eligible-provider matching)
 * @param {string} [props.currentProviderId] - Current PCP to exclude from results
 * @returns {React.ReactElement}
 */
export default function DoctorFinderModal({ isOpen, onClose, onSelect, memberId, currentProviderId }) {
  const [connecting, setConnecting] = useState(true);
  const [providers, setProviders] = useState([]);
  const [query, setQuery] = useState('');

  // Simulate the SSO redirect/handoff, then load the directory.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    setConnecting(true);
    setQuery('');

    const timer = setTimeout(() => {
      let list = [];
      try {
        const eligible = findEligibleProvidersForMember(memberId);
        list = Array.isArray(eligible) && eligible.length > 0
          ? eligible
          : getProviderNetwork({ acceptingNewPatients: true, inNetworkOnly: true });
      } catch {
        list = [];
      }
      // Exclude current PCP and providers not accepting patients.
      list = (Array.isArray(list) ? list : []).filter(
        (p) => p.id !== currentProviderId && p.acceptingNewPatients !== false
      );
      setProviders(list);
      setConnecting(false);
    }, 900);

    return () => clearTimeout(timer);
  }, [isOpen, memberId, currentProviderId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return providers;
    }
    return providers.filter((p) => {
      const name = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
      return (
        name.includes(q) ||
        (p.specialty || '').toLowerCase().includes(q) ||
        (p.facilityName || '').toLowerCase().includes(q)
      );
    });
  }, [providers, query]);

  const handleSelect = useCallback((provider) => {
    onSelect(provider);
  }, [onSelect]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Doctor & Hospital Finder"
      size="lg"
      showCloseButton={!connecting}
    >
      {connecting ? (
        <div className="py-12 flex flex-col items-center text-center">
          <LoadingSpinner size="lg" variant="primary" />
          <p className="mt-4 text-sm font-medium text-gray-700">Connecting to Doctor &amp; Hospital Finder…</p>
          <p className="text-xs text-gray-400 mt-1">Securely signing you in via single sign-on (SSO).</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-csnp-primary flex-shrink-0 mt-0.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-[11px] text-csnp-blue-700 leading-relaxed">
              Showing in-network providers accepting new patients, matched to your plan and condition. Select a provider to continue your PCP change request.
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, specialty, or facility…"
              className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:border-transparent"
              aria-label="Search providers"
            />
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <EmptyState
              title="No matching providers"
              description={providers.length === 0 ? 'No in-network providers are currently accepting new patients.' : 'Try a different search term.'}
              iconType="no-results"
              size="sm"
            />
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {filtered.map((p) => {
                const inNet = isInNetwork(p);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-csnp-blue-50 text-csnp-primary flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            Dr. {p.firstName} {p.lastName}
                          </p>
                          <StatusBadge
                            status={inNet ? 'active' : 'expired'}
                            label={inNet ? 'In-Network' : 'Out-of-Network'}
                            size="sm"
                            showDot
                            bordered
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">
                          {p.specialty || 'General'} · {p.facilityName || 'No facility'}
                        </p>
                        {p.npi && <p className="text-[10px] text-gray-400 mt-0.5">NPI: {p.npi}</p>}
                      </div>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => handleSelect(p)}>
                      Select
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-200">
            <Button variant="outline" size="md" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

DoctorFinderModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  memberId: PropTypes.string.isRequired,
  currentProviderId: PropTypes.string,
};

DoctorFinderModal.defaultProps = {
  currentProviderId: null,
};
