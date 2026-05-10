interface TypingDotsProps {
  className?: string;
  size?: number;
}

/**
 * Three pulsing dots used to mark a typing indicator. Pure CSS so it stays
 * cheap to render in a virtualised list.
 */
export function TypingDots({ className = '', size = 3 }: TypingDotsProps) {
  const style = { width: size, height: size } as const;
  return (
    <span
      className={`inline-flex items-end gap-0.5 ${className}`}
      aria-hidden="true"
    >
      <span
        className="inline-block animate-typing-bounce bg-current"
        style={{ ...style, animationDelay: '0ms' }}
      />
      <span
        className="inline-block animate-typing-bounce bg-current"
        style={{ ...style, animationDelay: '150ms' }}
      />
      <span
        className="inline-block animate-typing-bounce bg-current"
        style={{ ...style, animationDelay: '300ms' }}
      />
    </span>
  );
}
