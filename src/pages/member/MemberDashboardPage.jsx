import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMember } from '../../contexts/MemberContext.jsx';
import { getProviderById } from '../../services/providerService.js';
import { CONDITION_CATEGORY_LABELS } from '../../data/icd10Data.js';
import { calculateAge, formatPhone, toTitleCase } from '../../utils/helpers.js';
import Card from '../../components/common/Card.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

/**
 * Quick-access cards linking to the member self-service features.
 * @type {{ to: string, title: string, description: string, accent: string, icon: React.ReactElement }[]}
 */
const QUICK_LINKS = [
  {
    to: '/member/account',
    title: 'My Account',
    description: 'View and update your contact information.',
    accent: 'bg-csnp-blue-50 text-csnp-primary',
    icon: (<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  },
  {
    to: '/member/pcp',
    title: 'Change PCP',
    description: 'Request a change to your primary care provider.',
    accent: 'bg-green-50 text-green-600',
    icon: (<><path d="M5 21v-1a5 5 0 015-5h4a5 5 0 015 5v1" /><circle cx="12" cy="7" r="4" /></>),
  },
  {
    to: '/member/documents',
    title: 'Documents',
    description: 'Go paperless and view your plan documents.',
    accent: 'bg-amber-50 text-amber-600',
    icon: (<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>),
  },
  {
    to: '/member/notifications',
    title: 'Notifications',
    description: 'Choose how and when we contact you.',
    accent: 'bg-purple-50 text-purple-600',
    icon: (<><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></>),
  },
];

/**
 * A labelled fact in the plan summary grid.
 * @param {Object} props
 * @param {string} props.label - Field label
 * @param {string} props.value - Field value
 * @returns {React.ReactElement}
 */
function SummaryItem({ label, value }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5 truncate" title={value}>{value || '—'}</p>
    </div>
  );
}

/**
 * Member portal home page. Greets the member and shows a plan summary plus
 * quick links to the self-service features.
 *
 * @returns {React.ReactElement}
 */
export default function MemberDashboardPage() {
  const { member, loading, error } = useMember();

  const pcpName = useMemo(() => {
    if (!member || !member.primaryProviderId) {
      return 'Not assigned';
    }
    try {
      const provider = getProviderById(member.primaryProviderId);
      if (provider) {
        return `Dr. ${provider.firstName} ${provider.lastName}`;
      }
    } catch {
      // fall through
    }
    return 'Not assigned';
  }, [member]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner size="lg" variant="primary" text="Loading your information..." />
      </div>
    );
  }

  if (error || !member) {
    return (
      <EmptyState
        title="Member information unavailable"
        description={error || 'We could not find your member record. Please contact support.'}
        iconType="error"
        size="md"
      />
    );
  }

  const age = calculateAge(member.dateOfBirth);
  const condition = member.conditionCategory
    ? (CONDITION_CATEGORY_LABELS[member.conditionCategory] || toTitleCase(member.conditionCategory))
    : '—';

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">
          Welcome back, {member.firstName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your Chronic Condition Special Needs Plan (C-SNP) membership.
        </p>
      </div>

      {/* Plan summary */}
      <Card bordered flat={false}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-csnp-primary">Plan Summary</p>
            <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              Active
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <SummaryItem label="Plan Type" value="C-SNP (Part C)" />
            <SummaryItem label="Member ID" value={member.medicareId} />
            <SummaryItem label="Primary Condition" value={condition} />
            <SummaryItem label="Primary Care Provider" value={pcpName} />
            <SummaryItem label="Date of Birth" value={age != null ? `${member.dateOfBirth} (age ${age})` : member.dateOfBirth} />
            <SummaryItem label="Phone" value={member.phone ? formatPhone(member.phone) : '—'} />
          </div>
        </div>
      </Card>

      {/* Quick links */}
      <div>
        <p className="text-sm font-semibold text-csnp-primary mb-3">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group block p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-card hover:border-csnp-primary-light transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-csnp-primary-light"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${link.accent}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {link.icon}
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-csnp-primary">{link.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
