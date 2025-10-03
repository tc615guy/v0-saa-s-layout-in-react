"use client"

import { useState, useEffect } from "react"
import { Search, ChevronDown, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"
import { loadCatalog } from "@/lib/catalog"
import { Template } from "@/lib/types"

console.log("Sidebar component loaded")

const categories = [
  { id: "room", name: "Room Elements", icon: "🏠" },
  { id: "base", name: "Base", icon: "📦" },
  { id: "wall", name: "Wall", icon: "🗄️" },
  { id: "tall", name: "Tall", icon: "🚪" },
  { id: "trim", name: "Trim", icon: "📏" },
  { id: "appliances", name: "Appliances", icon: "🔌" },
]

interface SidebarPaletteProps {
  onAddTemplate?: (template: any) => void
  onWindowPlacement?: (templateId: string) => void
}

export function SidebarPalette({ onAddTemplate, onWindowPlacement }: SidebarPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["room", "base"]))
  
  const { templates, addInstance } = useAppStore()
  
  // Load catalog on component mount
  useEffect(() => {
    loadCatalog().then(templates => {
      useAppStore.getState().initTemplates(templates)
    }).catch(error => {
      console.error("Error loading catalog:", error)
    })
  }, [])

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })
  
  const handleAddTemplate = (template: Template) => {
    console.log("handleAddTemplate called with:", template.id)
    // Add all templates (including windows) directly to canvas
    addInstance(template.id)
    // Call legacy callback if provided
    if (onAddTemplate) {
      onAddTemplate(template)
    }
  }

  return (
    <aside className="w-80 border-r border-border bg-card flex flex-col">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold mb-4">Design Palette</h2>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search elements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="text-xs"
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="text-xs"
            >
              {category.icon} {category.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {categories.map((category) => {
          const categoryTemplates = filteredTemplates.filter((t) => t.category === category.id)
          if (categoryTemplates.length === 0) return null

          const isExpanded = expandedCategories.has(category.id)

          return (
            <div key={category.id} className="space-y-2">
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex items-center gap-2 w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span>{category.icon}</span>
                <span>{category.name}</span>
                <span className="ml-auto text-xs">({categoryTemplates.length})</span>
              </button>

              {isExpanded && (
                <div className="space-y-2 ml-6">
                  {categoryTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="border border-border rounded-lg p-3 bg-secondary hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-sm font-medium text-foreground">{template.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {template.allowedWidthsIn?.join('", "')}" W • {template.defaultHeightIn || template.allowedHeightsIn?.[0] || 'N/A'}" H • {template.depthIn || 'N/A'}" D
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleAddTemplate(template)}
                          className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
