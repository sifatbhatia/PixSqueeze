"use client"

import React, { useState, useRef } from "react"
import { Upload, Download } from "lucide-react"

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null)
  const [compressedFile, setCompressedFile] = useState<File | null>(null)
  const [quality, setQuality] = useState(80)
  const [format, setFormat] = useState("jpeg")
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setCompressedFile(null)
    }
  }

  const handleCompress = async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)

    // Simulate compression progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 10
      })
    }, 100)

    try {
      // Create canvas for compression
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // Set canvas dimensions
        canvas.width = img.width
        canvas.height = img.height
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0)
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], `compressed_${file.name}`, {
              type: `image/${format}`,
              lastModified: Date.now()
            })
            setCompressedFile(compressedFile)
            setProgress(100)
            setIsProcessing(false)
          }
        }, `image/${format}`, quality / 100)
      }
      
      img.src = URL.createObjectURL(file)
    } catch (error) {
      console.error('Compression failed:', error)
      setIsProcessing(false)
      setProgress(0)
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
          <div 
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Upload size={32} color="rgba(255, 255, 255, 0.7)" />
            <h3>Drop your image here</h3>
            <p>Single file processing</p>
            <p>Supports: JPEG, PNG, WebP</p>
            <p>Maximum size: 10MB</p>
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
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </select>
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
