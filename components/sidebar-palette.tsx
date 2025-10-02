"use client"

import { useState } from "react"
import { Search, ChevronDown, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const categories = [
  { id: "room", name: "Room Elements", icon: "🏠" },
  { id: "base", name: "Base", icon: "📦" },
  { id: "wall", name: "Wall", icon: "🗄️" },
  { id: "tall", name: "Tall", icon: "🚪" },
  { id: "trim", name: "Trim", icon: "📏" },
  { id: "appliances", name: "Appliances", icon: "🔌" },
]

const templates = [
  {
    id: 101,
    title: "Wall Segment",
    category: "room",
    type: "wall",
    description: 'Custom length wall segment (1/8" increments)',
    customizable: true,
  },
  {
    id: 102,
    title: "Single Door",
    category: "room",
    type: "door",
    description: 'Custom width door (1/8" increments)',
    customizable: true,
  },
  {
    id: 103,
    title: "Double Door",
    category: "room",
    type: "door",
    description: 'Custom width double door (1/8" increments)',
    customizable: true,
  },
  {
    id: 104,
    title: "Single Window",
    category: "room",
    type: "window",
    description: 'Custom dimensions window (1/8" increments)',
    customizable: true,
  },
  {
    id: 105,
    title: "Double Window",
    category: "room",
    type: "window",
    description: 'Custom dimensions window (1/8" increments)',
    customizable: true,
  },
  // Base Cabinets - 34.5" H, 24" D, 4.5" toe kick
  {
    id: 1,
    title: "Base 1-Door 1-Drawer (Left)",
    category: "base",
    type: "cabinet",
    subtype: "base",
    description: '12"-24" W • 34.5" H • 24" D • 4.5" toe kick',
    widthRange: { min: 12, max: 24, increment: 3 },
  },
  {
    id: 2,
    title: "Base 1-Door 1-Drawer (Right)",
    category: "base",
    type: "cabinet",
    subtype: "base",
    description: '12"-24" W • 34.5" H • 24" D • 4.5" toe kick',
    widthRange: { min: 12, max: 24, increment: 3 },
  },
  {
    id: 3,
    title: "Base 2-Door 1-Drawer",
    category: "base",
    type: "cabinet",
    subtype: "base",
    description: '24"-36" W • 34.5" H • 24" D • 4.5" toe kick',
    widthRange: { min: 24, max: 36, increment: 3 },
  },
  {
    id: 4,
    title: "Base 2-Door 2-Drawer",
    category: "base",
    type: "cabinet",
    subtype: "base",
    description: '39"-48" W • 34.5" H • 24" D • 4.5" toe kick',
    widthRange: { min: 39, max: 48, increment: 3 },
  },
  {
    id: 5,
    title: "Base Full Height Single Door",
    category: "base",
    type: "cabinet",
    subtype: "base",
    description: '9"-24" W • 34.5" H • 24" D • 4.5" toe kick',
    widthRange: { min: 9, max: 24, increment: 3 },
  },
  {
    id: 6,
    title: "Base Full Height Double Door",
    category: "base",
    type: "cabinet",
    subtype: "base",
    description: '24"-42" W • 34.5" H • 24" D • 4.5" toe kick',
    widthRange: { min: 24, max: 42, increment: 3 },
  },
  // Wall Cabinets - Heights: 30", 36", 42" • Depths: 12", 24"
  {
    id: 7,
    title: "Wall Single Door",
    category: "wall",
    type: "cabinet",
    subtype: "wall",
    description: '12"-36" W • 30"/36"/42" H • 12"/24" D',
    widthRange: { min: 12, max: 36, increment: 3 },
    heights: [30, 36, 42],
    depths: [12, 24],
  },
  {
    id: 8,
    title: "Wall Double Door",
    category: "wall",
    type: "cabinet",
    subtype: "wall",
    description: '24"-36" W • 30"/36"/42" H • 12"/24" D',
    widthRange: { min: 24, max: 36, increment: 3 },
    heights: [30, 36, 42],
    depths: [12, 24],
  },
  // Tall Cabinets - Heights: 84", 90", 96" • Depths: 24", 12"
  {
    id: 9,
    title: "Tall Pantry Cabinet",
    category: "tall",
    type: "cabinet",
    subtype: "tall",
    description: '18"-36" W • 84"/90"/96" H • 24"/12" D',
    widthRange: { min: 18, max: 36, increment: 3 },
    heights: [84, 90, 96],
    depths: [24, 12],
  },
  {
    id: 10,
    title: "Tall Utility Cabinet",
    category: "tall",
    type: "cabinet",
    subtype: "tall",
    description: '18"-36" W • 84"/90"/96" H • 24"/12" D',
    widthRange: { min: 18, max: 36, increment: 3 },
    heights: [84, 90, 96],
    depths: [24, 12],
  },
  {
    id: 16,
    title: "Tall Oven Cabinet",
    category: "tall",
    type: "cabinet",
    subtype: "tall",
    description: '27"-33" W • 84"/90"/96" H • 24" D',
    widthRange: { min: 27, max: 33, increment: 3 },
    heights: [84, 90, 96],
    depths: [24],
  },
  // Trim
  {
    id: 11,
    title: "Crown Molding",
    category: "trim",
    type: "trim",
    description: 'Custom length (1/8" increments)',
    customizable: true,
  },
  {
    id: 12,
    title: "Base Molding",
    category: "trim",
    type: "trim",
    description: 'Custom length (1/8" increments)',
    customizable: true,
  },
  // Appliances
  {
    id: 13,
    title: "Dishwasher Opening",
    category: "appliances",
    type: "appliance",
    description: '24" W standard',
    widthRange: { min: 24, max: 24, increment: 3 },
  },
  {
    id: 14,
    title: "Range Opening",
    category: "appliances",
    type: "appliance",
    description: '30"-36" W (3" increments)',
    widthRange: { min: 30, max: 36, increment: 3 },
  },
  {
    id: 15,
    title: "Refrigerator Opening",
    category: "appliances",
    type: "appliance",
    description: '33"-48" W (3" increments)',
    widthRange: { min: 33, max: 48, increment: 3 },
  },
]

interface SidebarPaletteProps {
  onAddTemplate: (template: any) => void
}

export function SidebarPalette({ onAddTemplate }: SidebarPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["room", "base", "wall"]))

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
                          <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button
                          size="sm"
                          onClick={() => onAddTemplate(template)}
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
