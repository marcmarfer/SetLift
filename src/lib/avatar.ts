const SIZE = 192
const QUALITY = 0.82

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url
  return image
    .decode()
    .then(() => image)
    .finally(() => URL.revokeObjectURL(url))
}

export async function squareAvatar(file: File): Promise<string> {
  const image = await loadImage(file)
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  const left = (image.naturalWidth - side) / 2
  const top = (image.naturalHeight - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')

  context.imageSmoothingQuality = 'high'
  context.drawImage(image, left, top, side, side, 0, 0, SIZE, SIZE)
  return canvas.toDataURL('image/jpeg', QUALITY)
}
