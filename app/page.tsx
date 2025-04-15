"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileWarning, Download, Info, ImageIcon, Upload } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"

// Add HTMLImageElement constructor type
declare global {
  interface Window {
    Image: {
      new(width?: number, height?: number): HTMLImageElement;
    }
  }
}

// Increased from 50MB to 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB for initial upload

// Compression formats
type CompressionFormat = "auto" | "jpeg" | "png" | "webp"

export default function ImageCompressor() {
  const [file, setFile] = useState<File | null>(null)
  const [compressedImage, setCompressedImage] = useState<string | null>(null)
  const [quality, setQuality] = useState(80)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [originalSize, setOriginalSize] = useState<string | null>(null)
  const [compressedSize, setCompressedSize] = useState<string | null>(null)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [format, setFormat] = useState<CompressionFormat>("auto")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [originalPreview, setOriginalPreview] = useState<string | null>(null)
  const [originalSizeBytes, setOriginalSizeBytes] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (originalPreview) URL.revokeObjectURL(originalPreview)
      if (compressedImage) URL.revokeObjectURL(compressedImage)
    }
  }, [originalPreview, compressedImage])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes"
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
    else return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setWarning(null)
    setCompressedImage(null)
    setCompressedSize(null)
    setCompressionProgress(0)

    if (originalPreview) {
      URL.revokeObjectURL(originalPreview)
      setOriginalPreview(null)
    }

    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]

      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(`File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`)
        return
      }

      if (!selectedFile.type.startsWith("image/")) {
        setError("Please select an image file")
        return
      }

      // Add a warning for very large files
      if (selectedFile.size > 100 * 1024 * 1024) {
        setWarning("Very large image detected. Processing may take longer and use significant memory.")
      }

      setFile(selectedFile)
      setOriginalSizeBytes(selectedFile.size)
      setOriginalSize(formatFileSize(selectedFile.size))
      setOriginalPreview(URL.createObjectURL(selectedFile))

      // Auto-select format based on file type
      if (selectedFile.type === "image/png" || selectedFile.type === "image/gif") {
        setFormat("png") // Keep transparency for PNG and GIF
      } else if (selectedFile.type === "image/jpeg" || selectedFile.type === "image/jpg") {
        setFormat("jpeg")
      } else {
        setFormat("auto")
      }
    }
  }

  // Trigger file input click
  const handleChooseFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Get the appropriate MIME type based on format selection
  const getMimeType = (originalType: string, selectedFormat: CompressionFormat): string => {
    if (selectedFormat === "auto") {
      // For auto, use the original type or default to jpeg
      return originalType || "image/jpeg"
    }

    switch (selectedFormat) {
      case "jpeg":
        return "image/jpeg"
      case "png":
        return "image/png"
      case "webp":
        return "image/webp"
      default:
        return originalType || "image/jpeg"
    }
  }

  // Client-side image compression using Canvas
  const compressImageInBrowser = (file: File, quality: number, selectedFormat: CompressionFormat): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        try {
          // Create canvas if it doesn't exist
          const canvas = canvasRef.current || document.createElement("canvas")
          const ctx = canvas.getContext("2d")

          if (!ctx) {
            reject(new Error("Could not get canvas context"))
            return
          }

          // Set canvas dimensions to match image
          let width = img.width
          let height = img.height

          // Scale down very large images to improve performance
          const MAX_DIMENSION = 4000
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
            width = Math.floor(width * ratio)
            height = Math.floor(height * ratio)
          }

          canvas.width = width
          canvas.height = height

          // For PNG with transparency, set white background
          if (file.type === "image/png" && selectedFormat === "jpeg") {
            ctx.fillStyle = "white"
            ctx.fillRect(0, 0, width, height)
          }

          // Clear canvas and draw image
          ctx.drawImage(img, 0, 0, width, height)

          // Convert to blob with specified quality
          const mimeType = getMimeType(file.type, selectedFormat)

          // Adjust quality based on format
          let adjustedQuality = quality / 100
          if (mimeType === "image/png") {
            // PNG uses compression level 0-9, so map our 1-100 to that range
            // Lower values mean less compression but better quality
            adjustedQuality = 1 - quality / 100
          }

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error("Canvas toBlob failed"))
              }
            },
            mimeType,
            mimeType === "image/png" ? undefined : adjustedQuality,
          )
        } catch (err) {
          reject(new Error(`Error processing image: ${err instanceof Error ? err.message : String(err)}`))
        }
      }

      img.onerror = () => {
        reject(new Error("Error loading image"))
      }

      // Load image from file
      img.src = URL.createObjectURL(file)
    })
  }

  const handleCompress = async () => {
    if (!file) return

    setError(null)
    setWarning(null)
    setIsCompressing(true)
    setCompressionProgress(10)

    try {
      // Try multiple compression strategies if needed
      setCompressionProgress(30)

      // First attempt with selected format and quality
      let compressedBlob = await compressImageInBrowser(file, quality, format)
      setCompressionProgress(70)

      // If the compressed size is larger than the original, try different strategies
      if (compressedBlob.size >= file.size) {
        // For PNGs, try JPEG if not explicitly requested PNG
        if (file.type === "image/png" && format !== "png") {
          setCompressionProgress(75)
          compressedBlob = await compressImageInBrowser(file, quality, "jpeg")
        }

        // If still larger, try WebP
        if (compressedBlob.size >= file.size && format !== "webp") {
          setCompressionProgress(80)
          compressedBlob = await compressImageInBrowser(file, quality, "webp")
        }

        // If still larger, try with lower quality
        if (compressedBlob.size >= file.size && quality > 50) {
          setCompressionProgress(85)
          compressedBlob = await compressImageInBrowser(file, 50, format === "auto" ? "jpeg" : format)
        }

        // If all attempts failed to reduce size
        if (compressedBlob.size >= file.size) {
          setWarning("Compression resulted in a larger file. The image may already be optimized.")
        }
      }

      // Create object URL for display
      const objectUrl = URL.createObjectURL(compressedBlob)
      setCompressedImage(objectUrl)
      setCompressedSize(formatFileSize(compressedBlob.size))
      setCompressionProgress(100)

      console.log(`Original size: ${file.size}, Compressed size: ${compressedBlob.size}`)
    } catch (err) {
      console.error("Compression error:", err)
      setError(err instanceof Error ? err.message : "Failed to compress image")
    } finally {
      setIsCompressing(false)
    }
  }

  // Calculate size reduction percentage
  const getSizeReduction = (): number | null => {
    if (!compressedSize || !file) return null

    // Extract numeric value from formatted size string
    const compressedBytes = Number.parseFloat(compressedSize.replace(/[^\d.-]/g, ""))

    // Determine the unit (KB or MB)
    const isKB = compressedSize.includes("KB")
    const isMB = compressedSize.includes("MB")

    // Convert to bytes for comparison
    let compressedSizeBytes = compressedBytes
    if (isKB) compressedSizeBytes *= 1024
    if (isMB) compressedSizeBytes *= 1024 * 1024

    // Calculate percentage reduction
    return Math.round((1 - compressedSizeBytes / file.size) * 100)
  }

  const sizeReduction = getSizeReduction()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-6xl sm:text-7xl font-bold tracking-tighter mb-3">PixSqueeze</h1>
          <p className="text-xl text-foreground/70">Your images, only lighter.</p>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="bg-transparent border-0">
          <CardContent className="p-0">
            {!file ? (
              <div className="upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <Label
                  htmlFor="file-upload"
                  className="flex flex-col items-center gap-6 cursor-pointer h-full"
                >
                  <Upload className="h-8 w-8 text-foreground/70" />
                  <div className="space-y-2">
                    <h3 className="text-xl font-medium">
                      Drop your image here
                    </h3>
                    <p className="text-sm text-foreground/70">
                      Maximum size: {formatFileSize(MAX_FILE_SIZE)}
                    </p>
                  </div>
                </Label>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Controls Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base">Quality</Label>
                        <span className="text-sm text-foreground/70">{quality}%</span>
                      </div>
                      <Slider
                        id="quality-slider"
                        min={1}
                        max={100}
                        step={1}
                        value={[quality]}
                        onValueChange={(value) => setQuality(value[0])}
                        className="mt-2"
                      />
                    </div>
                    <div className="space-y-4">
                      <Label className="text-base">Format</Label>
                      <Select value={format} onValueChange={(value) => setFormat(value as CompressionFormat)}>
                        <SelectTrigger className="w-full bg-transparent border-foreground/20">
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (Same as original)</SelectItem>
                          <SelectItem value="jpeg">JPEG</SelectItem>
                          <SelectItem value="png">PNG</SelectItem>
                          <SelectItem value="webp">WebP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <Button
                      onClick={handleCompress}
                      disabled={!file || isCompressing}
                      className="button-minimal px-8 py-6 text-lg w-full"
                    >
                      {isCompressing ? (
                        <div className="flex items-center gap-3">
                          <span>Processing</span>
                          <Progress value={compressionProgress} className="w-20" />
                        </div>
                      ) : (
                        "Compress Image"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Image Preview Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Original Image */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground/70">Original</span>
                      <span className="text-sm text-foreground/70">{originalSize}</span>
                    </div>
                    <div className="preview-area aspect-square">
                      {originalPreview && (
                        <img
                          src={originalPreview}
                          alt="Original"
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                  </div>

                  {/* Compressed Image */}
                  {compressedImage && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground/70">Compressed</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground/70">{compressedSize}</span>
                          {sizeReduction !== null && (
                            <span className={`text-sm ${sizeReduction > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              ({sizeReduction > 0 ? '-' : '+'}{Math.abs(sizeReduction)}%)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="preview-area aspect-square">
                        <img
                          src={compressedImage}
                          alt="Compressed"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        className="button-minimal w-full"
                      >
                        <a
                          href={compressedImage}
                          download={`compressed_${file.name.split(".")[0]}.${format === "auto" ? file.name.split(".").pop() : format}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <Alert variant="destructive" className="mt-6 bg-transparent border border-red-500/50">
                <FileWarning className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {warning && (
              <Alert className="mt-6 bg-transparent border border-yellow-500/50">
                <Info className="h-4 w-4" />
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
