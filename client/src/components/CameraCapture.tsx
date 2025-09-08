import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, RotateCcw, Check, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  maxImages?: number;
}

export default function CameraCapture({ 
  isOpen, 
  onClose, 
  onCapture, 
  maxImages = 10 
}: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: facingMode
  };

  const capture = useCallback(() => {
    if (!webcamRef.current) return;
    
    setIsCapturing(true);
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc && capturedImages.length < maxImages) {
        setCapturedImages(prev => [...prev, imageSrc]);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [capturedImages.length, maxImages]);

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const convertToFile = (dataUrl: string, index: number): File => {
    const byteString = atob(dataUrl.split(',')[1]);
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    return new File([ab], `business-card-${index + 1}.jpg`, { type: mimeString });
  };

  const handleDone = () => {
    capturedImages.forEach((imageData, index) => {
      const file = convertToFile(imageData, index);
      onCapture(file);
    });
    
    setCapturedImages([]);
    onClose();
  };

  const handleClose = () => {
    setCapturedImages([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Camera className="h-5 w-5" />
            <span>Capture Business Cards</span>
            <span className="text-sm text-gray-500">
              ({capturedImages.length}/{maxImages})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera View */}
          <Card>
            <CardContent className="p-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full h-64 sm:h-80 object-cover"
                />
                
                {/* Camera Controls Overlay */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={switchCamera}
                    className="bg-white/20 backdrop-blur-sm hover:bg-white/30"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    onClick={capture}
                    disabled={isCapturing || capturedImages.length >= maxImages}
                    className="bg-white text-black hover:bg-gray-100 px-8"
                    size="lg"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    {isCapturing ? 'Capturing...' : 'Capture'}
                  </Button>
                </div>
              </div>
              
              {/* Instructions */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Tips for best results:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Ensure good lighting and avoid shadows</li>
                      <li>• Hold the camera steady and capture the entire card</li>
                      <li>• Make sure text is clearly visible and not blurry</li>
                      <li>• You can capture up to {maxImages} cards</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Captured Images */}
          {capturedImages.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Captured Images ({capturedImages.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {capturedImages.map((imageSrc, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={imageSrc}
                        alt={`Captured business card ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between space-x-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleDone}
              disabled={capturedImages.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Process {capturedImages.length} Image{capturedImages.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}