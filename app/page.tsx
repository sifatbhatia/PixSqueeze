"use client"

import React, { useState, useRef } from "react"
import { Upload, Download, AlertCircle } from "lucide-react"

// Constants
const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB
const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null)
  const [compressedFile, setCompressedFile] = useState<File | null>(null)
  const [quality, setQuality] = useState(80)
  const [format, setFormat] = useState("jpeg")
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds maximum limit of ${formatFileSize(MAX_FILE_SIZE)}`
    }

    // Check file type
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
    if (!SUPPORTED_FORMATS.includes(file.type) && !isHeic) {
      return 'Unsupported file format. Please upload JPEG, PNG, WebP, or HEIC files.'
    }

    return null
  }

  const convertHeicToCanvas = async (file: File): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      // Try to use native browser support first
      const img = new Image()
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        canvas.width = img.width
        canvas.height = img.height
        ctx?.drawImage(img, 0, 0)
        
        resolve(canvas)
      }
      
      img.onerror = async () => {
        try {
          // Fallback: Use heic2any library if available
          if (typeof window !== 'undefined' && (window as any).heic2any) {
            const convertedBlob = await (window as any).heic2any({
              blob: file,
              toType: "image/jpeg",
              quality: 1
            })
            
            const convertedImg = new Image()
            convertedImg.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              
              canvas.width = convertedImg.width
              canvas.height = convertedImg.height
              ctx?.drawImage(convertedImg, 0, 0)
              
              resolve(canvas)
            }
            convertedImg.src = URL.createObjectURL(convertedBlob)
          } else {
            reject(new Error('HEIC support not available. Please convert to JPEG/PNG first.'))
          }
        } catch (error) {
          reject(new Error('Failed to convert HEIC file'))
        }
      }
      
      img.src = URL.createObjectURL(file)
    })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      const validationError = validateFile(selectedFile)
      if (validationError) {
        setError(validationError)
        return
      }
      
      setFile(selectedFile)
      setCompressedFile(null)
      setError(null)
    }
  }

  const handleCompress = async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)
    setError(null)

    // Progress simulation
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 10
      })
    }, 150)

    try {
      let canvas: HTMLCanvasElement

      // Check if it's a HEIC file
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
      
      if (isHeic) {
        // Convert HEIC to canvas
        canvas = await convertHeicToCanvas(file)
      } else {
        // Handle regular image files
        canvas = await new Promise((resolve, reject) => {
          const img = new Image()
          
          img.onload = () => {
            const newCanvas = document.createElement('canvas')
            const ctx = newCanvas.getContext('2d')
            
            newCanvas.width = img.width
            newCanvas.height = img.height
            ctx?.drawImage(img, 0, 0)
            
            resolve(newCanvas)
          }
          
          img.onerror = () => reject(new Error('Failed to load image'))
          img.src = URL.createObjectURL(file)
        })
      }

      // Compress the image
      canvas.toBlob((blob) => {
        if (blob) {
          const fileExtension = format === 'jpeg' ? 'jpg' : format
          const originalName = file.name.split('.')[0]
          const compressedFile = new File([blob], `${originalName}_compressed.${fileExtension}`, {
            type: `image/${format}`,
            lastModified: Date.now()
          })
          setCompressedFile(compressedFile)
          setProgress(100)
          setIsProcessing(false)
        } else {
          throw new Error('Compression failed')
        }
      }, `image/${format}`, quality / 100)
      
    } catch (error) {
      console.error('Compression failed:', error)
      setError(error instanceof Error ? error.message : 'Compression failed')
      setIsProcessing(false)
      setProgress(0)
      clearInterval(interval)
    }
  }

  const handleDownload = () => {
    if (!compressedFile) return
    
    const url = URL.createObjectURL(compressedFile)
    const a = document.createElement('a')
    a.href = url
    a.download = compressedFile.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getSizeReduction = () => {
    if (!file || !compressedFile) return 0
    return Math.round(((file.size - compressedFile.size) / file.size) * 100)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="mobile-header">
        <div className="header-content">
          <h1>PixSqueeze</h1>
          <div className="status-badges">
            <div className="status-badge">
              <div style={{ width: '8px', height: '8px', background: '#60a5fa', borderRadius: '50%' }}></div>
              <span>GPU</span>
            </div>
          </div>
        </div>
        <p className="subtitle">Your images, only lighter.</p>
      </header>

      {/* Main Content */}
      <main className="mobile-container">
        {!file ? (
          /* Upload Area */
          <div>
            {error && (
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={20} color="#ef4444" />
                <span style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{error}</span>
              </div>
            )}
            
            <div 
              className="upload-area"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,image/heic,image/heif"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Upload size={32} color="rgba(255, 255, 255, 0.7)" />
              <h3>Drop your image here</h3>
              <p>Single file processing</p>
              <p>Supports: JPEG, PNG, WebP, HEIC/HEIF</p>
              <p>Maximum size: {formatFileSize(MAX_FILE_SIZE)}</p>
            </div>
          </div>
        ) : (
          <div>
            {/* Image Preview */}
            <div className="image-preview">
              <img 
                src={URL.createObjectURL(file)} 
                alt="Original" 
                style={{ maxHeight: '300px', objectFit: 'contain' }}
              />
            </div>

            {/* Controls */}
            <div className="mobile-controls">
              <div className="control-group">
                <div className="control-label">
                  <h4>Quality</h4>
                  <span className="value">{quality}%</span>
                </div>
                <div className="mobile-slider">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="control-group">
                <div className="control-label">
                  <h4>Format</h4>
                </div>
                <select 
                  className="mobile-select"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="jpeg">JPEG (Best compression)</option>
                  <option value="png">PNG (Lossless)</option>
                  <option value="webp">WebP (Modern)</option>
                </select>
                {file?.name.toLowerCase().includes('.heic') && (
                  <p style={{ 
                    fontSize: '0.85rem', 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    marginTop: '8px',
                    lineHeight: '1.4'
                  }}>
                    💡 HEIC files will be converted to your selected format
                  </p>
                )}
              </div>
            </div>

            {/* Progress */}
            {isProcessing && (
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            {/* Stats */}
            {compressedFile && (
              <div className="stats-card">
                <div className="stats-row">
                  <span className="stats-label">Original Size</span>
                  <span className="stats-value">{formatFileSize(file.size)}</span>
                </div>
                <div className="stats-row">
                  <span className="stats-label">Compressed Size</span>
                  <span className="stats-value success">{formatFileSize(compressedFile.size)}</span>
                </div>
                <div className="stats-row">
                  <span className="stats-label">Size Reduction</span>
                  <span className="stats-value success">-{getSizeReduction()}%</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
              {!compressedFile && (
                <button 
                  className="mobile-button"
                  onClick={handleCompress}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Compressing...' : 'Compress Image'}
                </button>
              )}
              
              {compressedFile && (
                <>
                  <button 
                    className="mobile-button"
                    onClick={handleDownload}
                  >
                    <Download size={20} style={{ marginRight: '8px' }} />
                    Download
                  </button>
                  <button 
                    className="mobile-button secondary"
                    onClick={() => {
                      setFile(null)
                      setCompressedFile(null)
                      setProgress(0)
                    }}
                  >
                    New Image
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
