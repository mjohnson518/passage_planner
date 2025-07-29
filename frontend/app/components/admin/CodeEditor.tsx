'use client'

import { Card, CardContent } from '../ui/card'

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
}

export default function CodeEditor({ 
  value = '', 
  onChange, 
  language = 'json',
  readOnly = false
}: CodeEditorProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-0">
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          className="w-full h-[400px] p-4 font-mono text-sm bg-muted/20 border-0 resize-none focus:outline-none"
          placeholder={`Enter ${language} code here...`}
        />
      </CardContent>
    </Card>
  )
} 