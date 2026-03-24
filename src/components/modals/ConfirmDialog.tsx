import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, Info, AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger'
}: ConfirmDialogProps) {
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-5 h-5 text-red-600" />,
          iconBg: 'bg-red-50',
          accent: 'bg-red-600 hover:bg-red-700 shadow-red-500/20',
          bar: 'bg-red-500'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          iconBg: 'bg-amber-50',
          accent: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
          bar: 'bg-amber-500'
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5 text-blue-600" />,
          iconBg: 'bg-blue-50',
          accent: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
          bar: 'bg-blue-500'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl bg-white">
        <div className={`absolute top-0 left-0 w-full h-1 ${styles.bar}`} />
        
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 ${styles.iconBg} rounded-xl shrink-0 mt-1`}>
              {styles.icon}
            </div>
            <div className="space-y-2">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black tracking-tight text-slate-900">
                  {title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-slate-500 leading-relaxed font-medium">
                  {description}
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 sm:gap-0">
          <AlertDialogCancel className="mt-0 bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-bold uppercase text-[10px] tracking-widest px-6 shadow-sm">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
              onOpenChange(false);
            }}
            className={`${styles.accent} text-white font-bold uppercase text-[10px] tracking-widest px-8 shadow-md transition-all active:scale-95 ml-2`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
