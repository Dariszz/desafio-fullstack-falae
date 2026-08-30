import type { NoticeMessage } from '../review-ui.js';

export function Notice({
  message,
  className = '',
  alert = false,
}: {
  message: NoticeMessage;
  className?: string;
  alert?: boolean;
}) {
  return (
    <p
      className={`notice ${message.kind} ${className}`.trim()}
      role={alert ? 'alert' : 'status'}
    >
      {message.text}
    </p>
  );
}
