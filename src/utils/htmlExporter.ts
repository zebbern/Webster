import { ScrapedImage } from './advancedImageScraper'

export const generateHTMLExport = (images: ScrapedImage[], websiteUrl: string): string => {
  // Clean images-only export without any additional text or UI elements
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Images from ${new URL(websiteUrl).hostname}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; }
    .images { display: block; }
    .images img { 
      display: block; 
      width: 100%; 
      height: auto; 
      margin: 0; 
      padding: 0; 
    }
  </style>
</head>
<body>
  <div class="images">
    ${images.map((image) => `<img src="${image.url}" alt="" />`).join('')}
  </div>
</body>
</html>`
}

export const downloadHTMLExport = (images: ScrapedImage[], websiteUrl: string) => {
  const htmlContent = generateHTMLExport(images, websiteUrl)
  const blob = new Blob([htmlContent], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `images-${new URL(websiteUrl).hostname}-${new Date().toISOString().split('T')[0]}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}