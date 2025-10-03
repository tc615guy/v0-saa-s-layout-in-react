"use client"

import { SidebarPalette } from "@/components/sidebar-palette"
import { TopToolbar } from "@/components/top-toolbar"
import { RightPanel } from "@/components/right-panel"
import { CanvasSurface } from "@/components/canvas-surface"
import { Toast } from "@/components/toast"

export default function CabinetDesigner() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <TopToolbar />

      <div className="flex flex-1 overflow-hidden">
        <SidebarPalette />
        <CanvasSurface />
        <RightPanel />
      </div>

    </div>
  )
}
