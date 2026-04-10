import React, { useState } from 'react';
import '../styles/ifrn-theme.css';

interface IFRNAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  dismissible?: boolean;
  children: React.ReactNode;
}

const IFRNAlert = React.forwardRef<HTMLDivElement, IFRNAlertProps>(
  (
    {
      variant = 'info',
      title,
      dismissible = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(true);

    const variantStyles = {
      success: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        title: 'text-green-900',
      },
      warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        title: 'text-yellow-900',
      },
      error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        title: 'text-red-900',
      },
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        title: 'text-blue-900',
      },
    };

    const styles = variantStyles[variant];

    if (!isVisible) return null;

    return (
      <div
        ref={ref}
        className={`
          border rounded-lg p-4
          ${styles.bg}
          ${styles.border}
          ${styles.text}
          ${className}
        `}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div>
            {title && (
              <h4 className={`font-semibold mb-1 ${styles.title}`}>
                {title}
              </h4>
            )}
            <div className="text-sm">
              {children}
            </div>
          </div>
          {dismissible && (
            <button
              onClick={() => setIsVisible(false)}
              className="ml-4 text-current opacity-70 hover:opacity-100"
              aria-label="Fechar alerta"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }
);

IFRNAlert.displayName = 'IFRNAlert';

export default IFRNAlert;
