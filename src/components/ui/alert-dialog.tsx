import * as React from "react"
import { cn } from "../../lib/utils"
import { Button } from "./button"

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface AlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogCancelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

const AlertDialog = ({ open, onOpenChange, children }: AlertDialogProps) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/80 animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />
      {children}
    </div>
  );
};

const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-gray-200 bg-white p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
AlertDialogContent.displayName = "AlertDialogContent"

const AlertDialogHeader = ({ className, children }: AlertDialogHeaderProps) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}>
    {children}
  </div>
);
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({ className, children }: AlertDialogFooterProps) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}>
    {children}
  </div>
);
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, AlertDialogTitleProps>(
  ({ className, children }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold", className)}>
      {children}
    </h3>
  )
);
AlertDialogTitle.displayName = "AlertDialogTitle"

const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, AlertDialogDescriptionProps>(
  ({ className, children }, ref) => (
    <p ref={ref} className={cn("text-sm text-gray-500", className)}>
      {children}
    </p>
  )
);
AlertDialogDescription.displayName = "AlertDialogDescription"

const AlertDialogAction = React.forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  ({ className, children, ...props }, ref) => (
    <Button ref={ref} className={cn(className)} {...props}>
      {children}
    </Button>
  )
);
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, AlertDialogCancelProps>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant="outline"
      className={cn("mt-2 sm:mt-0", className)}
      {...props}
    >
      {children}
    </Button>
  )
);
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}