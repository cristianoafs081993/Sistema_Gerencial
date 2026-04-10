import React from 'react';
import '../styles/ifrn-theme.css';

interface IFRNStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  borderColor?: 'green' | 'red' | 'blue' | 'purple' | 'orange';
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

const IFRNStatCard = React.forwardRef<HTMLDivElement, IFRNStatCardProps>(
  (
    {
      title,
      value,
      subtitle,
      icon,
      borderColor = 'green',
      trend,
      className = '',
      ...props
    },
    ref
  ) => {
    const borderColors = {
      green: 'border-l-4 border-l-ifrn-green',
      red: 'border-l-4 border-l-ifrn-red',
      blue: 'border-l-4 border-l-blue-500',
      purple: 'border-l-4 border-l-purple-500',
      orange: 'border-l-4 border-l-orange-500',
    };

    return (
      <div
        ref={ref}
        className={`
          ifrn-card
          ${borderColors[borderColor]}
          ${className}
        `}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-ifrn-gray-600 text-sm font-medium mb-2">
              {title}
            </p>
            <p className="text-3xl font-bold text-ifrn-gray-900 mb-1">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-ifrn-gray-500">
                {subtitle}
              </p>
            )}
            {trend && (
              <div className={`text-xs font-semibold mt-2 ${
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
              </div>
            )}
          </div>
          {icon && (
            <div className="text-2xl opacity-50 ml-4">
              {icon}
            </div>
          )}
        </div>
      </div>
    );
  }
);

IFRNStatCard.displayName = 'IFRNStatCard';

export default IFRNStatCard;
