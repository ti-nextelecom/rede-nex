import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { TrendingUp, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

interface DashboardMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down';
  };
  variant?: 'default' | 'glass' | 'gradient';
  className?: string;
}

export const DashboardMetric = React.forwardRef<HTMLDivElement, DashboardMetricProps>(
  ({ icon, label, value, change, variant = 'gradient', className }, ref) => {
    return (
      <Card ref={ref} variant={variant} className={cn('overflow-hidden', className)}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">{label}</p>
              <h3 className="text-2xl font-bold text-foreground">{value}</h3>
              {change && (
                <div className="flex items-center gap-2 mt-2">
                  {change.trend === 'up' ? (
                    <TrendingUp size={14} className="text-green-500" />
                  ) : (
                    <Activity size={14} className="text-red-500" />
                  )}
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      change.trend === 'up'
                        ? 'text-green-500'
                        : 'text-red-500'
                    )}
                  >
                    {change.trend === 'up' ? '+' : '-'}{Math.abs(change.value)}%
                  </span>
                </div>
              )}
            </div>
            <div className="p-3 rounded-lg bg-gradient-primary/20">
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

DashboardMetric.displayName = 'DashboardMetric';

interface DashboardStatsProps {
  metrics: DashboardMetricProps[];
  className?: string;
}

export const DashboardStats = React.forwardRef<HTMLDivElement, DashboardStatsProps>(
  ({ metrics, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
          className
        )}
      >
        {metrics.map((metric, index) => (
          <DashboardMetric key={index} {...metric} />
        ))}
      </div>
    );
  }
);

DashboardStats.displayName = 'DashboardStats';

interface ActivityItemProps {
  avatar: string;
  name: string;
  title: string;
  description: string;
  timestamp: string;
  status?: 'active' | 'idle' | 'offline';
}

export const ActivityItem = React.forwardRef<HTMLDivElement, ActivityItemProps>(
  ({ avatar, name, title, description, timestamp, status = 'offline' }, ref) => {
    const statusColors = {
      active: 'bg-green-500 ring-green-500/50',
      idle: 'bg-yellow-500 ring-yellow-500/50',
      offline: 'bg-gray-500 ring-gray-500/50',
    };

    return (
      <div ref={ref} className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/10 transition-all cursor-pointer group">
        <div className="relative flex-shrink-0">
          <img
            src={avatar}
            alt={name}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/30 group-hover:ring-primary/60 transition-all"
          />
          <div className={cn('absolute -bottom-1 -right-1 w-3 h-3 rounded-full ring-2 ring-card', statusColors[status])} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-text-secondary">{title}</p>
          <p className="text-xs text-text-muted mt-1 truncate">{description}</p>
          <p className="text-[10px] text-text-muted mt-1">{timestamp}</p>
        </div>
      </div>
    );
  }
);

ActivityItem.displayName = 'ActivityItem';

interface ActivityFeedProps {
  items: ActivityItemProps[];
  title?: string;
  className?: string;
}

export const ActivityFeed = React.forwardRef<HTMLDivElement, ActivityFeedProps>(
  ({ items, title = 'Atividade Recente', className }, ref) => {
    return (
      <Card ref={ref} variant="glass" className={className}>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item, index) => (
            <ActivityItem key={index} {...item} />
          ))}
        </CardContent>
      </Card>
    );
  }
);

ActivityFeed.displayName = 'ActivityFeed';
