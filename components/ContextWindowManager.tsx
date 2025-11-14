"use client";

import { useState, useEffect } from "react";
import { Database, Plus, Trash2, RefreshCw, Check, Folder } from "lucide-react";

interface Collection {
  name: string;
  metadata?: Record<string, unknown>;
}

interface ContextWindowManagerProps {
  onCollectionSelect?: (collectionName: string | null) => void;
}

export default function ContextWindowManager({
  onCollectionSelect,
}: ContextWindowManagerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch collections on mount
  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chroma?action=list");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch collections");
      }

      setCollections(data.collections || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch collections"
      );
      console.error("Error fetching collections:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/chroma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: newCollectionName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create collection");
      }

      setNewCollectionName("");
      await fetchCollections();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create collection"
      );
      console.error("Error creating collection:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCollection = async (collectionName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the collection "${collectionName}"?`
      )
    )
      return;

    setError(null);
    try {
      const response = await fetch("/api/chroma", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: collectionName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete collection");
      }

      if (selectedCollection === collectionName) {
        setSelectedCollection(null);
        onCollectionSelect?.(null);
      }
      await fetchCollections();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete collection"
      );
      console.error("Error deleting collection:", err);
    }
  };

  const handleSelectCollection = (collectionName: string) => {
    const newSelection =
      selectedCollection === collectionName ? null : collectionName;
    setSelectedCollection(newSelection);
    onCollectionSelect?.(newSelection);
  };

  return (
    <div className='flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800'>
        <div className='flex items-center gap-2'>
          <Database className='w-5 h-5 text-blue-500' />
          <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>
            Context Collections
          </h2>
        </div>
        <button
          onClick={fetchCollections}
          disabled={isLoading}
          className='p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-50'
          title='Refresh collections'
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Create Collection Form */}
      <div className='p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50'>
        <form onSubmit={handleCreateCollection} className='flex gap-2'>
          <input
            type='text'
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder='New collection name...'
            className='flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
            disabled={isCreating}
          />
          <button
            type='submit'
            disabled={isCreating || !newCollectionName.trim()}
            className='px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium'
          >
            <Plus className='w-4 h-4' />
            Create
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className='mx-4 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'>
          <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
        </div>
      )}

      {/* Collections List */}
      <div className='flex-1 overflow-y-auto p-4'>
        {isLoading && collections.length === 0 ? (
          <div className='flex items-center justify-center h-32'>
            <RefreshCw className='w-6 h-6 animate-spin text-zinc-400' />
          </div>
        ) : collections.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-32 text-center'>
            <Folder className='w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-2' />
            <p className='text-sm text-zinc-500 dark:text-zinc-400'>
              No collections yet
            </p>
            <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-1'>
              Create one to get started
            </p>
          </div>
        ) : (
          <div className='space-y-2'>
            {collections.map((collection) => (
              <div
                key={collection.name}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedCollection === collection.name
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                    : "bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
                onClick={() => handleSelectCollection(collection.name)}
              >
                <div className='flex items-center gap-3 flex-1 min-w-0'>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedCollection === collection.name
                        ? "bg-blue-500"
                        : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  >
                    {selectedCollection === collection.name ? (
                      <Check className='w-4 h-4 text-white' />
                    ) : (
                      <Database className='w-4 h-4 text-zinc-600 dark:text-zinc-400' />
                    )}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='font-medium text-zinc-900 dark:text-zinc-100 truncate'>
                      {collection.name}
                    </p>
                    {collection.metadata && (
                      <p className='text-xs text-zinc-500 dark:text-zinc-400 truncate'>
                        {Object.keys(collection.metadata).length} metadata
                        field(s)
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCollection(collection.name);
                  }}
                  className='p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0'
                  title='Delete collection'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {selectedCollection && (
        <div className='p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50'>
          <div className='flex items-center gap-2'>
            <div className='w-2 h-2 rounded-full bg-green-500 animate-pulse'></div>
            <p className='text-xs text-zinc-600 dark:text-zinc-400'>
              Using collection:{" "}
              <span className='font-medium text-zinc-900 dark:text-zinc-100'>
                {selectedCollection}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
