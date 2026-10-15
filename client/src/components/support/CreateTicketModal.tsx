import React, { useState, useRef } from 'react';
import { X, UploadCloud, Image as ImageIcon, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../core/context/ToastContext';
import { supportService, TicketImage } from '../../services/supportService';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId?: string;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  branchId,
}) => {
  const { t } = useTranslation();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<TicketImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 2) {
      toast.error(t('support.maxImagesError', 'You can upload a maximum of 2 images per ticket.'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const newImages: TicketImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          toast.error(t('support.invalidImageType', 'Only image files (JPEG, PNG, WebP) are allowed.'));
          continue;
        }

        // Upload to server storage
        const uploaded = await supportService.uploadImage(file);
        newImages.push(uploaded);
      }
      setImages((prev) => [...prev, ...newImages].slice(0, 2));
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      toast.error(err?.response?.data?.message || t('support.uploadFailed', 'Failed to upload image.'));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(t('support.titleRequired', 'Ticket Name is required.'));
      return;
    }

    if (!description.trim()) {
      toast.error(t('support.descRequired', 'Description is required.'));
      return;
    }

    setIsSubmitting(true);
    try {
      await supportService.createTicket({
        title: title.trim(),
        description: description.trim(),
        images,
        branchId,
      });

      toast.success(t('support.createSuccess', 'Support ticket created successfully! Platform Admins have been notified.'));
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create ticket:', err);
      toast.error(err?.response?.data?.message || t('support.createError', 'Failed to create support ticket.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '620px',
          width: '94%',
          borderRadius: '16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-app)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('support.createTicketTitle', 'Create Support Ticket')}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('support.createTicketSubtitle', 'Submit your query or technical issue directly to Platform Support.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Ticket Name / Title */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}
              >
                {t('support.ticketName', 'Ticket Name')} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('support.ticketNamePlaceholder', 'Brief summary of the issue...')}
                maxLength={200}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}
              >
                {t('support.description', 'Description')} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  'support.descriptionPlaceholder',
                  'Provide detailed information about the issue, steps to reproduce, or assistance needed...',
                )}
                rows={5}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Image Upload (Max 2 images) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t('support.imageUpload', 'Image Upload')}
                </label>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: images.length >= 2 ? '#f59e0b' : 'var(--text-muted)',
                  }}
                >
                  {images.length} / 2 {t('support.imagesUploaded', 'images attached')}
                </span>
              </div>

              {/* Upload trigger box */}
              {images.length < 2 && (
                <div
                  onClick={() => !uploadingImage && fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: uploadingImage ? 'not-allowed' : 'pointer',
                    background: 'var(--bg-app)',
                    transition: 'border-color 0.2s',
                    marginBottom: images.length > 0 ? '12px' : 0,
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple={images.length === 0}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  {uploadingImage ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Loader2 size={24} className="spin" style={{ color: 'var(--primary-600)' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {t('support.uploading', 'Uploading image...')}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <UploadCloud size={28} style={{ color: 'var(--primary-600)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t('support.clickToUpload', 'Click to upload screenshot or image')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t('support.imageSpecs', 'PNG, JPG, or WEBP (Max 2 images)')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Attached Images Previews */}
              {images.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-app)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          height: '110px',
                          background: '#090d16',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div
                        style={{
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--bg-surface)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '180px',
                          }}
                          title={img.name}
                        >
                          {img.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          title={t('common.remove', 'Remove')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Note banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                fontSize: '12px',
                lineHeight: '1.4',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                {t(
                  'support.autoTrackingNotice',
                  'Your Tenant details, Branch, Author name, and creation timestamp will be recorded automatically with this ticket.',
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-app)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary"
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploadingImage}
              className="btn btn-primary"
              style={{
                padding: '8px 22px',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              {isSubmitting && <Loader2 size={16} className="spin" />}
              {t('support.submitTicket', 'Submit Ticket')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
