import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useToast } from '../../core/context/ToastContext';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  FileText,
  Users,
  Layers,
  Cpu,
  UserCheck,
  Building2,
  RefreshCw,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface RowError {
  sheet: 'Technician' | 'Doctor' | 'Process Area' | 'Process';
  row: number;
  column: string;
  value?: string;
  message: string;
}

interface ValidationData {
  valid: boolean;
  totalRows: number;
  counts: {
    technicians: number;
    doctors: number;
    processAreas: number;
    processes: number;
  };
  errors: RowError[];
}

interface ImportResult {
  success: boolean;
  imported: {
    technicians: number;
    doctors: number;
    processAreas: number;
    processes: number;
  };
  branchName: string;
}

interface LabBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LabBulkUploadModal: React.FC<LabBulkUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  const [validationResult, setValidationResult] = useState<ValidationData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedSheetFilter, setSelectedSheetFilter] = useState<string>('ALL');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      setDownloading(true);
      const res = await api.get('/lab/bulk-upload/template', {
        responseType: 'blob',
      });

      // Extract filename from Content-Disposition header if available
      let fileName = 'Dental_Lab_Bulk_Upload_Template.xlsx';
      const disposition = res.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) fileName = match[1];
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(t('bulkUpload.alerts.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    const validExtensions = ['.xlsx', '.xls'];
    const lowerName = selectedFile.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValidExt) {
      toast.error('Only Excel files (.xlsx or .xls) are accepted.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit.');
      return;
    }

    setFile(selectedFile);
    setValidationResult(null);
    setImportResult(null);
    setSelectedSheetFilter('ALL');

    // Auto-run validation
    runValidation(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const runValidation = async (targetFile?: File) => {
    const fileToValidate = targetFile || file;
    if (!fileToValidate) {
      toast.error(t('bulkUpload.alerts.selectFileFirst'));
      return;
    }

    try {
      setValidating(true);
      const formData = new FormData();
      formData.append('file', fileToValidate);

      const res = await api.post('/lab/bulk-upload/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setValidationResult(res.data);
      if (!res.data.valid) {
        toast.error(`Found ${res.data.errors.length} issue(s) in the template.`);
      } else {
        toast.success(t('bulkUpload.validationSuccess'));
      }
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Validation failed';
      toast.error(errMsg);
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/lab/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImportResult(res.data);
      toast.success(res.data.message || 'Bulk upload completed successfully!');
    } catch (err: any) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        setValidationResult({
          valid: false,
          totalRows: 0,
          counts: { technicians: 0, doctors: 0, processAreas: 0, processes: 0 },
          errors: err.response.data.errors,
        });
        toast.error('Validation failed. Please review the highlighted issues.');
      } else {
        const msg =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          t('bulkUpload.alerts.importFailed');
        toast.error(msg);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (importResult && onSuccess) {
      onSuccess();
    }
    setFile(null);
    setValidationResult(null);
    setImportResult(null);
    onClose();
  };

  // Filtered errors
  const filteredErrors = (validationResult?.errors || []).filter((err) => {
    if (selectedSheetFilter === 'ALL') return true;
    return err.sheet === selectedSheetFilter;
  });

  const getSheetBadgeColor = (sheet: string) => {
    switch (sheet) {
      case 'Technician':
        return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
      case 'Doctor':
        return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'Process Area':
        return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
      case 'Process':
        return { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' };
      default:
        return { bg: 'var(--bg-surface-hover)', text: 'var(--text-main)', border: 'var(--border-color)' };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '18px',
          boxShadow: 'var(--shadow-xl)',
          backgroundColor: 'var(--bg-modal)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #107C41 0%, #059669 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(16, 124, 65, 0.25)',
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                {t('bulkUpload.modalTitle')}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {t('bulkUpload.modalSubtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="btn btn-icon btn-sm"
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {importResult ? (
            /* ─────────────────────────────────────────────────────────── */
            /* SUCCESS VIEW */
            /* ─────────────────────────────────────────────────────────── */
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.2)',
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '6px' }}>
                {t('bulkUpload.success.title')}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                {t('bulkUpload.success.desc')}{' '}
                <strong style={{ color: 'var(--text-main)' }}>{importResult.branchName}</strong>
              </p>

              {/* Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '14px',
                  marginBottom: '28px',
                }}
              >
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', marginBottom: '6px' }}>
                    <Users size={16} />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Technicians</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#065f46' }}>
                    +{importResult.imported.technicians}
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', marginBottom: '6px' }}>
                    <UserCheck size={16} />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Doctors</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e40af' }}>
                    +{importResult.imported.doctors}
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706', marginBottom: '6px' }}>
                    <Layers size={16} />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Process Areas</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#92400e' }}>
                    +{importResult.imported.processAreas}
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed', marginBottom: '6px' }}>
                    <Cpu size={16} />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Processes</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#5b21b6' }}>
                    +{importResult.imported.processes}
                  </div>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="btn btn-primary"
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                {t('bulkUpload.success.closeBtn')}
              </button>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────── */
            /* REGULAR UPLOAD WORKFLOW */
            /* ─────────────────────────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Step 1: Download Template */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor: '#107C41',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      STEP 1
                    </span>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                      {t('bulkUpload.step1Title')}
                    </h4>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                    {t('bulkUpload.step1Desc')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloading}
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    padding: '9px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #107C41',
                    color: '#107C41',
                    cursor: downloading ? 'not-allowed' : 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    flexShrink: 0,
                  }}
                >
                  <Download size={16} />
                  <span>{downloading ? 'Downloading...' : t('bulkUpload.downloadTemplateBtn')}</span>
                </button>
              </div>

              {/* Step 2: Upload Completed File */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: 'var(--primary-600)',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    STEP 2
                  </span>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                    {t('bulkUpload.step2Title')}
                  </h4>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${
                      isDragging
                        ? 'var(--primary-600)'
                        : file
                        ? '#059669'
                        : 'var(--border-color)'
                    }`,
                    backgroundColor: isDragging
                      ? 'rgba(37, 99, 235, 0.05)'
                      : file
                      ? 'rgba(5, 150, 105, 0.03)'
                      : 'var(--bg-surface)',
                    borderRadius: '14px',
                    padding: '24px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      backgroundColor: file ? '#ecfdf5' : 'var(--bg-surface-hover)',
                      color: file ? '#059669' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 10px',
                    }}
                  >
                    {file ? <CheckCircle2 size={24} /> : <UploadCloud size={24} />}
                  </div>

                  {file ? (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        {(file.size / 1024).toFixed(1)} KB • {file.name.endsWith('.xlsx') ? 'OpenXML Spreadsheet' : 'Excel BIFF8'}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        style={{
                          fontSize: '12px',
                          color: 'var(--primary-600)',
                          fontWeight: 700,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {t('bulkUpload.changeFile')}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                        {t('bulkUpload.dragDropText')}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {t('bulkUpload.fileLimitText')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Validation Feedback & Preview */}
              {validating && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-surface-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                  }}
                >
                  <RefreshCw size={16} className="animate-spin" />
                  <span>{t('bulkUpload.validating')}</span>
                </div>
              )}

              {/* Validation Success Banner */}
              {validationResult?.valid && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', marginBottom: '12px' }}>
                    <CheckCircle2 size={18} />
                    <span style={{ fontSize: '13.5px', fontWeight: 700 }}>
                      {t('bulkUpload.validationSuccess')}
                    </span>
                  </div>

                  {/* Ready to Import Breakdown */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #d1fae5',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669' }}>
                        {t('bulkUpload.summary.technicians')}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#065f46' }}>
                        {validationResult.counts.technicians}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #dbeafe',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>
                        {t('bulkUpload.summary.doctors')}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e40af' }}>
                        {validationResult.counts.doctors}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #fef3c7',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706' }}>
                        {t('bulkUpload.summary.processAreas')}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#92400e' }}>
                        {validationResult.counts.processAreas}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #ede9fe',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed' }}>
                        {t('bulkUpload.summary.processes')}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#5b21b6' }}>
                        {validationResult.counts.processes}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Validation Errors Table */}
              {validationResult && !validationResult.valid && (
                <div
                  style={{
                    borderRadius: '14px',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fff1f2',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b' }}>
                      <AlertTriangle size={18} />
                      <span style={{ fontSize: '14px', fontWeight: 800 }}>
                        {t('bulkUpload.validationErrorsTitle', { count: validationResult.errors.length })}
                      </span>
                    </div>

                    {/* Sheet Filter Tabs */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['ALL', 'Technician', 'Doctor', 'Process Area', 'Process'].map((sheet) => {
                        const count =
                          sheet === 'ALL'
                            ? validationResult.errors.length
                            : validationResult.errors.filter((e) => e.sheet === sheet).length;
                        if (sheet !== 'ALL' && count === 0) return null;

                        return (
                          <button
                            key={sheet}
                            type="button"
                            onClick={() => setSelectedSheetFilter(sheet)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '6px',
                              border:
                                selectedSheetFilter === sheet
                                  ? '1px solid #991b1b'
                                  : '1px solid #fecaca',
                              backgroundColor:
                                selectedSheetFilter === sheet ? '#991b1b' : '#ffffff',
                              color: selectedSheetFilter === sheet ? '#ffffff' : '#991b1b',
                              cursor: 'pointer',
                            }}
                          >
                            {sheet} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: '#7f1d1d', margin: '0 0 12px' }}>
                    {t('bulkUpload.validationErrorsDesc')}
                  </p>

                  {/* Errors Table */}
                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #fecaca',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fff5f5', borderBottom: '1px solid #fee2e2' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#991b1b' }}>
                            {t('bulkUpload.table.sheet')}
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#991b1b', width: '60px' }}>
                            {t('bulkUpload.table.row')}
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#991b1b' }}>
                            {t('bulkUpload.table.column')}
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#991b1b' }}>
                            {t('bulkUpload.table.issue')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredErrors.map((err, idx) => {
                          const badge = getSheetBadgeColor(err.sheet);
                          return (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: idx < filteredErrors.length - 1 ? '1px solid #fee2e2' : 'none',
                              }}
                            >
                              <td style={{ padding: '8px 12px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    backgroundColor: badge.bg,
                                    color: badge.text,
                                    border: `1px solid ${badge.border}`,
                                  }}
                                >
                                  {err.sheet}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#7f1d1d' }}>
                                #{err.row}
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-main)' }}>
                                {err.column}
                                {err.value && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                                    ("{err.value}")
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '8px 12px', color: '#991b1b' }}>
                                {err.message}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!importResult && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={importing || validating}
              className="btn btn-secondary"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                padding: '9px 18px',
                borderRadius: '9px',
              }}
            >
              Cancel
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              {validationResult && !validationResult.valid && (
                <button
                  type="button"
                  onClick={() => runValidation()}
                  disabled={validating || !file}
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    padding: '9px 18px',
                    borderRadius: '9px',
                  }}
                >
                  <RefreshCw size={14} className={validating ? 'animate-spin' : ''} />
                  <span>Re-Validate</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleImport}
                disabled={!file || validating || importing || (validationResult !== null && !validationResult.valid)}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  padding: '9px 22px',
                  borderRadius: '9px',
                  boxShadow: 'var(--shadow-sm)',
                  opacity:
                    !file || validating || importing || (validationResult !== null && !validationResult.valid)
                      ? 0.6
                      : 1,
                  cursor:
                    !file || validating || importing || (validationResult !== null && !validationResult.valid)
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {importing ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>{t('bulkUpload.importing')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('bulkUpload.importBtn')}</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
