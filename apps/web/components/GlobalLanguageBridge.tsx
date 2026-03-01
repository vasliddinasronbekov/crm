'use client'

import { useEffect, useRef } from 'react'
import { useSettings } from '@/contexts/SettingsContext'

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION'])
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const
const INPUT_BUTTON_TYPES = new Set(['button', 'submit', 'reset'])

export default function GlobalLanguageBridge() {
  const { language, translateText } = useSettings()
  const textNodeOriginals = useRef<WeakMap<Text, string>>(new WeakMap())
  const attributeOriginals = useRef<WeakMap<Element, Map<string, string>>>(new WeakMap())

  useEffect(() => {
    if (typeof window === 'undefined' || !document.body) return

    const processTextNode = (node: Text) => {
      const parentElement = node.parentElement
      if (!parentElement || SKIP_TAGS.has(parentElement.tagName)) return
      if (parentElement.closest('[data-i18n-skip="true"]')) return

      const currentValue = node.nodeValue ?? ''
      if (!currentValue.trim()) return

      const originalValue = textNodeOriginals.current.get(node) ?? currentValue
      if (!textNodeOriginals.current.has(node)) {
        textNodeOriginals.current.set(node, currentValue)
      }

      const translated = translateText(originalValue)
      if (translated !== currentValue) {
        node.nodeValue = translated
      }
    }

    const processElementAttributes = (element: Element) => {
      if (SKIP_TAGS.has(element.tagName)) return
      if (element.closest('[data-i18n-skip="true"]')) return

      let cachedAttributes = attributeOriginals.current.get(element)
      if (!cachedAttributes) {
        cachedAttributes = new Map<string, string>()
        attributeOriginals.current.set(element, cachedAttributes)
      }

      TRANSLATABLE_ATTRIBUTES.forEach((attrName) => {
        const attrValue = element.getAttribute(attrName)
        if (!attrValue || !attrValue.trim()) return

        const originalValue = cachedAttributes?.get(attrName) ?? attrValue
        if (!cachedAttributes?.has(attrName)) {
          cachedAttributes?.set(attrName, attrValue)
        }

        const translated = translateText(originalValue)
        if (translated !== attrValue) {
          element.setAttribute(attrName, translated)
        }
      })

      if (element instanceof HTMLInputElement && INPUT_BUTTON_TYPES.has((element.type || '').toLowerCase())) {
        const inputValue = element.value
        if (!inputValue || !inputValue.trim()) return

        const cacheKey = 'value'
        const originalValue = cachedAttributes?.get(cacheKey) ?? inputValue
        if (!cachedAttributes?.has(cacheKey)) {
          cachedAttributes?.set(cacheKey, inputValue)
        }

        const translated = translateText(originalValue)
        if (translated !== inputValue) {
          element.value = translated
        }
      }
    }

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        processTextNode(node as Text)
        return
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return
      processElementAttributes(node as Element)

      let child = node.firstChild
      while (child) {
        processNode(child)
        child = child.nextSibling
      }
    }

    processNode(document.body)

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          processTextNode(mutation.target as Text)
          return
        }

        if (mutation.type === 'attributes') {
          processElementAttributes(mutation.target as Element)
          return
        }

        mutation.addedNodes.forEach((addedNode) => {
          processNode(addedNode)
        })
      })
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES, 'value'],
    })

    return () => {
      observer.disconnect()
    }
  }, [language, translateText])

  return null
}
