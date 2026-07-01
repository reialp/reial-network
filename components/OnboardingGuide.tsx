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
      title: 'Welcome to Reial Network',
      description: 'You are now a creator. Here is how to get started.',
    },
    {
      title: 'Upload Your Video',
      description: 'Upload your video to YouTube or Vimeo. Copy the share link and paste it into the upload form on Reial Network.',
      details: [
        'YouTube: Set your video to "Unlisted" (not Public or Private)',
        'YouTube: Make sure it is NOT age-restricted (age-restricted videos will not play)',
        'Vimeo: Recommended for premium content with domain-level privacy',
        'After uploading, copy the share link and paste it in the "Video Link" field',
      ],
    },
    {
      title: 'Add a Trailer',
      description: 'If you have a trailer, upload it to YouTube or Vimeo. Copy the share link and paste it in the "Trailer Link" field on the upload form.',
    },
    {
      title: 'Add a Poster',
      description: 'Upload your poster image directly on Reial Network. You can upload a JPEG, PNG, GIF, or WebP file up to 5MB.',
      details: [
        'Click the "Poster Image" upload area on the upload form',
        'Select your image file from your computer',
        'You can change your poster at any time by uploading a new one',
        'The poster should be clear and professional',
        'For best results, use a high-quality image',
      ],
    },
    {
      title: 'Submit for Approval',
      description: 'Once you have filled in all the details, submit your project for approval. Our admin team will review it and approve it if it meets our guidelines.',
    },
    {
      title: 'Earn 85% of Every Sale',
      description: 'You keep 85% of every sale. Request payouts once you reach KES 500.',
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl max-w-lg w-full border border-white/10 shadow-2xl">
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">{currentStep.title}</h2>
            <p className="text-gray-400 text-sm mb-4">{currentStep.description}</p>
            
            {currentStep.details && (
              <div className="text-left space-y-2 mb-6">
                {currentStep.details.map((detail, index) => (
                  <div key={index} className="flex items-start gap-2 bg-[#0a0a0a] p-3 rounded-lg border border-white/5">
                    <span className="text-[#f5c518] text-sm font-medium mt-0.5">{index + 1}.</span>
                    <span className="text-sm text-gray-300">{detail}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-center gap-2 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition ${
                    i === step ? 'w-8 bg-[#f5c518]' : 'w-2 bg-gray-600'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              {step > 0 && (
                <button
                  onClick={prevStep}
                  className="flex-1 px-4 py-2 border border-white/20 rounded-lg text-sm font-medium hover:bg-white/5 transition"
                >
                  Back
                </button>
              )}
              <button
                onClick={nextStep}
                className={`${step > 0 ? 'flex-1' : 'w-full'} px-4 py-2 bg-[#f5c518] text-black rounded-lg text-sm font-semibold hover:bg-[#e0b010] transition`}
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
