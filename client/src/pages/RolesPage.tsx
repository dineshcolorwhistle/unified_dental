import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Key, CheckCircle2 } from 'lucide-react';

export const RolesPage: React.FC = () => {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<any[]>([]);
  const [permissionsGrouped, setPermissionsGrouped] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRbac = async () => {
      try {
        setLoading(true);
        const [rolesRes, permsRes] = await Promise.allSettled([
          api.get('/rbac/roles'),
          api.get('/rbac/permissions'),
        ]);

        if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.data || []);
        if (permsRes.status === 'fulfilled') setPermissionsGrouped(permsRes.value.data?.grouped || {});
      } catch (e) {
        console.error('Failed to load RBAC data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchRbac();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', color: 'var(--text-heading)' }}>{t('roles.title')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>{t('roles.subtitle')}</p>
      </div>

      {/* System Roles Grid */}
      <h2 style={{ fontSize: '18px', color: 'var(--text-heading)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={20} style={{ color: 'var(--primary-600)' }} /> {t('roles.systemRoles')}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '18px',
          marginBottom: '36px',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', gridColumn: '1 / -1', color: 'var(--primary-600)' }}>
            {t('common.loading')}
          </div>
        ) : (
          roles.map((r) => (
            <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '16px', color: 'var(--text-main)' }}>{r.name}</h3>
                  <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                    {r.isSystem ? 'System' : 'Custom'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', minHeight: '36px' }}>
                  {r.description || 'Standard role permissions.'}
                </div>
                {r.moduleKey && (
                  <span className="badge badge-info" style={{ fontSize: '10px', marginBottom: '8px' }}>
                    Module: {r.moduleKey}
                  </span>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Permissions: <strong>{r.rolePermissions?.length || 0}</strong></span>
                <span>Assigned Users: <strong>{r._count?.userRoles || 0}</strong></span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Permissions Matrix */}
      <h2 style={{ fontSize: '18px', color: 'var(--text-heading)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Key size={20} style={{ color: 'var(--sky-500)' }} /> {t('roles.permissionGroups')}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {Object.entries(permissionsGrouped).map(([group, perms]) => (
          <div key={group} className="card">
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              {group} ({perms.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {perms.map((p: any) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <CheckCircle2 size={13} style={{ color: 'var(--emerald-500)', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: 'var(--text-main)' }}>{p.name}</strong>
                    <div style={{ fontSize: '10px', color: 'var(--text-subtle)', fontFamily: 'monospace' }}>
                      {p.key}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
