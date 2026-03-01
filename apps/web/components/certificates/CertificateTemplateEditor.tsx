'use client'

import { useState } from 'react'
import { Rnd } from 'react-rnd'

interface LayoutItem {
  x: number
  y: number
  width: number
  height: number
  font_size: number
  font_name: string
  color: string
}

interface LayoutConfig {
  [key: string]: LayoutItem
}

interface CertificateTemplateEditorProps {
  layoutConfig: LayoutConfig
  backgroundImage: File | null
  onLayoutChange: (newLayout: LayoutConfig) => void
}

export default function CertificateTemplateEditor({
  layoutConfig,
  backgroundImage,
  onLayoutChange,
}: CertificateTemplateEditorProps) {
  const [items, setItems] = useState<LayoutConfig>(layoutConfig)

  const handleDragStop = (id: string, d: any) => {
    const newItems = { ...items }
    newItems[id] = { ...newItems[id], x: d.x, y: d.y }
    setItems(newItems)
    onLayoutChange(newItems)
  }

  const handleResizeStop = (id: string, ref: any, position: any) => {
    const newItems = { ...items }
    newItems[id] = {
      ...newItems[id],
      width: ref.style.width,
      height: ref.style.height,
      ...position,
    }
    setItems(newItems)
    onLayoutChange(newItems)
  }

  const backgroundUrl = backgroundImage ? URL.createObjectURL(backgroundImage) : ''

  return (
    <div className="relative" style={{ width: 842, height: 595, backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover' }}>
      {Object.keys(items).map((key) => (
        <Rnd
          key={key}
          size={{ width: items[key].width, height: items[key].height }}
          position={{ x: items[key].x, y: items[key].y }}
          onDragStop={(e, d) => handleDragStop(key, d)}
          onResizeStop={(e, direction, ref, delta, position) => handleResizeStop(key, ref, position)}
          bounds="parent"
        >
          <div
            className="flex items-center justify-center border border-dashed border-gray-500"
            style={{
              width: '100%',
              height: '100%',
              fontSize: items[key].font_size,
              fontFamily: items[key].font_name,
              color: items[key].color,
            }}
          >
            {`{${key}}`}
          </div>
        </Rnd>
      ))}
    </div>
  )
}