import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { Download, Printer, X } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { useToast } from '../../core/context/ToastContext';

interface QrCodeModalProps {
  order: {
    id: string;
    folioNumber: string;
    qrToken: string;
    patient?: string | null;
    boxNumber?: string | null;
    doctor?: {
      name?: string | null;
      clinicName?: string | null;
    } | null;
  } | null;
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ order, onClose }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!order) return null;

  const publicTrackingUrl = `${window.location.origin}/qr/${order.qrToken}`;

  useEffect(() => {
    if (canvasRef.current && order.qrToken) {
      QRCode.toCanvas(
        canvasRef.current,
        publicTrackingUrl,
        {
          width: 220,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        },
        (error) => {
          if (error) {
            console.error('Failed to generate QR code canvas:', error);
          }
        },
      );
    }
  }, [order.qrToken, publicTrackingUrl]);

  /**
   * Generates a high-resolution, branded PNG image of the QR card
   * exactly matching the modal layout for download.
   */
  const handleDownload = async () => {
    try {
      const cardCanvas = document.createElement('canvas');
      const ctx = cardCanvas.getContext('2d');
      if (!ctx) return;

      const width = 480;
      const height = 670;
      const scale = 2; // High-res retina scale

      cardCanvas.width = width * scale;
      cardCanvas.height = height * scale;
      ctx.scale(scale, scale);

      // 1. Background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, 16);
      ctx.fill();

      // Card border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. WO Folio Header
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 24px "Outfit", "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`WO #${order.folioNumber}`, width / 2, 52);

      // 3. Dashed line divider
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.moveTo(40, 74);
      ctx.lineTo(width - 40, 74);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // 4. Patient Name Label & Value
      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px "Inter", sans-serif';
      ctx.fillText(t('qrModal.patientNameLabel', 'Patient Name').toUpperCase(), width / 2, 98);

      ctx.fillStyle = '#0f172a';
      ctx.font = '700 17px "Inter", sans-serif';
      ctx.fillText(order.patient || '—', width / 2, 122);

      // 5. Box # & Doctor Name section (2 columns)
      // Left: Box #
      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px "Inter", sans-serif';
      ctx.fillText(t('qrModal.boxNumberLabel', 'Box #').toUpperCase(), width / 4, 154);

      ctx.fillStyle = '#0284c7';
      ctx.font = '800 16px "Inter", sans-serif';
      ctx.fillText(order.boxNumber ? `#${order.boxNumber}` : '—', width / 4, 178);

      // Right: Doctor Name
      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px "Inter", sans-serif';
      ctx.fillText(t('qrModal.doctorNameLabel', 'Doctor Name').toUpperCase(), (width * 3) / 4, 154);

      ctx.fillStyle = '#0f172a';
      ctx.font = '700 15px "Inter", sans-serif';
      const doctorDisplayName = order.doctor?.name || '—';
      ctx.fillText(doctorDisplayName, (width * 3) / 4, 178);

      // 6. QR Code inner rounded frame
      const qrBoxX = 90;
      const qrBoxY = 202;
      const qrBoxSize = 300;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16);
      ctx.fill();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 7. Render QR Code onto the card
      const qrDataUrl = await QRCode.toDataURL(publicTrackingUrl, {
        width: 260,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });

      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.onload = () => {
        ctx.drawImage(qrImg, qrBoxX + 20, qrBoxY + 20, 260, 260);

        // 8. Trigger PNG download
        const dataUrl = cardCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `WO-${order.folioNumber}-QR.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(
          t('qrModal.downloadSuccess', {
            folio: order.folioNumber,
            defaultValue: `QR code for WO #${order.folioNumber} downloaded.`,
          }),
        );
      };
      qrImg.src = qrDataUrl;
    } catch (err) {
      console.error('Failed to download QR code image:', err);
      toast.error(t('qrModal.downloadFailed', 'Failed to download QR code image'));
    }
  };

  /**
   * Prints the QR card cleanly using an invisible iframe to prevent popup blockers and instant window close issues.
   */
  const handlePrint = async () => {
    try {
      const qrDataUrl = await QRCode.toDataURL(publicTrackingUrl, {
        width: 300,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });

      // Reuse or create hidden printing iframe
      let iframe = document.getElementById('qr-print-iframe') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'qr-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc || !iframe.contentWindow) {
        toast.error(t('qrModal.printFailed', 'Failed to print QR code'));
        return;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>WO #${order.folioNumber} - QR Code</title>
            <style>
              @page {
                size: auto;
                margin: 8mm;
              }
              * {
                box-sizing: border-box;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0;
                padding: 16px;
                background: #ffffff;
                color: #0f172a;
              }
              .qr-card {
                border: 2px solid #0f172a;
                border-radius: 16px;
                padding: 24px 20px;
                width: 320px;
                text-align: center;
                background: #ffffff;
              }
              .folio-title {
                font-size: 22px;
                font-weight: 800;
                margin: 0 0 8px 0;
                letter-spacing: 0.02em;
                color: #0f172a;
              }
              .divider {
                border-bottom: 1.5px dashed #94a3b8;
                margin: 8px 0 10px 0;
              }
              .meta-label {
                font-size: 10px;
                font-weight: 600;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                margin-bottom: 2px;
              }
              .patient-name {
                font-size: 16px;
                font-weight: 700;
                color: #0f172a;
                margin: 0 0 10px 0;
              }
              .meta-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 6px 12px;
                margin-bottom: 12px;
              }
              .meta-col {
                flex: 1;
                text-align: center;
              }
              .box-badge {
                font-size: 14px;
                font-weight: 800;
                color: #0284c7;
              }
              .doctor-name {
                font-size: 13px;
                font-weight: 700;
                color: #0f172a;
              }
              .qr-image-wrapper {
                border: 1px solid #cbd5e1;
                border-radius: 12px;
                padding: 8px;
                display: inline-block;
                background: #ffffff;
              }
              .qr-image {
                display: block;
                width: 200px;
                height: 200px;
              }
            </style>
          </head>
          <body>
            <div class="qr-card">
              <div class="folio-title">WO #${order.folioNumber}</div>
              <div class="divider"></div>
              <div class="meta-label">${t('qrModal.patientNameLabel', 'Patient Name')}</div>
              <div class="patient-name">${order.patient || '—'}</div>
              <div class="meta-row">
                <div class="meta-col">
                  <div class="meta-label">${t('qrModal.boxNumberLabel', 'Box #')}</div>
                  <div class="box-badge">${order.boxNumber ? '#' + order.boxNumber : '—'}</div>
                </div>
                <div class="meta-col">
                  <div class="meta-label">${t('qrModal.doctorNameLabel', 'Doctor Name')}</div>
                  <div class="doctor-name">${order.doctor?.name || '—'}</div>
                </div>
              </div>
              <div class="qr-image-wrapper">
                <img id="qr-code-img" class="qr-image" src="${qrDataUrl}" alt="QR Code" />
              </div>
            </div>
          </body>
        </html>
      `;

      doc.open();
      doc.write(htmlContent);
      doc.close();

      const triggerPrint = () => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (printErr) {
          console.error('Print execution failed:', printErr);
        }
      };

      const qrImg = doc.getElementById('qr-code-img') as HTMLImageElement | null;
      if (qrImg) {
        if (qrImg.complete) {
          setTimeout(triggerPrint, 50);
        } else {
          qrImg.onload = () => setTimeout(triggerPrint, 50);
        }
      } else {
        setTimeout(triggerPrint, 50);
      }
    } catch (err) {
      console.error('Failed to print QR code:', err);
      toast.error(t('qrModal.printFailed', 'Failed to print QR code'));
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '430px',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-modal, var(--bg-card))',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ─── MODAL HEADER (Matching Screenshot) ─────────────── */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-modal-header, var(--bg-card))',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-heading)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {t('qrModal.title', 'QR Code')}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Download Button */}
            <Tooltip content={t('qrModal.downloadTooltip', 'Download QR Card')}>
              <button
                type="button"
                onClick={handleDownload}
                className="btn-icon"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                }}
                aria-label={t('qrModal.downloadTooltip', 'Download QR Card')}
              >
                <Download size={15} />
              </button>
            </Tooltip>

            {/* Print Button */}
            <Tooltip content={t('qrModal.printTooltip', 'Print QR Card')}>
              <button
                type="button"
                onClick={handlePrint}
                className="btn-icon"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                }}
                aria-label={t('qrModal.printTooltip', 'Print QR Card')}
              >
                <Printer size={15} />
              </button>
            </Tooltip>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
              aria-label={t('common.close', 'Close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── MODAL BODY (Light gray/blue backdrop with white inner card) ── */}
        <div
          style={{
            padding: '24px 20px',
            backgroundColor: 'var(--bg-surface-muted, #f1f5f9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Inner QR Card matching the Screenshot */}
          <div
            style={{
              width: '100%',
              maxWidth: '320px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '1.5px solid #e2e8f0',
              padding: '26px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
              textAlign: 'center',
            }}
          >
            {/* 1. Folio Number */}
            <div
              style={{
                fontSize: '21px',
                fontWeight: 800,
                color: '#0f172a',
                fontFamily: 'var(--font-heading, "Outfit", "Inter", sans-serif)',
                letterSpacing: '0.02em',
              }}
            >
              WO #{order.folioNumber}
            </div>

            {/* 2. Dashed Divider */}
            <div
              style={{
                width: '100%',
                borderBottom: '1.5px dashed #cbd5e1',
                margin: '12px 0 10px 0',
              }}
            />

            {/* 3. Patient Name */}
            <div style={{ width: '100%', marginBottom: '10px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '2px',
                }}
              >
                {t('qrModal.patientNameLabel', 'Patient Name')}
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                {order.patient || '—'}
              </div>
            </div>

            {/* 4. Box # and Doctor Name Row */}
            <div
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '8px 10px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '14px',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {t('qrModal.boxNumberLabel', 'Box #')}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0284c7', marginTop: '1px' }}>
                  {order.boxNumber ? `#${order.boxNumber}` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {t('qrModal.doctorNameLabel', 'Doctor Name')}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: '1px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={order.doctor?.name || ''}
                >
                  {order.doctor?.name || '—'}
                </div>
              </div>
            </div>

            {/* 5. QR Code Box */}
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '10px',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  display: 'block',
                  width: '200px',
                  height: '200px',
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── MODAL FOOTER ───────────────────────────────────── */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-modal, var(--bg-card))',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              minWidth: '85px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
