# PixSqueeze
PixSqueeze - Your images, only lighter

## Features

- **Multi-format Support**: Compress images in JPEG, PNG, WebP, AVIF, GIF, and HEIC/HEIF formats
- **Quality Control**: Adjustable compression quality from 1-100%
- **Transparency Preservation**: Maintains transparency in PNG, WebP, and AVIF formats
- **Advanced Corner Rounding**: Add rounded corners up to 1000px for images with transparent backgrounds
- **Batch Processing**: Upload and process multiple images simultaneously
- **Enhanced File Management**: Working "Add More Files" and easy batch expansion
- **HEIC/HEIF Support**: Convert Apple's HEIC/HEIF images to standard web formats
- **Background Color Options**: Choose white or black backgrounds when converting PNG to JPEG
- **WebGPU Acceleration**: Hardware-accelerated processing for faster compression of large images
- **Real-time Preview**: See original and compressed images side by side
- **Size Comparison**: View file sizes and compression percentage
- **Large File Support**: Handle images up to 1GB with optimized processing

## HEIC/HEIF Support

PixSqueeze now has comprehensive support for Apple's HEIC and HEIF image formats:

- **Automatic Detection**: HEIC/HEIF files are automatically detected by both file extension and MIME type
- **Smart Conversion**: Uses the `heic2any` library for reliable cross-browser conversion
- **Dual Processing**: Attempts direct browser loading first, falls back to library conversion
- **Real-time Preview**: HEIC files are converted to JPEG for preview display
- **Format Selection**: Convert HEIC to JPEG, PNG, WebP, or AVIF formats
- **Quality Preservation**: High-quality conversion maintains image fidelity
- **Error Handling**: Informative error messages and graceful fallbacks
- **Batch Support**: Process multiple HEIC files simultaneously with other formats

### HEIC Processing Flow:
1. **Detection**: Files are identified as HEIC/HEIF by extension (.heic, .heif) or MIME type
2. **Preview Generation**: HEIC files are converted to JPEG for browser display
3. **Processing**: Attempts native browser support first, then uses heic2any for conversion
4. **Output**: Converts to your selected format (JPEG default) with chosen quality settings

### HEIC Compatibility:
- **All Browsers**: Works universally through JavaScript conversion
- **Memory Efficient**: Optimized conversion process for large HEIC files
- **High Quality**: Maintains original image quality during conversion
- **Transparent Background**: Can convert to PNG/WebP/AVIF for transparency support

## Enhanced File Management

Improved file management with working "Add More Files" functionality:

- **Working Add More Files**: Fixed implementation that properly adds files to existing batch
- **Smart Batch Expansion**: Automatically converts single-file mode to batch when adding multiple files
- **File Type Validation**: Comprehensive validation including HEIC support
- **Size Management**: Total file size validation across all selected and added files
- **Error Handling**: Graceful handling of file addition errors
- **State Management**: Proper cleanup and state transitions

### How "Add More Files" Works:
1. Upload initial file(s) normally
2. Click "Add More Files" to open a new file picker
3. Select additional files (including HEIC)
4. Files are validated and added to the current batch
5. Existing settings apply to all files in the batch

## Batch Processing

PixSqueeze supports comprehensive batch processing:

- **Multi-Upload**: Select multiple images at once using file picker or drag & drop
- **Automatic Detection**: Single file or batch mode automatically determined by selection
- **File Addition**: Add more files to existing batches with working "Add More Files" button
- **Individual Progress**: Track compression progress for each file independently
- **Grid Display**: Organized grid layout showing all processed images
- **Individual Downloads**: Download each compressed image separately
- **Error Handling**: Graceful handling of individual file processing errors
- **Mixed Format Support**: Process HEIC, JPEG, PNG, WebP, AVIF files together

### Batch Processing Steps:
1. Select multiple files when uploading (Ctrl+click or Shift+click)
2. Use "Add More Files" to expand your batch
3. Configure settings (applied to all images including HEIC conversion)
4. Monitor individual progress in the grid view
5. Download each processed image individually

## Supported Formats

### Input Formats:
- **JPEG/JPG**: Standard web format
- **PNG**: With transparency support
- **WebP**: Modern web format with transparency
- **AVIF**: Next-generation format with transparency
- **GIF**: With transparency (animated GIFs processed as static)
- **HEIC/HEIF**: Apple's high-efficiency formats (converted automatically)

### Output Formats:
- **JPEG**: High compatibility, smaller file sizes
- **PNG**: Transparency support, lossless compression
- **WebP**: Modern format with excellent compression and transparency
- **AVIF**: Next-generation format with superior compression
- **Auto**: Maintains original format (except HEIC → JPEG)

## Corner Rounding Feature

Available for formats that support transparency:
- **PNG**: Full transparency support with rounded corners up to 1000px
- **WebP**: Modern format with transparency and rounded corners  
- **AVIF**: Next-generation format with transparency and rounded corners
- **HEIC → PNG/WebP/AVIF**: HEIC files can be converted to transparent formats with corner rounding

## WebGPU Acceleration

Enhanced performance with WebGPU support:

- **HEIC Processing**: GPU acceleration applies to HEIC conversion
- **Batch Acceleration**: WebGPU benefits apply to batch processing including mixed format batches
- **Enhanced Performance**: Process larger images (up to 8000px) with WebGPU
- **Smart Fallback**: Automatic fallback for browsers without WebGPU support
- **Toggle Control**: Manual WebGPU enable/disable option

## Usage

### Single Image Processing:
1. Upload an image (including HEIC/HEIF) - up to 1GB supported
2. Choose your desired output format
3. Adjust quality and corner radius settings
4. Enable WebGPU for enhanced performance
5. Process and download

### Batch Processing with File Addition:
1. Select multiple images (including mixed formats with HEIC)
2. Click "Add More Files" to expand your batch
3. Configure global settings for all files
4. Process entire batch with "Compress X Images"
5. Download each result individually

## Browser Compatibility

- **HEIC Support**: Works across all modern browsers with automatic conversion
- **File Management**: Enhanced file handling with proper state management
- **WebGPU**: Supported in Chrome 113+, Edge 113+, and Chromium browsers
- **Corner Rounding**: Modern Canvas API with fallback support
- **Large Files**: Optimized for files up to 1GB with smart memory management
- **Cross-Platform**: Windows, macOS, Linux, and mobile device support

## Performance Notes

- **HEIC Files**: Automatic conversion with quality preservation
- **Mixed Batches**: Efficient processing of different format combinations
- **Large File Handling**: Smart scaling and memory management
- **WebGPU Benefits**: GPU acceleration for all supported formats including HEIC
- **Batch Efficiency**: Optimized parallel processing for multi-file workflows
