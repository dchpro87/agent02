import { ChevronDown } from "lucide-react";

type ModelSelectorProps = {
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  isLoading: boolean;
};

export default function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  isLoading,
}: ModelSelectorProps) {
  return (
    <div className='relative'>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={isLoading}
        className='appearance-none px-4 py-2 pr-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
      >
        {isLoading ? (
          <option>Loading models...</option>
        ) : models.length === 0 ? (
          <option>No models available</option>
        ) : (
          models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))
        )}
      </select>
      <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none' />
    </div>
  );
}
