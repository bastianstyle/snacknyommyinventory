import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImageToBase64 } from "@/lib/imageUpload";

type UploadStatus = "idle" | "compressing" | "ready" | "error";

interface PhotoUploadProofProps {
  onPhotoReady: (base64DataUrl: string) => void;
  onError: (error: Error) => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export const PhotoUploadProof = ({ onPhotoReady, onError }: PhotoUploadProofProps) => {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (file: File) => {
    setErrorMessage(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      const error = new Error("Tipe file tidak didukung. Gunakan JPEG atau PNG.");
      setStatus("error");
      setErrorMessage(error.message);
      onError(error);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      setStatus("compressing");
      const base64DataUrl = await compressImageToBase64(file);
      setStatus("ready");
      onPhotoReady(base64DataUrl);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Gagal memproses foto.");
      setStatus("error");
      setErrorMessage(err.message);
      onError(err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStatus("idle");
    setErrorMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleInputChange}
      />

      {!previewUrl ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <ImagePlus className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-600">Klik atau seret foto bukti penerimaan ke sini</p>
          <p className="text-xs text-gray-400">JPEG atau PNG</p>
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          <img src={previewUrl} alt="Preview bukti penerimaan" className="w-full max-h-64 object-cover" />
          <div className="absolute top-2 right-2 flex gap-2">
            {status !== "compressing" && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-7 w-7"
                onClick={handleReset}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 flex items-center gap-2 text-xs">
            {status === "compressing" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                <span className="text-slate-200">Mengompresi foto...</span>
              </>
            )}
            {status === "ready" && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-300">Foto siap digunakan</span>
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-300">{errorMessage || "Gagal memproses foto"}</span>
              </>
            )}
          </div>
        </div>
      )}

      {status === "error" && previewUrl && (
        <Button type="button" variant="outline" size="sm" onClick={handleReset} className="w-full">
          Coba Lagi
        </Button>
      )}
    </div>
  );
};