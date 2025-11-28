import { Send, X, Image as ImageIcon } from "lucide-react";
import { RefObject, useState, DragEvent } from "react";

type ChatInputProps = {
  inputValue: string;
  setInputValue: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  status: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isProcessing: boolean;
  imageAttachment?: { url: string; name: string; type: string } | null;
  onImageAttach?: (image: { url: string; name: string; type: string }) => void;
  onImageRemove?: () => void;
};

export default function ChatInput({
  inputValue,
  setInputValue,
  onSubmit,
  onCancel,
  status,
  inputRef,
  isProcessing,
  imageAttachment,
  onImageAttach,
  onImageRemove,
}: ChatInputProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleButtonClick = (e: React.MouseEvent) => {
    if (isProcessing) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/") && onImageAttach) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageAttach({
            url: event.target.result as string,
            name: file.name,
            type: file.type,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/") && onImageAttach) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageAttach({
            url: event.target.result as string,
            name: file.name,
            type: file.type,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className='border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm'>
      <div className='max-w-4xl mx-auto px-4 py-4'>
        {/* Image Preview */}
        {imageAttachment && (
          <div className='mb-3 relative inline-block'>
            <img
              src={imageAttachment.url}
              alt={imageAttachment.name}
              className='max-h-32 rounded-lg border border-zinc-200 dark:border-zinc-700'
            />
            <button
              type='button'
              onClick={onImageRemove}
              className='absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center'
              title='Remove image'
            >
              <X className='w-4 h-4' />
            </button>
            <p className='text-xs text-zinc-500 dark:text-zinc-400 mt-1'>
              {imageAttachment.name}
            </p>
          </div>
        )}

        <form onSubmit={onSubmit} className='flex gap-3'>
          <div
            className={`flex-1 relative ${
              isDragging ? "ring-2 ring-blue-500 rounded-full" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type='text'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isDragging
                  ? "Drop image here..."
                  : "Type your message or drag an image..."
              }
              className='w-full rounded-full px-6 py-3 pl-12 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400'
              disabled={status !== "ready"}
            />
            {/* Image Upload Button */}
            <label
              htmlFor='image-upload'
              className='absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors'
            >
              <ImageIcon className='w-5 h-5 text-zinc-400 dark:text-zinc-500' />
            </label>
            <input
              id='image-upload'
              type='file'
              accept='image/*'
              onChange={handleFileSelect}
              className='hidden'
              disabled={status !== "ready"}
            />
          </div>
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
