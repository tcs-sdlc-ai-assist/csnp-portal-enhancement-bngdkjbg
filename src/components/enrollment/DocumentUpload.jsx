import React, { useState, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import Button from '../common/Button.jsx';
import Alert from '../common/Alert.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import Card from '../common/Card.jsx';
import EmptyState from '../common/EmptyState.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useApp } from '../../contexts/AppContext.jsx';

/**
 * Accepted file types for document upload.
 * @type {Object.<string, string>}
 */
const ACCEPTED_FILE_TYPES = Object.freeze({
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
  'image/tiff': 'TIFF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
});

/**
 * Accepted file extensions for the file input accept attribute.
 * @type {string}
 */
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.tiff,.tif,.doc,.docx';

/**
 * Maximum file size in bytes (25 MB).
 * @type {number}
 */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Maximum number of files allowed.
 * @type {number}
 */
const MAX_FILES = 20;

/**
 * Document type options for categorizing uploaded documents.
 * @type {{ value: string, label: string }[]}
 */
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'enrollment_form', label: 'Enrollment Form' },
  { value: 'diagnosis_verification', label: 'Diagnosis Verification' },
  { value: 'physician_attestation', label: 'Physician Attestation' },
  { value: 'medical_record', label: 'Medical Record' },
  { value: 'consent_form', label: 'Consent Form' },
  { value: 'identification', label: 'Identification' },
  { value: 'medicare_card', label: 'Medicare Card' },
  { value: 'power_of_attorney', label: 'Power of Attorney' },
  { value: 'advance_directive', label: 'Advance Directive' },
  { value: 'other', label: 'Other' },
];

/**
 * Required document types for CMS compliance.
 * @type {string[]}
 */
const REQUIRED_DOCUMENT_TYPES = [
  'enrollment_form',
  'diagnosis_verification',
];

/**
 * VCC validation status styles.
 * @type {Object.<string, { bg: string, text: string, border: string, label: string }>}
 */
const VCC_STATUS_STYLES = Object.freeze({
  pending: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    label: 'Pending Validation',
  },
  validating: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    label: 'Validating...',
  },
  valid: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    label: 'Valid',
  },
  invalid: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    label: 'Invalid',
  },
});

/**
 * Formats a file size in bytes to a human-readable string.
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size string
 */
function formatFileSize(bytes) {
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
 * Returns the file extension from a filename.
 * @param {string} filename - The filename
 * @returns {string} The file extension (lowercase, without dot)
 */
function getFileExtension(filename) {
  if (typeof filename !== 'string' || filename.length === 0) {
    return '';
  }
  const parts = filename.split('.');
  if (parts.length < 2) {
    return '';
  }
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Validates a file against accepted types and size limits.
 * @param {Object} file - The file object (or simulated file)
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateFile(file) {
  if (!file || typeof file !== 'object') {
    return { valid: false, error: 'Invalid file object' };
  }

  const fileName = file.name || '';
  const fileSize = typeof file.size === 'number' ? file.size : 0;
  const fileType = file.type || '';

  if (fileName.trim().length === 0) {
    return { valid: false, error: 'File name is missing' };
  }

  if (fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds maximum size of ${formatFileSize(MAX_FILE_SIZE)}` };
  }

  if (fileSize === 0) {
    return { valid: false, error: 'File is empty (0 bytes)' };
  }

  const ext = getFileExtension(fileName);
  const validExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'doc', 'docx'];

  if (fileType && ACCEPTED_FILE_TYPES[fileType]) {
    return { valid: true, error: null };
  }

  if (validExtensions.includes(ext)) {
    return { valid: true, error: null };
  }

  return {
    valid: false,
    error: `File type "${ext || fileType || 'unknown'}" is not supported. Accepted types: PDF, JPEG, PNG, TIFF, DOC, DOCX`,
  };
}

/**
 * Simulates VCC document validation with a delay.
 * @param {Object} document - The document object to validate
 * @returns {Promise<{ valid: boolean, reason: string }>}
 */
function simulateVCCValidation(document) {
  return new Promise((resolve) => {
    const delay = Math.floor(Math.random() * 1500) + 500;

    setTimeout(() => {
      if (!document || typeof document !== 'object') {
        resolve({ valid: false, reason: 'Invalid document object' });
        return;
      }

      const docType = document.documentType || '';
      const fileName = document.name || '';

      const validDocumentTypes = [
        'enrollment_form',
        'diagnosis_verification',
        'physician_attestation',
        'medical_record',
        'consent_form',
        'identification',
        'medicare_card',
        'power_of_attorney',
        'advance_directive',
        'other',
      ];

      const hasValidType = validDocumentTypes.includes(docType) || fileName.length > 0;

      if (hasValidType) {
        resolve({ valid: true, reason: 'Document validated successfully by VCC' });
      } else {
        resolve({ valid: false, reason: 'Document type not recognized by VCC validation' });
      }
    }, delay);
  });
}

/**
 * Returns the icon SVG path for a file type.
 * @param {string} extension - The file extension
 * @returns {React.ReactElement}
 */
function FileTypeIcon({ extension }) {
  const ext = typeof extension === 'string' ? extension.toLowerCase() : '';

  let color = 'text-gray-400';
  if (ext === 'pdf') {
    color = 'text-red-500';
  } else if (['jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext)) {
    color = 'text-blue-500';
  } else if (['doc', 'docx'].includes(ext)) {
    color = 'text-csnp-primary';
  }

  return (
    <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center ${color}`}>
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
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      {ext && (
        <span className="sr-only">{ext.toUpperCase()} file</span>
      )}
    </div>
  );
}

FileTypeIcon.propTypes = {
  extension: PropTypes.string,
};

FileTypeIcon.defaultProps = {
  extension: '',
};

/**
 * Upload progress bar component.
 *
 * @param {Object} props
 * @param {number} props.progress - Progress percentage (0-100)
 * @returns {React.ReactElement}
 */
function UploadProgressBar({ progress }) {
  const safeProgress = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0;

  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
      <div
        className="bg-csnp-primary h-1.5 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${safeProgress}%` }}
        role="progressbar"
        aria-valuenow={safeProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Upload progress: ${safeProgress}%`}
      />
    </div>
  );
}

UploadProgressBar.propTypes = {
  progress: PropTypes.number.isRequired,
};

/**
 * Single uploaded document item component.
 *
 * @param {Object} props
 * @param {Object} props.document - The document object
 * @param {Function} props.onRemove - Remove handler
 * @param {Function} props.onChangeType - Document type change handler
 * @param {Function} props.onValidate - Validate handler
 * @param {boolean} [props.disabled=false] - Whether actions are disabled
 * @returns {React.ReactElement}
 */
function DocumentItem({ document, onRemove, onChangeType, onValidate, disabled = false }) {
  const ext = getFileExtension(document.name || '');
  const vccStatus = document.vccStatus || 'pending';
  const vccStyle = VCC_STATUS_STYLES[vccStatus] || VCC_STATUS_STYLES.pending;
  const isUploading = document.uploadProgress !== undefined && document.uploadProgress < 100;
  const isValidating = vccStatus === 'validating';

  const documentTypeLabel = useMemo(() => {
    const option = DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === document.documentType);
    return option ? option.label : document.documentType || 'Uncategorized';
  }, [document.documentType]);

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150 ${
      vccStatus === 'invalid'
        ? 'bg-red-50 border-red-200'
        : vccStatus === 'valid'
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200'
    }`}>
      {/* File Type Icon */}
      <FileTypeIcon extension={ext} />

      {/* Document Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-900 truncate max-w-[200px]" title={document.name}>
            {document.name || 'Unnamed Document'}
          </p>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${vccStyle.bg} ${vccStyle.text} border ${vccStyle.border}`}>
            {vccStatus === 'validating' && (
              <svg
                className="animate-spin w-2.5 h-2.5"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {vccStyle.label}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400 uppercase font-medium">
            {ext ? ext.toUpperCase() : 'FILE'}
          </span>
          <span className="text-[10px] text-gray-300" aria-hidden="true">·</span>
          <span className="text-[10px] text-gray-400">
            {formatFileSize(document.size || 0)}
          </span>
          <span className="text-[10px] text-gray-300" aria-hidden="true">·</span>
          <span className="text-[10px] text-gray-500">
            {documentTypeLabel}
          </span>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-1.5">
            <UploadProgressBar progress={document.uploadProgress} />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Uploading... {document.uploadProgress}%
            </p>
          </div>
        )}

        {/* VCC Validation Result */}
        {document.vccReason && vccStatus !== 'pending' && vccStatus !== 'validating' && (
          <p className={`text-[10px] mt-1 ${vccStatus === 'valid' ? 'text-green-600' : 'text-red-600'}`}>
            {document.vccReason}
          </p>
        )}

        {/* Document Type Selector */}
        {!isUploading && !disabled && (
          <div className="mt-1.5">
            <select
              value={document.documentType || 'other'}
              onChange={(e) => onChangeType(document.id, e.target.value)}
              className="border border-gray-200 rounded px-1.5 py-0.5 text-[10px] bg-white focus:outline-none focus:ring-1 focus:ring-csnp-primary-light focus:border-csnp-primary-light"
              aria-label={`Document type for ${document.name}`}
              disabled={disabled}
            >
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Validate Button */}
        {!isUploading && vccStatus === 'pending' && !disabled && (
          <button
            type="button"
            onClick={() => onValidate(document.id)}
            className="p-1.5 rounded text-csnp-primary hover:bg-csnp-blue-50 focus:outline-none focus:ring-1 focus:ring-csnp-primary-light transition-colors duration-150"
            aria-label={`Validate ${document.name}`}
            title="Validate document"
          >
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
          </button>
        )}

        {/* Remove Button */}
        {!isUploading && !disabled && (
          <button
            type="button"
            onClick={() => onRemove(document.id)}
            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-300 transition-colors duration-150"
            aria-label={`Remove ${document.name}`}
            title="Remove document"
          >
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

DocumentItem.propTypes = {
  document: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    size: PropTypes.number,
    type: PropTypes.string,
    documentType: PropTypes.string,
    uploadProgress: PropTypes.number,
    vccStatus: PropTypes.string,
    vccReason: PropTypes.string,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
  onChangeType: PropTypes.func.isRequired,
  onValidate: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

DocumentItem.defaultProps = {
  disabled: false,
};

/**
 * Document upload component for enrollment.
 * Provides drag-and-drop file upload area, file type validation,
 * upload progress indicator, uploaded file list with remove option,
 * and simulates VCC document validation.
 *
 * @param {Object} props
 * @param {string} [props.enrollmentId] - The enrollment ID for document association
 * @param {Object[]} [props.initialDocuments=[]] - Pre-existing documents
 * @param {Function} [props.onDocumentsChange] - Callback when documents change: (documents) => void
 * @param {Function} [props.onValidationComplete] - Callback when all validations complete: (results) => void
 * @param {boolean} [props.showHeader=true] - Whether to show the section header
 * @param {boolean} [props.showValidateAll=true] - Whether to show the validate all button
 * @param {boolean} [props.showRequiredDocuments=true] - Whether to show required documents checklist
 * @param {boolean} [props.autoValidate=false] - Whether to auto-validate documents after upload
 * @param {boolean} [props.disabled=false] - Whether the upload is disabled
 * @param {boolean} [props.compact=false] - Whether to use compact layout
 * @param {number} [props.maxFiles=20] - Maximum number of files allowed
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement}
 */
export default function DocumentUpload({
  enrollmentId,
  initialDocuments = [],
  onDocumentsChange,
  onValidationComplete,
  showHeader = true,
  showValidateAll = true,
  showRequiredDocuments = true,
  autoValidate = false,
  disabled = false,
  compact = false,
  maxFiles = MAX_FILES,
  className = '',
  ...rest
}) {
  const { user } = useAuth();
  const { addNotification } = useApp();

  const [documents, setDocuments] = useState(() => {
    if (Array.isArray(initialDocuments) && initialDocuments.length > 0) {
      return initialDocuments.map((doc) => ({
        id: doc.id || uuidv4(),
        name: doc.name || 'Unnamed Document',
        size: doc.size || 0,
        type: doc.type || '',
        documentType: doc.documentType || doc.type || 'other',
        uploadProgress: 100,
        vccStatus: doc.vccStatus || 'pending',
        vccReason: doc.vccReason || null,
        uploadedAt: doc.uploadedAt || new Date().toISOString(),
      }));
    }
    return [];
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [validatingAll, setValidatingAll] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  /**
   * Notifies parent of document changes.
   * @param {Object[]} updatedDocuments - The updated documents array
   */
  const notifyDocumentsChange = useCallback((updatedDocuments) => {
    if (typeof onDocumentsChange === 'function') {
      onDocumentsChange(updatedDocuments);
    }
  }, [onDocumentsChange]);

  /**
   * Simulates upload progress for a document.
   * @param {string} docId - The document ID
   * @returns {Promise<void>}
   */
  const simulateUploadProgress = useCallback((docId) => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 25) + 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);

          setDocuments((prev) => {
            const updated = prev.map((doc) =>
              doc.id === docId ? { ...doc, uploadProgress: 100 } : doc
            );
            return updated;
          });

          resolve();
        } else {
          setDocuments((prev) =>
            prev.map((doc) =>
              doc.id === docId ? { ...doc, uploadProgress: progress } : doc
            )
          );
        }
      }, 200);
    });
  }, []);

  /**
   * Processes and adds files to the document list.
   * @param {FileList|File[]} files - The files to process
   */
  const processFiles = useCallback(async (files) => {
    if (!files || files.length === 0) {
      return;
    }

    setUploadError(null);

    const fileArray = Array.from(files);
    const currentCount = documents.length;
    const remainingSlots = maxFiles - currentCount;

    if (remainingSlots <= 0) {
      setUploadError(`Maximum of ${maxFiles} files allowed. Please remove some files before adding more.`);
      addNotification('warning', 'File Limit Reached', `Maximum of ${maxFiles} files allowed.`);
      return;
    }

    if (fileArray.length > remainingSlots) {
      setUploadError(`Only ${remainingSlots} more file(s) can be added. ${fileArray.length - remainingSlots} file(s) were not added.`);
    }

    const filesToProcess = fileArray.slice(0, remainingSlots);
    const newDocuments = [];
    const errors = [];

    for (const file of filesToProcess) {
      const validation = validateFile(file);

      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      const ext = getFileExtension(file.name);
      let defaultDocType = 'other';
      if (ext === 'pdf') {
        defaultDocType = 'enrollment_form';
      } else if (['jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext)) {
        defaultDocType = 'medical_record';
      } else if (['doc', 'docx'].includes(ext)) {
        defaultDocType = 'enrollment_form';
      }

      const docId = uuidv4();
      const newDoc = {
        id: docId,
        name: file.name,
        size: file.size,
        type: file.type || '',
        documentType: defaultDocType,
        uploadProgress: 0,
        vccStatus: 'pending',
        vccReason: null,
        uploadedAt: new Date().toISOString(),
      };

      newDocuments.push(newDoc);
    }

    if (errors.length > 0) {
      const errorMsg = errors.length === 1
        ? errors[0]
        : `${errors.length} file(s) failed validation:\n${errors.join('\n')}`;
      setUploadError(errorMsg);
      addNotification('warning', 'File Validation', `${errors.length} file(s) could not be added.`);
    }

    if (newDocuments.length === 0) {
      return;
    }

    setDocuments((prev) => {
      const updated = [...prev, ...newDocuments];
      notifyDocumentsChange(updated);
      return updated;
    });

    addNotification(
      'success',
      'Files Added',
      `${newDocuments.length} file(s) added successfully.`
    );

    // Simulate upload progress for each new document
    for (const doc of newDocuments) {
      await simulateUploadProgress(doc.id);
    }

    // Auto-validate if enabled
    if (autoValidate) {
      for (const doc of newDocuments) {
        await handleValidateDocument(doc.id);
      }
    }
  }, [documents, maxFiles, addNotification, notifyDocumentsChange, simulateUploadProgress, autoValidate]);

  /**
   * Handles file input change event.
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event
   */
  const handleFileInputChange = useCallback((e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  /**
   * Handles click on the upload area to trigger file input.
   */
  const handleUploadAreaClick = useCallback(() => {
    if (disabled) {
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  /**
   * Handles drag enter event.
   * @param {React.DragEvent} e - Drag event
   */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  /**
   * Handles drag leave event.
   * @param {React.DragEvent} e - Drag event
   */
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  /**
   * Handles drag over event.
   * @param {React.DragEvent} e - Drag event
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handles drop event.
   * @param {React.DragEvent} e - Drag event
   */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    if (disabled) {
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  /**
   * Handles removing a document.
   * @param {string} docId - The document ID to remove
   */
  const handleRemoveDocument = useCallback((docId) => {
    setConfirmRemoveId(docId);
  }, []);

  /**
   * Confirms document removal.
   */
  const handleConfirmRemove = useCallback(() => {
    if (!confirmRemoveId) {
      return;
    }

    setDocuments((prev) => {
      const removed = prev.find((d) => d.id === confirmRemoveId);
      const updated = prev.filter((d) => d.id !== confirmRemoveId);
      notifyDocumentsChange(updated);

      if (removed) {
        addNotification('info', 'Document Removed', `"${removed.name}" has been removed.`);
      }

      return updated;
    });

    setConfirmRemoveId(null);
  }, [confirmRemoveId, addNotification, notifyDocumentsChange]);

  /**
   * Handles changing a document's type.
   * @param {string} docId - The document ID
   * @param {string} newType - The new document type
   */
  const handleChangeDocumentType = useCallback((docId, newType) => {
    setDocuments((prev) => {
      const updated = prev.map((doc) =>
        doc.id === docId ? { ...doc, documentType: newType } : doc
      );
      notifyDocumentsChange(updated);
      return updated;
    });
  }, [notifyDocumentsChange]);

  /**
   * Handles validating a single document via VCC simulation.
   * @param {string} docId - The document ID to validate
   */
  const handleValidateDocument = useCallback(async (docId) => {
    // Set status to validating
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId ? { ...doc, vccStatus: 'validating', vccReason: null } : doc
      )
    );

    // Find the document
    const doc = documents.find((d) => d.id === docId);
    if (!doc) {
      return;
    }

    try {
      const result = await simulateVCCValidation(doc);

      setDocuments((prev) => {
        const updated = prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                vccStatus: result.valid ? 'valid' : 'invalid',
                vccReason: result.reason,
              }
            : d
        );
        notifyDocumentsChange(updated);
        return updated;
      });

      if (result.valid) {
        addNotification('success', 'Document Valid', `"${doc.name}" passed VCC validation.`);
      } else {
        addNotification('warning', 'Document Invalid', `"${doc.name}" failed VCC validation: ${result.reason}`);
      }
    } catch (err) {
      console.error('DocumentUpload: VCC validation error:', err);
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, vccStatus: 'invalid', vccReason: 'Validation error occurred' }
            : d
        )
      );
      addNotification('error', 'Validation Error', `An error occurred while validating "${doc.name}".`);
    }
  }, [documents, addNotification, notifyDocumentsChange]);

  /**
   * Handles validating all pending documents.
   */
  const handleValidateAll = useCallback(async () => {
    const pendingDocs = documents.filter((d) => d.vccStatus === 'pending' && d.uploadProgress === 100);

    if (pendingDocs.length === 0) {
      addNotification('info', 'No Documents to Validate', 'All documents have already been validated.');
      return;
    }

    setValidatingAll(true);

    let validCount = 0;
    let invalidCount = 0;

    for (const doc of pendingDocs) {
      // Set status to validating
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id ? { ...d, vccStatus: 'validating', vccReason: null } : d
        )
      );

      try {
        const result = await simulateVCCValidation(doc);

        setDocuments((prev) => {
          const updated = prev.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  vccStatus: result.valid ? 'valid' : 'invalid',
                  vccReason: result.reason,
                }
              : d
          );
          return updated;
        });

        if (result.valid) {
          validCount++;
        } else {
          invalidCount++;
        }
      } catch {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? { ...d, vccStatus: 'invalid', vccReason: 'Validation error occurred' }
              : d
          )
        );
        invalidCount++;
      }
    }

    setValidatingAll(false);

    // Notify documents change with final state
    setDocuments((prev) => {
      notifyDocumentsChange(prev);
      return prev;
    });

    const totalProcessed = validCount + invalidCount;
    if (invalidCount === 0) {
      addNotification('success', 'All Documents Valid', `${validCount} document(s) passed VCC validation.`);
    } else if (validCount === 0) {
      addNotification('error', 'Validation Failed', `${invalidCount} document(s) failed VCC validation.`);
    } else {
      addNotification('warning', 'Validation Complete', `${validCount} valid, ${invalidCount} invalid out of ${totalProcessed} document(s).`);
    }

    if (typeof onValidationComplete === 'function') {
      onValidationComplete({
        total: totalProcessed,
        valid: validCount,
        invalid: invalidCount,
        allValid: invalidCount === 0 && validCount > 0,
      });
    }
  }, [documents, addNotification, notifyDocumentsChange, onValidationComplete]);

  /**
   * Computed: document statistics.
   */
  const stats = useMemo(() => {
    const total = documents.length;
    const valid = documents.filter((d) => d.vccStatus === 'valid').length;
    const invalid = documents.filter((d) => d.vccStatus === 'invalid').length;
    const pending = documents.filter((d) => d.vccStatus === 'pending' && d.uploadProgress === 100).length;
    const validating = documents.filter((d) => d.vccStatus === 'validating').length;
    const uploading = documents.filter((d) => d.uploadProgress !== undefined && d.uploadProgress < 100).length;

    return { total, valid, invalid, pending, validating, uploading };
  }, [documents]);

  /**
   * Computed: required documents checklist.
   */
  const requiredDocumentsChecklist = useMemo(() => {
    return REQUIRED_DOCUMENT_TYPES.map((reqType) => {
      const option = DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === reqType);
      const label = option ? option.label : reqType;
      const hasDocument = documents.some((d) => d.documentType === reqType);
      const hasValidDocument = documents.some((d) => d.documentType === reqType && d.vccStatus === 'valid');

      return {
        type: reqType,
        label,
        hasDocument,
        hasValidDocument,
      };
    });
  }, [documents]);

  /**
   * Computed: whether all required documents are present and valid.
   */
  const allRequiredDocumentsValid = useMemo(() => {
    return requiredDocumentsChecklist.every((item) => item.hasValidDocument);
  }, [requiredDocumentsChecklist]);

  /**
   * Computed: the document being confirmed for removal.
   */
  const documentToRemove = useMemo(() => {
    if (!confirmRemoveId) {
      return null;
    }
    return documents.find((d) => d.id === confirmRemoveId) || null;
  }, [confirmRemoveId, documents]);

  const containerClassName = [
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName} {...rest}>
      {/* Header */}
      {showHeader && (
        <div className="mb-4">
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
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-csnp-primary">
                  Document Upload
                </h3>
                {!compact && (
                  <p className="text-[10px] text-gray-500">
                    Upload supporting documents for enrollment processing
                  </p>
                )}
              </div>
              {stats.total > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {stats.total} file{stats.total !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Validate All Button */}
              {showValidateAll && stats.pending > 0 && !disabled && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleValidateAll}
                  loading={validatingAll}
                  loadingText="Validating..."
                  disabled={validatingAll || stats.pending === 0}
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
                  Validate All ({stats.pending})
                </Button>
              )}
            </div>
          </div>

          {/* Stats Summary */}
          {!compact && stats.total > 0 && (
            <div className="flex items-center gap-3 mt-3">
              {stats.valid > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-green-700">
                    {stats.valid} valid
                  </span>
                </div>
              )}
              {stats.invalid > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-red-700">
                    {stats.invalid} invalid
                  </span>
                </div>
              )}
              {stats.pending > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-yellow-700">
                    {stats.pending} pending
                  </span>
                </div>
              )}
              {stats.validating > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-blue-700">
                    {stats.validating} validating
                  </span>
                </div>
              )}
              {stats.uploading > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-purple-700">
                    {stats.uploading} uploading
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <Alert
          variant="warning"
          title="Upload Issue"
          dismissible={true}
          onDismiss={() => setUploadError(null)}
          className="mb-4"
          size="sm"
        >
          {uploadError}
        </Alert>
      )}

      {/* Required Documents Checklist */}
      {showRequiredDocuments && !compact && (
        <div className="mb-4 p-3 bg-csnp-blue-50 rounded-lg border border-csnp-blue-100">
          <div className="flex items-center gap-1.5 mb-2">
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-[10px] font-semibold text-csnp-blue-700 uppercase tracking-wider">
              Required Documents
            </p>
          </div>
          <div className="space-y-1.5">
            {requiredDocumentsChecklist.map((item) => (
              <div key={item.type} className="flex items-center gap-2">
                <span
                  className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center ${
                    item.hasValidDocument
                      ? 'bg-green-500 text-white'
                      : item.hasDocument
                        ? 'bg-yellow-400 text-white'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {item.hasValidDocument ? (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : item.hasDocument ? (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  ) : null}
                </span>
                <span className={`text-xs ${
                  item.hasValidDocument
                    ? 'text-green-700 line-through'
                    : item.hasDocument
                      ? 'text-yellow-700'
                      : 'text-csnp-blue-700'
                }`}>
                  {item.label}
                  {item.hasDocument && !item.hasValidDocument && (
                    <span className="text-[10px] text-yellow-500 ml-1">(needs validation)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ${
          disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
            : isDragOver
              ? 'border-csnp-primary bg-csnp-blue-50 scale-[1.01]'
              : 'border-gray-300 bg-white hover:border-csnp-primary-light hover:bg-gray-50 cursor-pointer'
        } ${compact ? 'p-4' : 'p-6'}`}
        onClick={handleUploadAreaClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload documents by clicking or dragging files here"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            handleUploadAreaClick();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
        />

        <div className="flex flex-col items-center justify-center text-center">
          {/* Upload Icon */}
          <div className={`flex-shrink-0 rounded-full flex items-center justify-center mb-3 ${
            isDragOver
              ? 'w-14 h-14 bg-csnp-primary text-white'
              : 'w-12 h-12 bg-gray-100 text-gray-400'
          } transition-all duration-200`}>
            <svg
              width={isDragOver ? 24 : 20}
              height={isDragOver ? 24 : 20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          {isDragOver ? (
            <p className="text-sm font-semibold text-csnp-primary">
              Drop files here to upload
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                <span className="text-csnp-primary font-semibold">Click to upload</span>
                {' '}or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PDF, JPEG, PNG, TIFF, DOC, DOCX up to {formatFileSize(MAX_FILE_SIZE)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Maximum {maxFiles} files · {maxFiles - documents.length} remaining
              </p>
            </>
          )}
        </div>
      </div>

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Uploaded Documents ({documents.length})
          </p>
          <div className="space-y-2">
            {documents.map((doc) => (
              <DocumentItem
                key={doc.id}
                document={doc}
                onRemove={handleRemoveDocument}
                onChangeType={handleChangeDocumentType}
                onValidate={handleValidateDocument}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {documents.length === 0 && !compact && (
        <div className="mt-4">
          <EmptyState
            title="No Documents Uploaded"
            description="Upload supporting documents for the enrollment application. Required documents include enrollment form and diagnosis verification."
            iconType="no-data"
            size="sm"
            variant="muted"
          />
        </div>
      )}

      {/* VCC Compliance Notice */}
      {!compact && documents.length > 0 && (
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
              <span className="font-semibold">VCC Document Validation:</span>{' '}
              All uploaded documents are validated through the Verification &amp; Compliance Center (VCC)
              to ensure they meet CMS enrollment documentation requirements. Documents must pass VCC
              validation before the enrollment can be submitted for CMS processing.
              {!allRequiredDocumentsValid && stats.total > 0 && (
                <span className="block mt-1 font-semibold text-yellow-700">
                  ⚠ Some required documents are missing or not yet validated.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* All Valid Confirmation */}
      {stats.total > 0 && stats.valid === stats.total && stats.invalid === 0 && stats.pending === 0 && stats.validating === 0 && (
        <Alert
          variant="success"
          title="All Documents Validated"
          showIcon={true}
          bordered={true}
          size="sm"
          className="mt-4"
        >
          All {stats.total} document(s) have passed VCC validation.
          {allRequiredDocumentsValid
            ? ' All required documents are present and valid.'
            : ' Note: Some required document types may still be missing.'}
        </Alert>
      )}

      {/* Invalid Documents Warning */}
      {stats.invalid > 0 && (
        <Alert
          variant="error"
          title={`${stats.invalid} Document${stats.invalid !== 1 ? 's' : ''} Failed Validation`}
          showIcon={true}
          bordered={true}
          size="sm"
          className="mt-4"
        >
          {stats.invalid} document{stats.invalid !== 1 ? 's' : ''} did not pass VCC validation.
          Please review the invalid documents and re-upload corrected versions.
        </Alert>
      )}

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmRemoveId !== null}
        onClose={() => setConfirmRemoveId(null)}
        onConfirm={handleConfirmRemove}
        title="Remove Document"
        message={documentToRemove
          ? `Are you sure you want to remove "${documentToRemove.name}"? This action cannot be undone.`
          : 'Are you sure you want to remove this document?'}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

DocumentUpload.propTypes = {
  enrollmentId: PropTypes.string,
  initialDocuments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      size: PropTypes.number,
      type: PropTypes.string,
      documentType: PropTypes.string,
      vccStatus: PropTypes.string,
      vccReason: PropTypes.string,
    })
  ),
  onDocumentsChange: PropTypes.func,
  onValidationComplete: PropTypes.func,
  showHeader: PropTypes.bool,
  showValidateAll: PropTypes.bool,
  showRequiredDocuments: PropTypes.bool,
  autoValidate: PropTypes.bool,
  disabled: PropTypes.bool,
  compact: PropTypes.bool,
  maxFiles: PropTypes.number,
  className: PropTypes.string,
};

DocumentUpload.defaultProps = {
  enrollmentId: undefined,
  initialDocuments: [],
  onDocumentsChange: undefined,
  onValidationComplete: undefined,
  showHeader: true,
  showValidateAll: true,
  showRequiredDocuments: true,
  autoValidate: false,
  disabled: false,
  compact: false,
  maxFiles: MAX_FILES,
  className: '',
};