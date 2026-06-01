import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import Modal from '../common/Modal.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import EmptyState from '../common/EmptyState.jsx';
import FormField from '../common/FormField.jsx';
import DataTable from '../common/DataTable.jsx';
import Tabs from '../common/Tabs.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toTitleCase,
} from '../../utils/helpers.js';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
} from '../../utils/constants.js';
import { getItem, setItem } from '../../utils/storage.js';
import { logAction } from '../../services/auditLogger.js';
import { AUDIT_ACTIONS } from '../../utils/constants.js';

/**
 * localStorage key for users collection.
 * @type {string}
 */
const USERS_KEY = 'csnp_users';

/**
 * Role options for the select field.
 * @type {{ value: string, label: string }[]}
 */
const ROLE_OPTIONS = Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Role filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All Roles' },
  ...ROLE_OPTIONS,
];

/**
 * Status filter options for the select dropdown.
 * @type {{ value: string, label: string }[]}
 */
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/**
 * Retrieves all users from localStorage.
 * @returns {Object[]} Array of user objects
 */
function getAllUsers() {
  const users = getItem(USERS_KEY, []);
  if (!Array.isArray(users)) {
    return [];
  }
  return users;
}

/**
 * Persists users to localStorage.
 * @param {Object[]} users - Array of user objects
 * @returns {boolean} Whether the operation succeeded
 */
function saveUsers(users) {
  return setItem(USERS_KEY, users);
}

/**
 * Skeleton loading state for the user management panel.
 * @returns {React.ReactElement}
 */
function UserManagementSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-10 bg-gray-200 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * User form modal component for adding or editing users.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler
 * @param {Object|null} props.user - The user to edit (null for new user)
 * @param {boolean} props.isEditMode - Whether editing an existing user
 * @param {boolean} [props.loading=false] - Whether the form is submitting
 * @returns {React.ReactElement|null}
 */
function UserFormModal({ isOpen, onClose, onSave, user, isEditMode, loading = false }) {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(USER_ROLES.MEMBER);
  const [active, setActive] = useState(true);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (user && typeof user === 'object') {
        setUsername(user.username || '');
        setFirstName(user.firstName || '');
        setLastName(user.lastName || '');
        setEmail(user.email || '');
        setRole(user.role || USER_ROLES.MEMBER);
        setActive(user.active !== undefined ? user.active : true);
      } else {
        setUsername('');
        setFirstName('');
        setLastName('');
        setEmail('');
        setRole(USER_ROLES.MEMBER);
        setActive(true);
      }
      setFormErrors({});
    }
  }, [isOpen, user]);

  const validateForm = useCallback(() => {
    const errors = {};

    if (typeof username !== 'string' || username.trim().length === 0) {
      errors.username = 'Username is required';
    } else if (username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    if (typeof firstName !== 'string' || firstName.trim().length === 0) {
      errors.firstName = 'First name is required';
    }

    if (typeof lastName !== 'string' || lastName.trim().length === 0) {
      errors.lastName = 'Last name is required';
    }

    if (typeof email !== 'string' || email.trim().length === 0) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }

    const validRoles = Object.values(USER_ROLES);
    if (!validRoles.includes(role)) {
      errors.role = 'Please select a valid role';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [username, firstName, lastName, email, role]);

  const handleSubmit = useCallback(() => {
    if (!validateForm()) {
      return;
    }

    onSave({
      username: username.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      role,
      active,
    });
  }, [validateForm, onSave, username, firstName, lastName, email, role, active]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit User' : 'Add New User'}
      size="md"
      showCloseButton={true}
    >
      <div className="space-y-5">
        {/* Username */}
        <FormField
          name="username"
          label="Username"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setFormErrors((prev) => {
              const updated = { ...prev };
              delete updated.username;
              return updated;
            });
          }}
          placeholder="Enter username"
          required={true}
          disabled={loading || isEditMode}
          error={formErrors.username}
          helperText={isEditMode ? 'Username cannot be changed after creation' : 'Unique username for login'}
        />

        {/* First Name & Last Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            name="firstName"
            label="First Name"
            type="text"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setFormErrors((prev) => {
                const updated = { ...prev };
                delete updated.firstName;
                return updated;
              });
            }}
            placeholder="Enter first name"
            required={true}
            disabled={loading}
            error={formErrors.firstName}
          />

          <FormField
            name="lastName"
            label="Last Name"
            type="text"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              setFormErrors((prev) => {
                const updated = { ...prev };
                delete updated.lastName;
                return updated;
              });
            }}
            placeholder="Enter last name"
            required={true}
            disabled={loading}
            error={formErrors.lastName}
          />
        </div>

        {/* Email */}
        <FormField
          name="email"
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFormErrors((prev) => {
              const updated = { ...prev };
              delete updated.email;
              return updated;
            });
          }}
          placeholder="user@example.com"
          required={true}
          disabled={loading}
          error={formErrors.email}
        />

        {/* Role */}
        <FormField
          name="role"
          label="Role"
          type="select"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setFormErrors((prev) => {
              const updated = { ...prev };
              delete updated.role;
              return updated;
            });
          }}
          options={ROLE_OPTIONS}
          required={true}
          disabled={loading}
          error={formErrors.role}
          helperText="Determines the user's access level and permissions"
        />

        {/* Active Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-700">Account Active</p>
            <p className="text-[10px] text-gray-500">
              Inactive accounts cannot log in to the portal
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => !loading && setActive((prev) => !prev)}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-csnp-primary-light focus:ring-offset-2 ${
              active ? 'bg-csnp-primary' : 'bg-gray-300'
            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                active ? 'translate-x-5' : 'translate-x-0'
              }`}
              aria-hidden="true"
            />
          </button>
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
            In this simulation, any non-empty password is accepted for login.
            Password fields are not required for user creation. All user data
            is stored in localStorage.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            loading={loading}
            loadingText="Saving..."
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
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            {isEditMode ? 'Update User' : 'Create User'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

UserFormModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  user: PropTypes.object,
  isEditMode: PropTypes.bool.isRequired,
  loading: PropTypes.bool,
};

UserFormModal.defaultProps = {
  user: null,
  loading: false,
};

/**
 * User detail modal component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object|null} props.user - The user to display
 * @returns {React.ReactElement|null}
 */
function UserDetailModal({ isOpen, onClose, user }) {
  if (!user) {
    return null;
  }

  const roleLabel = USER_ROLE_LABELS[user.role] || toTitleCase(user.role || 'unknown');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Details"
      size="md"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div className={`p-3 rounded-lg border ${user.active ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={user.active ? 'active' : 'expired'}
                label={user.active ? 'Active' : 'Inactive'}
                size="md"
                showDot={true}
                bordered={true}
              />
              <span className="text-sm font-semibold text-gray-900">
                {user.firstName} {user.lastName}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {user.updatedAt ? formatRelativeTime(user.updatedAt) : user.createdAt ? formatRelativeTime(user.createdAt) : ''}
            </span>
          </div>
        </div>

        {/* User Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">User ID</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5 truncate" title={user.id}>
              {user.id ? user.id.substring(0, 16) + '…' : '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Username</p>
            <p className="text-xs font-mono text-gray-700 mt-0.5">{user.username || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">First Name</p>
            <p className="text-xs text-gray-700 mt-0.5">{user.firstName || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Last Name</p>
            <p className="text-xs text-gray-700 mt-0.5">{user.lastName || '—'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Email</p>
            <p className="text-xs text-gray-700 mt-0.5 truncate" title={user.email}>
              {user.email || '—'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Role</p>
            <p className="text-xs text-gray-700 mt-0.5">{roleLabel}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Status</p>
            <p className="text-xs text-gray-700 mt-0.5">{user.active ? 'Active' : 'Inactive'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Created At</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {user.createdAt ? formatDateTime(user.createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* Role Badge */}
        <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-csnp-primary flex-shrink-0"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div className="min-w-0">
              <p className="text-[10px] text-csnp-blue-700 uppercase tracking-wider font-semibold">Assigned Role</p>
              <p className="text-xs font-semibold text-csnp-primary mt-0.5">{roleLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

UserDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.object,
};

UserDetailModal.defaultProps = {
  user: null,
};

/**
 * User management component for admins.
 * Provides user list with roles, add/edit user form, role assignment,
 * activate/deactivate users, and password reset simulation.
 *
 * @param {Object} props
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function UserManagement({
  showHeader = true,
  compact = false,
  className = '',
  ...rest
}) {
  const { user: currentUser, isAuthenticated } = useAuth();
  const { addNotification } = useApp();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formSaving, setFormSaving] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Confirm dialogs
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [activateTarget, setActivateTarget] = useState(null);
  const [resetPasswordConfirmOpen, setResetPasswordConfirmOpen] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);

  /**
   * Loads users from localStorage.
   */
  const loadUsers = useCallback(() => {
    setError(null);

    try {
      const allUsers = getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error('UserManagement: failed to load users:', err);
      setError('Unable to load user data');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial load.
   */
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  /**
   * Enriched users with display fields.
   */
  const enrichedUsers = useMemo(() => {
    return users.map((u) => ({
      ...u,
      _roleLabel: USER_ROLE_LABELS[u.role] || toTitleCase(u.role || 'unknown'),
      _fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unnamed User',
      _statusLabel: u.active ? 'Active' : 'Inactive',
    }));
  }, [users]);

  /**
   * Filtered records based on role and status filters.
   */
  const filteredRecords = useMemo(() => {
    let filtered = enrichedUsers;

    if (roleFilter && roleFilter.trim().length > 0) {
      filtered = filtered.filter((u) => u.role === roleFilter.trim());
    }

    if (statusFilter && statusFilter.trim().length > 0) {
      if (statusFilter === 'active') {
        filtered = filtered.filter((u) => u.active === true);
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter((u) => u.active === false);
      }
    }

    return filtered;
  }, [enrichedUsers, roleFilter, statusFilter]);

  /**
   * Computed statistics.
   */
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active === true).length;
    const inactive = users.filter((u) => u.active === false).length;

    const byRole = {};
    for (const u of users) {
      const r = u.role || 'unknown';
      if (!byRole[r]) {
        byRole[r] = 0;
      }
      byRole[r]++;
    }

    return { total, active, inactive, byRole };
  }, [users]);

  /**
   * Handles opening the form modal for adding a new user.
   */
  const handleAddUser = useCallback(() => {
    setEditingUser(null);
    setIsEditMode(false);
    setFormModalOpen(true);
  }, []);

  /**
   * Handles opening the form modal for editing an existing user.
   * @param {Object} userRecord - The user to edit
   */
  const handleEditUser = useCallback((userRecord) => {
    setEditingUser(userRecord);
    setIsEditMode(true);
    setFormModalOpen(true);
  }, []);

  /**
   * Handles closing the form modal.
   */
  const handleCloseFormModal = useCallback(() => {
    setFormModalOpen(false);
    setEditingUser(null);
    setIsEditMode(false);
  }, []);

  /**
   * Handles saving a user (create or update).
   * @param {Object} userData - The user data from the form
   */
  const handleSaveUser = useCallback((userData) => {
    setFormSaving(true);

    try {
      const performedBy = currentUser ? currentUser.id : 'system';
      const timestamp = new Date().toISOString();
      const allUsers = getAllUsers();

      if (isEditMode && editingUser) {
        // Update existing user
        const existingIndex = allUsers.findIndex((u) => u.id === editingUser.id);
        if (existingIndex === -1) {
          addNotification('error', 'Update Failed', 'User not found.');
          setFormSaving(false);
          return;
        }

        // Check for duplicate username (excluding current user)
        if (userData.username !== editingUser.username) {
          const duplicateUsername = allUsers.find(
            (u) => u.username && u.username.toLowerCase() === userData.username.toLowerCase() && u.id !== editingUser.id
          );
          if (duplicateUsername) {
            addNotification('error', 'Update Failed', `Username "${userData.username}" is already taken.`);
            setFormSaving(false);
            return;
          }
        }

        // Check for duplicate email (excluding current user)
        const duplicateEmail = allUsers.find(
          (u) => u.email && u.email.toLowerCase() === userData.email.toLowerCase() && u.id !== editingUser.id
        );
        if (duplicateEmail) {
          addNotification('error', 'Update Failed', `Email "${userData.email}" is already in use.`);
          setFormSaving(false);
          return;
        }

        allUsers[existingIndex] = {
          ...allUsers[existingIndex],
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          role: userData.role,
          active: userData.active,
          updatedAt: timestamp,
        };

        const saved = saveUsers(allUsers);
        if (!saved) {
          addNotification('error', 'Update Failed', 'Failed to save user data.');
          setFormSaving(false);
          return;
        }

        logAction(
          AUDIT_ACTIONS.UPDATE,
          performedBy,
          {
            targetType: 'user',
            targetId: editingUser.id,
            description: `User "${userData.firstName} ${userData.lastName}" (${userData.username}) updated. Role: ${USER_ROLE_LABELS[userData.role] || userData.role}. Active: ${userData.active}`,
            metadata: {
              userId: editingUser.id,
              username: userData.username,
              role: userData.role,
              active: userData.active,
            },
            ipAddress: '127.0.0.1',
          },
          'auth'
        );

        addNotification(
          'success',
          'User Updated',
          `User "${userData.firstName} ${userData.lastName}" has been updated successfully.`
        );
      } else {
        // Create new user

        // Check for duplicate username
        const duplicateUsername = allUsers.find(
          (u) => u.username && u.username.toLowerCase() === userData.username.toLowerCase()
        );
        if (duplicateUsername) {
          addNotification('error', 'Creation Failed', `Username "${userData.username}" is already taken.`);
          setFormSaving(false);
          return;
        }

        // Check for duplicate email
        const duplicateEmail = allUsers.find(
          (u) => u.email && u.email.toLowerCase() === userData.email.toLowerCase()
        );
        if (duplicateEmail) {
          addNotification('error', 'Creation Failed', `Email "${userData.email}" is already in use.`);
          setFormSaving(false);
          return;
        }

        const newUserId = uuidv4();
        const newUser = {
          id: newUserId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          role: userData.role,
          active: userData.active,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        allUsers.push(newUser);

        const saved = saveUsers(allUsers);
        if (!saved) {
          addNotification('error', 'Creation Failed', 'Failed to save user data.');
          setFormSaving(false);
          return;
        }

        logAction(
          AUDIT_ACTIONS.CREATE,
          performedBy,
          {
            targetType: 'user',
            targetId: newUserId,
            description: `New user "${userData.firstName} ${userData.lastName}" (${userData.username}) created with role "${USER_ROLE_LABELS[userData.role] || userData.role}"`,
            metadata: {
              userId: newUserId,
              username: userData.username,
              role: userData.role,
              active: userData.active,
            },
            ipAddress: '127.0.0.1',
          },
          'auth'
        );

        addNotification(
          'success',
          'User Created',
          `User "${userData.firstName} ${userData.lastName}" has been created successfully.`
        );
      }

      setFormModalOpen(false);
      setEditingUser(null);
      setIsEditMode(false);
      loadUsers();
    } catch (err) {
      console.error('UserManagement: save user error:', err);
      addNotification('error', 'Save Error', 'An unexpected error occurred while saving the user.');
    } finally {
      setFormSaving(false);
    }
  }, [isEditMode, editingUser, currentUser, addNotification, loadUsers]);

  /**
   * Handles viewing a user's details.
   * @param {Object} userRecord - The user record
   */
  const handleViewDetails = useCallback((userRecord) => {
    setSelectedUser(userRecord);
    setDetailModalOpen(true);
  }, []);

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetail = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedUser(null);
  }, []);

  /**
   * Handles initiating user deactivation.
   * @param {Object} userRecord - The user to deactivate
   */
  const handleDeactivateInit = useCallback((userRecord) => {
    setDeactivateTarget(userRecord);
    setDeactivateConfirmOpen(true);
  }, []);

  /**
   * Confirms and executes user deactivation.
   */
  const handleConfirmDeactivate = useCallback(() => {
    if (!deactivateTarget) {
      return;
    }

    setDeactivateConfirmOpen(false);

    try {
      const performedBy = currentUser ? currentUser.id : 'system';
      const timestamp = new Date().toISOString();
      const allUsers = getAllUsers();

      const index = allUsers.findIndex((u) => u.id === deactivateTarget.id);
      if (index === -1) {
        addNotification('error', 'Deactivation Failed', 'User not found.');
        setDeactivateTarget(null);
        return;
      }

      allUsers[index] = {
        ...allUsers[index],
        active: false,
        updatedAt: timestamp,
      };

      const saved = saveUsers(allUsers);
      if (!saved) {
        addNotification('error', 'Deactivation Failed', 'Failed to save user data.');
        setDeactivateTarget(null);
        return;
      }

      logAction(
        AUDIT_ACTIONS.UPDATE,
        performedBy,
        {
          targetType: 'user',
          targetId: deactivateTarget.id,
          description: `User "${deactivateTarget.firstName} ${deactivateTarget.lastName}" (${deactivateTarget.username}) deactivated`,
          metadata: {
            userId: deactivateTarget.id,
            username: deactivateTarget.username,
            previousActive: true,
            newActive: false,
          },
          ipAddress: '127.0.0.1',
        },
        'auth'
      );

      addNotification(
        'info',
        'User Deactivated',
        `User "${deactivateTarget.firstName} ${deactivateTarget.lastName}" has been deactivated.`
      );

      loadUsers();
    } catch (err) {
      console.error('UserManagement: deactivate error:', err);
      addNotification('error', 'Deactivation Error', 'An unexpected error occurred.');
    } finally {
      setDeactivateTarget(null);
    }
  }, [deactivateTarget, currentUser, addNotification, loadUsers]);

  /**
   * Handles initiating user activation.
   * @param {Object} userRecord - The user to activate
   */
  const handleActivateInit = useCallback((userRecord) => {
    setActivateTarget(userRecord);
    setActivateConfirmOpen(true);
  }, []);

  /**
   * Confirms and executes user activation.
   */
  const handleConfirmActivate = useCallback(() => {
    if (!activateTarget) {
      return;
    }

    setActivateConfirmOpen(false);

    try {
      const performedBy = currentUser ? currentUser.id : 'system';
      const timestamp = new Date().toISOString();
      const allUsers = getAllUsers();

      const index = allUsers.findIndex((u) => u.id === activateTarget.id);
      if (index === -1) {
        addNotification('error', 'Activation Failed', 'User not found.');
        setActivateTarget(null);
        return;
      }

      allUsers[index] = {
        ...allUsers[index],
        active: true,
        updatedAt: timestamp,
      };

      const saved = saveUsers(allUsers);
      if (!saved) {
        addNotification('error', 'Activation Failed', 'Failed to save user data.');
        setActivateTarget(null);
        return;
      }

      logAction(
        AUDIT_ACTIONS.UPDATE,
        performedBy,
        {
          targetType: 'user',
          targetId: activateTarget.id,
          description: `User "${activateTarget.firstName} ${activateTarget.lastName}" (${activateTarget.username}) activated`,
          metadata: {
            userId: activateTarget.id,
            username: activateTarget.username,
            previousActive: false,
            newActive: true,
          },
          ipAddress: '127.0.0.1',
        },
        'auth'
      );

      addNotification(
        'success',
        'User Activated',
        `User "${activateTarget.firstName} ${activateTarget.lastName}" has been activated.`
      );

      loadUsers();
    } catch (err) {
      console.error('UserManagement: activate error:', err);
      addNotification('error', 'Activation Error', 'An unexpected error occurred.');
    } finally {
      setActivateTarget(null);
    }
  }, [activateTarget, currentUser, addNotification, loadUsers]);

  /**
   * Handles initiating password reset.
   * @param {Object} userRecord - The user to reset password for
   */
  const handleResetPasswordInit = useCallback((userRecord) => {
    setResetPasswordTarget(userRecord);
    setResetPasswordConfirmOpen(true);
  }, []);

  /**
   * Confirms and executes password reset (simulated).
   */
  const handleConfirmResetPassword = useCallback(() => {
    if (!resetPasswordTarget) {
      return;
    }

    setResetPasswordConfirmOpen(false);

    try {
      const performedBy = currentUser ? currentUser.id : 'system';

      logAction(
        AUDIT_ACTIONS.PASSWORD_CHANGE,
        performedBy,
        {
          targetType: 'user',
          targetId: resetPasswordTarget.id,
          description: `Password reset initiated for user "${resetPasswordTarget.firstName} ${resetPasswordTarget.lastName}" (${resetPasswordTarget.username})`,
          metadata: {
            userId: resetPasswordTarget.id,
            username: resetPasswordTarget.username,
            initiatedBy: performedBy,
          },
          ipAddress: '127.0.0.1',
        },
        'auth'
      );

      addNotification(
        'success',
        'Password Reset',
        `Password has been reset for "${resetPasswordTarget.firstName} ${resetPasswordTarget.lastName}". In this simulation, any non-empty password will work for login.`
      );
    } catch (err) {
      console.error('UserManagement: password reset error:', err);
      addNotification('error', 'Reset Error', 'An unexpected error occurred during password reset.');
    } finally {
      setResetPasswordTarget(null);
    }
  }, [resetPasswordTarget, currentUser, addNotification]);

  /**
   * Handles role filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleRoleFilterChange = useCallback((e) => {
    setRoleFilter(e.target.value);
  }, []);

  /**
   * Handles status filter change.
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Select change event
   */
  const handleStatusFilterChange = useCallback((e) => {
    setStatusFilter(e.target.value);
  }, []);

  /**
   * Table columns definition.
   */
  const columns = useMemo(() => {
    const cols = [
      {
        key: '_fullName',
        label: 'User',
        sortable: true,
        searchable: true,
        width: 'min-w-[180px]',
        render: (value, row) => {
          return (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-csnp-primary flex items-center justify-center text-xs font-bold text-white">
                {row.firstName ? row.firstName.charAt(0).toUpperCase() : ''}
                {row.lastName ? row.lastName.charAt(0).toUpperCase() : ''}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate max-w-[160px]" title={value}>
                  {value || 'Unnamed User'}
                </p>
                <p className="text-[10px] text-gray-500 truncate" title={row.username}>
                  @{row.username || '—'}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        key: 'email',
        label: 'Email',
        sortable: true,
        searchable: true,
        width: 'min-w-[180px]',
        render: (value) => {
          return (
            <span className="text-xs text-gray-700 truncate max-w-[200px]" title={value}>
              {value || '—'}
            </span>
          );
        },
      },
      {
        key: '_roleLabel',
        label: 'Role',
        sortable: true,
        searchable: true,
        width: 'min-w-[140px]',
        render: (value, row) => {
          const roleStatusMap = {
            admin: 'submitted',
            care_manager: 'in_progress',
            claims_processor: 'processing',
            enrollment_specialist: 'active',
            provider: 'accepted',
            member: 'pending',
            auditor: 'compliant',
            supervisor: 'approved',
          };
          const badgeStatus = roleStatusMap[row.role] || 'pending';
          return (
            <StatusBadge
              status={badgeStatus}
              label={value}
              size="sm"
              showDot={false}
              bordered={true}
            />
          );
        },
      },
      {
        key: 'active',
        label: 'Status',
        sortable: true,
        searchable: false,
        width: 'min-w-[90px]',
        render: (value) => {
          return (
            <StatusBadge
              status={value ? 'active' : 'expired'}
              label={value ? 'Active' : 'Inactive'}
              size="sm"
              showDot={true}
              bordered={true}
            />
          );
        },
      },
    ];

    if (!compact) {
      cols.push({
        key: 'createdAt',
        label: 'Created',
        sortable: true,
        searchable: false,
        width: 'min-w-[110px]',
        render: (value) => {
          if (!value) {
            return <span className="text-gray-400">—</span>;
          }
          return (
            <div>
              <p className="text-xs text-gray-700">{formatDate(value)}</p>
              <p className="text-[10px] text-gray-400">{formatRelativeTime(value)}</p>
            </div>
          );
        },
      });
    }

    return cols;
  }, [compact]);

  /**
   * Table actions definition.
   */
  const actions = useMemo(() => {
    const actionList = [
      {
        label: 'View',
        onClick: (row) => handleViewDetails(row),
        variant: 'ghost',
        size: 'sm',
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
    ];

    if (isAuthenticated) {
      actionList.push({
        label: 'Edit',
        onClick: (row) => handleEditUser(row),
        variant: 'ghost',
        size: 'sm',
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
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
      });

      actionList.push({
        label: 'Deactivate',
        onClick: (row) => handleDeactivateInit(row),
        variant: 'ghost',
        size: 'sm',
        visible: (row) => row.active === true,
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
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
      });

      actionList.push({
        label: 'Activate',
        onClick: (row) => handleActivateInit(row),
        variant: 'ghost',
        size: 'sm',
        visible: (row) => row.active === false,
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
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      });

      actionList.push({
        label: 'Reset Password',
        onClick: (row) => handleResetPasswordInit(row),
        variant: 'ghost',
        size: 'sm',
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
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        ),
      });
    }

    return actionList;
  }, [isAuthenticated, handleViewDetails, handleEditUser, handleDeactivateInit, handleActivateInit, handleResetPasswordInit]);

  const containerClassName = [className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-csnp-blue-50 flex items-center justify-center text-csnp-primary">
                <svg
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
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-csnp-primary">
                  User Management
                </h2>
                {!compact && (
                  <p className="mt-0.5 text-sm text-gray-500">
                    Manage portal users, assign roles, and control account access.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Add User Button */}
              {isAuthenticated && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddUser}
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
                      <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  }
                >
                  Add User
                </Button>
              )}

              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadUsers}
                disabled={loading}
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
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {!loading && !error && !compact && users.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
            <p className="text-[10px] text-csnp-blue-500 uppercase tracking-wider font-semibold">Total Users</p>
            <p className="text-lg font-bold text-csnp-primary">{stats.total}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-[10px] text-green-500 uppercase tracking-wider font-semibold">Active</p>
            <p className="text-lg font-bold text-green-700">{stats.active}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-[10px] text-red-500 uppercase tracking-wider font-semibold">Inactive</p>
            <p className={`text-lg font-bold ${stats.inactive > 0 ? 'text-red-700' : 'text-red-400'}`}>{stats.inactive}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Roles</p>
            <p className="text-lg font-bold text-gray-700">{Object.keys(stats.byRole).length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && !error && users.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={handleRoleFilterChange}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
            aria-label="Filter by role"
          >
            {ROLE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
            aria-label="Filter by status"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Role Stats */}
          {!compact && (
            <div className="flex items-center gap-3 ml-auto flex-wrap">
              {Object.entries(stats.byRole).map(([r, count]) => (
                <div key={r} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
                  <span className="text-[10px] font-medium text-gray-600">
                    {USER_ROLE_LABELS[r] ? USER_ROLE_LABELS[r].split(' ').slice(0, 2).join(' ') : toTitleCase(r)}: {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <UserManagementSkeleton />
      )}

      {/* Error State */}
      {!loading && error && (
        <EmptyState
          title="Unable to load user data"
          description={error}
          iconType="error"
          size="sm"
          actionLabel="Retry"
          onAction={loadUsers}
          actionVariant="outline"
        />
      )}

      {/* Empty State */}
      {!loading && !error && users.length === 0 && (
        <EmptyState
          title="No Users Found"
          description="No user accounts have been created yet. Add a new user to get started."
          iconType="no-data"
          size="sm"
          actionLabel={isAuthenticated ? 'Add First User' : undefined}
          onAction={isAuthenticated ? handleAddUser : undefined}
          actionVariant="primary"
          actionIcon={
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
              <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          }
        />
      )}

      {/* Filtered Empty State */}
      {!loading && !error && users.length > 0 && filteredRecords.length === 0 && (
        <EmptyState
          title="No Matching Users"
          description={`No users match the selected filters${roleFilter ? ` (Role: ${USER_ROLE_LABELS[roleFilter] || toTitleCase(roleFilter)})` : ''}${statusFilter ? ` (Status: ${toTitleCase(statusFilter)})` : ''}.`}
          iconType="no-results"
          size="sm"
          actionLabel="Clear Filters"
          onAction={() => {
            setRoleFilter('');
            setStatusFilter('');
          }}
          actionVariant="outline"
        />
      )}

      {/* Data Table */}
      {!loading && !error && filteredRecords.length > 0 && (
        <DataTable
          data={filteredRecords}
          columns={columns}
          actions={actions}
          loading={false}
          searchable={!compact}
          searchPlaceholder="Search by name, username, email, role..."
          paginated={true}
          initialPageSize={compact ? 10 : 20}
          initialSortField="_fullName"
          initialSortDirection="asc"
          emptyMessage="No users found"
          emptyDescription="No users match the current search criteria."
          idKey="id"
          onRowClick={handleViewDetails}
          className=""
        />
      )}

      {/* CMS Compliance Notice */}
      {!loading && !error && !compact && users.length > 0 && (
        <div className="mt-4">
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
              User access management must comply with HIPAA security requirements (45 CFR §164.312).
              All user account changes, role assignments, and access modifications are logged in the
              audit trail. Ensure users are assigned the minimum necessary role for their job function.
              Deactivate accounts promptly when users no longer require access.
            </p>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      <UserFormModal
        isOpen={formModalOpen}
        onClose={handleCloseFormModal}
        onSave={handleSaveUser}
        user={editingUser}
        isEditMode={isEditMode}
        loading={formSaving}
      />

      {/* User Detail Modal */}
      <UserDetailModal
        isOpen={detailModalOpen}
        onClose={handleCloseDetail}
        user={selectedUser}
      />

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={deactivateConfirmOpen}
        onClose={() => {
          setDeactivateConfirmOpen(false);
          setDeactivateTarget(null);
        }}
        onConfirm={handleConfirmDeactivate}
        title="Deactivate User"
        message={deactivateTarget
          ? `Are you sure you want to deactivate "${deactivateTarget.firstName} ${deactivateTarget.lastName}" (@${deactivateTarget.username})? The user will no longer be able to log in to the portal.`
          : 'Are you sure you want to deactivate this user?'}
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="warning"
      />

      {/* Activate Confirm Dialog */}
      <ConfirmDialog
        isOpen={activateConfirmOpen}
        onClose={() => {
          setActivateConfirmOpen(false);
          setActivateTarget(null);
        }}
        onConfirm={handleConfirmActivate}
        title="Activate User"
        message={activateTarget
          ? `Are you sure you want to activate "${activateTarget.firstName} ${activateTarget.lastName}" (@${activateTarget.username})? The user will be able to log in to the portal.`
          : 'Are you sure you want to activate this user?'}
        confirmText="Activate"
        cancelText="Cancel"
        variant="success"
      />

      {/* Reset Password Confirm Dialog */}
      <ConfirmDialog
        isOpen={resetPasswordConfirmOpen}
        onClose={() => {
          setResetPasswordConfirmOpen(false);
          setResetPasswordTarget(null);
        }}
        onConfirm={handleConfirmResetPassword}
        title="Reset Password"
        message={resetPasswordTarget
          ? `Are you sure you want to reset the password for "${resetPasswordTarget.firstName} ${resetPasswordTarget.lastName}" (@${resetPasswordTarget.username})? In this simulation, any non-empty password will work for login after reset.`
          : 'Are you sure you want to reset this user\'s password?'}
        confirmText="Reset Password"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}

UserManagement.propTypes = {
  showHeader: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
};

UserManagement.defaultProps = {
  showHeader: true,
  compact: false,
  className: '',
};