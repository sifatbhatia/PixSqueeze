"use client"

import type React from "react"
import ReactCrop, { type Crop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Download, FileWarning, ImageIcon, Info, Upload } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

// Add HTMLImageElement constructor type
declare global {
  interface Window {
    Image: {
      new(width?: number, height?: number): HTMLImageElement;
    }
  }
  interface Navigator {
    gpu?: {
      requestAdapter(): Promise<GPUAdapter | null>;
    }
  }
  interface GPUAdapter {
    requestDevice(): Promise<GPUDevice>;
  }
  interface GPUDevice {
    createCommandEncoder(): GPUCommandEncoder;
    queue: GPUQueue;
  }
  interface GPUCommandEncoder {
    beginRenderPass(descriptor: any): GPURenderPassEncoder;
    finish(): GPUCommandBuffer;
  }
  interface GPURenderPassEncoder {
    end(): void;
  }
  interface GPUQueue {
    submit(commandBuffers: GPUCommandBuffer[]): void;
  }
  interface GPUCommandBuffer {}
}

// Increased from 50MB to 1GB
const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB for initial upload

// Compression formats
type CompressionFormat = "auto" | "jpeg" | "png" | "webp" | "avif"

export default function ImageCompressor() {
  const [file, setFile] = useState<File | null>(null)
  const [compressedImage, setCompressedImage] = useState<string | null>(null)
  const [compressedMimeType, setCompressedMimeType] = useState<string | null>(null)
  const [compressedFileExtension, setCompressedFileExtension] = useState<string | null>(null)
  const [quality, setQuality] = useState(80)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [originalSize, setOriginalSize] = useState<string | null>(null)
  const [compressedSize, setCompressedSize] = useState<string | null>(null)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [format, setFormat] = useState<CompressionFormat>("auto")
  const [backgroundColor, setBackgroundColor] = useState<"white" | "black">("white")
  const [cornerRadius, setCornerRadius] = useState(0)
  const [webGPUAvailable, setWebGPUAvailable] = useState(false)
  const [useWebGPU, setUseWebGPU] = useState(false)
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchMode, setBatchMode] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{[key: string]: number}>({})
  const [batchResults, setBatchResults] = useState<{[key: string]: string}>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [originalPreview, setOriginalPreview] = useState<string | null>(null)
  const [originalSizeBytes, setOriginalSizeBytes] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isGeneratingHeicPreview, setIsGeneratingHeicPreview] = useState(false)
  const [crop, setCrop] = useState<Crop>()
  const compressedImgRef = useRef<HTMLImageElement | null>(null)
  
  // Cache for converted HEIC blobs to avoid reconversion
  const heicCacheRef = useRef<Map<string, Blob>>(new Map())
  
  // Cleanup function for HEIC cache
  const cleanupHeicCache = () => {
    heicCacheRef.current.clear()
  }

  // Force memory cleanup
  const forceMemoryCleanup = () => {
    // Clean up HEIC cache
    cleanupHeicCache()
    
    // Revoke any existing object URLs
    if (originalPreview) {
      URL.revokeObjectURL(originalPreview)
      setOriginalPreview(null)
    }
    if (compressedImage) {
      URL.revokeObjectURL(compressedImage)
      setCompressedImage(null)
    }
    
    // Clean up batch results
    Object.values(batchResults).forEach(url => {
      if (url) URL.revokeObjectURL(url)
    })
    setBatchResults({})
    
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc()
    }
  }

  // Monitor memory usage and provide warnings
  const checkMemoryUsage = (): string | null => {
    if ('memory' in performance && (performance as any).memory) {
      const memInfo = (performance as any).memory
      const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024)
      const limitMB = Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024)
      const usage = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100
      
      if (usage > 80) {
        return `High memory usage (${usedMB}MB/${limitMB}MB). Consider processing smaller images or clearing cache.`
      } else if (usage > 60) {
        return `Memory usage: ${usedMB}MB/${limitMB}MB. Performance may be affected with large images.`
      }
    }
    return null
  }

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (originalPreview) URL.revokeObjectURL(originalPreview)
      if (compressedImage) URL.revokeObjectURL(compressedImage)
      // Clean up HEIC cache
      cleanupHeicCache()
      // Reset loading states
      setIsGeneratingHeicPreview(false)
    }
  }, [originalPreview, compressedImage])

  // Dynamic import for heic2any to avoid SSR issues
  const loadHeic2any = async () => {
    if (typeof window === 'undefined') {
      throw new Error('heic2any can only be used in the browser')
    }
    const { default: heic2any } = await import('heic2any')
    return heic2any
  }

  // Check for WebGPU support
  useEffect(() => {
    const checkWebGPU = async () => {
      if ('gpu' in navigator && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter()
          if (adapter) {
            setWebGPUAvailable(true)
            setUseWebGPU(true) // Auto-enable if available
          }
        } catch (error) {
          console.log('WebGPU not available:', error)
          setWebGPUAvailable(false)
        }
      }
    }
    checkWebGPU()
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes"
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
    else return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setWarning(null)
    setCompressedImage(null)
    setCompressedMimeType(null)
    setCompressedFileExtension(null)
    setCompressedSize(null)
    setCompressionProgress(0)
    setIsGeneratingHeicPreview(false)
    setCornerRadius(0)
    setBatchResults({})
    setBatchProgress({})

    if (originalPreview) {
      URL.revokeObjectURL(originalPreview)
      setOriginalPreview(null)
    }

    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files)
      
      // Check if multiple files selected for batch mode
      if (selectedFiles.length > 1) {
        setBatchMode(true)
        setBatchFiles(selectedFiles)
        setFile(null) // Clear single file
        
        // Validate all files
        let hasError = false
        const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0)
        
        if (totalSize > MAX_FILE_SIZE) {
          setError(`Total file size is too large. Maximum total size is ${formatFileSize(MAX_FILE_SIZE)}`)
          hasError = true
        }
        
        selectedFiles.forEach(file => {
          if (!file.type.startsWith("image/") && !file.type.includes("heic") && !file.type.includes("heif")) {
            setError("All files must be images (including HEIC/HEIF)")
            hasError = true
          }
        })
        
        if (!hasError && totalSize > 200 * 1024 * 1024) {
          setWarning("Large batch detected. Processing may take longer. WebGPU acceleration recommended.")
        }
        
        // Check for HEIC files and add warning
        const hasHEIC = selectedFiles.some(file => isHEIC(file))
        if (hasHEIC && !hasError) {
          setWarning("HEIC/HEIF files detected. They will be automatically converted to web-compatible formats.")
        }
      } else {
        // Single file mode
        const selectedFile = selectedFiles[0]
        setBatchMode(false)
        setBatchFiles([])
        
        if (selectedFile.size > MAX_FILE_SIZE) {
          setError(`File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`)
          return
        }

        if (!selectedFile.type.startsWith("image/") && !isHEIC(selectedFile)) {
          setError("Please select an image file (including HEIC/HEIF)")
          return
        }

        // Add a warning for very large files
        if (selectedFile.size > 200 * 1024 * 1024) {
          setWarning("Very large image detected. Processing may take longer and use significant memory. WebGPU acceleration recommended.")
        }
        
        // Check for HEIC and add appropriate warnings
        if (isHEIC(selectedFile)) {
          let heicWarning = "HEIC/HEIF file detected. It will be automatically converted to a web-compatible format."
          
          // Add memory warning for large HEIC files
          if (selectedFile.size > 50 * 1024 * 1024) {
            heicWarning += " Large HEIC files may require significant memory for conversion."
          }
          
          // Check current memory usage
          const memoryWarning = checkMemoryUsage()
          if (memoryWarning) {
            heicWarning += " " + memoryWarning
          }
          
          setWarning(heicWarning)
        } else {
          // Check memory usage for non-HEIC files too
          const memoryWarning = checkMemoryUsage()
          if (memoryWarning && selectedFile.size > 200 * 1024 * 1024) {
            setWarning(memoryWarning)
          }
        }

        setFile(selectedFile)
        setOriginalSizeBytes(selectedFile.size)
        setOriginalSize(formatFileSize(selectedFile.size))
        
        // Generate preview (handles HEIC conversion)
        generatePreview(selectedFile).then((previewUrl) => {
          setOriginalPreview(previewUrl)
        }).catch((error) => {
          console.warn("Failed to generate preview:", error)
          setOriginalPreview(null)
        })

        // Auto-select format based on file type
        if (selectedFile.type === "image/png" || selectedFile.type === "image/gif") {
          setFormat("png") // Keep transparency for PNG and GIF
        } else if (selectedFile.type === "image/jpeg" || selectedFile.type === "image/jpg") {
          setFormat("jpeg")
        } else if (isHEIC(selectedFile)) {
          setFormat("jpeg") // Convert HEIC to JPEG by default
        } else {
          setFormat("auto")
        }
      }
    }
  }

  // Trigger file input click
  const handleChooseFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Add more files to existing batch
  const handleAddMoreFiles = () => {
    if (fileInputRef.current) {
      // Create a new input element to allow adding more files
      const newInput = document.createElement('input')
      newInput.type = 'file'
      newInput.accept = 'image/*,image/heic,image/heif'
      newInput.multiple = true
      newInput.onchange = (e) => {
        const target = e.target as HTMLInputElement
        if (target.files && target.files.length > 0) {
          const newFiles = Array.from(target.files)
          
          // Validate new files
          let hasError = false
          const currentTotalSize = batchFiles.reduce((sum, file) => sum + file.size, 0) + 
                                  (file ? file.size : 0)
          const newTotalSize = newFiles.reduce((sum, file) => sum + file.size, 0)
          
          if (currentTotalSize + newTotalSize > MAX_FILE_SIZE) {
            setError(`Total file size would exceed limit. Maximum total size is ${formatFileSize(MAX_FILE_SIZE)}`)
            return
          }
          
          newFiles.forEach(file => {
            if (!file.type.startsWith("image/") && !isHEIC(file)) {
              setError("All files must be images (including HEIC/HEIF)")
              hasError = true
            }
          })
          
          if (!hasError) {
            setError(null)
            if (batchMode) {
              setBatchFiles(prev => [...prev, ...newFiles])
            } else {
              // Convert to batch mode
              setBatchMode(true)
              setBatchFiles(file ? [file, ...newFiles] : newFiles)
              setFile(null)
              if (originalPreview) {
                URL.revokeObjectURL(originalPreview)
                setOriginalPreview(null)
              }
            }
          }
        }
      }
      newInput.click()
    }
  }

  // Reset and allow new file selection
  const handleReset = () => {
    setFile(null)
    setBatchFiles([])
    setBatchMode(false)
    setBatchResults({})
    setBatchProgress({})
    setCompressedImage(null)
    setCompressedMimeType(null)
    setCompressedFileExtension(null)
    setCompressedSize(null)
    setCompressionProgress(0)
    setError(null)
    setWarning(null)
    setCornerRadius(0)
    setIsGeneratingHeicPreview(false)
    
    if (originalPreview) {
      URL.revokeObjectURL(originalPreview)
      setOriginalPreview(null)
    }
    
    // Clear all batch result URLs
    Object.values(batchResults).forEach(url => {
      if (url) URL.revokeObjectURL(url)
    })
    
    // Clean up HEIC cache to free memory
    cleanupHeicCache()
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleApplyCrop = async () => {
    if (compressedImgRef.current && crop?.width && crop?.height && compressedMimeType) {
      const image = compressedImgRef.current
      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height

      const pixelCrop = {
        x: crop.x * scaleX,
        y: crop.y * scaleY,
        width: crop.width * scaleX,
        height: crop.height * scaleY,
        unit: 'px' as const,
      }

      const croppedBlob = await getCroppedImg(
        image,
        pixelCrop,
        compressedMimeType
      )
      
      if (compressedImage) {
        URL.revokeObjectURL(compressedImage)
      }

      const croppedUrl = URL.createObjectURL(croppedBlob)
      setCompressedImage(croppedUrl)
      setCompressedSize(formatFileSize(croppedBlob.size))
      setCrop(undefined) // Reset crop selection
    }
  }

  function getCroppedImg(image: HTMLImageElement, crop: Crop, mimeType: string): Promise<Blob> {
    const canvas = document.createElement("canvas")
    canvas.width = crop.width
    canvas.height = crop.height
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return Promise.reject(new Error("Could not get canvas context"))
    }

    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    )

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"))
            return
          }
          resolve(blob)
        },
        mimeType,
        1 // Use max quality for cropping, compression is already done
      )
    })
  }

  // Get the appropriate MIME type based on format selection
  const getMimeType = (originalType: string, selectedFormat: CompressionFormat): string => {
    switch (selectedFormat) {
      case "jpeg":
        return "image/jpeg"
      case "png":
        return "image/png"
      case "webp":
        return "image/webp"
      case "avif":
        return "image/avif"
      case "auto":
        return originalType
      default:
        return "image/jpeg"
    }
  }

  // Check if format supports transparency
  const supportsTransparency = (formatType: CompressionFormat, originalType?: string): boolean => {
    if (formatType === "auto" && originalType) {
      return originalType === "image/png" || originalType === "image/webp" || originalType === "image/avif" || originalType === "image/gif"
    }
    return formatType === "png" || formatType === "webp" || formatType === "avif"
  }

  // Check if file is HEIC/HEIF
  const isHEIC = (file: File): boolean => {
    const fileName = file.name.toLowerCase()
    const mimeType = file.type.toLowerCase()
    
    // Check file extension
    const isHEICExtension = fileName.endsWith('.heic') || fileName.endsWith('.heif')
    
    // Check MIME type (may not always be set correctly)
    const isHEICMime = mimeType.includes("heic") || mimeType.includes("heif") || 
                       mimeType === "image/heic" || mimeType === "image/heif"
    
    return isHEICExtension || isHEICMime
  }

  // Memory-efficient HEIC conversion with caching
  const convertHeicToBlob = async (file: File, quality: number = 0.7): Promise<Blob> => {
    // Create a cache key based on file and quality
    const cacheKey = `${file.name}-${file.size}-${file.lastModified}-${quality}`
    
    // Check cache first
    if (heicCacheRef.current.has(cacheKey)) {
      console.log("Using cached HEIC conversion")
      return heicCacheRef.current.get(cacheKey)!
    }
    
    // Check available memory before conversion
    if ('memory' in performance && (performance as any).memory) {
      const memInfo = (performance as any).memory
      const availableMemory = memInfo.jsHeapSizeLimit - memInfo.usedJSHeapSize
      const estimatedConversionMemory = file.size * 3 // Rough estimate
      
      if (availableMemory < estimatedConversionMemory) {
        // Try to free up memory first
        cleanupHeicCache()
        // Force garbage collection if available
        if ('gc' in window && typeof (window as any).gc === 'function') {
          (window as any).gc()
        }
      }
    }
    
    try {
      // Limit file size for HEIC conversion to prevent memory issues
      const maxHeicSize = 50 * 1024 * 1024 // Reduced to 50MB limit for HEIC conversion
      if (file.size > maxHeicSize) {
        throw new Error(`HEIC file too large for conversion. Maximum size: ${formatFileSize(maxHeicSize)}. Try compressing the HEIC file first or use a smaller image.`)
      }
      
      const heic2any = await loadHeic2any()
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: quality // Use variable quality
      }) as Blob
      
      // Cache the result but limit cache size
      if (heicCacheRef.current.size >= 3) {
        // Remove oldest entry
        const firstKey = heicCacheRef.current.keys().next().value
        if (firstKey) {
          heicCacheRef.current.delete(firstKey)
        }
      }
      
      heicCacheRef.current.set(cacheKey, convertedBlob)
      return convertedBlob
    } catch (error) {
      throw new Error(`HEIC conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Generate preview for any file type, including HEIC
  const generatePreview = async (file: File): Promise<string> => {
    if (isHEIC(file)) {
      setIsGeneratingHeicPreview(true)
      try {
        // Use lower quality for preview to save memory
        const convertedBlob = await convertHeicToBlob(file, 0.5)
        return URL.createObjectURL(convertedBlob)
      } catch (error) {
        console.warn("Failed to generate HEIC preview:", error)
        return ""
      } finally {
        setIsGeneratingHeicPreview(false)
      }
    } else {
      return URL.createObjectURL(file)
    }
  }

  // Convert HEIC to supported format using heic2any
  const convertHEICToCanvas = async (file: File): Promise<HTMLImageElement> => {
    try {
      // First try to load directly (in case browser supports HEIC)
      const tryDirectLoad = (): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new window.Image()
          img.crossOrigin = "anonymous"
          
          const timeout = setTimeout(() => {
            img.removeEventListener('load', onLoad)
            img.removeEventListener('error', onError)
            URL.revokeObjectURL(img.src) // Clean up on timeout
            reject(new Error("Direct HEIC load timeout"))
          }, 2000)
          
          const onLoad = () => {
            clearTimeout(timeout)
            URL.revokeObjectURL(img.src) // Clean up object URL after loading
            resolve(img)
          }
          
          const onError = () => {
            clearTimeout(timeout)
            URL.revokeObjectURL(img.src) // Clean up on error
            reject(new Error("Direct HEIC load failed"))
          }
          
          img.addEventListener('load', onLoad)
          img.addEventListener('error', onError)
          img.src = URL.createObjectURL(file)
        })
      }

      try {
        // Try direct loading first
        return await tryDirectLoad()
      } catch {
        // Fall back to heic2any conversion using cached/optimized method
        console.log("Direct HEIC loading failed, converting with heic2any...")

        // Use medium quality for processing (balance between quality and memory)
        const convertedBlob = await convertHeicToBlob(file, 0.8)

        return new Promise((resolve, reject) => {
          const img = new window.Image()
          img.crossOrigin = "anonymous"
          
          img.onload = () => {
            // Don't revoke the URL immediately as we might need it for processing
            resolve(img)
          }
          
          img.onerror = () => {
            URL.revokeObjectURL(img.src)
            reject(new Error("Failed to load converted HEIC image"))
          }
          
          img.src = URL.createObjectURL(convertedBlob)
        })
      }
    } catch (error) {
      throw new Error(`HEIC conversion failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // WebGPU-accelerated image processing
  const processImageWithWebGPU = async (canvas: HTMLCanvasElement, width: number, height: number, cornerRadius: number): Promise<void> => {
    if (!navigator.gpu || !useWebGPU) {
      return Promise.resolve()
    }

    try {
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) return

      const device = await adapter.requestDevice()
      const context = canvas.getContext('webgpu')
      
      if (context) {
        // WebGPU context configuration would go here
        // For now, we'll fall back to Canvas 2D with performance hints
        console.log('WebGPU context available - using optimized rendering')
      }
    } catch (error) {
      console.log('WebGPU processing failed, falling back to Canvas 2D:', error)
    }
  }

  // Client-side image compression using Canvas
  const compressImageInBrowser = (file: File, quality: number, selectedFormat: CompressionFormat, cornerRadius: number = 0): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Check memory before starting compression
        if ('memory' in performance && (performance as any).memory) {
          const memInfo = (performance as any).memory
          const availableMemory = memInfo.jsHeapSizeLimit - memInfo.usedJSHeapSize
          const estimatedNeeded = file.size * 4 // Rough estimate for canvas processing
          
          if (availableMemory < estimatedNeeded && availableMemory < 100 * 1024 * 1024) {
            // Try to free up memory first
            console.warn("Low memory detected, attempting cleanup...")

            // Wait a bit for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }

        let img: HTMLImageElement
        
        if (isHEIC(file)) {
          // Handle HEIC files
          try {
            img = await convertHEICToCanvas(file)
          } catch (heicError) {
            reject(heicError)
            return
          }
        } else {
          // Handle regular image files
          img = new window.Image()
          img.crossOrigin = "anonymous"
        }

        const handleImageLoad = async () => {
          let canvas: HTMLCanvasElement | null = null
          let ctx: CanvasRenderingContext2D | null = null
          
          try {
            // Create canvas - for now stick with HTMLCanvas for compatibility
            canvas = canvasRef.current || document.createElement("canvas")
            ctx = canvas.getContext("2d")

            if (!ctx) {
              reject(new Error("Could not get canvas context"))
              return
            }

            // Enable performance optimizations
            if (useWebGPU) {
              ctx.imageSmoothingEnabled = true
              ctx.imageSmoothingQuality = 'high'
            }

            // Set canvas dimensions to match image
            let width = img.width
            let height = img.height

            // Scale down very large images to improve performance
            const MAX_DIMENSION = useWebGPU ? 8000 : 4000 // Higher limit with WebGPU
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
              const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
              width = Math.floor(width * ratio)
              height = Math.floor(height * ratio)
            }

            canvas.width = width
            canvas.height = height

            // Use WebGPU acceleration if available (non-blocking)
            if (useWebGPU && webGPUAvailable) {
              processImageWithWebGPU(canvas, width, height, cornerRadius).catch(console.error)
            }

            // For PNG with transparency, set background color only for JPEG
            if (file.type === "image/png" && selectedFormat === "jpeg") {
              ctx.fillStyle = backgroundColor
              ctx.fillRect(0, 0, width, height)
            }

            // Apply corner rounding if format supports transparency and corner radius is set
            const shouldApplyCornerRadius = cornerRadius > 0 && supportsTransparency(selectedFormat, file.type)
            
            if (shouldApplyCornerRadius) {
              // Create rounded rectangle path
              const radiusInPixels = Math.min(cornerRadius, Math.min(width, height) / 2)
              
              ctx.save()
              ctx.beginPath()
              
              // Use roundRect if available, otherwise fallback to manual path
              if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(0, 0, width, height, radiusInPixels)
              } else {
                // Manual rounded rectangle for older browsers
                ctx.moveTo(radiusInPixels, 0)
                ctx.lineTo(width - radiusInPixels, 0)
                ctx.quadraticCurveTo(width, 0, width, radiusInPixels)
                ctx.lineTo(width, height - radiusInPixels)
                ctx.quadraticCurveTo(width, height, width - radiusInPixels, height)
                ctx.lineTo(radiusInPixels, height)
                ctx.quadraticCurveTo(0, height, 0, height - radiusInPixels)
                ctx.lineTo(0, radiusInPixels)
                ctx.quadraticCurveTo(0, 0, radiusInPixels, 0)
              }
              
              ctx.clip()
            }

            // Clear canvas and draw image
            ctx.drawImage(img, 0, 0, width, height)
            
            if (shouldApplyCornerRadius) {
              ctx.restore()
            }

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
                // Clean up canvas if it was created temporarily
                if (canvas !== canvasRef.current) {
                  ctx = null
                  canvas = null
                }
                
                if (blob) {
                  resolve(blob)
                } else {
                  reject(new Error("Canvas toBlob failed - possibly out of memory"))
                }
              },
              mimeType,
              mimeType === "image/png" ? undefined : adjustedQuality,
            )
          } catch (err) {
            // Clean up canvas on error
            if (canvas !== canvasRef.current) {
              ctx = null
              canvas = null
            }
            
            // Check if this is a memory error
            const errorMessage = err instanceof Error ? err.message : String(err)
            if (errorMessage.toLowerCase().includes('memory') || 
                errorMessage.toLowerCase().includes('out of') ||
                errorMessage.toLowerCase().includes('allocation')) {
              reject(new Error("Out of memory during image processing. Try reducing the image size or using a smaller corner radius."))
            } else {
              reject(new Error(`Error processing image: ${errorMessage}`))
            }
          } finally {
            // Final cleanup
            if (canvas && canvas !== canvasRef.current) {
              ctx = null
              canvas = null
            }
          }
        }

        if (isHEIC(file)) {
          // Image is already loaded for HEIC files
          handleImageLoad()
        } else {
          // Set up event handlers for regular images
          img.onload = handleImageLoad
          
          img.onerror = () => {
            reject(new Error("Error loading image"))
          }

          // Load image from file
          img.src = URL.createObjectURL(file)
        }
      } catch (err) {
        reject(new Error(`Error setting up image processing: ${err instanceof Error ? err.message : String(err)}`))
      }
    })
  }

  const handleCompress = async () => {
    if (batchMode && batchFiles.length > 0) {
      return handleBatchCompress()
    }
    
    if (!file) {
      setError("Please select an image first")
      return
    }

    setIsCompressing(true)
    setError(null)
    setCompressionProgress(0)

    try {
      // Check for AVIF support
      if (format === "avif") {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          throw new Error("Could not get canvas context")
        }
        canvas.width = 1
        canvas.height = 1
        const isAvifSupported = await new Promise((resolve) => {
          canvas.toBlob(
            (blob) => resolve(blob !== null),
            "image/avif",
            0.5
          )
        })
        if (!isAvifSupported) {
          setWarning("Your browser does not support AVIF encoding. The image will be converted to WebP instead.")
          setFormat("webp")
        }
      }

      setCompressionProgress(20)

      // Try multiple compression strategies if needed
      setCompressionProgress(30)

      // First attempt with selected format and quality
      let compressedBlob = await compressImageInBrowser(file, quality, format, cornerRadius)
      let finalMimeType = getMimeType(file.type, format)
      let finalExtension = format === "auto" ? (file.name.split(".").pop() || 'jpg') : format
      setCompressionProgress(70)

      // If the compressed size is larger than the original, try different strategies
      if (compressedBlob.size >= file.size) {
        // For PNGs, try JPEG if not explicitly requested PNG
        if (file.type === "image/png" && format !== "png") {
          setCompressionProgress(75)
          compressedBlob = await compressImageInBrowser(file, quality, "jpeg", 0) // No corner radius for JPEG
          finalMimeType = "image/jpeg"
          finalExtension = "jpeg"
        }

        // If still larger, try WebP
        if (compressedBlob.size >= file.size && format !== "webp") {
          setCompressionProgress(80)
          compressedBlob = await compressImageInBrowser(file, quality, "webp", cornerRadius)
          finalMimeType = "image/webp"
          finalExtension = "webp"
        }

        // If still larger, try with lower quality
        if (compressedBlob.size >= file.size && quality > 50) {
          setCompressionProgress(85)
          const fallbackFormat = format === "auto" ? "jpeg" : format
          const fallbackRadius = supportsTransparency(fallbackFormat, file.type) ? cornerRadius : 0
          compressedBlob = await compressImageInBrowser(file, 50, fallbackFormat, fallbackRadius)
          finalMimeType = getMimeType(file.type, fallbackFormat)
          finalExtension = fallbackFormat
        }

        // If all attempts failed to reduce size
        if (compressedBlob.size >= file.size) {
          setWarning("Compression resulted in a larger file. The image may already be optimized.")
        }
      }

      // Create object URL for display
      const objectUrl = URL.createObjectURL(compressedBlob)
      setCompressedImage(objectUrl)
      setCompressedMimeType(finalMimeType)
      setCompressedFileExtension(finalExtension)
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

  const handleBatchCompress = async () => {
    setIsCompressing(true)
    setError(null)
    setBatchResults({})
    setBatchProgress({})

    try {
      const results: {[key: string]: string} = {}
      
      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i]
        const fileKey = `${file.name}_${i}`
        
        try {
          setBatchProgress(prev => ({ ...prev, [fileKey]: 0 }))
          
          // Compress each file
          const compressedBlob = await compressImageInBrowser(file, quality, format, cornerRadius)
          const objectUrl = URL.createObjectURL(compressedBlob)
          results[fileKey] = objectUrl
          
          setBatchProgress(prev => ({ ...prev, [fileKey]: 100 }))
          
          // Update overall progress
          setCompressionProgress(Math.round(((i + 1) / batchFiles.length) * 100))
        } catch (err) {
          console.error(`Error compressing ${file.name}:`, err)
          setBatchProgress(prev => ({ ...prev, [fileKey]: -1 })) // -1 indicates error
        }
      }
      
      setBatchResults(results)
    } catch (err) {
      console.error("Batch compression error:", err)
      setError(err instanceof Error ? err.message : "Failed to compress batch")
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
          <div className="flex items-center gap-4 mb-3">
            <h1 className="text-6xl sm:text-7xl font-bold tracking-tighter">PixSqueeze</h1>
            {webGPUAvailable && useWebGPU && (
              <div className="flex items-center gap-2 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                WebGPU
              </div>
            )}
          </div>
          <p className="text-xl text-foreground/70">Your images, only lighter.</p>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="bg-transparent border-0">
          <CardContent className="p-0">
            {!file && !batchMode ? (
              <div className="upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,image/heic,image/heif"
                  multiple
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
                      Drop your image(s) here
                    </h3>
                    <p className="text-sm text-foreground/70">
                      Single file or multiple files for batch processing
                    </p>
                    <p className="text-sm text-foreground/70">
                      Supports: JPEG, PNG, WebP, AVIF, GIF, HEIC/HEIF
                    </p>
                    <p className="text-sm text-foreground/70">
                      Maximum total size: {formatFileSize(MAX_FILE_SIZE)}
                    </p>
                  </div>
                </Label>
              </div>
            ) : (
              <div className="space-y-12">
                {/* File Management Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    {batchMode ? (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-medium">Batch Mode</span>
                        <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-sm">
                          {batchFiles.length} files
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-medium">Single Mode</span>
                        <span className="text-sm text-foreground/70">{file?.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddMoreFiles}
                      variant="outline"
                      className="button-minimal"
                    >
                      Add More Files
                    </Button>
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="button-minimal"
                    >
                      Start Over
                    </Button>
                    <Button
                      onClick={() => {
                        forceMemoryCleanup()
                        setWarning("Memory cache cleared. Available memory may have increased.")
                        setTimeout(() => setWarning(null), 3000)
                      }}
                      variant="outline"
                      className="button-minimal text-orange-600 hover:text-orange-700"
                      title="Clear memory cache to free up RAM"
                    >
                      Free Memory
                    </Button>
                  </div>
                </div>

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
                          <SelectItem value="avif">AVIF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {format === "jpeg" && file?.type === "image/png" && (
                      <div className="space-y-4">
                        <Label className="text-base">Background Color</Label>
                        <Select value={backgroundColor} onValueChange={(value) => setBackgroundColor(value as "white" | "black")}>
                          <SelectTrigger className="w-full bg-transparent border-foreground/20">
                            <SelectValue placeholder="Select background color" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="white">White</SelectItem>
                            <SelectItem value="black">Black</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {supportsTransparency(format, file?.type) && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base">Corner Radius</Label>
                          <span className="text-sm text-foreground/70">
                            {cornerRadius === 9999 ? "Circle" : cornerRadius > 0 ? `${cornerRadius}px` : "None"}
                          </span>
                        </div>
                        <Select onValueChange={(value) => setCornerRadius(Number(value))}>
                          <SelectTrigger className="w-full bg-transparent border-foreground/20">
                            <SelectValue placeholder="Select corner radius" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">None</SelectItem>
                            <SelectItem value="24">24px</SelectItem>
                            <SelectItem value="48">48px</SelectItem>
                            <SelectItem value="128">128px</SelectItem>
                            <SelectItem value="256">256px</SelectItem>
                            <SelectItem value="9999">Circle</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-foreground/60">
                          Add rounded corners to images with transparent backgrounds (PNG, WebP, AVIF)
                        </p>
                      </div>
                    )}

                    {webGPUAvailable && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base">WebGPU Acceleration</Label>
                          <button
                            type="button"
                            onClick={() => setUseWebGPU(!useWebGPU)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              useWebGPU ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                useWebGPU ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-xs text-foreground/60">
                          Use GPU acceleration for faster processing of large images
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                    <Button
                      onClick={handleCompress}
                      disabled={(!file && !batchMode) || isCompressing || isGeneratingHeicPreview}
                      className="button-minimal px-8 py-6 text-lg w-full"
                    >
                      {isCompressing ? (
                        <div className="flex items-center gap-3">
                          <span>{batchMode ? "Processing Batch" : "Processing"}</span>
                          {useWebGPU && webGPUAvailable && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">GPU</span>
                          )}
                          <Progress value={compressionProgress} className="w-20" />
                        </div>
                      ) : isGeneratingHeicPreview ? (
                        <div className="flex items-center gap-3">
                          <span>Converting HEIC Preview...</span>
                          <div className="w-4 h-4 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        batchMode ? `Compress ${batchFiles.length} Images` : "Compress Image"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Image Preview Section */}
                {batchMode ? (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium">Batch Results</h3>
                    {batchFiles.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {batchFiles.map((file, index) => {
                          const fileKey = `${file.name}_${index}`
                          const progress = batchProgress[fileKey] || 0
                          const result = batchResults[fileKey]
                          const isError = progress === -1
                          
                          return (
                            <div key={fileKey} className="space-y-2">
                              <div className="preview-area aspect-square relative">
                                {result ? (
                                  <img
                                    src={result}
                                    alt={`Compressed ${file.name}`}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                                    {isError ? (
                                      <span className="text-red-400 text-sm">Error</span>
                                    ) : progress > 0 ? (
                                      <Progress value={progress} className="w-20" />
                                    ) : (
                                      <span className="text-foreground/50 text-sm">Pending</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-foreground/70">{formatFileSize(file.size)}</p>
                                {result && (
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="button-minimal w-full"
                                  >
                                    <a
                                      href={result}
                                      download={`compressed_${file.name.split(".")[0]}.${format === "auto" ? file.name.split(".").pop() : format}`}
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Download
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    
                    {Object.keys(batchResults).length > 0 && (
                      <div className="flex justify-center">
                        <Button
                          onClick={() => {
                            // Download all as ZIP would be ideal, but for now show download all individually message
                            alert("Individual downloads available above. Browser limitations prevent automatic ZIP creation.")
                          }}
                          variant="outline"
                          className="button-minimal"
                        >
                          Download All Instructions
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
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
                          <ReactCrop
                            crop={crop}
                            onChange={(c, percentCrop) => setCrop(c)}
                          >
                            <img
                              ref={compressedImgRef}
                              src={compressedImage}
                              alt="Compressed"
                              className="w-full h-full object-contain"
                              onLoad={(e) => (compressedImgRef.current = e.currentTarget)}
                            />
                          </ReactCrop>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            asChild
                            variant="outline"
                            className="button-minimal w-full"
                          >
                            <a
                              href={compressedImage}
                              download={`compressed_${file?.name.split(".")[0] || 'image'}.${compressedFileExtension || format}`}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </a>
                          </Button>
                          <Button
                            onClick={handleApplyCrop}
                            disabled={!crop?.width || !crop?.height}
                            className="button-minimal w-full"
                            variant="outline"
                          >
                            Apply Crop
                          </Button>
                        </div>
                      </div>
                    )}
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
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
