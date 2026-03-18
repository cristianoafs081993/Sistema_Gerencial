import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

interface HeaderProps {
    title: string;
    icon: LucideIcon;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

/**
 * Standard Header component for pages.
 * Note: Subtitle and Actions are handled via HeaderParts and Portals in Layout.tsx
 */
export function Header({ title, icon: Icon, onRefresh, isRefreshing }: HeaderProps) {
    return (
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-sm border border-primary/20">
                    <Icon className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-black tracking-tight text-foreground">
                    {title}
                </h1>
            </div>
            {onRefresh && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="gap-2 font-bold shadow-sm hover:bg-muted/50 transition-all active:scale-95"
                >
                    <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    {isRefreshing ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
            )}
        </div>
    );
}

export function HeaderPortal({ children, targetId }: { children: React.ReactNode, targetId: string }) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const el = document.getElementById(targetId);
    if (!el) return null;

    return createPortal(children, el);
}
