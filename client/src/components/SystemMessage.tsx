interface SystemMessageProps {
  content: string
}

export function SystemMessage({ content }: SystemMessageProps) {
  return <div className="system-message animate-chat-message">{content}</div>
}
