import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../core/context/AuthContext';
import { formatHeaderDateTime, DEFAULT_TIMEZONE } from '../../core/utils/dateUtils';
import { Clock } from 'lucide-react';

export const HeaderLiveClock: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState<Date>(() => new Date());

  const activeTimezone = (user?.activeTenant?.settings as any)?.timezone || DEFAULT_TIMEZONE;

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { dateText, timeText } = formatHeaderDateTime(now, {
    locale: i18n.language,
    timeZone: activeTimezone,
  });

  return (
    <div
      className="header-live-clock"
      title={t('header.timezoneTooltip', { timezone: activeTimezone })}
      aria-label={`${dateText} ${timeText}`}
    >
      <Clock size={14} className="header-live-clock-icon" />
      <span className="header-live-clock-date">{dateText}</span>
      <span className="header-live-clock-divider">•</span>
      <span className="header-live-clock-time">{timeText}</span>
    </div>
  );
};

