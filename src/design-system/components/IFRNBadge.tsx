import React from 'react';
import '../styles/ifrn-theme.css';

interface IFRNBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const IFRNBadge = React.forwardRef<HTMLSpanElement, IFRNBadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'ifrn-badge inline-block font-semibold rounded';
    
    const variantStyles = {
      success: 'ifrn-badge-success',
      warning: 'ifrn-badge-warning',
      error: 'ifrn-badge-error',
      info: 'ifrn-badge-info',
      default: 'bg-ifrn-gray-200 text-ifrn-gray-800',
    };

    const sizeStyles = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base',
    };

    return (
      <span
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  }
);

IFRNBadge.displayName = 'IFRNBadge';

export default IFRNBadge;
