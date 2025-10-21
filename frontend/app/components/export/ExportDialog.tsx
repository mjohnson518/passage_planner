'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { Checkbox } from '../ui/checkbox'
import { 
  Download, 
  FileCode, 
  Map, 
  FileSpreadsheet,
  FileText,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

// Type inlined from @passage-planner/shared to avoid workspace dependency issues
type Passage = any; // TODO: Import properly after fixing monorepo build

type ExportFormat = 'gpx' | 'kml' | 'csv' | 'pdf'

interface ExportOptions {
  includeWeather?: boolean
  includeTides?: boolean
  includeWaypoints?: boolean
  includePorts?: boolean
  includeSafety?: boolean
  includeNotes?: boolean
  format?: ExportFormat
}
import { downloadGPX } from '../../lib/export/gpx'
import { downloadKML } from '../../lib/export/kml'
import { downloadCSV } from '../../lib/export/csv'
import { downloadPassagePDF } from '../../lib/export/pdf'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  passage: Passage
}

const exportFormats = [
  {
    value: 'gpx' as ExportFormat,
    label: 'GPX',
    description: 'For chartplotters and navigation apps',
    icon: FileCode,
  },
  {
    value: 'kml' as ExportFormat,
    label: 'KML',
    description: 'For Google Earth and marine apps',
    icon: Map,
  },
  {
    value: 'csv' as ExportFormat,
    label: 'CSV',
    description: 'For spreadsheets and analysis',
    icon: FileSpreadsheet,
  },
  {
    value: 'pdf' as ExportFormat,
    label: 'PDF',
    description: 'Printable passage plan with charts',
    icon: FileText,
  },
]

export function ExportDialog({ open, onOpenChange, passage }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('gpx')
  const [options, setOptions] = useState<ExportOptions>({
    format: 'gpx',
    includeWeather: true,
    includeTides: true,
    includeNotes: true,
    includeSafety: true
  })
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    
    try {
      switch (format) {
        case 'gpx':
          downloadGPX(passage)
          toast.success('GPX file downloaded successfully')
          break
          
        case 'kml':
          downloadKML(passage)
          toast.success('KML file downloaded successfully')
          break
          
        case 'csv':
          // Show submenu for CSV options
          const csvType = await showCSVOptions()
          if (csvType) {
            downloadCSV(passage, csvType)
            toast.success('CSV file downloaded successfully')
          }
          break
          
        case 'pdf':
          await downloadPassagePDF(passage, {
            includeCharts: options.includeWeather,
            includeWeather: options.includeWeather,
            includeTides: options.includeTides,
            includeSafety: options.includeSafety
          })
          toast.success('PDF passage plan generated successfully')
          break
      }
      
      onOpenChange(false)
    } catch (error) {
      toast.error('Export failed. Please try again.')
      console.error('Export error:', error)
    } finally {
      setExporting(false)
    }
  }

  const showCSVOptions = (): Promise<'route' | 'weather' | 'tides' | null> => {
    return new Promise((resolve) => {
      // For now, just export route data
      // In a real implementation, show a dialog to choose
      resolve('route')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Passage Plan</DialogTitle>
          <DialogDescription>
            Choose a format to export "{passage.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              {exportFormats.map((fmt) => (
                <div
                  key={fmt.value}
                  className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                  onClick={() => setFormat(fmt.value)}
                >
                  <RadioGroupItem value={fmt.value} id={fmt.value} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <fmt.icon className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={fmt.value} className="font-medium cursor-pointer">
                        {fmt.label}
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {fmt.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Format-specific options */}
          {(format === 'gpx' || format === 'kml') && (
            <div className="space-y-3">
              <Label>Include in Export</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="weather"
                    checked={options.includeWeather}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeWeather: !!checked }))
                    }
                  />
                  <Label htmlFor="weather" className="font-normal cursor-pointer">
                    Weather data
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tides"
                    checked={options.includeTides}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeTides: !!checked }))
                    }
                  />
                  <Label htmlFor="tides" className="font-normal cursor-pointer">
                    Tidal information
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notes"
                    checked={options.includeNotes}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, includeNotes: !!checked }))
                    }
                  />
                  <Label htmlFor="notes" className="font-normal cursor-pointer">
                    Waypoint notes
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* File info */}
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              <strong>File name:</strong> {passage.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_passage.{format}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <strong>Contains:</strong> {passage.waypoints.length + 2} waypoints, {passage.distance.toFixed(1)} nm
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 