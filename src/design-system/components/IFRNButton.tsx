import React from 'react';
import '../styles/ifrn-theme.css';

interface IFRNButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

const IFRNButton = React.forwardRef<HTMLButtonElement, IFRNButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'ifrn-button font-semibold transition-all duration-200 flex items-center justify-center gap-2';
    
    const variantStyles = {
      primary: 'ifrn-button-primary hover:shadow-md',
      secondary: 'ifrn-button-secondary hover:shadow-md',
      outline: 'border border-ifrn-gray-300 text-ifrn-gray-700 hover:bg-ifrn-gray-50',
      ghost: 'text-ifrn-green hover:bg-ifrn-gray-100',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const disabledStyles = disabled || loading ? 'opacity-60 cursor-not-allowed' : '';
    const widthStyles = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${disabledStyles}
          ${widthStyles}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <span className="inline-block animate-spin">⟳</span>
        )}
        {children}
      </button>
    );
  }
);

IFRNButton.displayName = 'IFRNButton';

export default IFRNButton;
