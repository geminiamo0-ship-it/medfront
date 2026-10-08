import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { AmbossImageViewer, type ImageViewerData } from '@/components/media/AmbossImageViewer';
import { rewriteLegacyMediaUrls, rewriteRelativeOfflineMediaUrl } from '@/lib/media';
import { prepareAmbossImageDescription } from './ambossMarkup';
import './styles/amboss.images.css';

const IMAGE_SELECTOR = '.amboss-stem img, .amboss-option-text img, .amboss-option-explanation img, .amboss-hint-copy img';

/** Only normalize imported media URLs; never execute attributes as script or HTML. */
function sourceUrl(source: string): string {
  const normalized = rewriteRelativeOfflineMediaUrl(rewriteLegacyMediaUrls(source.trim()));
  if (!normalized || /^(?:javascript|data|file):/i.test(normalized)) return '';
  try {
    const parsed = new URL(normalized, window.location.href);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
  } catch {
    return '';
  }
}

export function useAmbossExamImages(questionId: number | null, showDescription: boolean) {
  const mediaRootRef = useRef<HTMLElement>(null);
  const [imageViewer, setImageViewer] = useState<ImageViewerData | null>(null);
  const close = useCallback(() => setImageViewer(null), []);

  // Imported rich HTML remains in the sanitizer. Make only its media elements
  // keyboard-operable and handle broken images without modifying source data.
  useEffect(() => {
    setImageViewer(null);
    const root = mediaRootRef.current;
    if (!root) return;

    const decorate = () => {
      root.querySelectorAll<HTMLImageElement>(IMAGE_SELECTOR).forEach((img) => {
        if (img.dataset.examImageReady) return;
        img.dataset.examImageReady = 'true';
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', 'Open image: ' + (img.alt || img.title || 'Medical illustration'));
        img.loading = 'lazy';
        img.addEventListener('error', () => {
          if (img.dataset.examImageFailed) return;
          img.dataset.examImageFailed = 'true';
          img.setAttribute('aria-hidden', 'true');
          img.tabIndex = -1;
          const fallback = document.createElement('span');
          fallback.className = 'amboss-exam-image-fallback';
          fallback.setAttribute('role', 'status');
          fallback.textContent = 'Image unavailable';
          img.insertAdjacentElement('afterend', fallback);
        }, { once:true });
      });
    };
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(root, { childList:true, subtree:true });
    return () => observer.disconnect();
  }, [questionId]);

  const open = useCallback((img: HTMLImageElement) => {
    const imgSrc = sourceUrl(img.getAttribute('src') || img.currentSrc);
    if (!imgSrc || img.dataset.examImageFailed) return;
    const overlaySrc = sourceUrl(img.getAttribute('data-overlay-src') || img.getAttribute('data-overlay') || '');
    const title = img.getAttribute('title') || img.getAttribute('alt') || 'Medical Illustration';
    const desc = img.getAttribute('data-description') || '';
    setImageViewer({
      imgSrc,
      title,
      imgAlt: img.getAttribute('alt') || title,
      descHtml: prepareAmbossImageDescription(desc),
      overlaySrc,
      showOverlay:false,
      zoom:1,
    });
  }, []);

  const handleImageClickCapture = (event: MouseEvent<HTMLElement>): boolean => {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    const img = target.closest<HTMLImageElement>('img');
    if (!img || !img.matches(IMAGE_SELECTOR)) return false;
    event.preventDefault();
    event.stopPropagation();
    open(img);
    return true;
  };

  const handleImageKeyDownCapture = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!(event.target instanceof HTMLImageElement) || !event.target.matches(IMAGE_SELECTOR)) return;
    event.preventDefault();
    event.stopPropagation();
    open(event.target);
  };

  const modal = imageViewer ? (
    <AmbossImageViewer
      data={imageViewer}
      showDescription={showDescription}
      onUpdate={(patch) => setImageViewer((current) => current ? { ...current, ...patch } : current)}
      onClose={close}
    />
  ) : null;

  return { mediaRootRef, handleImageClickCapture, handleImageKeyDownCapture, imageViewer:modal };
}
