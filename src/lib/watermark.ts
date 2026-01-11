export interface WatermarkData {
  fullName: string;
  timestamp: Date;
}

export function addWatermarkToImage(
  imageDataUrl: string,
  watermarkData: WatermarkData
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the original image
      ctx.drawImage(img, 0, 0);
      
      // Configure watermark style
      const fontSize = Math.max(14, Math.floor(img.width / 30));
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      
      // Format timestamp
      const formattedDate = watermarkData.timestamp.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const formattedTime = watermarkData.timestamp.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      
      const line1 = watermarkData.fullName;
      const line2 = `${formattedDate} - ${formattedTime}`;
      
      // Measure text
      const line1Width = ctx.measureText(line1).width;
      const line2Width = ctx.measureText(line2).width;
      const maxWidth = Math.max(line1Width, line2Width);
      
      // Position in bottom right corner with padding
      const padding = fontSize;
      const boxPadding = fontSize * 0.5;
      const lineHeight = fontSize * 1.4;
      const boxHeight = lineHeight * 2 + boxPadding * 2;
      const boxWidth = maxWidth + boxPadding * 2;
      
      const boxX = canvas.width - boxWidth - padding;
      const boxY = canvas.height - boxHeight - padding;
      
      // Draw semi-transparent background
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, fontSize * 0.3);
      ctx.fill();
      
      // Draw text
      ctx.fillStyle = "white";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      
      const textX = boxX + boxPadding;
      const textY = boxY + boxPadding;
      
      ctx.fillText(line1, textX, textY);
      ctx.fillText(line2, textX, textY + lineHeight);
      
      // Convert to blob URL
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    
    img.src = imageDataUrl;
  });
}

export function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
}
