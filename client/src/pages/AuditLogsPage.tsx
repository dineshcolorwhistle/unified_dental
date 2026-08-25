import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { Pagination } from '../components/common/Pagination';
import { Clock, User, Building, Eye } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async (p = 1, limit = pageSize) => {
    try {
      setLoading(true);
      const res = await api.get('/audit-logs', { params: { page: p, limit } });
      const receivedLogs = res.data?.logs || (Array.isArray(res.data) ? res.data : []);
      const total = res.data?.meta?.total || receivedLogs.length;
      const pages = res.data?.meta?.totalPages || Math.max(1, Math.ceil(total / limit));
      setLogs(receivedLogs);
      setTotalItems(total);
      setTotalPages(pages);
      setPage(p);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, pageSize);
  }, [pageSize]);

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    fetchLogs(1, newSize);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', color: 'var(--text-heading)' }}>{t('audit.title')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>{t('audit.subtitle')}</p>
      </div>

      {/* Audit Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="ud-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface-hover)' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('audit.action')}</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('audit.resource')}</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('audit.performedBy')}</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('audit.branch')}</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('audit.timestamp')}</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('audit.details')}</th>
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
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-info" style={{ fontSize: '11px' }}>{log.action}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-main)' }}>
                      {log.resourceType} {log.resourceId ? `(#${log.resourceId.substring(0, 6)})` : ''}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
                        <User size={13} style={{ color: 'var(--text-subtle)' }} />
                        {log.user?.name || log.user?.email || 'System'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      {log.branch?.name || 'Tenant Scope'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <Clock size={12} />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
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

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

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
