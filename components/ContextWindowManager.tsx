"use client";

import { useState, useEffect, useRef } from "react";
import {
  Database,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  Folder,
  Upload,
  FileText,
  File,
  X,
} from "lucide-react";

interface Collection {
  name: string;
  metadata?: Record<string, unknown>;
}

interface ContextWindowManagerProps {
  selectedCollection?: string | null;
  onCollectionSelect?: (collectionName: string | null) => void;
}

export default function ContextWindowManager({
  selectedCollection,
  onCollectionSelect,
}: ContextWindowManagerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
      // Convert to snake_case: replace spaces with underscores and convert to lowercase
      const snakeCaseName = newCollectionName.trim().replace(/\s+/g, "_");

      const response = await fetch("/api/chroma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: snakeCaseName,
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
    onCollectionSelect?.(newSelection);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCollection) return;

    // Validate file type
    const validTypes = ["application/pdf", "text/plain"];
    const isValidType =
      validTypes.includes(file.type) || file.name.endsWith(".txt");

    if (!isValidType) {
      setError("Please upload a PDF or TXT file");
      return;
    }

    await processFileUpload(file);
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setUploadMessage("Cancelling upload...");
    }
  };

  const handleUploadButtonClick = () => {
    if (!selectedCollection) {
      setError("Please select a collection first");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading && selectedCollection) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!selectedCollection || isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];

    // Validate file type
    const validTypes = ["application/pdf", "text/plain"];
    const isValidType =
      validTypes.includes(file.type) || file.name.endsWith(".txt");

    if (!isValidType) {
      setError("Please upload a PDF or TXT file");
      return;
    }

    // Process the file using the same logic as handleFileUpload
    await processFileUpload(file);
  };

  const processFileUpload = async (file: File) => {
    if (!selectedCollection) return;

    setIsUploading(true);
    setError(null);
    setUploadSuccess(null);
    setUploadProgress(0);
    setUploadMessage("Starting upload...");

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("collectionName", selectedCollection);

      const response = await fetch("/api/documents/upload", {
        method: "PUT", // Use PUT for streaming endpoint
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to upload document");
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              console.log("[Upload] SSE message:", data);

              if (data.error) {
                console.error("[Upload] Server error:", data.error);
                throw new Error(data.error);
              }

              if (data.progress !== undefined) {
                setUploadProgress(data.progress);
              }

              if (data.message) {
                setUploadMessage(data.message);
              }

              if (data.status === "complete") {
                setUploadSuccess(
                  `Successfully added ${data.chunksAdded} chunks from "${data.fileName}"`
                );

                // Clear the file input
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }

                // Clear success message after 5 seconds
                setTimeout(() => {
                  setUploadSuccess(null);
                  setUploadProgress(0);
                  setUploadMessage("");
                }, 5000);
              }
            } catch (parseError) {
              console.error("[Upload] Error parsing SSE data:", parseError);
              // Only re-throw if it's an actual error from the server
              if (
                parseError instanceof Error &&
                parseError.message &&
                !parseError.message.includes("JSON")
              ) {
                throw parseError;
              }
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Upload cancelled");
        console.log("Upload cancelled by user");
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to upload document"
        );
        console.error("Error uploading document:", err);
      }
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
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
          disabled={isLoading || isUploading}
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
            disabled={isCreating || isUploading}
          />
          <button
            type='submit'
            disabled={isCreating || !newCollectionName.trim() || isUploading}
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

      {/* Success Message */}
      {uploadSuccess && (
        <div className='mx-4 mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'>
          <p className='text-sm text-green-600 dark:text-green-400'>
            {uploadSuccess}
          </p>
        </div>
      )}

      {/* Upload Section */}
      {selectedCollection && (
        <div className='mx-4 mt-4 p-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'>
          {!isUploading ? (
            <>
              <div className='flex items-center justify-between mb-3'>
                <div className='flex items-center gap-2'>
                  <FileText className='w-4 h-4 text-zinc-600 dark:text-zinc-400' />
                  <h3 className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                    Add Documents
                  </h3>
                </div>
              </div>
              <div className='flex flex-col gap-2'>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='.pdf,.txt,text/plain,application/pdf'
                  onChange={handleFileUpload}
                  className='hidden'
                />
                <button
                  onClick={handleUploadButtonClick}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  disabled={isUploading || !selectedCollection}
                  className={`w-full px-4 py-3 rounded-lg border-2 border-dashed transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium ${
                    isDragging
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 scale-105"
                      : "border-zinc-300 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400"
                  }`}
                >
                  <Upload className='w-4 h-4' />
                  {isDragging ? "Drop file here" : "Upload PDF or TXT file"}
                </button>
                <p className='text-xs text-zinc-500 dark:text-zinc-400 text-center'>
                  Documents will be chunked and embedded automatically
                </p>
              </div>
            </>
          ) : (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <RefreshCw className='w-4 h-4 text-blue-500 animate-spin' />
                  <h3 className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                    Processing Document
                  </h3>
                </div>
                <span className='text-sm font-semibold text-blue-600 dark:text-blue-400'>
                  {uploadProgress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className='w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5 overflow-hidden'>
                <div
                  className='bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out'
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>

              {/* Progress Message */}
              <p className='text-xs text-zinc-600 dark:text-zinc-400 text-center'>
                {uploadMessage}
              </p>

              {/* Cancel Button */}
              <button
                onClick={handleCancelUpload}
                className='w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-2 text-sm font-medium'
              >
                <X className='w-4 h-4' />
                Cancel Upload
              </button>
            </div>
          )}
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
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isUploading
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                } ${
                  selectedCollection === collection.name
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                    : "bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
                onClick={() =>
                  !isUploading && handleSelectCollection(collection.name)
                }
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
                    if (!isUploading) {
                      handleDeleteCollection(collection.name);
                    }
                  }}
                  disabled={isUploading}
                  className='p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed'
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
