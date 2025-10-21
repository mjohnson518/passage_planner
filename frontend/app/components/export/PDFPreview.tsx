'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { FileText, Download, Eye, X } from 'lucide-react'
import type { Passage } from '@/types/shared'
import { generatePassagePDF } from '../../lib/export/pdf'

interface PDFPreviewProps {
  passage: Passage
  onClose?: () => void
}

export default function PDFPreview({ passage, onClose }: PDFPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => {
    generatePreview()
    
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [passage])

  const generatePreview = async () => {
    try {
      setLoading(true)
      
      const pdf = await generatePassagePDF(passage, {
        includeCharts: false, // Charts will be added separately
        includeWeather: true,
        includeTides: true,
        includeSafety: true
      })
      
      setPageCount(pdf.getNumberOfPages())
      
      // Convert to blob and create URL
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
      
      setLoading(false)
    } catch (error) {
      console.error('Failed to generate PDF preview:', error)
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!pdfUrl) return
    
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `${passage.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_passage_plan.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF Preview
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={!pdfUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {onClose && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-96 w-full" />
            <div className="flex justify-center gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        ) : pdfUrl ? (
          <div className="space-y-4">
            <div className="bg-gray-100 rounded-lg p-4 h-96 overflow-auto">
              <embed
                src={pdfUrl}
                type="application/pdf"
                width="100%"
                height="100%"
                className="rounded"
              />
            </div>
            
            <div className="text-center text-sm text-muted-foreground">
              <p>{pageCount} pages generated</p>
              <p className="mt-1">
                Includes route details, waypoints, weather, tides, and safety information
              </p>
            </div>
            
            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => window.open(pdfUrl, '_blank')}
              >
                <Eye className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to generate PDF preview</p>
            <Button
              variant="outline"
              onClick={generatePreview}
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 