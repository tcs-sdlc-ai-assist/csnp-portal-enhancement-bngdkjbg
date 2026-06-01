import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout.jsx';
import MemberLayout from './components/layout/MemberLayout.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import LoadingSpinner from './components/common/LoadingSpinner.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import { USER_ROLES } from './utils/constants.js';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const EligibilityPage = lazy(() => import('./pages/EligibilityPage.jsx'));
const EnrollmentPage = lazy(() => import('./pages/EnrollmentPage.jsx'));
const BenefitsPage = lazy(() => import('./pages/BenefitsPage.jsx'));
const ProvidersPage = lazy(() => import('./pages/ProvidersPage.jsx'));
const CareManagementPage = lazy(() => import('./pages/CareManagementPage.jsx'));
const ClaimsPage = lazy(() => import('./pages/ClaimsPage.jsx'));
const CompliancePage = lazy(() => import('./pages/CompliancePage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const ForbiddenPage = lazy(() => import('./pages/ForbiddenPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

// Member self-service portal pages (PRD 1)
const MemberDashboardPage = lazy(() => import('./pages/member/MemberDashboardPage.jsx'));
const MemberAccountPage = lazy(() => import('./pages/member/MemberAccountPage.jsx'));
const MemberPcpPage = lazy(() => import('./pages/member/MemberPcpPage.jsx'));
const MemberDocumentsPage = lazy(() => import('./pages/member/MemberDocumentsPage.jsx'));
const MemberNotificationsPage = lazy(() => import('./pages/member/MemberNotificationsPage.jsx'));

/**
 * Suspense fallback component for lazy-loaded routes.
 * @returns {React.ReactElement}
 */
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner
        size="lg"
        variant="primary"
        text="Loading page..."
      />
    </div>
  );
}

/**
 * Wraps a lazy-loaded page component in Suspense with a loading fallback.
 * @param {React.ReactElement} element - The lazy-loaded component element
 * @returns {React.ReactElement}
 */
function withSuspense(element) {
  return (
    <Suspense fallback={<PageLoader />}>
      {element}
    </Suspense>
  );
}

/**
 * Role-aware landing redirect for the index route.
 * Members are sent to the member portal; staff to the operations dashboard.
 * @returns {React.ReactElement}
 */
function RoleLanding() {
  const { user } = useAuth();
  if (user && user.role === USER_ROLES.MEMBER) {
    return <Navigate to="/member" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

/**
 * Application router configuration.
 * Defines all routes with MainLayout wrapper, ProtectedRoute guards,
 * role-based access control, and lazy loading for all page components.
 *
 * Route structure:
 * - /login — Public login page (no layout chrome)
 * - /403 — Public forbidden page
 * - / — Redirects to /dashboard
 * - /dashboard — Protected, all authenticated users
 * - /eligibility — Protected, admin, enrollment specialist, care manager, auditor
 * - /enrollment — Protected, admin, enrollment specialist, auditor
 * - /benefits — Protected, admin, enrollment specialist, care manager, auditor
 * - /providers — Protected, admin, care manager, enrollment specialist, provider, auditor
 * - /care-management — Protected, admin, care manager, auditor
 * - /claims — Protected, admin, claims processor, auditor
 * - /compliance — Protected, admin, auditor
 * - /audit-logs — Protected, admin, auditor (redirects to compliance page)
 * - /settings — Protected, admin
 * - /* — 404 Not Found
 */
const router = createBrowserRouter([
  {
    path: '/login',
    element: withSuspense(<LoginPage />),
  },
  {
    path: '/403',
    element: withSuspense(<ForbiddenPage />),
  },
  {
    path: '/member',
    element: (
      <ProtectedRoute allowedRoles={[USER_ROLES.MEMBER]}>
        <MemberLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: withSuspense(<MemberDashboardPage />),
      },
      {
        path: 'account',
        element: withSuspense(<MemberAccountPage />),
      },
      {
        path: 'pcp',
        element: withSuspense(<MemberPcpPage />),
      },
      {
        path: 'documents',
        element: withSuspense(<MemberDocumentsPage />),
      },
      {
        path: 'notifications',
        element: withSuspense(<MemberNotificationsPage />),
      },
    ],
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <RoleLanding />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
              USER_ROLES.CARE_MANAGER,
              USER_ROLES.CLAIMS_PROCESSOR,
              USER_ROLES.ENROLLMENT_SPECIALIST,
              USER_ROLES.PROVIDER,
              USER_ROLES.AUDITOR,
              USER_ROLES.SUPERVISOR,
            ]}
            showForbidden={false}
            forbiddenRedirectTo="/member"
          >
            {withSuspense(<DashboardPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'eligibility',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
              USER_ROLES.ENROLLMENT_SPECIALIST,
              USER_ROLES.CARE_MANAGER,
              USER_ROLES.AUDITOR,
            ]}
          >
            {withSuspense(<EligibilityPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'enrollment',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
              USER_ROLES.ENROLLMENT_SPECIALIST,
              USER_ROLES.AUDITOR,
            ]}
          >
            {withSuspense(<EnrollmentPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'benefits',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
              USER_ROLES.ENROLLMENT_SPECIALIST,
              USER_ROLES.CARE_MANAGER,
              USER_ROLES.AUDITOR,
            ]}
          >
            {withSuspense(<BenefitsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'providers',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
              USER_ROLES.CARE_MANAGER,
              USER_ROLES.ENROLLMENT_SPECIALIST,
              USER_ROLES.PROVIDER,
              USER_ROLES.AUDITOR,
            ]}
          >
            {withSuspense(<ProvidersPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'care-management',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
              USER_ROLES.CARE_MANAGER,
              USER_ROLES.AUDITOR,
            ]}
          >
            {withSuspense(<CareManagementPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'claims',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
              USER_ROLES.CLAIMS_PROCESSOR,
              USER_ROLES.AUDITOR,
            ]}
          >
            {withSuspense(<ClaimsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'compliance',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
              USER_ROLES.AUDITOR,
            ]}
          >
            {withSuspense(<CompliancePage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit-logs',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
              USER_ROLES.AUDITOR,
            ]}
          >
            {withSuspense(<CompliancePage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute
            allowedRoles={[
              USER_ROLES.ADMIN,
            ]}
          >
            {withSuspense(<SettingsPage />)}
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: withSuspense(<NotFoundPage />),
      },
    ],
  },
]);

export default router;