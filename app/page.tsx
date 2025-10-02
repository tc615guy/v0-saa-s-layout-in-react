"use client"

import { useState } from "react"
import { SidebarPalette } from "@/components/sidebar-palette"
import { TopToolbar } from "@/components/top-toolbar"
import { RightPanel } from "@/components/right-panel"
import { CanvasSurface } from "@/components/canvas-surface"
import { Toast } from "@/components/toast"

export default function CabinetDesigner() {
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [ceilingHeight, setCeilingHeight] = useState(96)
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  })

  const showToast = (message: string) => {
    setToast({ message, visible: true })
    setTimeout(() => setToast({ message: "", visible: false }), 3000)
  }

  const handleAddTemplate = (template: any) => {
    showToast("Added to canvas")
    console.log("[v0] Template added:", template)
  }

  const handleChangeProperty = (property: string, value: any) => {
    console.log("[v0] Property changed:", property, value)
  }

  const handleToolbarAction = (action: string) => {
    showToast(action)
    console.log("[v0] Toolbar action:", action)
  }

  const handleCeilingHeightChange = (height: number) => {
    setCeilingHeight(height)
    showToast(`Ceiling height set to ${height}"`)
    console.log("[v0] Ceiling height changed:", height)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopToolbar
        onAction={handleToolbarAction}
        ceilingHeight={ceilingHeight}
        onCeilingHeightChange={handleCeilingHeightChange}
      />

      <div className="flex flex-1 overflow-hidden">
        <SidebarPalette onAddTemplate={handleAddTemplate} />

        <CanvasSurface />

        <RightPanel selectedItem={selectedItem} onChangeProperty={handleChangeProperty} />
      </div>

      {toast.visible && <Toast message={toast.message} />}
    </div>
  )
}
