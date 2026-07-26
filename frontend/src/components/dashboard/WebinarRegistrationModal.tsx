'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { webinar } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WebinarRegistrationModal({ isOpen, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [time, setTime] = useState('3:00 PM');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.email) {
      setEmail(user.email);
    }
    // Do NOT auto-fill name per requirement
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg(t('landing.webinarModal.errors.emailRequired'));
      return;
    }
    if (!name) {
      setErrorMsg(t('landing.webinarModal.errors.nameRequired'));
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await webinar.register({
        email,
        name,
        webinar_title: "Get a Social Listening certificate with Nope360",
        webinar_time: `Wednesday, June 10, 2026 ${time}`,
        timezone: "Asia/Bangkok"
      });
      onSuccess();
    } catch (error: any) {
      console.error('Failed to register', error);
      setErrorMsg(error.response?.data?.detail || t('landing.webinarModal.errors.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/25 dark:bg-void/75 backdrop-blur-sm p-4">
      <div className="bg-void-surface border border-edge rounded-xl shadow-tile w-full max-w-[500px] overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-paper-muted hover:text-paper hover:bg-paper/[0.04] rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pb-6 flex flex-col items-center">
          {/* Header Illustration */}
          <div className="w-48 h-32 relative mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 bg-void-raised rounded-full flex items-center justify-center relative border border-edge">
                <div className="w-16 h-16 bg-signal/10 rounded-full"></div>
                <div className="absolute top-0 right-0 -mr-4 -mt-2 bg-signal text-white p-1.5 rounded text-xs">
                  <div className="w-4 h-1 bg-paper/50 rounded mb-1"></div>
                  <div className="w-6 h-1 bg-paper/50 rounded"></div>
                </div>
                <div className="absolute bottom-2 right-0 -mr-6 bg-signal text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold tabular-nums border-2 border-void-surface shadow-sm">
                  72
                </div>
                {/* Minimal representation of woman */}
                <div className="absolute w-12 h-12 flex flex-col items-center justify-end mt-4">
                  <div className="w-6 h-6 border-2 border-signal rounded-full mb-0.5"></div>
                  <div className="w-10 h-6 border-2 border-signal rounded-t-xl border-b-0"></div>
                </div>
              </div>
            </div>
            {/* Minimal line chart representation */}
            <div className="absolute top-0 left-0 w-24 h-16 bg-void-surface border border-edge rounded shadow-sm p-1.5">
              <div className="w-full h-full border-b border-l border-edge relative">
                <svg className="w-full h-full absolute inset-0 text-signal dark:text-signal-bright" viewBox="0 0 100 50" preserveAspectRatio="none">
                  <polyline points="0,40 25,20 50,30 75,10 100,20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <p className="text-paper-muted text-sm font-medium mb-1">{t('landing.webinarModal.upcoming')}</p>
          <h2 className="text-xl font-bold text-paper text-center mb-6 px-4">
            {t('nav.webinarDesc')}
          </h2>

          <div className="flex items-center text-signal dark:text-signal-bright font-bold mb-8">
            <span className="w-5 h-5 flex items-center justify-center bg-signal/10 rounded mr-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            {t('landing.webinarModal.date')}
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <label className="block text-sm font-bold text-paper mb-1">
                {t('landing.webinarModal.timeLabel')} <span className="font-normal text-paper-muted">{t('landing.webinarModal.timezoneNote')}</span>
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-lg text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
              >
                <option value="3:00 PM">{t('landing.webinarModal.timeOptionAfternoon')}</option>
                <option value="8:00 PM">{t('landing.webinarModal.timeOptionEvening')}</option>
              </select>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 relative">
                <label className="absolute -top-2 left-3 bg-void-surface px-1 text-xs text-paper-faint z-10">{t('auth.emailLabel')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  disabled
                  readOnly
                  className="w-full px-4 py-2.5 bg-void-raised border border-edge-strong rounded-lg text-paper-faint placeholder:text-paper-faint cursor-not-allowed focus-visible:outline-none"
                />
              </div>
              <div className="flex-1 relative">
                <label className="absolute -top-2 left-3 bg-void-surface px-1 text-xs text-signal dark:text-signal-bright font-medium z-10">{t('landing.webinarModal.nameLabel')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-void-surface border-2 border-signal rounded-lg text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm mb-4 border border-destructive/25 flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-4 flex justify-center pb-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white font-bold py-3 px-16 rounded-full transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? t('landing.webinarModal.registering') : t('landing.webinarModal.register')}
              </button>
            </div>

            <p className="text-center text-xs text-paper-faint mt-2">
              {t('landing.webinarModal.consentPrefix')} <a href="#" className="text-signal dark:text-signal-bright hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">{t('landing.webinarModal.consentLink')}</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
