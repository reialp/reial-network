'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface OnboardingGuideProps {
  userId: string
  forceOpen?: boolean
  onClose?: () => void
}

export default function OnboardingGuide({ userId, forceOpen = false, onClose }: OnboardingGuideProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)
  const supabase = createClient()

  const steps = [
    {
      title: 'Welcome to Cheki',
      description: 'You are now a creator. Here is how to get started.',
    },
    {
      title: 'Upload Your Video',
      description: 'Upload your video to YouTube or Vimeo. Copy the share link and paste it into the upload form.',
      details: [
        'Set your video to "Unlisted" (not Public or Private)',
        'Make sure it is NOT age-restricted',
        'Vimeo is recommended for premium content',
        'Copy the share link and paste it in the "Video Link" field',
      ],
    },
    {
      title: 'Add a Trailer',
      description: 'If you have a trailer, upload it to YouTube or Vimeo. Copy the share link and paste it in the "Trailer Link" field.',
    },
    {
      title: 'Add a Poster',
      description: 'Upload your poster image directly on Cheki. JPEG, PNG, GIF, or WebP up to 5MB.',
      details: [
        'Click the poster upload area on the upload form',
        'Select your image file from your computer',
        'You can change your poster at any time',
        'Use a high-quality image for best results',
      ],
    },
    {
      title: 'Submit for Approval',
      description: 'Once you have filled in all the details, submit your project for approval. Our admin team will review it.',
    },
    {
      title: 'Earn 70% of Every Sale',
      description: 'You keep 70% of every sale. Request payouts once you reach KES 500.',
    },
    {
      title: 'Track Your Performance',
      description: 'Use the dashboard to view your sales, earnings, and audience engagement.',
    },
  ]

  const totalSteps = steps.length

  useEffect(() => {
    const checkFirstVisit = async () => {
      if (forceOpen) {
        setStep(0)
        setIsOpen(true)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_seen')
        .eq('id', userId)
        .single()

      if (data && !data.onboarding_seen) {
        setIsOpen(true)
      }
    }
    checkFirstVisit()
  }, [userId, supabase, forceOpen])

  const handleComplete = async () => {
    await supabase
      .from('profiles')
      .update({ onboarding_seen: true })
      .eq('id', userId)
    setIsOpen(false)
    if (onClose) onClose()
  }

  const nextStep = () => {
    if (step === totalSteps - 1) {
      handleComplete()
    } else {
      setStep(step + 1)
    }
  }

  const prevStep = () => {
    if (step > 0) setStep(step - 1)
  }

  if (!isOpen) return null

  const currentStep = steps[step]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl max-w-lg w-full border border-white/10 shadow-2xl mx-auto">
        <div className="p-4 sm:p-5 md:p-6">
          <div className="text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-1.5 sm:mb-2">
              {currentStep.title}
            </h2>
            
            <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">
              {currentStep.description}
            </p>
            
            {currentStep.details && (
              <div className="text-left space-y-1.5 sm:space-y-2 mb-4 sm:mb-5">
                {currentStep.details.map((detail, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-1.5 sm:gap-2 bg-[#0a0a0a] p-2 sm:p-2.5 md:p-3 rounded-lg border border-white/5"
                  >
                    <span className="text-[#f5c518] text-[10px] sm:text-sm font-medium mt-0.5 flex-shrink-0">
                      {index + 1}.
                    </span>
                    <span className="text-[11px] sm:text-sm text-gray-300 leading-relaxed">
                      {detail}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                    i === step 
                      ? 'w-6 sm:w-8 bg-[#f5c518]' 
                      : 'w-1.5 sm:w-2 bg-gray-600'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2 sm:gap-3">
              {step > 0 && (
                <button
                  onClick={prevStep}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-white/20 rounded-lg text-xs sm:text-sm font-medium hover:bg-white/5 transition"
                >
                  Back
                </button>
              )}
              <button
                onClick={nextStep}
                className={`${
                  step > 0 ? 'flex-1' : 'w-full'
                } px-3 sm:px-4 py-1.5 sm:py-2 bg-[#f5c518] text-black rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#e0b010] transition`}
              >
                {step === totalSteps - 1 ? 'Get Started' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
