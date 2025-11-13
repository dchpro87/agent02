import { Send, X } from "lucide-react";
import { RefObject } from "react";

type ChatInputProps = {
  inputValue: string;
  setInputValue: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  status: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isProcessing: boolean;
};

export default function ChatInput({
  inputValue,
  setInputValue,
  onSubmit,
  onCancel,
  status,
  inputRef,
  isProcessing,
}: ChatInputProps) {
  const handleButtonClick = (e: React.MouseEvent) => {
    if (isProcessing) {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className='border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm'>
      <div className='max-w-4xl mx-auto px-4 py-4'>
        <form onSubmit={onSubmit} className='flex gap-3'>
          <input
            ref={inputRef}
            type='text'
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder='Type your message...'
            className='flex-1 rounded-full px-6 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400'
            disabled={status !== "ready"}
          />
          <button
            type={isProcessing ? "button" : "submit"}
            onClick={handleButtonClick}
            disabled={
              !isProcessing && (status !== "ready" || !inputValue.trim())
            }
            className='rounded-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:from-blue-700 enabled:hover:to-purple-700 transition-all flex items-center gap-2'
          >
            {isProcessing ? (
              <X className='w-4 h-4' />
            ) : (
              <Send className='w-4 h-4' />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
