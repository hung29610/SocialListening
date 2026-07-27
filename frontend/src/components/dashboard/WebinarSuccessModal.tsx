import React from 'react';
import { X, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function WebinarSuccessModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/25 dark:bg-void/75 backdrop-blur-sm p-4">
      <div className="bg-void-surface border border-edge rounded-xl shadow-tile w-full max-w-[450px] overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-paper-muted hover:text-paper hover:bg-paper/[0.04] rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pb-8 flex flex-col items-center text-center">
          {/* Success Confetti Animation */}
          <div className="relative mb-6 mt-4">
            <div className="w-20 h-20 bg-success rounded-full flex items-center justify-center relative z-10 shadow-lg">
              <Check className="w-10 h-10 text-white stroke-[3]" />
            </div>

            {/* Confetti particles */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full">
              <div className="absolute -top-4 -left-4 w-2 h-2 bg-success/70 rounded-full"></div>
              <div className="absolute top-2 -right-6 w-3 h-3 bg-success/80 rounded-full"></div>
              <div className="absolute bottom-0 -left-6 w-2 h-4 bg-success rounded-sm rotate-45"></div>
              <div className="absolute -bottom-4 right-0 w-2 h-2 bg-success/90 rounded-full"></div>
              <div className="absolute top-10 -right-4 w-1.5 h-3 bg-success/60 rounded-sm -rotate-45"></div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-paper mb-2">
            Success!
          </h2>
          <h3 className="text-xl font-medium text-paper mb-6">
            You have signed up for the webinar.
          </h3>

          <p className="text-paper-muted mb-8">
            Wednesday, June 10, 2026 (Asia/Bangkok). See you!
          </p>

          <button
            onClick={onClose}
            className="bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white font-bold py-3 px-10 rounded-full transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
