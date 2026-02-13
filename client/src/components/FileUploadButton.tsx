/**
 * FileUploadButton — Paperclip button + file preview chips for chat input.
 * Supports PDF, DOCX, TXT, PPTX, and images.
 */

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Image, File as FileIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 5;

export interface AttachedFile {
  file: File;
  id: string; // local temp id
  uploading: boolean;
  uploadedId?: string; // server file_id after upload
  error?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="w-3.5 h-3.5" />;
  if (mimeType.includes("pdf")) return <FileText className="w-3.5 h-3.5 text-red-500" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className="w-3.5 h-3.5 text-blue-500" />;
  if (mimeType.includes("presentation"))
    return <FileText className="w-3.5 h-3.5 text-orange-500" />;
  return <FileIcon className="w-3.5 h-3.5" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileUploadButtonProps {
  files: AttachedFile[];
  onFilesChange: (files: AttachedFile[]) => void;
  disabled?: boolean;
}

export default function FileUploadButton({
  files,
  onFilesChange,
  disabled = false,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length === 0) return;

      // Validate count
      const totalCount = files.length + selectedFiles.length;
      if (totalCount > MAX_FILES) {
        toast.error(`Максимум ${MAX_FILES} файлов за раз`);
        return;
      }

      // Validate each file
      const validFiles: AttachedFile[] = [];
      for (const file of selectedFiles) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} слишком большой (макс. 20 МБ)`);
          continue;
        }
        if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|docx|pptx|txt|md|csv|png|jpg|jpeg|webp|gif)$/i)) {
          toast.error(`${file.name}: неподдерживаемый формат`);
          continue;
        }
        validFiles.push({
          file,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          uploading: false,
        });
      }

      if (validFiles.length > 0) {
        onFilesChange([...files, ...validFiles]);
      }

      // Reset input so same file can be selected again
      if (inputRef.current) inputRef.current.value = "";
    },
    [files, onFilesChange],
  );

  const handleRemove = useCallback(
    (id: string) => {
      onFilesChange(files.filter((f) => f.id !== id));
    },
    [files, onFilesChange],
  );

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Paperclip button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={disabled || files.length >= MAX_FILES}
        className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary"
        title="Прикрепить файлы (PDF, DOCX, PPTX, TXT, изображения)"
      >
        <Paperclip className="w-4.5 h-4.5" />
      </Button>

      {/* File preview chips — rendered in parent via FileChips */}
    </>
  );
}

/** Separate component for file chips — rendered above the input row */
export function FileChips({
  files,
  onRemove,
}: {
  files: AttachedFile[];
  onRemove: (id: string) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {files.map((f) => (
        <div
          key={f.id}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
            f.error
              ? "bg-destructive/5 border-destructive/20 text-destructive"
              : f.uploading
                ? "bg-primary/5 border-primary/20 text-primary"
                : "bg-secondary/60 border-border text-foreground"
          }`}
        >
          {f.uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            getFileIcon(f.file.type)
          )}
          <span className="max-w-[140px] truncate font-medium">{f.file.name}</span>
          <span className="text-muted-foreground text-[10px]">
            {formatFileSize(f.file.size)}
          </span>
          {!f.uploading && (
            <button
              onClick={() => onRemove(f.id)}
              className="ml-0.5 p-0.5 rounded-full hover:bg-foreground/10 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
