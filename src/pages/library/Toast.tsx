interface ToastProps {
  toast: { msg: string; err: boolean } | null;
}

export function Toast({ toast }: ToastProps) {
  return (
    <div
      id="toast"
      className={toast ? 'show' : ''}
      style={toast?.err ? { background: '#ef4444' } : undefined}
    >
      {toast ? toast.msg : ''}
    </div>
  );
}