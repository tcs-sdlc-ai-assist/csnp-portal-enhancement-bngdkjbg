import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';

/**
 * Placeholder page for member self-service features that are scaffolded but
 * not yet implemented. Each PRD 1 feature group replaces its placeholder
 * route with the real page as it is built.
 *
 * @param {Object} props
 * @param {string} props.title - The feature title
 * @param {string} [props.prd] - The PRD 1 requirement reference(s)
 * @returns {React.ReactElement}
 */
export default function MemberPlaceholderPage({ title, prd }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-csnp-primary tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">Member self-service feature.</p>
      </div>

      <Card bordered flat={false}>
        <div className="flex flex-col items-center text-center py-12 px-4">
          <div className="w-16 h-16 rounded-full bg-csnp-blue-50 flex items-center justify-center text-csnp-primary mb-4">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800">Coming soon</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            This feature is part of the Member Portal enhancement and is being built.
            {prd ? <> <span className="font-medium text-gray-600">({prd})</span></> : null}
          </p>
          <Link
            to="/member"
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-csnp-primary text-white hover:bg-csnp-primary-dark focus:outline-none focus:ring-2 focus:ring-csnp-primary-light transition-colors duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Home
          </Link>
        </div>
      </Card>
    </div>
  );
}

MemberPlaceholderPage.propTypes = {
  title: PropTypes.string.isRequired,
  prd: PropTypes.string,
};

MemberPlaceholderPage.defaultProps = {
  prd: '',
};
