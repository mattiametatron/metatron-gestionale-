import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

let activePrintPortalCount = 0;

interface PrintPortalProps {
  children: React.ReactNode;
}

export const PrintPortal: React.FC<PrintPortalProps> = ({ children }) => {
  useEffect(() => {
    activePrintPortalCount += 1;
    document.body.classList.add('carico-print-active');

    return () => {
      activePrintPortalCount = Math.max(0, activePrintPortalCount - 1);
      if (activePrintPortalCount === 0) {
        document.body.classList.remove('carico-print-active');
      }
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="carico-print-portal-root fixed inset-0 z-[9999]">
      {children}
    </div>,
    document.body
  );
};
