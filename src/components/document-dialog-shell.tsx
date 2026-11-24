"use client"

import React, { useState, useEffect, useRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Dialog, DialogTitle, DialogPortal } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Minus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"
import { useShakeWarning } from "@/hooks/use-shake-warning"

// Dialog shell for the document dialogs (to-do 6.3, step S1).
// It holds the window itself (overlay, frame, header, minimize dock, close warning)
// and the state around it (open, minimized, remembered in the browser session).
// Everything about the document (fields, lines, totals, save) stays in the dialog that uses it.

interface UseDocumentDialogShellOptions {
  /** Prefix of the sessionStorage keys: `${prefix}DialogState` and `${prefix}MinimizedState`. */
  storageKeyPrefix: string
  /** True when the form has unsaved changes (asked when the user closes the window). */
  isDirty: () => boolean
  /** Puts the form back to its blank state (called after the window has closed). */
  onReset: () => void
}

export function useDocumentDialogShell({ storageKeyPrefix, isDirty, onReset }: UseDocumentDialogShellOptions) {
  const dialogKey = `${storageKeyPrefix}DialogState`
  const minimizedKey = `${storageKeyPrefix}MinimizedState`

  const [open, setOpen] = useState<boolean>((() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(dialogKey);
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  })());

  useEffect(() => {
    sessionStorage.setItem(dialogKey, JSON.stringify(open));
  }, [open, dialogKey]);

  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(minimizedKey);
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  useEffect(() => {
    sessionStorage.setItem(minimizedKey, JSON.stringify(isMinimized));
  }, [isMinimized, minimizedKey]);

  const { state, isMobile } = useSidebar();
  const dockOffset = isMobile ? 0 : (state === 'expanded' ? 256 : 48);
  const dialogRef = useRef<HTMLDivElement>(null)

  const [showCloseAlert, setShowCloseAlert] = useState(false)
  const { overlayShakeTick, triggerOverlayShake } = useShakeWarning();
  const [isHoveringDock, setIsHoveringDock] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (isDirty()) {
        if (isMinimized) setIsMinimized(false)
        setShowCloseAlert(true)
        triggerOverlayShake()
        return
      }
      setOpen(false)
      setTimeout(() => {
        onReset()
        setShowCloseAlert(false)
        setIsHoveringDock(false)
        setIsMinimized(false)
      }, 300)
    } else {
      setOpen(true)
    }
  }

  const confirmClose = () => {
    setShowCloseAlert(false)
    setOpen(false)
    setTimeout(() => {
      onReset()
      setShowCloseAlert(false)
      setIsHoveringDock(false)
      setIsMinimized(false)
    }, 300)
  }

  const handleOverlayClick = () => {
    triggerOverlayShake()
  }

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
    if (isMinimized) { setIsHoveringDock(false); }
  }

  const handleMouseEnter = () => {
    if (!isMinimized) return;
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; }
    setIsHoveringDock(true);
  };

  const handleMouseLeave = () => {
    if (!isMinimized) return;
    hoverTimeoutRef.current = setTimeout(() => { setIsHoveringDock(false); }, 250);
  };

  return {
    open,
    setOpen,
    isMinimized,
    setIsMinimized,
    isMobile,
    dockOffset,
    dialogRef,
    showCloseAlert,
    setShowCloseAlert,
    overlayShakeTick,
    isHoveringDock,
    setIsHoveringDock,
    handleOpenChange,
    confirmClose,
    handleOverlayClick,
    toggleMinimize,
    handleMouseEnter,
    handleMouseLeave,
  }
}

export type DocumentDialogShellState = ReturnType<typeof useDocumentDialogShell>

interface DocumentDialogShellProps {
  /** The object returned by useDocumentDialogShell. */
  shell: DocumentDialogShellState
  /** Title shown in the header when the window is open, for example "Modifier le bon de commande - BC0001". */
  title: string
  /** Title shown in the dock when the window is minimized, for example "Bon de commande - BC0001". */
  minimizedTitle: string
  /** Title shown at the top of the preview that pops up over the dock. */
  previewTitle: string
  /** Hidden title for screen readers. */
  srTitle: string
  /** Line under the header, for example "Remplissez les informations ci-dessous.". */
  subtitle: string
  /** Question asked when closing a changed form. */
  closeAlertMessage: string
  /** Called when the user answers "Oui" to the close warning: the dialog saves its form. */
  onSaveFromAlert: () => void
  /** The form and its footer. */
  children: React.ReactNode
}

export function DocumentDialogShell({
  shell,
  title,
  minimizedTitle,
  previewTitle,
  srTitle,
  subtitle,
  closeAlertMessage,
  onSaveFromAlert,
  children,
}: DocumentDialogShellProps) {
  const {
    open,
    isMinimized,
    isMobile,
    dockOffset,
    dialogRef,
    showCloseAlert,
    setShowCloseAlert,
    overlayShakeTick,
    isHoveringDock,
    setIsHoveringDock,
    handleOpenChange,
    confirmClose,
    handleOverlayClick,
    toggleMinimize,
    handleMouseEnter,
    handleMouseLeave,
  } = shell

  return (
      <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
        <DialogPortal>
          <div 
            className="fixed inset-0 z-40 flex pointer-events-none transition-all duration-300 ease-in-out"
          >
             {!isMobile && (
                <div 
                    className="flex-none transition-all duration-300 ease-in-out" 
                    style={{ width: dockOffset }} 
                />
             )}

             <div className="flex-1 relative pointer-events-none h-full w-full">
                {open && !isMinimized && (
                    <div 
                        className="absolute inset-0 z-40 bg-black/50 pointer-events-auto transition-all duration-300 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                        onClick={(e) => { e.stopPropagation(); handleOverlayClick(); }}
                    />
                )}

                <DialogPrimitive.Content 
                    onInteractOutside={(e) => {
                        e.preventDefault(); 
                        if (!isMinimized && showCloseAlert) {
                            handleOverlayClick();
                        }
                    }}
                    className={cn(
                        "p-0 overflow-visible bg-transparent border-none shadow-none max-w-none w-auto h-auto transition-all duration-300 ease-in-out [&>button]:!hidden pointer-events-none outline-none focus:outline-none",
                        isMinimized 
                        ? "absolute bottom-[10px] left-4 z-[9999] w-fit max-w-fit translate-x-0 translate-y-0"
                        : "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-auto"
                    )}
                    style={
                        isMinimized 
                        ? { transition: "all 0.3s ease-in-out" } 
                        : { 
                            width: "96%", 
                            height: "96%",
                            transition: "all 0.3s ease-in-out"
                            }
                    }
                >
                    <div 
                        ref={dialogRef}
                        onClick={isMinimized ? toggleMinimize : undefined}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={cn(
                            "relative bg-white border rounded shadow-xl flex flex-col pointer-events-auto",
                            isMinimized ? "shadow-md cursor-pointer overflow-visible px-0 h-10" : "rounded-lg h-full",
                            "transition-all duration-300 ease-in-out"
                        )}
                        style={{ 
                            width: "100%",
                            height: isMinimized ? 40 : "100%",
                            transformOrigin: isMinimized ? "bottom left" : "center", 
                            transition: "all 0.3s ease-in-out" 
                        }}
                    >
                        {showCloseAlert && (
                            <div 
                            className="absolute inset-0 z-[10000] flex items-center justify-center rounded-lg p-4 bg-black/5"
                            onClick={handleOverlayClick}
                            >
                            <div 
                                key={overlayShakeTick}
                                className="bg-white border shadow-lg p-6 rounded-md max-w-sm text-center animate-shake"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="font-semibold text-lg mb-2">Attention</h3>
                                <p className="text-sm text-muted-foreground mb-6">
                                  {closeAlertMessage}
                                </p>
                                <div className="flex justify-center gap-2">
                                    <Button className="bg-slate-900 text-white min-w-[70px]" size="sm" onClick={() => { setShowCloseAlert(false); onSaveFromAlert(); }}>Oui</Button>
                                    <Button variant="destructive" size="sm" className="min-w-[70px]" onClick={confirmClose}>Non</Button>
                                    <Button variant="outline" size="sm" className="min-w-[70px]" onClick={() => setShowCloseAlert(false)}>Annuler</Button>
                                </div>
                            </div>
                            </div>
                        )}

                        {isMinimized && (
                            <div className={cn("absolute bottom-full left-1/2 -translate-x-1/2 pb-3 z-[10000] origin-bottom transition-all duration-300 ease-out", isHoveringDock ? "scale-100 opacity-100 pointer-events-auto" : "scale-0 opacity-0 pointer-events-none")}>
                            <div className="group bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden cursor-pointer relative" style={{ width: 1000 * 0.25, height: 800 * 0.25 }} onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}>
                                <button onClick={(e) => { e.stopPropagation(); handleOpenChange(false); setIsHoveringDock(false); }} className="absolute top-2 right-2 z-50 p-1.5 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 rounded-md transition-opacity duration-200 shadow-sm pointer-events-auto opacity-0 group-hover:opacity-100" title="Fermer"><X className="h-4 w-4" /></button>
                                <div className="pointer-events-none origin-top-left bg-white flex flex-col" style={{ width: 1000, height: 800, transform: 'scale(0.25)' }}>
                                    <div className="flex-none p-4 flex items-center gap-2 font-semibold text-sm">{previewTitle}</div>
                                    <div className="px-6 pb-4 border-b text-muted-foreground text-sm">{subtitle}</div>
                                    <div className="flex-1 min-h-0 flex flex-col">{children}</div>
                                </div>
                            </div>
                            </div>
                        )}

                        <div className="absolute right-3 top-3 z-50 flex gap-1">
                            {!isMinimized && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); toggleMinimize(); }} onMouseDown={(e) => e.stopPropagation()} className="p-1.5 opacity-60 hover:opacity-100 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Réduire"><Minus className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleOpenChange(false)} onMouseDown={(e) => e.stopPropagation()} className="p-1.5 opacity-60 hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded transition-colors cursor-pointer" title="Fermer"><X className="h-4 w-4" /></button>
                            </>
                            )}
                        </div>

                        <div className={cn("flex-none p-4 select-none flex items-center gap-2", !isMinimized && "cursor-default", isMinimized && "py-0 px-3 h-10")}>
                            {isMinimized && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                            <div className={cn("font-semibold text-sm", isMinimized ? "whitespace-nowrap pr-2" : "truncate pr-12")}>{isMinimized ? minimizedTitle : title}</div>
                        </div>
                        {!isMinimized && (<div className="px-6 pb-4 border-b text-muted-foreground text-sm text-left">{subtitle}</div>)}
                        <div className={cn("flex-col flex-1 min-h-0 transition-opacity duration-300", isMinimized ? "hidden" : "flex")}>
                            <DialogTitle className="sr-only">{srTitle}</DialogTitle>
                            {children}
                        </div>
                    </div>
                </DialogPrimitive.Content>
             </div>
          </div>
        </DialogPortal>
      </Dialog>
  )
}
