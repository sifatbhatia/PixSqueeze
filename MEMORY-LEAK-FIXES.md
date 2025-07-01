# HEIC Memory Leak Fixes

## Problem
The PixSqueeze app was experiencing memory leaks when converting HEIC files, leading to "out of memory" errors. This was caused by:

1. **Multiple HEIC conversions**: Same file being converted multiple times for preview and processing
2. **Lack of cleanup**: Converted blobs and object URLs not being properly cleaned up
3. **High quality conversions**: Using 0.9 quality created large intermediate objects
4. **No memory management**: No checks for available memory or size limits
5. **Accumulating cache**: HEIC conversions being cached indefinitely

## Solutions Implemented

### 1. **HEIC Conversion Caching**
- Added `heicCacheRef` to cache converted HEIC blobs
- Prevents multiple conversions of the same file
- Automatically limits cache size to 3 entries
- Cache key includes file size, modification date, and quality

### 2. **Memory Monitoring**
- Added `checkMemoryUsage()` function to monitor JavaScript heap usage
- Provides warnings when memory usage exceeds 60% or 80%
- Shows actual memory usage in MB

### 3. **Proactive Memory Cleanup**
- Added `forceMemoryCleanup()` function
- Clears HEIC cache, revokes object URLs, cleans batch results
- Attempts garbage collection if available
- Added "Free Memory" button in UI for manual cleanup

### 4. **Reduced HEIC File Size Limits**
- Reduced max HEIC conversion size from 100MB to 50MB
- Better error messages for oversized files
- Memory checks before starting conversion

### 5. **Improved Error Handling**
- Better detection of memory-related errors
- Specific "out of memory" error messages
- Graceful fallbacks and cleanup on errors

### 6. **Canvas Cleanup**
- Proper cleanup of canvas contexts
- Immediate revocation of temporary object URLs
- Better handling of canvas memory in compression function

### 7. **Quality Optimization**
- Reduced preview quality from 0.8 to 0.5 to save memory
- Processing quality reduced from 0.9 to 0.8
- Variable quality based on use case (preview vs processing)

### 8. **Enhanced Warnings**
- Memory usage warnings for large files
- HEIC-specific memory warnings for files > 50MB
- Real-time memory status in file selection

## Key Functions Added

### `convertHeicToBlob(file, quality)`
- Central HEIC conversion with caching
- Memory checks before conversion
- Automatic cache management
- Better error handling

### `forceMemoryCleanup()`
- Comprehensive cleanup function
- Clears all caches and URLs
- Forces garbage collection when available

### `checkMemoryUsage()`
- Returns memory usage warnings
- Monitors JavaScript heap size
- Provides actionable feedback

## UI Improvements

### Free Memory Button
- Manual memory cleanup option
- Shows confirmation message
- Located next to "Add More Files" and "Start Over"

### Enhanced Warnings
- Memory usage warnings in file selection
- HEIC-specific memory guidance
- Real-time memory status updates

## Technical Details

### Memory Optimization
```javascript
// Before: Multiple conversions
generatePreview() -> heic2any conversion
processImage() -> heic2any conversion (again)

// After: Single conversion with caching
convertHeicToBlob() -> cached result used for both
```

### Cache Management
```javascript
// Automatic cache size limiting
if (heicCacheRef.current.size >= 3) {
  const firstKey = heicCacheRef.current.keys().next().value
  if (firstKey) {
    heicCacheRef.current.delete(firstKey)
  }
}
```

### Memory Checks
```javascript
// Memory availability check
const availableMemory = memInfo.jsHeapSizeLimit - memInfo.usedJSHeapSize
const estimatedNeeded = file.size * 4
if (availableMemory < estimatedNeeded) {
  forceMemoryCleanup()
}
```

## Results

### Before Fixes
- ❌ "Out of memory" errors with large HEIC files
- ❌ Multiple unnecessary conversions
- ❌ Accumulating memory usage
- ❌ No user feedback on memory status

### After Fixes
- ✅ Efficient single-conversion with caching
- ✅ Proactive memory management
- ✅ User-controlled memory cleanup
- ✅ Real-time memory status and warnings
- ✅ Graceful handling of memory limitations
- ✅ Better error messages and guidance

## Usage Recommendations

1. **For Large HEIC Files**: Use the "Free Memory" button before processing
2. **Batch Processing**: Clear cache between large batches
3. **Memory Warnings**: Pay attention to memory usage warnings
4. **File Size**: Keep HEIC files under 50MB for optimal performance
5. **Browser**: Use browsers with sufficient memory allocation

## Browser Support

- ✅ Chrome/Edge: Full memory monitoring support
- ✅ Firefox: Basic memory management
- ✅ Safari: Standard cleanup without memory monitoring
- ✅ All browsers: Improved HEIC conversion with caching
