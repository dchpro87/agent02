import { ChevronDown } from "lucide-react";
import {
  PREDEFINED_PROMPTS,
  SystemPrompt,
} from "@/lib/predefined-system-prompts";

type SystemPromptSelectorProps = {
  selectedPromptId: string;
  onPromptChange: (promptId: string) => void;
};

export default function SystemPromptSelector({
  selectedPromptId,
  onPromptChange,
}: SystemPromptSelectorProps) {
  const selectedPrompt = PREDEFINED_PROMPTS.find(
    (p) => p.id === selectedPromptId
  );

  // Group prompts by category
  const promptsByCategory = PREDEFINED_PROMPTS.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<string, SystemPrompt[]>);

  const categories = Object.keys(promptsByCategory).sort();

  return (
    <div className='flex items-center gap-2'>
      <div className='relative'>
        <select
          value={selectedPromptId}
          onChange={(e) => onPromptChange(e.target.value)}
          className='appearance-none px-4 py-2 pr-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          {categories.map((category) => (
            <optgroup key={category} label={category}>
              {promptsByCategory[category].map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none' />
      </div>

      {selectedPrompt && (
        <div className='flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'>
          <selectedPrompt.icon className='w-4 h-4 text-blue-600 dark:text-blue-400' />
          <span className='text-xs text-blue-700 dark:text-blue-300'>
            {selectedPrompt.description}
          </span>
        </div>
      )}
    </div>
  );
}
