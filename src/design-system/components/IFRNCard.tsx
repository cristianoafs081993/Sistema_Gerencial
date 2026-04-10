import React from 'react';
import '../styles/ifrn-theme.css';

interface IFRNCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const IFRNCard = React.forwardRef<HTMLDivElement, IFRNCardProps>(
  (
    {
      variant = 'default',
      className = '',
      header,
      footer,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'ifrn-card';
    
    const variantStyles = {
      default: 'bg-white border border-ifrn-gray-200 shadow-sm',
      elevated: 'bg-white shadow-lg border-0',
      outlined: 'bg-transparent border-2 border-ifrn-green',
    };

    return (
      <div
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${className}
        `}
        {...props}
      >
        {header && (
          <div className="pb-4 border-b border-ifrn-gray-200 mb-4">
            {header}
          </div>
        )}
        
        <div>
          {children}
        </div>
        
        {footer && (
          <div className="pt-4 border-t border-ifrn-gray-200 mt-4">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

IFRNCard.displayName = 'IFRNCard';

export default IFRNCard;
