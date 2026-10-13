import { TFunction } from 'i18next';

export interface AuditLogFormatResult {
  actionTitle: string;
  dotColor: string;
  notesText: string;
  isRework: boolean;
}

/**
 * Format and localize process activity audit logs for admin and technician modals.
 * Handles English-stored notes strings from DB and dynamically translates them into
 * the current active language (e.g. Spanish).
 */
export function formatAuditLog(
  log: {
    id?: string;
    action?: string;
    notes?: string | null;
    timestamp?: string | Date;
    [key: string]: any;
  },
  t: TFunction,
  language: string = 'en',
  fallbackProcessName?: string,
): AuditLogFormatResult {
  const action = (log.action || '').toUpperCase();
  const rawNotes = (log.notes || '').trim();
  const isSpanish = language?.toLowerCase().startsWith('es');

  // 1. Determine if this entry is a Rework or Repetition event
  const isReworkAction =
    action === 'REWORK_ASSIGNED' ||
    action === 'REWORK' ||
    /rework cycle/i.test(rawNotes) ||
    /rework initiated/i.test(rawNotes) ||
    /flagged for rework/i.test(rawNotes);

  const isRepetitionAction =
    action === 'REPETITION_RESET' ||
    /repetition initiated/i.test(rawNotes);

  const isRework = isReworkAction || isRepetitionAction;

  // 2. Action Title & Dot Color determination
  let actionTitle = '';
  let dotColor = '#64748b'; // default slate

  if (isReworkAction) {
    dotColor = '#ef4444'; // Red for rework
    actionTitle = t('technician.auditLog.reworkInitiated', { defaultValue: 'Rework Initiated' });
  } else if (isRepetitionAction) {
    dotColor = '#ef4444'; // Red for repetition
    actionTitle = t('technician.auditLog.repetitionInitiated', { defaultValue: 'Repetition Initiated' });
  } else if (action === 'COMPLETE') {
    dotColor = '#10b981'; // Green
    actionTitle = t('technician.auditLog.processCompleted', { defaultValue: 'Process Completed' });
  } else if (action === 'START') {
    dotColor = 'var(--primary-600, #0ea5e9)'; // Blue
    actionTitle = t('technician.auditLog.processStarted', { defaultValue: 'Process Started' });
  } else if (action === 'PAUSE') {
    dotColor = '#f59e0b'; // Amber
    actionTitle = t('technician.auditLog.processPaused', { defaultValue: 'Process Paused' });
  } else if (action === 'RESUME') {
    dotColor = '#8b5cf6'; // Purple
    actionTitle = t('technician.auditLog.processResumed', { defaultValue: 'Process Resumed' });
  } else if (action === 'VERIFICATION_APPROVED') {
    dotColor = '#10b981'; // Green
    actionTitle = t('technician.auditLog.verificationApproved', { defaultValue: 'Verification Approved' });
  } else if (action === 'FAIL') {
    dotColor = '#ef4444'; // Red
    actionTitle = t('technician.auditLog.processFailed', { defaultValue: 'Process Failed' });
  } else {
    actionTitle = log.action || t('technician.auditLog.processActivity', { defaultValue: 'Process Activity' });
  }

  // 3. Notes / Subtitle translation
  let notesText = '';

  if (rawNotes) {
    // A. "Process completed. Active time: 42s." or "Process completed. Active time: 1 minute 17s."
    const completedMatch = rawNotes.match(/^Process completed\.\s*Active time:\s*(.+?)\.?$/i);
    if (completedMatch) {
      let durationStr = completedMatch[1].trim();
      if (isSpanish) {
        durationStr = durationStr
          .replace(/\bhours\b/gi, 'horas')
          .replace(/\bhour\b/gi, 'hora')
          .replace(/\bminutes\b/gi, 'minutos')
          .replace(/\bminute\b/gi, 'minuto')
          .replace(/\bseconds\b/gi, 'segundos')
          .replace(/\bsecond\b/gi, 'segundo');
      }
      notesText = t('technician.auditLog.notes.completedActiveTime', {
        duration: durationStr,
        defaultValue: `Process completed. Active time: ${durationStr}.`,
      });
    }
    // B. "Process started by technician"
    else if (/^Process started by technician\.?$/i.test(rawNotes)) {
      notesText = t('technician.auditLog.notes.startedByTech', {
        defaultValue: 'Process started by technician',
      });
    }
    // C. "Verification started by admin"
    else if (/^Verification started by admin\.?$/i.test(rawNotes)) {
      notesText = t('technician.auditLog.notes.startedByAdmin', {
        defaultValue: 'Verification started by admin',
      });
    }
    // D. "Process paused"
    else if (/^Process paused\.?$/i.test(rawNotes)) {
      notesText = t('technician.auditLog.notes.processPaused', {
        defaultValue: 'Process paused',
      });
    }
    // E. "Process resumed by technician"
    else if (/^Process resumed by technician\.?$/i.test(rawNotes)) {
      notesText = t('technician.auditLog.notes.resumedByTech', {
        defaultValue: 'Process resumed by technician',
      });
    }
    // F. "Process status changed to IN_PROGRESS by Admin"
    else if (/^Process status changed to IN_PROGRESS by Admin\.?$/i.test(rawNotes)) {
      notesText = t('technician.auditLog.notes.statusChangedToInProgressAdmin', {
        defaultValue: 'Process status changed to IN_PROGRESS by Admin',
      });
    }
    // G. "Process status changed to PAUSED by Admin"
    else if (/^Process status changed to PAUSED by Admin\.?$/i.test(rawNotes)) {
      notesText = t('technician.auditLog.notes.statusChangedToPausedAdmin', {
        defaultValue: 'Process status changed to PAUSED by Admin',
      });
    }
    // H. "Process status marked as COMPLETED by Admin"
    else if (/^Process status marked as COMPLETED by Admin\.?$/i.test(rawNotes)) {
      notesText = t('technician.auditLog.notes.statusMarkedCompletedAdmin', {
        defaultValue: 'Process status marked as COMPLETED by Admin',
      });
    }
    // I. "Process status marked as FAILED by Admin"
    else if (/^Process status marked as FAILED by Admin\.?$/i.test(rawNotes)) {
      notesText = t('technician.auditLog.notes.statusMarkedFailedAdmin', {
        defaultValue: 'Process status marked as FAILED by Admin',
      });
    }
    // J. "Rework cycle #1 initiated by Karthi S in stage: Internal. Note: ..."
    else {
      const reworkMatch = rawNotes.match(
        /^Rework cycle #(\d+) initiated by (.*?) in stage:\s*([^\.]+)\.?(?:\s*Note:\s*(.*))?$/i,
      );
      if (reworkMatch) {
        const cycle = reworkMatch[1];
        const initiator = reworkMatch[2].trim();
        let stage = reworkMatch[3].trim();
        const noteExtra = reworkMatch[4] ? reworkMatch[4].trim() : '';

        if (isSpanish) {
          if (/^internal$/i.test(stage)) stage = 'Interna';
          if (/^external$/i.test(stage)) stage = 'Externa';
        }

        const noteFragment = noteExtra
          ? isSpanish
            ? ` Nota: ${noteExtra}`
            : ` Note: ${noteExtra}`
          : '';

        notesText = t('technician.auditLog.notes.reworkCycleInitiated', {
          cycle,
          initiator,
          stage,
          note: noteFragment,
          defaultValue: `Rework cycle #${cycle} initiated by ${initiator} in stage: ${stage}.${noteFragment}`,
        });
      }
      // K. "Repetition initiated by Admin from verification stage: Internal."
      else {
        const repMatch = rawNotes.match(
          /^Repetition initiated by (.*?) from verification stage:\s*([^\.]+)\.?$/i,
        );
        if (repMatch) {
          const initiator = repMatch[1].trim();
          let stage = repMatch[2].trim();
          if (isSpanish) {
            if (/^internal$/i.test(stage)) stage = 'Interna';
            if (/^external$/i.test(stage)) stage = 'Externa';
          }
          notesText = t('technician.auditLog.notes.repetitionCycleInitiated', {
            initiator,
            stage,
            defaultValue: `Repetition initiated by ${initiator} from verification stage: ${stage}.`,
          });
        }
        // L. "Verification approved by Admin."
        else {
          const verMatch = rawNotes.match(/^Verification approved by (.*?)\.?$/i);
          if (verMatch) {
            const user = verMatch[1].trim();
            notesText = t('technician.auditLog.notes.verificationApprovedBy', {
              user,
              defaultValue: `Verification approved by ${user}.`,
            });
          }
          // M. "External verification auto-started for local doctor: Dr. Gregory."
          else {
            const extMatch = rawNotes.match(/^External verification auto-started for local doctor:\s*(.*?)\.?$/i);
            if (extMatch) {
              const doctor = extMatch[1].trim();
              notesText = t('technician.auditLog.notes.extVerifAutoStarted', {
                doctor,
                defaultValue: `External verification auto-started for local doctor: ${doctor}.`,
              });
            } else {
              // Unrecognized custom note format: display as is
              notesText = rawNotes;
            }
          }
        }
      }
    }
  } else {
    // If notes is empty/null, provide sensible default
    if (action === 'COMPLETE') {
      notesText = t('technician.auditLog.notes.completedDefault', { defaultValue: 'Process completed' });
    } else if (action === 'START') {
      notesText = t('technician.auditLog.notes.startedByTech', { defaultValue: 'Process started by technician' });
    } else if (fallbackProcessName) {
      notesText = `${fallbackProcessName} - ${actionTitle}`;
    } else {
      notesText = actionTitle;
    }
  }

  return {
    actionTitle,
    dotColor,
    notesText,
    isRework,
  };
}

/**
 * Extract or compute structured rework cycle audit trail entries for a work order on the client.
 */
export function extractReworkCycles(workOrder: any) {
  if (!workOrder) return [];
  if (Array.isArray(workOrder.reworkCycles) && workOrder.reworkCycles.length > 0) {
    return workOrder.reworkCycles;
  }
  if (!Array.isArray(workOrder.processes)) return [];

  const cycles: any[] = [];
  const sortedProcs = [...workOrder.processes].sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));

  for (const proc of sortedProcs) {
    const logs = Array.isArray(proc.activityLogs)
      ? [...proc.activityLogs].sort(
          (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        )
      : [];

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const isReworkAction =
        log.action === 'REWORK_ASSIGNED' ||
        /rework cycle/i.test(log.notes || '') ||
        /rework initiated/i.test(log.notes || '');

      if (!isReworkAction) continue;

      // Parse rework count
      const countMatch = (log.notes || '').match(/rework cycle #?(\d+)/i);
      const reworkCount = countMatch ? parseInt(countMatch[1], 10) : proc.reworkCount || 1;

      // Parse initiator
      const initMatch = (log.notes || '').match(/initiated by (.*?) in stage:/i);
      const initiatedBy = log.user?.name || (initMatch ? initMatch[1].trim() : 'Admin');

      // Parse triggering stage
      const stageMatch = (log.notes || '').match(/in stage:\s*([^\.]+)/i);
      const triggeringStage = stageMatch ? stageMatch[1].trim() : 'External Verification';

      // Find the next COMPLETE log on this process after this rework log
      const logTime = new Date(log.timestamp).getTime();
      const nextCompleteLog = logs.slice(i + 1).find((l: any) => {
        const lTime = new Date(l.timestamp).getTime();
        return lTime >= logTime && l.action === 'COMPLETE';
      });

      const completionDateTime = nextCompleteLog
        ? nextCompleteLog.timestamp
        : proc.status === 'COMPLETED' && !proc.reworkActive && proc.endedAt
        ? proc.endedAt
        : null;

      // Check for subsequent approval in verification steps
      let approvalDateTime: any = null;
      if (completionDateTime) {
        const compTime = new Date(completionDateTime).getTime();
        for (const vProc of sortedProcs) {
          if (
            (vProc.isVerification ||
              vProc.processType === 'INTERNAL_VERIFICATION' ||
              vProc.processType === 'EXTERNAL_VERIFICATION') &&
            (vProc.sequence || 0) > (proc.sequence || 0)
          ) {
            const vLogs = Array.isArray(vProc.activityLogs) ? vProc.activityLogs : [];
            const approvedLog = vLogs.find(
              (vl: any) =>
                vl.action === 'VERIFICATION_APPROVED' &&
                new Date(vl.timestamp).getTime() >= compTime,
            );
            if (approvedLog) {
              approvalDateTime = approvedLog.timestamp;
              break;
            }
          }
        }
      }

      // Determine status
      let status: 'Completed' | 'In Progress' | 'Not Started' | 'Approved' = 'Not Started';
      if (approvalDateTime) {
        status = 'Completed';
      } else if (completionDateTime) {
        status = 'Completed';
      } else if (proc.status === 'IN_PROGRESS' || proc.status === 'PAUSED') {
        status = 'In Progress';
      } else {
        status = 'Not Started';
      }

      cycles.push({
        processId: proc.id,
        processName: proc.processName,
        reworkCount,
        initiatedBy,
        initiatedById: log.userId || log.user?.id,
        initiationDateTime: log.timestamp,
        triggeringStage,
        assignedTechnician: proc.technician?.name || '—',
        assignedTechnicianId: proc.technicianId,
        completionDateTime: completionDateTime ? new Date(completionDateTime).toISOString() : null,
        approvalDateTime: approvalDateTime ? new Date(approvalDateTime).toISOString() : null,
        status,
      });
    }
  }

  // Fallback: If no activity logs matched but processes have rework flags
  if (cycles.length === 0) {
    for (const proc of sortedProcs) {
      if ((proc.reworkCount && proc.reworkCount > 0) || proc.reworkActive) {
        cycles.push({
          processId: proc.id,
          processName: proc.processName,
          reworkCount: proc.reworkCount || 1,
          initiatedBy: 'Admin',
          initiatedById: null,
          initiationDateTime: proc.updatedAt || new Date().toISOString(),
          triggeringStage: 'Verification',
          assignedTechnician: proc.technician?.name || '—',
          assignedTechnicianId: proc.technicianId,
          completionDateTime: proc.status === 'COMPLETED' ? proc.endedAt : null,
          approvalDateTime: null,
          status:
            proc.status === 'COMPLETED'
              ? 'Completed'
              : proc.status === 'IN_PROGRESS' || proc.status === 'PAUSED'
              ? 'In Progress'
              : 'Not Started',
        });
      }
    }
  }

  cycles.sort(
    (a, b) =>
      new Date(a.initiationDateTime).getTime() - new Date(b.initiationDateTime).getTime(),
  );

  return cycles;
}
