import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Video, Music, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiResourceUrl, post } from "@/lib/api";

interface FileUploadProps {
  workspaceId: string;
  onUploadSuccess?: (assetId: string, fileName: string, fileUrl: string) => void;
  acceptedTypes?: string;
}

interface FilePreview {
  file: File;
  preview?: string;
  uploadProgress?: number;
  error?: string;
  uploadedAssetId?: string;
}

const getFileType = (mimeType: string): "image" | "video" | "audio" | "document" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("audio/")) return Music;
  return FileIcon;
};

export function FileUpload({ workspaceId, onUploadSuccess, acceptedTypes = "image/*,video/*,audio/*" }: FileUploadProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (newFiles: File[]) => {
    setError("");
    const maxSize = 500 * 1024 * 1024; // 500MB
    
    const validFiles: FilePreview[] = [];
    for (const file of newFiles) {
      if (file.size > maxSize) {
        setError(`File "${file.name}" is too large. Max size is 500MB.`);
        continue;
      }
      
      let preview;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }
      
      validFiles.push({ file, preview, uploadProgress: 0 });
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
      validFiles.forEach((fp, idx) => uploadFile(fp.file, files.length + idx));
    }
  };

  const uploadFile = async (file: File, index: number) => {
    try {
      setFiles((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], uploadProgress: 10 };
        return updated;
      });

      // Step 1: Get upload URL from backend
      const uploadUrlResponse = await post("/api/assets/upload-url", {
        fileName: file.name,
        mimeType: file.type,
        workspaceId,
      });

      const { uploadUrl, assetId, key } = uploadUrlResponse as {
        uploadUrl: string;
        assetId: string;
        key: string;
      };
      const normalizedUploadUrl = apiResourceUrl(uploadUrl);

      setFiles((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], uploadProgress: 30 };
        return updated;
      });

      // Step 2: Upload file to the presigned URL
      const uploadResponse = await fetch(normalizedUploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      setFiles((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          uploadProgress: 100,
          uploadedAssetId: assetId,
        };
        return updated;
      });

      onUploadSuccess?.(assetId, file.name, `/uploads/${key}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      setFiles((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], error: errorMsg, uploadProgress: 0 };
        return updated;
      });
      setError(errorMsg);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Drag and drop files here, or click to select</p>
            <p className="text-xs text-muted-foreground mt-1">Supports images, videos, and audio files. Max 500MB per file.</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((fp, idx) => {
            const FileTypeIcon = getFileIcon(fp.file.type);
            return (
              <Card key={idx}>
                <CardContent className="p-4 space-y-3">
                  <div className="aspect-video bg-muted rounded flex items-center justify-center relative overflow-hidden">
                    {fp.preview ? (
                      <img src={fp.preview} alt={fp.file.name} className="w-full h-full object-cover" />
                    ) : (
                      <FileTypeIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                    {fp.uploadProgress !== undefined && fp.uploadProgress < 100 && !fp.error && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-white text-xs font-medium">{fp.uploadProgress}%</div>
                      </div>
                    )}
                    {fp.uploadedAssetId && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <div className="text-white text-xs font-medium">✓ Uploaded</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium truncate" title={fp.file.name}>
                      {fp.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(fp.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>

                  {fp.uploadProgress !== undefined && fp.uploadProgress < 100 && !fp.error && (
                    <Progress value={fp.uploadProgress} className="h-2" />
                  )}

                  {fp.error && (
                    <p className="text-xs text-destructive">{fp.error}</p>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(idx)}
                    className="w-full h-8"
                    disabled={fp.uploadProgress !== undefined && fp.uploadProgress < 100}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
