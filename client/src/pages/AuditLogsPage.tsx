import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { Clock, User, Building, Eye } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async (p = 1) => {
    try {
      setLoading(true);
      const res = await api.get('/audit-logs', { params: { page: p, limit: 20 } });
      setLogs(res.data?.logs || []);
      setTotalPages(res.data?.meta?.totalPages || 1);
      setPage(p);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', color: 'var(--text-heading)' }}>{t('audit.title')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>{t('audit.subtitle')}</p>
      </div>

      {/* Audit Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('audit.action')}</th>
              <th>{t('audit.resource')}</th>
              <th>{t('audit.performedBy')}</th>
              <th>{t('audit.branch')}</th>
              <th>{t('audit.timestamp')}</th>
              <th>{t('audit.details')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--primary-600)' }}>
                  {t('common.loading')}
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No audit records found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className="badge badge-info" style={{ fontFamily: 'monospace' }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{log.resourceType}</div>
                    {log.resourceId && (
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>#{log.resourceId.substring(0, 8)}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={13} style={{ color: 'var(--text-subtle)' }} />
                      <span>{log.user?.name || log.user?.email || 'System'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building size={13} style={{ color: 'var(--text-subtle)' }} />
                      <span>{log.branch?.name || 'Organization-wide'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <Clock size={12} />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      <Eye size={12} /> Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          <button
            disabled={page <= 1}
            onClick={() => fetchLogs(page - 1)}
            className="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', padding: '0 12px', color: 'var(--text-main)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => fetchLogs(page + 1)}
            className="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* Inspect Log Details Modal */}
      {selectedLog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', color: 'var(--text-heading)' }}>
                Audit Detail: {selectedLog.action} ({selectedLog.resourceType})
              </h3>
              <button onClick={() => setSelectedLog(null)} className="btn-secondary btn-sm">✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-main)' }}>
                <div><strong>User:</strong> {selectedLog.user?.name || 'System'}</div>
                <div><strong>Branch:</strong> {selectedLog.branch?.name || 'Tenant Scope'}</div>
                <div><strong>IP Address:</strong> {selectedLog.ipAddress || 'Internal'}</div>
                <div><strong>Timestamp:</strong> {new Date(selectedLog.createdAt).toLocaleString()}</div>
              </div>

              {selectedLog.oldValues && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--rose-500)', marginBottom: '4px' }}>
                    Old Values (Before):
                  </div>
                  <pre
                    style={{
                      backgroundColor: 'var(--badge-danger-bg)',
                      color: 'var(--badge-danger-text)',
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      overflowX: 'auto',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValues && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-600)', marginBottom: '4px' }}>
                    New Values (After):
                  </div>
                  <pre
                    style={{
                      backgroundColor: 'var(--badge-primary-bg)',
                      color: 'var(--badge-primary-text)',
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      overflowX: 'auto',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedLog(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
