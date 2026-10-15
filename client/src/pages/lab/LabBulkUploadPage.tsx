import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../core/context/AuthContext';
import { useToast } from '../../core/context/ToastContext';
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  UserCheck,
  Layers,
  Cpu,
  ArrowRight,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
  FileText,
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

export const LabBulkUploadPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  const [validationResult, setValidationResult] = useState<ValidationData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedSheetFilter, setSelectedSheetFilter] = useState<string>('ALL');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      setDownloading(true);
      const res = await api.get('/lab/bulk-upload/template', {
        responseType: 'blob',
      });

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
      toast.success('Template downloaded successfully.');
    } catch {
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
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setFile(selectedFile);
    setValidationResult(null);
    setImportResult(null);
    setSelectedSheetFilter('ALL');

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

  const handleReset = () => {
    setFile(null);
    setValidationResult(null);
    setImportResult(null);
    setSelectedSheetFilter('ALL');
  };

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
    <div style={{ paddingBottom: '40px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #107C41 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 124, 65, 0.25)',
            }}
          >
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              {t('bulkUpload.modalTitle')}
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t('bulkUpload.modalSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {importResult ? (
        /* ───────────────────────────────────────────────────────────── */
        /* SUCCESS SCREEN */
        /* ───────────────────────────────────────────────────────────── */
        <div className="card" style={{ padding: '36px', textAlign: 'center', borderRadius: '18px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              boxShadow: '0 6px 18px rgba(5, 150, 105, 0.25)',
            }}
          >
            <CheckCircle2 size={42} />
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '8px' }}>
            {t('bulkUpload.success.title')}
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '32px' }}>
            {t('bulkUpload.success.desc')}{' '}
            <strong style={{ color: 'var(--text-main)' }}>{importResult.branchName}</strong>
          </p>

          {/* Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              maxWidth: '840px',
              margin: '0 auto 36px',
            }}
          >
            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', marginBottom: '8px' }}>
                <Users size={18} />
                <span style={{ fontSize: '13px', fontWeight: 700 }}>Technicians Created</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#065f46' }}>
                +{importResult.imported.technicians}
              </div>
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', marginBottom: '8px' }}>
                <UserCheck size={18} />
                <span style={{ fontSize: '13px', fontWeight: 700 }}>Doctors Created</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e40af' }}>
                +{importResult.imported.doctors}
              </div>
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706', marginBottom: '8px' }}>
                <Layers size={18} />
                <span style={{ fontSize: '13px', fontWeight: 700 }}>Process Areas</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#92400e' }}>
                +{importResult.imported.processAreas}
              </div>
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: '#f5f3ff',
                border: '1px solid #ddd6fe',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed', marginBottom: '8px' }}>
                <Cpu size={18} />
                <span style={{ fontSize: '13px', fontWeight: 700 }}>Processes</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#5b21b6' }}>
                +{importResult.imported.processes}
              </div>
            </div>
          </div>

          {/* Quick Navigation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleReset}
              className="btn btn-secondary"
              style={{ padding: '10px 20px', fontWeight: 700, borderRadius: '10px' }}
            >
              Upload Another Spreadsheet
            </button>
            <button
              onClick={() => navigate('/lab/users/technicians')}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontWeight: 700, borderRadius: '10px' }}
            >
              View Technicians
            </button>
            <button
              onClick={() => navigate('/lab/processes')}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontWeight: 700, borderRadius: '10px' }}
            >
              View Processes
            </button>
          </div>
        </div>
      ) : (
        /* ───────────────────────────────────────────────────────────── */
        /* BULK UPLOAD THREE-STEP WORKFLOW */
        /* ───────────────────────────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Feature Highlights: The 4 Sheets & Dynamic Dropdowns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
            }}
          >
            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderRadius: '14px',
                borderLeft: '4px solid #107C41',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Users size={16} color="#107C41" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#107C41' }}>
                  Sheet 1: Technician
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                Enter technician name, email, and phone. Creates new branch staff and builds the technician dropdown list.
              </p>
            </div>

            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderRadius: '14px',
                borderLeft: '4px solid #1D4ED8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <UserCheck size={16} color="#1D4ED8" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1D4ED8' }}>
                  Sheet 2: Doctor
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                Enter doctor name, clinic name, and contact details. All uploaded doctors are registered as Local Doctors.
              </p>
            </div>

            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderRadius: '14px',
                borderLeft: '4px solid #D97706',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Layers size={16} color="#D97706" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#D97706' }}>
                  Sheet 3: Process Area
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                Define workstations/departments (e.g. CAD/CAM, Ceramics) which automatically feed the Process sheet dropdown.
              </p>
            </div>

            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderRadius: '14px',
                borderLeft: '4px solid #7C3AED',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Cpu size={16} color="#7C3AED" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#7C3AED' }}>
                  Sheet 4: Process
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                Select Process Area and Technician from Excel dropdowns populated from Sheets 1 & 3.
              </p>
            </div>
          </div>

          {/* Step 1 Card: Download Template */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: '#107C41',
                      color: '#ffffff',
                      padding: '3px 10px',
                      borderRadius: '6px',
                    }}
                  >
                    STEP 1
                  </span>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                    {t('bulkUpload.step1Title')}
                  </h3>
                </div>
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
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
                  fontSize: '14px',
                  fontWeight: 700,
                  padding: '11px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #107C41',
                  color: '#107C41',
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0,
                }}
              >
                <Download size={18} />
                <span>{downloading ? 'Downloading...' : t('bulkUpload.downloadTemplateBtn')}</span>
              </button>
            </div>
          </div>

          {/* Step 2 Card: Upload Spreadsheet File */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  backgroundColor: 'var(--primary-600)',
                  color: '#ffffff',
                  padding: '3px 10px',
                  borderRadius: '6px',
                }}
              >
                STEP 2
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
                {t('bulkUpload.step2Title')}
              </h3>
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
                  : 'var(--bg-surface-hover)',
                borderRadius: '16px',
                padding: '36px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  backgroundColor: file ? '#ecfdf5' : 'var(--bg-surface)',
                  color: file ? '#059669' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {file ? <CheckCircle2 size={30} /> : <UploadCloud size={30} />}
              </div>

              {file ? (
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {(file.size / 1024).toFixed(1)} KB • {file.name.endsWith('.xlsx') ? 'OpenXML Workbook' : 'Excel BIFF8'}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '12px', fontWeight: 700, borderRadius: '8px' }}
                  >
                    {t('bulkUpload.changeFile')}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {t('bulkUpload.dragDropText')}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {t('bulkUpload.fileLimitText')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Validation & Import Results */}
          {validating && (
            <div
              className="card"
              style={{
                padding: '28px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              <RefreshCw size={20} className="animate-spin" />
              <span>{t('bulkUpload.validating')}</span>
            </div>
          )}

          {/* Validation Success Card */}
          {validationResult?.valid && (
            <div
              className="card"
              style={{
                padding: '24px',
                borderRadius: '16px',
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #a7f3d0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#065f46', marginBottom: '16px' }}>
                <CheckCircle2 size={22} />
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                  {t('bulkUpload.validationSuccess')}
                </h3>
              </div>

              {/* Counts Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '14px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ padding: '14px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #d1fae5' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                    {t('bulkUpload.summary.technicians')}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#065f46' }}>
                    {validationResult.counts.technicians}
                  </div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #dbeafe' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>
                    {t('bulkUpload.summary.doctors')}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e40af' }}>
                    {validationResult.counts.doctors}
                  </div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #fef3c7' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', marginBottom: '4px' }}>
                    {t('bulkUpload.summary.processAreas')}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#92400e' }}>
                    {validationResult.counts.processAreas}
                  </div>
                </div>

                <div style={{ padding: '14px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #ede9fe' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', marginBottom: '4px' }}>
                    {t('bulkUpload.summary.processes')}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#5b21b6' }}>
                    {validationResult.counts.processes}
                  </div>
                </div>
              </div>

              {/* Import Action Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    padding: '12px 28px',
                    borderRadius: '10px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {importing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>{t('bulkUpload.importing')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('bulkUpload.importBtn')}</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Validation Errors Card */}
          {validationResult && !validationResult.valid && (
            <div
              className="card"
              style={{
                borderRadius: '16px',
                border: '1.5px solid #fecaca',
                backgroundColor: '#fff1f2',
                padding: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b' }}>
                  <AlertTriangle size={22} />
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                    {t('bulkUpload.validationErrorsTitle', { count: validationResult.errors.length })}
                  </h3>
                </div>

                {/* Sheet Tabs */}
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
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          borderRadius: '8px',
                          border:
                            selectedSheetFilter === sheet
                              ? '1.5px solid #991b1b'
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

              <p style={{ fontSize: '13px', color: '#7f1d1d', margin: '0 0 16px' }}>
                {t('bulkUpload.validationErrorsDesc')}
              </p>

              {/* Errors Table */}
              <div
                style={{
                  maxHeight: '320px',
                  overflowY: 'auto',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #fecaca',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fff5f5', borderBottom: '1.5px solid #fee2e2' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#991b1b' }}>
                        {t('bulkUpload.table.sheet')}
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#991b1b', width: '70px' }}>
                        {t('bulkUpload.table.row')}
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#991b1b' }}>
                        {t('bulkUpload.table.column')}
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#991b1b' }}>
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
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '6px',
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
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#7f1d1d' }}>
                            #{err.row}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-main)' }}>
                            {err.column}
                            {err.value && (
                              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                ("{err.value}")
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#991b1b' }}>
                            {err.message}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Re-validate button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => runValidation()}
                  disabled={validating}
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    padding: '9px 18px',
                    borderRadius: '9px',
                  }}
                >
                  <RefreshCw size={14} className={validating ? 'animate-spin' : ''} />
                  <span>Re-Validate File</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LabBulkUploadPage;
