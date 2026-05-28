'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QRCodeProps {
  value: string
  size?: number
}

export default function QRCodeComponent({ value, size = 160 }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    })
  }, [value, size])

  return <canvas ref={canvasRef} className="rounded-xl" />
}
