'use client';

import React, { useState } from 'react';
import { MessageSquare, X, Send, Camera, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type FeedbackType = 'bug' | 'feature' | 'general';

interface FeedbackFormData {
  type: FeedbackType;
  text: string;
  email: string;
  includeContext: boolean;
}

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { user } = useAuth();

  const [formData, setFormData] = useState<FeedbackFormData>({
    type: 'general',
    text: '',
    email: user?.email || '',
    includeContext: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Capture context
      const context = formData.includeContext ? {
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        browserInfo: {
          language: navigator.language,
          platform: navigator.platform,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        },
        timestamp: new Date().toISOString(),
      } : {};

      // Submit feedback
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback_type: formData.type,
          feedback_text: formData.text,
          contact_email: formData.email,
          ...context,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setIsSubmitted(true);

      // Reset form after 3 seconds
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
        setFormData({
          type: 'general',
          text: '',
          email: user?.email || '',
          includeContext: true,
        });
      }, 3000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating feedback button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Send feedback"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Feedback modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {isSubmitted ? 'Thank You!' : 'Send Feedback'}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Feedback Received
                  </h3>
                  <p className="text-sm text-gray-600">
                    Thank you for helping us improve Helmwise. We review all feedback and will follow up if needed.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Feedback type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What would you like to share?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'bug', label: 'Bug Report' },
                        { value: 'feature', label: 'Feature Idea' },
                        { value: 'general', label: 'General' },
                      ].map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, type: type.value as FeedbackType })}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            formData.type === type.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback text */}
                  <div>
                    <label htmlFor="feedback-text" className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.type === 'bug' && 'Describe the bug'}
                      {formData.type === 'feature' && 'Describe your feature idea'}
                      {formData.type === 'general' && 'Your feedback'}
                    </label>
                    <textarea
                      id="feedback-text"
                      rows={6}
                      required
                      value={formData.text}
                      onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder={
                        formData.type === 'bug'
                          ? 'What happened? What did you expect to happen?'
                          : formData.type === 'feature'
                          ? 'What feature would make Helmwise more useful for you?'
                          : 'Tell us what you think...'
                      }
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email (optional - for follow-up)
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="your@email.com"
                    />
                  </div>

                  {/* Include context */}
                  <div className="flex items-start">
                    <input
                      id="include-context"
                      type="checkbox"
                      checked={formData.includeContext}
                      onChange={(e) => setFormData({ ...formData, includeContext: e.target.checked })}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="include-context" className="ml-2 block text-sm text-gray-700">
                      Include page URL and browser info (helps us debug issues)
                    </label>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.text.trim()}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Feedback
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

